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

const CAMP_CATEGORY_URLS = [
  `${IHP_BASE}/product-category/youth-camps/`,
  `${IHP_BASE}/product-category/camps/`,
  `${IHP_BASE}/product-category/hockey-camps/`,
  `${IHP_BASE}/product-category/clinics/`,
  `${IHP_BASE}/product-category/skills-clinics/`,
  `${IHP_BASE}/shop/`,
  `${IHP_BASE}/shop/page/2/`,
  `${IHP_BASE}/shop/page/3/`,
  `${IHP_BASE}/shop/page/4/`,
];

// Search URLs instead of hardcoded product slugs — slugs change yearly
const MAX_IVANOV_SEARCH_URLS = [
  `${IHP_BASE}/?s=max+ivanov`,
  `${IHP_BASE}/?s=ivanov`,
  `${IHP_BASE}/?s=super+skills`,
  `${IHP_BASE}/?s=max+ivanov+2026`,
  `${IHP_BASE}/?s=ivanov+2026`,
  `${IHP_BASE}/?s=skills+camp+2026`,
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

  let score = clean.length;
  const kl = key.toLowerCase();
  const vl = clean.toLowerCase();

  if (kl === 'name' || kl === 'camp name' || kl === 'event name' || kl === 'title') score += 60;
  if (kl === 'program' || kl === 'class') score += 40;
  if (kl.includes('camp') && !kl.includes('date') && !kl.includes('location')) score += 50;

  const hockeyWords = [
    'hockey', 'skating', 'skills', 'clinic', 'tournament', 'league',
    'goalie', 'power', 'elite', 'development', 'training', 'weekend',
    'spring', 'summer', 'winter', 'ivanov', 'max', 'super',
  ];
  for (const word of hockeyWords) {
    if (vl.includes(word)) score += 20;
  }

  if (vl.includes('ivanov') || vl.includes('max ivanov')) score += 100;

  if (
    /^[A-Z][a-zA-Z\s]+,\s*[A-Za-z\s]+$/.test(clean) &&
    !hockeyWords.some((w) => vl.includes(w))
  ) {
    score -= 40;
  }

  if (
    /(?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d/i.test(
      clean,
    )
  ) {
    score -= 40;
  }

  if (/^\$?\d+\.?\d*$/.test(clean)) score -= 100;

  return Math.max(score, 0);
}

// ── Fetch helper with timeout ─────────────────────────────────────────

async function fetchPage(
  url: string,
  extraHeaders: Record<string, string> = {},
  timeoutMs = 15000,
): Promise<{ html: string; ok: boolean; status: number }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache',
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

// ── Safe body parser ──────────────────────────────────────────────────

async function safeParseBody(
  request: NextRequest,
): Promise<Record<string, unknown>> {
  try {
    const text = await request.text();
    if (!text || text.trim() === '') return {};
    return JSON.parse(text);
  } catch {
    return {};
  }
}

// ── Main route handler ────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const action = request.nextUrl.searchParams.get('action') || 'sync';

  try {
    const body = await safeParseBody(request);
    const email = typeof body.email === 'string' ? body.email : '';
    const password = typeof body.password === 'string' ? body.password : '';
    const sessionCookie =
      typeof body.sessionCookie === 'string' ? body.sessionCookie : '';
    const linkedChildNames = Array.isArray(body.linkedChildNames)
      ? (body.linkedChildNames as string[])
      : [];

    switch (action) {
      case 'login':
        return handleLogin(email, password);
      case 'sync':
        return handleSync(sessionCookie, linkedChildNames);
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
    return NextResponse.json(
      { error: 'Email and password required' },
      { status: 400 },
    );
  }

  try {
    const loginUrl = `${IHP_BASE}/my-account/`;

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
      ($loginPage('input[name="woocommerce-login-nonce"]').val() as string) ||
      '';

    const initCookies = (loginPageRes.headers.getSetCookie?.() || [])
      .map((c) => c.split(';')[0])
      .join('; ');

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

    return NextResponse.json({
      success: true,
      sessionCookie: cookies,
      hasOrders,
    });
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

        const productLinkText = $productCell.find('a').first().text().trim();
        const productHref =
          $productCell.find('a').first().attr('href') || '';
        const slugMatch = productHref.match(/\/product\/([^/?#]+)/);
        const slugName = slugMatch
          ? decodeURIComponent(slugMatch[1])
              .replace(/-/g, ' ')
              .replace(/\b\w/g, (c) => c.toUpperCase())
          : '';

        const variations = extractVariations($order, $productCell);
        const fullCellText = $productCell.text().trim();

        const candidates: { name: string; score: number; source: string }[] =
          [];

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
          $order('.woocommerce-order-data mark, .order-status')
            .first()
            .text()
            .trim() || 'completed';
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

    const matchedOrders = orders.map((order) => {
      const billingLower = order.billingName.toLowerCase();
      let matchedChild = linkedChildNames.find((name) =>
        billingLower.includes(name.toLowerCase()),
      );
      if (!matchedChild) {
        const billingParts = billingLower.split(/\s+/);
        const billingLast = billingParts[billingParts.length - 1];
        if (billingLast && billingLast.length > 2) {
          const lastNameMatches = linkedChildNames.filter(
            (name) => name.toLowerCase().split(/\s+/).pop() === billingLast,
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

// ── Variation extractor ───────────────────────────────────────────────

function extractVariations(
  $: ReturnType<typeof cheerio.load>,
  $productCell: ReturnType<ReturnType<typeof cheerio.load>>,
): Record<string, string> {
  const variations: Record<string, string> = {};

  $productCell.find('dl.variation dt, dl.wc-item-meta dt').each((_, el) => {
    const key = $(el).text().replace(/[:\s]+$/, '').trim().toLowerCase();
    const val = $(el).next('dd').text().trim();
    if (key && val) variations[key] = val;
  });

  $productCell.find('.wc-item-meta li, ul.wc-item-meta li').each((_, el) => {
    const label = $(el)
      .find('strong, .wc-item-meta-label')
      .text()
      .replace(/[:\s]+$/, '')
      .trim()
      .toLowerCase();
    const fullText = $(el).text().trim();
    const labelText = $(el).find('strong, .wc-item-meta-label').text().trim();
    const val = fullText.replace(labelText, '').replace(/^[:\s]+/, '').trim();
    if (label && val) variations[label] = val;
  });

  $productCell.find('table.wc-item-meta tr').each((_, el) => {
    const key = $(el)
      .find('td:first-child, th')
      .text()
      .replace(/[:\s]+$/, '')
      .trim()
      .toLowerCase();
    const val = $(el).find('td:last-child').text().trim();
    if (key && val && key !== val) variations[key] = val;
  });

  $productCell.find('p').each((_, el) => {
    const text = $(el).text().trim();
    const match = text.match(/^([^:]{2,40}):\s*(.+)$/);
    if (match) {
      const key = match[1].trim().toLowerCase();
      const val = match[2].trim();
      if (!variations[key] && isMeaningful(val)) {
        variations[key] = val;
      }
    }
  });

  return variations;
}

// ── Camps catalog (public, no auth) ──────────────────────────────────

async function handleCamps() {
  try {
    const urlsToScrape = [...CAMP_CATEGORY_URLS, ...MAX_IVANOV_SEARCH_URLS];

    const pageResults = await Promise.allSettled(
      urlsToScrape.map((url) => fetchPage(url)),
    );

    const productUrlSet = new Set<string>();
    const quickCamps: ScrapedCamp[] = [];

    for (let i = 0; i < pageResults.length; i++) {
      const result = pageResults[i];
      const sourceUrl = urlsToScrape[i];

      if (result.status !== 'fulfilled') continue;
      const { html, ok } = result.value;
      if (!ok || !html) continue;

      const $ = cheerio.load(html);

      if (
        sourceUrl.includes('/product/') &&
        $('body').hasClass('single-product')
      ) {
        const camp = await scrapeProductDetailFromHtml(sourceUrl, html);
        if (camp && !productUrlSet.has(sourceUrl)) {
          productUrlSet.add(sourceUrl);
          quickCamps.push(camp);
        }
        continue;
      }

      $('li.product, .product-item, .woocommerce ul.products li').each(
        (_, el) => {
          const $el = $(el);
          const name = $el
            .find('.woocommerce-loop-product__title, h2, .product-title')
            .first()
            .text()
            .trim();
          const url =
            $el
              .find('a.woocommerce-LoopProduct-link, a')
              .first()
              .attr('href') || '';
          const priceText = $el
            .find('.woocommerce-Price-amount, .price .amount')
            .first()
            .text()
            .trim();
          const price =
            parseFloat(priceText.replace(/[^0-9.]/g, '')) || 0;
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
        },
      );

      $('a[href*="/product/"]').each((_, el) => {
        const href = $(el).attr('href') || '';
        if (
          href &&
          !productUrlSet.has(href) &&
          /\/product\/[a-z0-9-]+\/?(\?.*)?$/.test(href)
        ) {
          productUrlSet.add(href);
          const linkText = $(el).text().trim();
          const isMaxIvanov =
            href.toLowerCase().includes('ivanov') ||
            linkText.toLowerCase().includes('ivanov');
          quickCamps.push({
            name: linkText || href,
            url: href,
            location: '',
            dates: '',
            price: 0,
            currency: 'USD',
            description: '',
            imageUrl: '',
            isMaxIvanov,
          });
        }
      });
    }

    const seen = new Set<string>();
    const uniqueCamps = quickCamps.filter((c) => {
      if (!c.url || seen.has(c.url)) return false;
      seen.add(c.url);
      return true;
    });

    const needsDetail = uniqueCamps.filter(
      (c) => c.isMaxIvanov || !c.dates || !c.location || c.price === 0,
    );
    const alreadyComplete = uniqueCamps.filter(
      (c) => !c.isMaxIvanov && !!c.dates && !!c.location && c.price > 0,
    );

    const detailLimit = Math.min(needsDetail.length, 30);
    const detailResults = await Promise.allSettled(
      needsDetail.slice(0, detailLimit).map((camp) => scrapeProductDetail(camp)),
    );

    const detailedCamps: ScrapedCamp[] = [];
    for (const result of detailResults) {
      if (result.status === 'fulfilled') {
        detailedCamps.push(result.value);
      }
    }
    for (const camp of needsDetail.slice(detailLimit)) {
      detailedCamps.push(camp);
    }

    const allCamps = [...detailedCamps, ...alreadyComplete];

    allCamps.sort((a, b) => {
      if (a.isMaxIvanov && !b.isMaxIvanov) return -1;
      if (!a.isMaxIvanov && b.isMaxIvanov) return 1;
      return a.name.localeCompare(b.name);
    });

    // Only keep camps that explicitly mention 2026 — don't pass through
    // undated camps as "2026" camps
    const camps2026 = allCamps.filter(
      (c) =>
        c.dates.includes('2026') ||
        c.description.includes('2026') ||
        c.name.includes('2026'),
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
  if (!ok || !html) return camp;
  return scrapeProductDetailFromHtml(camp.url, html, camp);
}

async function scrapeProductDetailFromHtml(
  url: string,
  html: string,
  baseCamp?: Partial<ScrapedCamp>,
): Promise<ScrapedCamp> {
  const $detail = cheerio.load(html);

  const detailTitle =
    $detail('.product_title, h1.entry-title, h1.product-title')
      .first()
      .text()
      .trim() ||
    baseCamp?.name ||
    url;

  const shortDesc = $detail(
    '.woocommerce-product-details__short-description, .product-short-description, .entry-summary .description',
  )
    .text()
    .trim();

  const longDesc = $detail(
    '.woocommerce-Tabs-panel--description, .product-description, #tab-description, .entry-content',
  )
    .text()
    .trim();

  const detailPriceText = $detail('.woocommerce-Price-amount, .price .amount')
    .first()
    .text()
    .trim();
  const detailPrice =
    parseFloat(detailPriceText.replace(/[^0-9.]/g, '')) ||
    baseCamp?.price ||
    0;

  const detailImage =
    $detail('.woocommerce-product-gallery__image img, .wp-post-image')
      .first()
      .attr('src') ||
    baseCamp?.imageUrl ||
    '';

  // ── JSON-LD structured data ───────────────────────────────────────────
  let jsonLdDates = '';
  let jsonLdLocation = '';
  $detail('script[type="application/ld+json"]').each((_, el) => {
    try {
      const data = JSON.parse($detail(el).html() || '{}');
      const items = Array.isArray(data['@graph']) ? data['@graph'] : [data];
      for (const item of items) {
        if (item.startDate && !jsonLdDates) {
          jsonLdDates = item.startDate;
          if (item.endDate) jsonLdDates += ` – ${item.endDate}`;
        }
        if (item.location && !jsonLdLocation) {
          if (typeof item.location === 'string') {
            jsonLdLocation = item.location;
          } else if (item.location.name) {
            jsonLdLocation = item.location.name;
          } else if (item.location.address) {
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

  // ── Date regex — supports hyphen, en-dash (–), em-dash (—) ───────────
  let scrapedDates = jsonLdDates;
  if (!scrapedDates) {
    const fullText = `${shortDesc} ${longDesc}`;
    const dateMatch = fullText.match(
      /(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(?:\s*[-\u2013\u2014]\s*\d{1,2})?,?\s*\d{4}/i,
    );
    if (dateMatch) scrapedDates = dateMatch[0];
  }

  // ── Location regex ────────────────────────────────────────────────────
  let scrapedLocation = jsonLdLocation;
  if (!scrapedLocation) {
    const fullText = `${shortDesc} ${longDesc}`;
    const locMatch = fullText.match(
      /\b([A-Z][a-zA-Z\s]{2,}),\s*([A-Z]{2}|[A-Za-z]{4,})\b/,
    );
    if (locMatch) scrapedLocation = locMatch[0];
  }

  // ── WooCommerce product attributes table ──────────────────────────────
  if (!scrapedDates || !scrapedLocation) {
    $detail('.woocommerce-product-attributes tr, .shop_attributes tr').each(
      (_, el) => {
        const label = $detail(el).find('th').text().trim().toLowerCase();
        const val = $detail(el).find('td').text().trim();
        if (!val) return;
        if (!scrapedDates && (label.includes('date') || label.includes('when'))) {
          scrapedDates = val;
        }
        if (
          !scrapedLocation &&
          (label.includes('location') ||
            label.includes('where') ||
            label.includes('venue'))
        ) {
          scrapedLocation = val;
        }
      },
    );
  }

  // ── Variation select options ──────────────────────────────────────────
  if (!scrapedDates) {
    $detail('select.variations option, .variations option').each((_, el) => {
      const optText = $detail(el).text().trim();
      const dateMatch = optText.match(
        /(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(?:\s*[-\u2013\u2014]\s*\d{1,2})?,?\s*\d{4}/i,
      );
      if (dateMatch && !scrapedDates) scrapedDates = dateMatch[0];
    });
  }

  const combined = `${detailTitle} | ${shortDesc} | ${longDesc}`;
  const parsed = parseCampDescription(combined);

  const isMaxIvanov =
    baseCamp?.isMaxIvanov ||
    combined.toLowerCase().includes('ivanov') ||
    combined.toLowerCase().includes('max ivanov');

  return {
    name: detailTitle,
    url,
    description: shortDesc || baseCamp?.description || '',
    location: scrapedLocation || parsed.location || baseCamp?.location || '',
    dates: scrapedDates || parsed.dates || baseCamp?.dates || '',
    price: detailPrice,
    currency: detailPriceText.includes('€') ? 'EUR' : 'USD',
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
    if (!part) continue;

    const dateMatch = part.match(
      /(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d/i,
    );
    if (dateMatch) {
      dates = dates || part;
      continue;
    }

    if (/\b202[5-9]\b/.test(part) && !dates) {
      dates = part;
      continue;
    }

    const locationMatch = part.match(
      /^[A-Z][a-zA-Z\s]{2,},\s*(?:[A-Z]{2}|[A-Za-z]{4,})$/,
    );
    if (locationMatch) {
      location = location || part;
      continue;
    }

    if (!location && part.length > 3 && !dates) location = part;
  }

  name = name.replace(/\s*×\s*\d+$/, '').trim();

  return { name, location, dates };
}
