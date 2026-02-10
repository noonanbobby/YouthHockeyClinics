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

        // Extract order details
        const orderId = link.match(/order\/(\d+)/)?.[1] ||
                        link.match(/view-order\/(\d+)/)?.[1] ||
                        $order('.woocommerce-order-data__heading, .order-number').first().text().replace(/[^\d]/g, '') ||
                        `unknown-${orders.length}`;

        // Description line: "SUPER SKILLS WEEKEND with MAX IVANOV | MIAMI, Florida - USA | February 28 - March 1, 2026 × 1"
        const description = $order('td.product-name, .woocommerce-table--order-details .product-name').first().text().trim();

        // Parse camp info from description
        const parsed = parseCampDescription(description);

        // Get total price
        const totalText = $order('.woocommerce-Price-amount, .order-total .amount, .woocommerce-table--order-details tfoot tr:last-child .amount').last().text().trim();
        const price = parseFloat(totalText.replace(/[^0-9.]/g, '')) || 0;
        const currency = totalText.includes('$') ? 'USD' : totalText.includes('€') ? 'EUR' : 'USD';

        // Get billing name from address section
        const billingName = $order('.woocommerce-column--billing-address address, .woocommerce-customer-details address').first().text().trim().split('\n')[0]?.trim() || '';
        const billingAddress = $order('.woocommerce-column--billing-address address, .woocommerce-customer-details address').first().text().trim();

        // Get order status
        const status = $order('.woocommerce-order-data mark, .order-status').first().text().trim() || 'completed';

        // Get order date
        const orderDate = $order('.woocommerce-order-data__meta time, .order-date time').first().attr('datetime') ||
                          $order('.woocommerce-order-data__meta, .order-date').first().text().match(/\w+ \d+, \d{4}/)?.[0] || '';

        orders.push({
          orderId,
          campName: parsed.name || description.split('|')[0]?.trim() || 'Unknown Camp',
          location: parsed.location || '',
          dates: parsed.dates || '',
          price,
          currency,
          billingName,
          billingAddress,
          status,
          orderDate,
        });
      } catch (err) {
        errors.push(`Failed to scrape order from ${link}: ${err}`);
      }
    }

    // Match orders to linked children by billing name
    const matchedOrders = orders.map((order) => {
      const billingLower = order.billingName.toLowerCase();
      const matchedChild = linkedChildNames.find((name: string) => billingLower.includes(name.toLowerCase()));
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
