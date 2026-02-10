import { NextRequest, NextResponse } from 'next/server';
import * as cheerio from 'cheerio';

/**
 * IceHockeyPro integration API
 *
 * WordPress/WooCommerce site — fully scrapable with Cheerio.
 *
 * Flow:
 * 1. POST ?action=login       → Login to WooCommerce, get session cookies
 * 2. POST ?action=sync        → Scrape order history, match to children
 * 3. POST ?action=camps       → Scrape public youth camps catalog (no auth needed)
 */

const IHP_BASE = 'https://icehockeypro.com';

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
}

// ── Name quality helpers ──────────────────────────────────────────

const GENERIC_WORDS = new Set([
  'camp', 'camps', 'event', 'events', 'class', 'classes', 'product', 'item',
  'session', 'sessions', 'program', 'programs', 'registration', 'ticket',
  'n/a', 'na', 'tbd', 'yes', 'no', 'none', 'other', 'default',
  'true', 'false', '1', '0', 'qty', 'quantity',
]);

/** Check if a string is meaningful (not generic/empty) */
function isMeaningful(s: string): boolean {
  const clean = s.replace(/\s*×\s*\d+$/, '').trim();
  if (clean.length <= 3) return false;
  if (GENERIC_WORDS.has(clean.toLowerCase())) return false;
  // Reject if it's just numbers/punctuation
  if (/^[\d\s.,/$€£]+$/.test(clean)) return false;
  return true;
}

/** Score a candidate camp name — higher is better */
function scoreCampName(value: string, key: string): number {
  const clean = value.replace(/\s*×\s*\d+$/, '').trim();
  if (!isMeaningful(clean)) return 0;

  let score = clean.length; // Longer names score higher (real camp names are descriptive)

  // Boost for keys that suggest this IS the camp name
  const kl = key.toLowerCase();
  if (kl.includes('camp') && !kl.includes('date') && !kl.includes('location')) score += 50;
  if (kl === 'name' || kl === 'camp name' || kl === 'event name' || kl === 'title') score += 60;
  if (kl === 'program' || kl === 'class') score += 40;

  // Boost for hockey-related words in the VALUE
  const vl = clean.toLowerCase();
  const hockeyWords = ['hockey', 'skating', 'skills', 'clinic', 'tournament', 'league', 'goalie', 'power', 'elite', 'development', 'training', 'weekend', 'spring', 'summer', 'winter'];
  for (const word of hockeyWords) {
    if (vl.includes(word)) score += 20;
  }

  // Penalize values that look like locations (CITY, State format)
  if (/^[A-Z\s]+,\s*[A-Za-z\s]+/.test(clean)) score -= 40;

  // Penalize values that look like dates
  if (/(?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d/i.test(clean)) score -= 40;

  // Penalize values that look like prices
  if (/^\$?\d+\.?\d*$/.test(clean)) score -= 100;

  return Math.max(score, 0);
}

// ── Main route handler ────────────────────────────────────────────

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
      { status: 500 }
    );
  }
}

/**
 * Login to WooCommerce — posts to wp-login.php and captures session cookies
 */
