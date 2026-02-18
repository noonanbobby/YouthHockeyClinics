import { NextRequest, NextResponse } from 'next/server';
import * as cheerio from 'cheerio';

const IHP_BASE = 'https://icehockeypro.com';

export async function POST(request: NextRequest) {
  try {
    const { sessionCookie } = await request.json();
    if (!sessionCookie) {
      return NextResponse.json({ error: 'sessionCookie required' }, { status: 400 });
    }

    const headers: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      Accept: 'text/html',
      Cookie: sessionCookie,
    };

    const ordersRes = await fetch(`${IHP_BASE}/my-account-2/orders/`, { headers, redirect: 'follow' });
    const ordersHtml = await ordersRes.text();
    const $ = cheerio.load(ordersHtml);

    const orderLinks: string[] = [];
    $(
      'a.woocommerce-button.view, a.button.view, td.woocommerce-orders-table__cell--order-actions a',
    ).each((_, el) => {
      const href = $(el).attr('href');
      if (href) orderLinks.push(href);
    });
    $('td.woocommerce-orders-table__cell--order-number a, td.order-number a').each((_, el) => {
      const href = $(el).attr('href');
      if (href && !orderLinks.includes(href)) orderLinks.push(href);
    });

    if (orderLinks.length === 0) {
      return NextResponse.json({
        error: 'No order links found',
        ordersPageSnippet: ordersHtml.substring(0, 2000),
        hasLoginForm: ordersHtml.includes('woocommerce-login-nonce'),
        hasOrderTable: ordersHtml.includes('woocommerce-orders-table'),
      });
    }

    const firstLink = orderLinks[0];
    const orderRes = await fetch(firstLink, { headers, redirect: 'follow' });
    const orderHtml = await orderRes.text();
    const $order = cheerio.load(orderHtml);

    const productTableHtml =
      $order('.woocommerce-table--order-details, table.order_details, .shop_table').first().html() ||
      'NOT FOUND';

    const productCells: { index: number; html: string; text: string }[] = [];
    $order('td.product-name, .woocommerce-table--order-details .product-name').each((i, el) => {
      productCells.push({
        index: i,
        html: $order(el).html() || '',
        text: $order(el).text().trim(),
      });
    });

    const variationData: Record<string, string>[] = [];
    $order('td.product-name, .woocommerce-table--order-details .product-name').each((_, el) => {
      const vars: Record<string, string> = {};

      $order(el).find('dl.variation dt, dl.wc-item-meta dt').each((_, dt) => {
        const key = $order(dt).text().replace(/[:\s]+$/, '').trim();
        const val = $order(dt).next('dd').text().trim();
        vars[`dl:${key}`] = val;
      });

      $order(el).find('.wc-item-meta li, ul.wc-item-meta li').each((_, li) => {
        const label = $order(li)
          .find('strong, .wc-item-meta-label')
          .text()
          .replace(/[:\s]+$/, '')
          .trim();
        const fullText = $order(li).text().trim();
        const labelText = $order(li).find('strong, .wc-item-meta-label').text().trim();
        const val = fullText.replace(labelText, '').replace(/^[:\s]+/, '').trim();
        vars[`li:${label}`] = val;
      });

      $order(el).find('table.wc-item-meta tr').each((_, tr) => {
        const key = $order(tr).find('td:first-child, th').text().replace(/[:\s]+$/, '').trim();
        const val = $order(tr).find('td:last-child').text().trim();
        vars[`table:${key}`] = val;
      });

      variationData.push(vars);
    });

    const priceCells: string[] = [];
    $order(
      'td.product-total, .woocommerce-table--order-details .product-total',
    ).each((_, el) => {
      priceCells.push($order(el).text().trim());
    });

    const orderTotal = $order(
      '.woocommerce-table--order-details tfoot tr:last-child .woocommerce-Price-amount, .order-total .amount',
    )
      .last()
      .text()
      .trim();

    return NextResponse.json({
      success: true,
      totalOrderLinks: orderLinks.length,
      firstOrderLink: firstLink,
      productCellCount: productCells.length,
      productCells,
      variationData,
      priceCells,
      orderTotal,
      productTableHtml: productTableHtml.substring(0, 5000),
    });
  } catch (error) {
    return NextResponse.json({ error: 'Debug error', details: String(error) }, { status: 500 });
  }
}
