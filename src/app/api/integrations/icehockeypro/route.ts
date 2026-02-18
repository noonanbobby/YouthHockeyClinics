import { NextRequest, NextResponse } from 'next/server';
import * as cheerio from 'cheerio';

/**
 * IceHockeyPro integration API
 *
 * WordPress/WooCommerce site — fully scrapable with Cheerio.
 *
 * Actions:
 *   POST ?action=login   → Login to WooCommerce, return session cookies
 *   POST ?action=sync    → Scrape authenticated order history
 *   POST ?action=camps   → Scrape public camp catalog (no auth needed)
 */

const IHP_BASE = 'https://icehockeypro.com';

// All category URLs to scrape for camps (including Max Ivanov)
const CAMP_CATEGORY_URLS = [
  `${IHP_BASE}/product-category/youth-camps/`,
  `${IHP_BASE}/product-category/camps/`,
  `${IHP_BASE}/product-category/hockey-camps/`,
  `${IHP_BASE}/product-category/clinics/`,
  `${IHP_BASE}/product-category/skills-clinics/`,
  `${IHP_BASE}/shop/`,
];

// Direct search URLs for Max Ivanov camps
const MAX_IVANOV_SEARCH_URLS = [
  `${IHP_BASE}/?s=max+ivanov&post_type=product`,
  `${IHP_BASE}/?s=ivanov&post_type=product`,
  `${IHP_BASE}/?s=super+skills&post_type=product`,
];

interface ScrapedOrder {
  orderId: string;
  campName: string;
  location: string;
  dates: string;
  price: number;
  currency: string;
  billingName: string;
  billingAddress: string;
  status: string;
  orderDate: string;
  debug?: Record<string, unknown>;
}

interface ScrapedCamp {
  name: string;
  url: string;
  location: string;
  dates: string;
  price: number;
  currency: string;
  description: string;
  imageUrl: string;
  isMaxIvanov?: boolean;
}

// ── Name quality helpers ──────────────────────────────────────────────

const GENERIC_WORDS = new Set([
  'camp', 'camps', 'event', 'events', 'class', 'classes', 'product', 'item',
  'session', 'sessions', 'program', 'programs', 'registration', 'ticket',
  'n/a', 'na', 'tbd', 'yes', 'no', 'none', 'other', 'default',
  'true', 'false', '1', '0', 'qty', 'quantity',
]);

function isMeaningful(s: string): boolean {
  const clean = s.replace(/\s*×\s*\d+$/, '').trim();
  if (clean.length <= 3) return false;
  if (GENERIC_WORDS.has(clean.toLowerCase())) return false;
  if (/^[\d\s.,/$€£]+$/.test(clean)) return false;
  return true;
}

function scoreCampName(value: string, key: string): number {
  const clean = value.replace(/\s*×\s*\d+$/, '').trim();
  if (!isMeaningful(clean)) return 0;

  // Base score: length (longer = more descriptive)
  let score = clean.length;

  const kl = key.toLowerCase();
  const vl = clean.toLowerCase();

  // Boost for keys that indicate this IS the camp name
  if (kl === 'name' || kl === 'camp name' || kl === 'event name' || kl === 'title') score += 60;
  if (kl === 'program' || kl === 'class') score += 40;
  if (kl.includes('camp') && !kl.includes('date') && !kl.includes('location')) score += 50;

  // Boost for hockey-related words in the value
  const hockeyWords = [
    'hockey', 'skating', 'skills', 'clinic', 'tournament', 'league',
    'goalie', 'power', 'elite', 'development', 'training', 'weekend',
    'spring', 'summer', 'winter', 'ivanov', 'max', 'super',
  ];
  for (const word of hockeyWords) {
    if (vl.includes(word)) score += 20;
  }

  // Large boost for Max Ivanov — his camps are the primary target
  if (vl.includes('ivanov') || vl.includes('max ivanov')) score += 100;

  // Penalize location-like values (CITY, State) that have no hockey words
  if (
    /^[A-Z][a-zA-Z\s]+,\s*[A-Za-z\s]+$/.test(clean) &&
    !hockeyWords.some((w) => vl.includes(w))
  ) {
    score -= 40;
  }

  // Penalize date-like values
  if (
    /(?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d/i.test(
      clean,
    )
  ) {
    score -= 40;
  }

  // Penalize price-like values
  if (/^\$?\d+\.?\d*$/.test(clean)) score -= 100;

  // Do NOT penalize ALL-CAPS — Max Ivanov uses them ("SUPER SKILLS WEEKEND")
  return Math.max(score, 0);
}

// ── Fetch helper with timeout ─────────────────────────────────────────

async function fetchPage(
  url: string,
  extraHeaders: Record<string, string> = {},
  timeoutMs = 10000,
): Promise<{ html: string; ok: boolean; status: number }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
        ...extraHeaders,
      },
      redirect: 'follow',
      signal: controller.signal,
    });
    clearTimeout(timer);
    const html = await res.text();
    return { html, ok: res.ok, status: res.status };
  } catch {
    clearTimeout(timer);
    return { html: '', ok: false, status: 0 };
  }
}