async function handleLogin(email: string, password: string) {
  if (!email || !password) {
    return NextResponse.json({ error: 'Email and password required' }, { status: 400 });
  }

  try {
    // WooCommerce login form
    const loginUrl = `${IHP_BASE}/my-account/`;

    const formData = new URLSearchParams();
    formData.set('username', email);
    formData.set('password', password);
    formData.set('login', 'Log in');
    formData.set('woocommerce-login-nonce', ''); // We'll try without nonce first
    formData.set('redirect', `${IHP_BASE}/my-account-2/orders/`);

    // First, fetch the login page to get the nonce
    const loginPageRes = await fetch(loginUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'text/html',
      },
      redirect: 'manual',
    });

    let nonce = '';
    const loginPageHtml = await loginPageRes.text();
    const $loginPage = cheerio.load(loginPageHtml);
    nonce = $loginPage('input[name="woocommerce-login-nonce"]').val() as string || '';

    if (nonce) {
      formData.set('woocommerce-login-nonce', nonce);
    }

    // Extract initial cookies
    const initCookies = (loginPageRes.headers.getSetCookie?.() || [])
      .map((c) => c.split(';')[0])
      .join('; ');

    // Submit login form
    const res = await fetch(loginUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'text/html',
        'Cookie': initCookies,
        'Origin': IHP_BASE,
        'Referer': loginUrl,
      },
      body: formData.toString(),
      redirect: 'manual',
    });

    // WooCommerce redirects on successful login (302)
    const setCookieHeaders = res.headers.getSetCookie?.() || [];
    const allCookies = [...initCookies.split('; ').filter(Boolean)];
    for (const c of setCookieHeaders) {
      const cookiePart = c.split(';')[0];
      if (cookiePart) allCookies.push(cookiePart);
    }
    const cookies = allCookies.join('; ');

    // Check if login was successful (should redirect to orders or my-account)
    const isSuccess = res.status === 302 || res.status === 301;

    if (!isSuccess && res.status !== 200) {
      return NextResponse.json(
        { error: 'Login failed. Check your email and password.' },
        { status: 401 }
      );
    }

    // Verify login by checking if we can access the orders page
    const ordersRes = await fetch(`${IHP_BASE}/my-account-2/orders/`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'text/html',
        'Cookie': cookies,
      },
      redirect: 'follow',
    });

    const ordersHtml = await ordersRes.text();
    const hasOrders = ordersHtml.includes('woocommerce-orders-table') ||
                      ordersHtml.includes('my_account_orders') ||
                      ordersHtml.includes('order-number');

    // If we see a login form instead of orders, login failed
    if (ordersHtml.includes('woocommerce-login-nonce') && !hasOrders) {
      return NextResponse.json(
        { error: 'Login failed. Invalid credentials or the account page structure changed.' },
        { status: 401 }
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
      { error: 'Could not connect to IceHockeyPro. The site may be temporarily unavailable.' },
      { status: 503 }
    );
  }
}

/**
 * Sync — scrape order history and match billing details to children
 */
async function handleSync(sessionCookie: string, linkedChildNames: string[]) {
  const headers: Record<string, string> = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    'Accept': 'text/html',
  };
  if (sessionCookie) {
    headers['Cookie'] = sessionCookie;
  }

  try {
    // Fetch orders list page
    const ordersRes = await fetch(`${IHP_BASE}/my-account-2/orders/`, {
      headers,
      redirect: 'follow',
    });

    if (!ordersRes.ok) {
      return NextResponse.json(
        { error: `Failed to fetch orders: ${ordersRes.status}`, needsReauth: ordersRes.status === 403 },
        { status: ordersRes.status }
      );
    }

    const ordersHtml = await ordersRes.text();
    const $ = cheerio.load(ordersHtml);

    // Check if we're actually logged in
    if (ordersHtml.includes('woocommerce-login-nonce') && !ordersHtml.includes('order-number')) {
      return NextResponse.json(
        { error: 'Session expired. Please reconnect.', needsReauth: true },
        { status: 401 }
      );
    }

    // Find all order "View" links
    const orderLinks: string[] = [];
    $('a.woocommerce-button.view, a.button.view, td.woocommerce-orders-table__cell--order-actions a').each((_, el) => {
      const href = $(el).attr('href');
      if (href) orderLinks.push(href);
    });

    // Also try finding order numbers with links
    $('td.woocommerce-orders-table__cell--order-number a, td.order-number a').each((_, el) => {
      const href = $(el).attr('href');
      if (href && !orderLinks.includes(href)) orderLinks.push(href);
    });

    // Scrape each order detail page
    const orders: ScrapedOrder[] = [];
    const errors: string[] = [];

    for (const link of orderLinks) {
      try {
        const orderRes = await fetch(link, { headers, redirect: 'follow' });
        if (!orderRes.ok) continue;

        const orderHtml = await orderRes.text();
        const $order = cheerio.load(orderHtml);

        // Extract order ID
        const orderId = link.match(/order\/(\d+)/)?.[1] ||
                        link.match(/view-order\/(\d+)/)?.[1] ||
                        $order('.woocommerce-order-data__heading, .order-number').first().text().replace(/[^\d]/g, '') ||
                        `unknown-${orders.length}`;

        // ────────────────────────────────────────────────────────────
        // PRODUCT CELL EXTRACTION — gather ALL possible data sources
        // ────────────────────────────────────────────────────────────
        const $productCell = $order('td.product-name, .woocommerce-table--order-details .product-name').first();

        // Source 1: Product link text (WooCommerce product title)
        const productLinkText = $productCell.find('a').first().text().trim();

        // Source 2: Product link URL slug → e.g. /product/super-skills-weekend/ → "Super Skills Weekend"
        const productHref = $productCell.find('a').first().attr('href') || '';
        const slugMatch = productHref.match(/\/product\/([^/?#]+)/);
        const slugName = slugMatch
          ? decodeURIComponent(slugMatch[1]).replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
          : '';

        // Source 3: ALL variation key/value pairs from EVERY format WooCommerce uses
        const variations: Record<string, string> = {};

        // Format A: <dl class="variation"> with dt/dd pairs
        $productCell.find('dl.variation dt, dl.wc-item-meta dt').each((_, el) => {
          const key = $order(el).text().replace(/[:\s]+$/, '').trim().toLowerCase();
          const val = $order(el).next('dd').text().trim();
          if (key && val) variations[key] = val;
        });

        // Format B: <ul class="wc-item-meta"> with li items
        $productCell.find('.wc-item-meta li, ul.wc-item-meta li').each((_, el) => {
          const label = $order(el).find('strong, .wc-item-meta-label').text().replace(/[:\s]+$/, '').trim().toLowerCase();
          // Get text after the label element
          const fullText = $order(el).text().trim();
          const labelText = $order(el).find('strong, .wc-item-meta-label').text().trim();
          const val = fullText.replace(labelText, '').replace(/^[:\s]+/, '').trim();
          if (label && val) variations[label] = val;
        });

        // Format C: <table class="wc-item-meta"> with tr/td pairs
        $productCell.find('table.wc-item-meta tr').each((_, el) => {
          const key = $order(el).find('td:first-child, th').text().replace(/[:\s]+$/, '').trim().toLowerCase();
          const val = $order(el).find('td:last-child').text().trim();
          if (key && val && key !== val) variations[key] = val;
        });

        // Source 4: Full cell text (for pipe-delimited or newline-delimited content)
        const fullCellText = $productCell.text().trim();

        // Source 5: All text from ALL product cells (some orders have multiple items)
        const allProductTexts: string[] = [];
        $order('td.product-name, .woocommerce-table--order-details .product-name').each((_, el) => {
          allProductTexts.push($order(el).text().trim());
        });

        // ────────────────────────────────────────────────────────────
        // CAMP NAME: Score ALL candidates and pick the best
        // ────────────────────────────────────────────────────────────
        const candidates: { name: string; score: number; source: string }[] = [];

        // Candidate set 1: ALL variation values (scored by key relevance + value quality)
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

        // Candidate set 2: Pipe-parsed name from full cell text
        const pipeParsed = parseCampDescription(fullCellText);
        if (pipeParsed.name && isMeaningful(pipeParsed.name)) {
          candidates.push({
            name: pipeParsed.name.replace(/\s*×\s*\d+$/, '').trim(),
            score: scoreCampName(pipeParsed.name, 'parsed'),
            source: 'pipe-parsed',
          });
        }

        // Candidate set 3: Newline-parsed segments from full cell text
        const lines = fullCellText.split(/\n/).map(l => l.trim()).filter(Boolean);
        for (const line of lines) {
          // Skip lines that start with common labels
          const labelStripped = line.replace(/^(?:camp|camp name|event|location|date|dates|camp location|camp dates|camp date|total|subtotal|price|qty|quantity)\s*:\s*/i, '');
          if (labelStripped !== line && isMeaningful(labelStripped)) {
            // This line had a label prefix — the remaining text might be the camp name
            candidates.push({
              name: labelStripped.replace(/\s*×\s*\d+$/, '').trim(),
              score: scoreCampName(labelStripped, 'label-stripped'),
              source: `line-label: ${line.substring(0, 30)}`,
            });
          }

          // Also try pipe segments within this line
          const segments = line.split('|').map(s => s.trim());
          for (const seg of segments) {
            const cleaned = seg.replace(/\s*×\s*\d+$/, '').trim();
            if (isMeaningful(cleaned)) {
              candidates.push({
                name: cleaned,
                score: scoreCampName(cleaned, 'segment'),
                source: `line-segment: ${cleaned.substring(0, 30)}`,
              });
            }
          }
        }

        // Candidate set 4: Product link text
        if (isMeaningful(productLinkText)) {
          candidates.push({
            name: productLinkText,
            score: scoreCampName(productLinkText, 'product-link') + 5,
            source: 'product-link',
          });
        }

        // Candidate set 5: URL slug
        if (isMeaningful(slugName)) {
          candidates.push({
            name: slugName,
            score: scoreCampName(slugName, 'url-slug'),
            source: 'url-slug',
          });
        }

        // Pick the BEST candidate by score
        candidates.sort((a, b) => b.score - a.score);
        const bestCandidate = candidates.find(c => c.score > 0);
        const scrapedName = bestCandidate
          ? bestCandidate.name
          : `IceHockeyPro Order #${orderId}`;

        // ── Location: check all relevant variation keys ──
        const scrapedLocation = variations['camp location'] || variations['location'] ||
                                variations['venue'] || variations['rink'] ||
                                variations['camplocation1'] || variations['camp location 1'] ||
                                pipeParsed.location || '';

        // ── Dates: check all relevant variation keys ──
        const scrapedDates = variations['camp dates'] || variations['dates'] ||
                             variations['date'] || variations['camp date'] ||
                             variations['campdates1'] || variations['camp dates 1'] ||
                             pipeParsed.dates || '';

        // Get total price
        const totalText = $order('.woocommerce-Price-amount, .order-total .amount, .woocommerce-table--order-details tfoot tr:last-child .amount').last().text().trim();
        const price = parseFloat(totalText.replace(/[^0-9.]/g, '')) || 0;
        const currency = totalText.includes('$') ? 'USD' : totalText.includes('€') ? 'EUR' : 'USD';

        // Billing info
        const billingName = $order('.woocommerce-column--billing-address address, .woocommerce-customer-details address').first().text().trim().split('\n')[0]?.trim() || '';
        const billingAddress = $order('.woocommerce-column--billing-address address, .woocommerce-customer-details address').first().text().trim();

        // Order status
        const status = $order('.woocommerce-order-data mark, .order-status').first().text().trim() || 'completed';

        // Order date
        const orderDate = $order('.woocommerce-order-data__meta time, .order-date time').first().attr('datetime') ||
                          $order('.woocommerce-order-data__meta, .order-date').first().text().match(/\w+ \d+, \d{4}/)?.[0] || '';

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
          // Include debug info so we can diagnose extraction issues
          debug: {
            productLinkText,
            slugName,
            variations,
            candidateCount: candidates.length,
            topCandidates: candidates.slice(0, 5).map(c => ({ name: c.name, score: c.score, source: c.source })),
            fullCellTextPreview: fullCellText.substring(0, 300),
            lineCount: lines.length,
          },
        });
      } catch (err) {
        errors.push(`Failed to scrape order from ${link}: ${err}`);
      }
    }

    // Match orders to linked children
    // Strategy: check billing name, product variations, and last-name overlap
    const matchedOrders = orders.map((order) => {
      const billingLower = order.billingName.toLowerCase();
      // Direct name match (billing includes child name)
      let matchedChild = linkedChildNames.find((name: string) =>
        billingLower.includes(name.toLowerCase())
      );
      // Last-name match: if billing has "Noonan" and child is "Sawyer Noonan"
      if (!matchedChild) {
        const billingParts = billingLower.split(/\s+/);
        const billingLast = billingParts[billingParts.length - 1];
        if (billingLast && billingLast.length > 2) {
          const lastNameMatches = linkedChildNames.filter((name: string) =>
            name.toLowerCase().split(/\s+/).pop() === billingLast
          );
          // If exactly one child shares the last name, assign them
          if (lastNameMatches.length === 1) matchedChild = lastNameMatches[0];
        }
      }
      return {
        ...order,
        matchedChildName: matchedChild || null,
        isMatched: !!matchedChild,
      };
    });

    const matched = matchedOrders.filter((o) => o.isMatched);
    const unmatched = matchedOrders.filter((o) => !o.isMatched);

    return NextResponse.json({
      success: true,
      totalOrders: orders.length,
      matchedOrders: matched,
      unmatchedOrders: unmatched,
      scrapedLinks: orderLinks.length,
      syncedAt: new Date().toISOString(),
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('[IceHockeyPro] Sync error:', error);
    return NextResponse.json(
      { error: 'Failed to scrape IceHockeyPro orders', details: String(error) },
      { status: 500 }
    );
  }
}

/**
 * Scrape public youth camps catalog (no auth needed)
 */
async function handleCamps() {
  try {
    const res = await fetch(`${IHP_BASE}/product-category/youth-camps/`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'text/html',
      },
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `Failed to fetch camps page: ${res.status}` },
        { status: res.status }
      );
    }

    const html = await res.text();
    const $ = cheerio.load(html);

    const camps: ScrapedCamp[] = [];

    // WooCommerce product listing — each product is in a .product or li.product container
    $('li.product, .product-item, .woocommerce ul.products li').each((_, el) => {
      const $el = $(el);
      const name = $el.find('.woocommerce-loop-product__title, h2, .product-title').first().text().trim();
      const url = $el.find('a.woocommerce-LoopProduct-link, a').first().attr('href') || '';
      const priceText = $el.find('.woocommerce-Price-amount, .price .amount').first().text().trim();
      const price = parseFloat(priceText.replace(/[^0-9.]/g, '')) || 0;
      const imageUrl = $el.find('img').first().attr('src') || '';

      // Try to extract location and dates from the title/description
      const desc = $el.find('.short-description, .product-excerpt, p').first().text().trim();
      const parsed = parseCampDescription(name + ' | ' + desc);

      if (name) {
        camps.push({
          name,
          url,
          location: parsed.location || '',
          dates: parsed.dates || '',
          price,
          currency: priceText.includes('$') ? 'USD' : 'USD',
          description: desc,
          imageUrl,
        });
      }
    });

    // If we found product links but not enough details, try scraping individual pages
    const detailedCamps: ScrapedCamp[] = [];
    for (const camp of camps.slice(0, 10)) { // Limit to 10 to avoid rate limiting
      if (camp.url && (!camp.dates || !camp.location)) {
        try {
          const detailRes = await fetch(camp.url, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
              'Accept': 'text/html',
            },
          });
          if (detailRes.ok) {
            const detailHtml = await detailRes.text();
            const $detail = cheerio.load(detailHtml);

            const fullDesc = $detail('.woocommerce-product-details__short-description, .product-short-description, .entry-summary .description').text().trim();
            const longDesc = $detail('.woocommerce-Tabs-panel--description, .product-description').text().trim();
            const combined = `${camp.name} | ${fullDesc} | ${longDesc}`;
            const parsed = parseCampDescription(combined);

            // Get more accurate price
            const detailPrice = $detail('.woocommerce-Price-amount, .price .amount').first().text().trim();
            const priceVal = parseFloat(detailPrice.replace(/[^0-9.]/g, '')) || camp.price;

            detailedCamps.push({
              ...camp,
              description: fullDesc || camp.description,
              location: parsed.location || camp.location,
              dates: parsed.dates || camp.dates,
              price: priceVal,
            });
          } else {
            detailedCamps.push(camp);
          }
        } catch {
          detailedCamps.push(camp);
        }
      } else {
        detailedCamps.push(camp);
      }
    }

    // Add remaining camps that weren't detail-scraped
    for (const camp of camps.slice(10)) {
      detailedCamps.push(camp);
    }

    return NextResponse.json({
      success: true,
      camps: detailedCamps.length > 0 ? detailedCamps : camps,
      totalCamps: (detailedCamps.length > 0 ? detailedCamps : camps).length,
      fetchedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[IceHockeyPro] Camps error:', error);
    return NextResponse.json(
      { error: 'Failed to scrape IceHockeyPro camps', details: String(error) },
      { status: 500 }
    );
  }
}

/**
 * Parse camp description like:
 * "SUPER SKILLS WEEKEND with MAX IVANOV | MIAMI, Florida - USA | February 28 - March 1, 2026"
 */
function parseCampDescription(description: string): { name: string; location: string; dates: string } {
  const parts = description.split('|').map((p) => p.trim());

  let name = parts[0] || '';
  let location = '';
  let dates = '';

  // Look for location-like parts (city, state format)
  for (const part of parts.slice(1)) {
    const locationMatch = part.match(/([A-Z][a-zA-Z\s]+),\s*([A-Za-z\s]+?)(?:\s*-\s*[A-Z]{2,3})?$/);
    if (locationMatch) {
      location = part;
      continue;
    }

    // Look for date-like parts
    const dateMatch = part.match(/(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d/i);
    if (dateMatch) {
      dates = part;
      continue;
    }

    // Also check for "× 1" quantity suffix and strip it
    const cleaned = part.replace(/\s*×\s*\d+$/, '').trim();
    if (cleaned && !location) location = cleaned;
    if (cleaned && !dates && /\d{4}/.test(cleaned)) dates = cleaned;
  }

  // Remove quantity suffix from name
  name = name.replace(/\s*×\s*\d+$/, '').trim();

  return { name, location, dates };
}