// ── Main route handler ────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const action = request.nextUrl.searchParams.get('action') || 'sync';

  try {
    const body = await request.json();
    const { email, password, sessionCookie, linkedChildNames } = body;

    switch (action) {
      case 'login':
        return handleLogin(email, password);
      case 'sync':
        return handleSync(sessionCookie || '', linkedChildNames || []);
      case 'camps':
        return handleCamps();
      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (error) {
    console.error('[IceHockeyPro] Error:', error);
    return NextResponse.json(
      { error: 'IceHockeyPro integration error', details: String(error) },
      { status: 500 },
    );
  }
}

// ── Login ─────────────────────────────────────────────────────────────

async function handleLogin(email: string, password: string) {
  if (!email || !password) {
    return NextResponse.json({ error: 'Email and password required' }, { status: 400 });
  }

  try {
    const loginUrl = `${IHP_BASE}/my-account/`;

    // Step 1: Fetch login page to get nonce + initial cookies
    const loginPageRes = await fetch(loginUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        Accept: 'text/html',
      },
      redirect: 'manual',
    });

    const loginPageHtml = await loginPageRes.text();
    const $loginPage = cheerio.load(loginPageHtml);
    const nonce =
      ($loginPage('input[name="woocommerce-login-nonce"]').val() as string) || '';

    const initCookies = (loginPageRes.headers.getSetCookie?.() || [])
      .map((c) => c.split(';')[0])
      .join('; ');

    // Step 2: Submit login form
    const formData = new URLSearchParams();
    formData.set('username', email);
    formData.set('password', password);
    formData.set('login', 'Log in');
    formData.set('woocommerce-login-nonce', nonce);
    formData.set('redirect', `${IHP_BASE}/my-account-2/orders/`);

    const res = await fetch(loginUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        Accept: 'text/html',
        Cookie: initCookies,
        Origin: IHP_BASE,
        Referer: loginUrl,
      },
      body: formData.toString(),
      redirect: 'manual',
    });

    // Collect all cookies from the login response
    const setCookieHeaders = res.headers.getSetCookie?.() || [];
    const allCookies = [...initCookies.split('; ').filter(Boolean)];
    for (const c of setCookieHeaders) {
      const cookiePart = c.split(';')[0];
      if (cookiePart) allCookies.push(cookiePart);
    }
    const cookies = allCookies.join('; ');

    if (res.status !== 302 && res.status !== 301 && res.status !== 200) {
      return NextResponse.json(
        { error: 'Login failed. Check your email and password.' },
        { status: 401 },
      );
    }

    // Step 3: Verify by accessing orders page
    const ordersRes = await fetch(`${IHP_BASE}/my-account-2/orders/`, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        Accept: 'text/html',
        Cookie: cookies,
      },
      redirect: 'follow',
    });

    const ordersHtml = await ordersRes.text();
    const hasOrders =
      ordersHtml.includes('woocommerce-orders-table') ||
      ordersHtml.includes('my_account_orders') ||
      ordersHtml.includes('order-number');

    if (ordersHtml.includes('woocommerce-login-nonce') && !hasOrders) {
      return NextResponse.json(
        { error: 'Login failed. Invalid credentials.' },
        { status: 401 },
      );
    }

    return NextResponse.json({ success: true, sessionCookie: cookies, hasOrders });
  } catch (error) {
    console.error('[IceHockeyPro] Login error:', error);
    return NextResponse.json(
      {
        error:
          'Could not connect to IceHockeyPro. The site may be temporarily unavailable.',
      },
      { status: 503 },
    );
  }
}

// ── Sync (authenticated order history) ───────────────────────────────

async function handleSync(sessionCookie: string, linkedChildNames: string[]) {
  const headers: Record<string, string> = {
    'User-Agent':
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    Accept: 'text/html',
  };
  if (sessionCookie) headers['Cookie'] = sessionCookie;

  try {
    const ordersRes = await fetch(`${IHP_BASE}/my-account-2/orders/`, {
      headers,
      redirect: 'follow',
    });

    if (!ordersRes.ok) {
      return NextResponse.json(
        {
          error: `Failed to fetch orders: ${ordersRes.status}`,
          needsReauth: ordersRes.status === 403 || ordersRes.status === 401,
        },
        { status: ordersRes.status },
      );
    }

    const ordersHtml = await ordersRes.text();
    const $ = cheerio.load(ordersHtml);

    if (
      ordersHtml.includes('woocommerce-login-nonce') &&
      !ordersHtml.includes('order-number')
    ) {
      return NextResponse.json(
        { error: 'Session expired. Please reconnect.', needsReauth: true },
        { status: 401 },
      );
    }

    // Collect order detail links
    const orderLinks: string[] = [];
    $(
      'a.woocommerce-button.view, a.button.view, td.woocommerce-orders-table__cell--order-actions a',
    ).each((_, el) => {
      const href = $(el).attr('href');
      if (href && !orderLinks.includes(href)) orderLinks.push(href);
    });
    $(
      'td.woocommerce-orders-table__cell--order-number a, td.order-number a',
    ).each((_, el) => {
      const href = $(el).attr('href');
      if (href && !orderLinks.includes(href)) orderLinks.push(href);
    });

    const orders: ScrapedOrder[] = [];
    const errors: string[] = [];

    for (const link of orderLinks) {
      try {
        const { html: orderHtml, ok } = await fetchPage(link, headers);
        if (!ok) continue;

        const $order = cheerio.load(orderHtml);

        const orderId =
          link.match(/order\/(\d+)/)?.[1] ||
          link.match(/view-order\/(\d+)/)?.[1] ||
          $order('.woocommerce-order-data__heading, .order-number')
            .first()
            .text()
            .replace(/[^\d]/g, '') ||
          `unknown-${orders.length}`;

        const $productCell = $order(
          'td.product-name, .woocommerce-table--order-details .product-name',
        ).first();

        // Product link text + URL slug
        const productLinkText = $productCell.find('a').first().text().trim();
        const productHref = $productCell.find('a').first().attr('href') || '';
        const slugMatch = productHref.match(/\/product\/([^/?#]+)/);
        const slugName = slugMatch
          ? decodeURIComponent(slugMatch[1])
              .replace(/-/g, ' ')
              .replace(/\b\w/g, (c) => c.toUpperCase())
          : '';

        // Variation key/value pairs — all WooCommerce formats
        const variations: Record<string, string> = {};

        $productCell.find('dl.variation dt, dl.wc-item-meta dt').each((_, el) => {
          const key = $order(el).text().replace(/[:\s]+$/, '').trim().toLowerCase();
          const val = $order(el).next('dd').text().trim();
          if (key && val) variations[key] = val;
        });

        $productCell.find('.wc-item-meta li, ul.wc-item-meta li').each((_, el) => {
          const label = $order(el)
            .find('strong, .wc-item-meta-label')
            .text()
            .replace(/[:\s]+$/, '')
            .trim()
            .toLowerCase();
          const fullText = $order(el).text().trim();
          const labelText = $order(el)
            .find('strong, .wc-item-meta-label')
            .text()
            .trim();
          const val = fullText.replace(labelText, '').replace(/^[:\s]+/, '').trim();
          if (label && val) variations[label] = val;
        });

        $productCell.find('table.wc-item-meta tr').each((_, el) => {
          const key = $order(el)
            .find('td:first-child, th')
            .text()
            .replace(/[:\s]+$/, '')
            .trim()
            .toLowerCase();
          const val = $order(el).find('td:last-child').text().trim();
          if (key && val && key !== val) variations[key] = val;
        });

        const fullCellText = $productCell.text().trim();

        // Score all name candidates
        const candidates: { name: string; score: number; source: string }[] = [];

        for (const [key, val] of Object.entries(variations)) {
          const clean = val.replace(/\s*×\s*\d+$/, '').trim();
          if (clean) {
            candidates.push({
              name: clean,
              score: scoreCampName(clean, key),
              source: `variation[${key}]`,
            });
          }
        }

        const pipeParsed = parseCampDescription(fullCellText);
        if (pipeParsed.name && isMeaningful(pipeParsed.name)) {
          candidates.push({
            name: pipeParsed.name.replace(/\s*×\s*\d+$/, '').trim(),
            score: scoreCampName(pipeParsed.name, 'parsed'),
            source: 'pipe-parsed',
          });
        }

        const lines = fullCellText
          .split(/\n/)
          .map((l) => l.trim())
          .filter(Boolean);
        for (const line of lines) {
          const labelStripped = line.replace(
            /^(?:camp|camp name|event|location|date|dates|camp location|camp dates|camp date|total|subtotal|price|qty|quantity)\s*:\s*/i,
            '',
          );
          if (labelStripped !== line && isMeaningful(labelStripped)) {
            candidates.push({
              name: labelStripped.replace(/\s*×\s*\d+$/, '').trim(),
              score: scoreCampName(labelStripped, 'label-stripped'),
              source: 'line-label',
            });
          }
          const segments = line.split('|').map((s) => s.trim());
          for (const seg of segments) {
            const cleaned = seg.replace(/\s*×\s*\d+$/, '').trim();
            if (isMeaningful(cleaned)) {
              candidates.push({
                name: cleaned,
                score: scoreCampName(cleaned, 'segment'),
                source: 'line-segment',
              });
            }
          }
        }

        if (isMeaningful(productLinkText)) {
          candidates.push({
            name: productLinkText,
            score: scoreCampName(productLinkText, 'product-link') + 5,
            source: 'product-link',
          });
        }
        if (isMeaningful(slugName)) {
          candidates.push({
            name: slugName,
            score: scoreCampName(slugName, 'url-slug'),
            source: 'url-slug',
          });
        }

        candidates.sort((a, b) => b.score - a.score);
        const bestCandidate = candidates.find((c) => c.score > 0);
        const scrapedName = bestCandidate
          ? bestCandidate.name
          : `IceHockeyPro Order #${orderId}`;

        const scrapedLocation =
          variations['camp location'] ||
          variations['location'] ||
          variations['venue'] ||
          variations['rink'] ||
          variations['camplocation1'] ||
          variations['camp location 1'] ||
          pipeParsed.location ||
          '';

        const scrapedDates =
          variations['camp dates'] ||
          variations['dates'] ||
          variations['date'] ||
          variations['camp date'] ||
          variations['campdates1'] ||
          variations['camp dates 1'] ||
          pipeParsed.dates ||
          '';

        const itemPriceText = $productCell
          .parent()
          .find(
            'td.product-total .woocommerce-Price-amount, td.product-total .amount',
          )
          .first()
          .text()
          .trim();
        const cellPriceText = $productCell
          .find('.woocommerce-Price-amount, .amount')
          .first()
          .text()
          .trim();
        const orderTotalText = $order(
          '.woocommerce-table--order-details tfoot tr:last-child .woocommerce-Price-amount, .order-total .amount',
        )
          .last()
          .text()
          .trim();
        const priceText = itemPriceText || cellPriceText || orderTotalText;
        const price = parseFloat(priceText.replace(/[^0-9.]/g, '')) || 0;
        const currency = priceText.includes('€') ? 'EUR' : 'USD';

        const billingName =
          $order(
            '.woocommerce-column--billing-address address, .woocommerce-customer-details address',
          )
            .first()
            .text()
            .trim()
            .split('\n')[0]
            ?.trim() || '';
        const billingAddress = $order(
          '.woocommerce-column--billing-address address, .woocommerce-customer-details address',
        )
          .first()
          .text()
          .trim();

        const status =
          $order('.woocommerce-order-data mark, .order-status').first().text().trim() ||
          'completed';
        const orderDate =
          $order('.woocommerce-order-data__meta time, .order-date time')
            .first()
            .attr('datetime') ||
          $order('.woocommerce-order-data__meta, .order-date')
            .first()
            .text()
            .match(/\w+ \d+, \d{4}/)?.[0] ||
          '';

        orders.push({
          orderId,
          campName: scrapedName,
          location: scrapedLocation,
          dates: scrapedDates,
          price,
          currency,
          billingName,
          billingAddress,
          status,
          orderDate,
          debug: {
            productLinkText,
            slugName,
            variations,
            candidateCount: candidates.length,
            topCandidates: candidates
              .slice(0, 5)
              .map((c) => ({ name: c.name, score: c.score, source: c.source })),
            fullCellTextPreview: fullCellText.substring(0, 300),
          },
        });
      } catch (err) {
        errors.push(`Failed to scrape order from ${link}: ${err}`);
      }
    }

    // Match orders to linked children
    const matchedOrders = orders.map((order) => {
      const billingLower = order.billingName.toLowerCase();
      let matchedChild = linkedChildNames.find((name: string) =>
        billingLower.includes(name.toLowerCase()),
      );
      if (!matchedChild) {
        const billingParts = billingLower.split(/\s+/);
        const billingLast = billingParts[billingParts.length - 1];
        if (billingLast && billingLast.length > 2) {
          const lastNameMatches = linkedChildNames.filter(
            (name: string) =>
              name.toLowerCase().split(/\s+/).pop() === billingLast,
          );
          if (lastNameMatches.length === 1) matchedChild = lastNameMatches[0];
        }
      }
      return {
        ...order,
        matchedChildName: matchedChild || null,
        isMatched: !!matchedChild,
      };
    });

    return NextResponse.json({
      success: true,
      totalOrders: orders.length,
      matchedOrders: matchedOrders.filter((o) => o.isMatched),
      unmatchedOrders: matchedOrders.filter((o) => !o.isMatched),
      scrapedLinks: orderLinks.length,
      syncedAt: new Date().toISOString(),
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('[IceHockeyPro] Sync error:', error);
    return NextResponse.json(
      { error: 'Failed to scrape IceHockeyPro orders', details: String(error) },
      { status: 500 },
    );
  }
}

// ── Camps catalog (public, no auth) ──────────────────────────────────

async function handleCamps() {
  try {
    // Scrape all category pages + Max Ivanov search results in parallel
    const urlsToScrape = [...CAMP_CATEGORY_URLS, ...MAX_IVANOV_SEARCH_URLS];

    const pageResults = await Promise.allSettled(
      urlsToScrape.map((url) => fetchPage(url)),
    );

    // Collect unique product URLs and quick camp data across all pages
    const productUrlSet = new Set<string>();
    const quickCamps: ScrapedCamp[] = [];

    for (const result of pageResults) {
      if (result.status !== 'fulfilled' || !result.value.ok) continue;

      const { html } = result.value;
      const $ = cheerio.load(html);

      // WooCommerce product listing
      $('li.product, .product-item, .woocommerce ul.products li').each((_, el) => {
        const $el = $(el);
        const name = $el
          .find('.woocommerce-loop-product__title, h2, .product-title')
          .first()
          .text()
          .trim();
        const url =
          $el.find('a.woocommerce-LoopProduct-link, a').first().attr('href') || '';
        const priceText = $el
          .find('.woocommerce-Price-amount, .price .amount')
          .first()
          .text()
          .trim();
        const price = parseFloat(priceText.replace(/[^0-9.]/g, '')) || 0;
        const imageUrl = $el.find('img').first().attr('src') || '';
        const desc = $el
          .find('.short-description, .product-excerpt, p')
          .first()
          .text()
          .trim();

        if (name && url && !productUrlSet.has(url)) {
          productUrlSet.add(url);
          const nameLower = name.toLowerCase();
          const descLower = desc.toLowerCase();
          const isMaxIvanov =
            nameLower.includes('ivanov') ||
            nameLower.includes('max ivanov') ||
            descLower.includes('ivanov');

          const parsed = parseCampDescription(`${name} | ${desc}`);
          quickCamps.push({
            name,
            url,
            location: parsed.location || '',
            dates: parsed.dates || '',
            price,
            currency: priceText.includes('€') ? 'EUR' : 'USD',
            description: desc,
            imageUrl,
            isMaxIvanov,
          });
        }
      });

      // Also pick up product links from search result pages
      $('a[href*="/product/"]').each((_, el) => {
        const href = $(el).attr('href') || '';
        if (href && !productUrlSet.has(href) && /\/product\/[a-z0-9-]+\/?$/.test(href)) {
          productUrlSet.add(href);
        }
      });
    }

    // Deduplicate by URL
    const uniqueCamps = quickCamps.filter(
      (c, idx, arr) => arr.findIndex((x) => x.url === c.url) === idx,
    );

    // Prioritize Max Ivanov camps + camps missing details for detail scraping
    const needsDetail = uniqueCamps.filter(
      (c) => c.isMaxIvanov || !c.dates || !c.location,
    );
    const alreadyComplete = uniqueCamps.filter(
      (c) => !c.isMaxIvanov && !!c.dates && !!c.location,
    );

    // Scrape detail pages in parallel (cap at 20 to avoid rate limiting)
    const detailLimit = Math.min(needsDetail.length, 20);
    const detailResults = await Promise.allSettled(
      needsDetail.slice(0, detailLimit).map((camp) => scrapeProductDetail(camp)),
    );

    const detailedCamps: ScrapedCamp[] = [];
    for (const result of detailResults) {
      if (result.status === 'fulfilled') {
        detailedCamps.push(result.value);
      }
    }
    // Add any that exceeded the limit without detail scraping
    for (const camp of needsDetail.slice(detailLimit)) {
      detailedCamps.push(camp);
    }

    // Combine: detailed first, then already-complete
    const allCamps = [...detailedCamps, ...alreadyComplete];

    // Sort: Max Ivanov first, then alphabetically
    allCamps.sort((a, b) => {
      if (a.isMaxIvanov && !b.isMaxIvanov) return -1;
      if (!a.isMaxIvanov && b.isMaxIvanov) return 1;
      return a.name.localeCompare(b.name);
    });

    // Prefer 2026 camps; fall back to all if none found
    const camps2026 = allCamps.filter(
      (c) =>
        c.dates.includes('2026') ||
        c.description.includes('2026') ||
        c.name.includes('2026') ||
        !c.dates,
    );
    const finalCamps = camps2026.length > 0 ? camps2026 : allCamps;

    return NextResponse.json({
      success: true,
      camps: finalCamps,
      totalCamps: finalCamps.length,
      maxIvanovCount: finalCamps.filter((c) => c.isMaxIvanov).length,
      fetchedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[IceHockeyPro] Camps error:', error);
    return NextResponse.json(
      { error: 'Failed to scrape IceHockeyPro camps', details: String(error) },
      { status: 500 },
    );
  }
}

// ── Product detail page scraper ───────────────────────────────────────

async function scrapeProductDetail(camp: ScrapedCamp): Promise<ScrapedCamp> {
  if (!camp.url) return camp;

  const { html, ok } = await fetchPage(camp.url);
  if (!ok) return camp;

  const $detail = cheerio.load(html);

  // Product title (may be more complete than listing title)
  const detailTitle =
    $detail('.product_title, h1.entry-title').first().text().trim() || camp.name;

  // Short description (most reliable for camp details on WooCommerce)
  const shortDesc = $detail(
    '.woocommerce-product-details__short-description, .product-short-description, .entry-summary .description',
  )
    .text()
    .trim();

  // Long description
  const longDesc = $detail(
    '.woocommerce-Tabs-panel--description, .product-description, #tab-description',
  )
    .text()
    .trim();

  // Price
  const detailPriceText = $detail('.woocommerce-Price-amount, .price .amount')
    .first()
    .text()
    .trim();
  const detailPrice =
    parseFloat(detailPriceText.replace(/[^0-9.]/g, '')) || camp.price;

  // Image
  const detailImage =
    $detail('.woocommerce-product-gallery__image img, .wp-post-image')
      .first()
      .attr('src') || camp.imageUrl;

  // Parse combined text for location + dates
  const combined = `${detailTitle} | ${shortDesc} | ${longDesc}`;
  const parsed = parseCampDescription(combined);

  // JSON-LD structured data (most reliable when present)
  let jsonLdDates = '';
  let jsonLdLocation = '';
  $detail('script[type="application/ld+json"]').each((_, el) => {
    try {
      const data = JSON.parse($detail(el).html() || '{}');
      // Handle both single object and @graph array
      const items = Array.isArray(data['@graph']) ? data['@graph'] : [data];
      for (const item of items) {
        if (item.startDate && !jsonLdDates) {
          jsonLdDates = item.startDate;
          if (item.endDate) jsonLdDates += ` – ${item.endDate}`;
        }
        if (item.location) {
          if (typeof item.location === 'string' && !jsonLdLocation) {
            jsonLdLocation = item.location;
          } else if (item.location.name && !jsonLdLocation) {
            jsonLdLocation = item.location.name;
          } else if (item.location.address && !jsonLdLocation) {
            const addr = item.location.address;
            jsonLdLocation = [
              addr.streetAddress,
              addr.addressLocality,
              addr.addressRegion,
            ]
              .filter(Boolean)
              .join(', ');
          }
        }
      }
    } catch {
      // Ignore malformed JSON-LD
    }
  });

  const isMaxIvanov =
    camp.isMaxIvanov ||
    combined.toLowerCase().includes('ivanov') ||
    combined.toLowerCase().includes('max ivanov');

  return {
    ...camp,
    name: detailTitle,
    description: shortDesc || camp.description,
    location: jsonLdLocation || parsed.location || camp.location,
    dates: jsonLdDates || parsed.dates || camp.dates,
    price: detailPrice,
    imageUrl: detailImage,
    isMaxIvanov,
  };
}

// ── parseCampDescription ──────────────────────────────────────────────

function parseCampDescription(description: string): {
  name: string;
  location: string;
  dates: string;
} {
  const parts = description.split('|').map((p) => p.trim());

  let name = parts[0] || '';
  let location = '';
  let dates = '';

  for (const part of parts.slice(1)) {
    // Location: "CITY, State" or "City, ST - Country"
    const locationMatch = part.match(
      /([A-Z][a-zA-Z\s]+),\s*([A-Za-z\s]+?)(?:\s*-\s*[A-Z]{2,3})?$/,
    );
    if (locationMatch && !dates) {
      location = location || part;
      continue;
    }

    // Dates: month name + number
    const dateMatch = part.match(
      /(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d/i,
    );
    if (dateMatch) {
      dates = dates || part;
      continue;
    }

    // Year-only date fallback
    if (/\b202[5-9]\b/.test(part) && !dates) {
      dates = part;
    }

    if (!location && part.length > 3) location = part;
  }

  name = name.replace(/\s*×\s*\d+$/, '').trim();

  return { name, location, dates };
}
