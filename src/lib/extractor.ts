/**
 * Intelligent HTML Data Extractor
 *
 * This module parses raw HTML from hockey organization websites
 * and extracts structured clinic/camp data using multiple strategies:
 *
 * 1. Schema.org / JSON-LD structured data
 * 2. Open Graph / meta tag extraction
 * 3. Semantic HTML analysis (event listings, cards, tables)
 * 4. Pattern matching for dates, prices, locations
 * 5. NLP-style heuristic extraction
 */

import * as cheerio from 'cheerio';
import { RawClinicData } from './searchEngine';

/**
 * Main extraction function - tries multiple strategies
 */
export function extractClinicsFromHTML(
  html: string,
  sourceUrl: string,
  sourceName: string
): RawClinicData[] {
  const $ = cheerio.load(html);
  const results: RawClinicData[] = [];

  // Strategy 1: JSON-LD structured data
  results.push(...extractFromJsonLd($, sourceUrl, sourceName));

  // Strategy 2: Open Graph and meta tags
  const ogData = extractFromMetaTags($, sourceUrl, sourceName);
  if (ogData) results.push(ogData);

  // Strategy 3: Event listing patterns (cards, list items, etc.)
  results.push(...extractFromEventListings($, sourceUrl, sourceName));

  // Strategy 4: Table-based listings
  results.push(...extractFromTables($, sourceUrl, sourceName));

  // Strategy 5: Generic content extraction as fallback
  if (results.length === 0) {
    const generic = extractGenericContent($, sourceUrl, sourceName);
    if (generic) results.push(generic);
  }

  // Filter out low-confidence duplicates within same page
  return deduplicatePageResults(results);
}

/**
 * Strategy 1: Extract from JSON-LD structured data
 * Many modern event websites embed schema.org Event data
 */
function extractFromJsonLd(
  $: cheerio.CheerioAPI,
  sourceUrl: string,
  sourceName: string
): RawClinicData[] {
  const results: RawClinicData[] = [];

  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const jsonText = $(el).html();
      if (!jsonText) return;

      let data = JSON.parse(jsonText);

      // Handle @graph arrays
      if (data['@graph']) data = data['@graph'];
      if (!Array.isArray(data)) data = [data];

      for (const item of data) {
        if (
          item['@type'] === 'Event' ||
          item['@type'] === 'SportsEvent' ||
          item['@type']?.includes?.('Event')
        ) {
          const nameText = item.name || item.headline || '';
          if (!isHockeyRelated(nameText + ' ' + (item.description || ''))) continue;

          results.push({
            source: sourceName,
            sourceUrl,
            name: nameText,
            description: item.description?.substring(0, 500),
            venue: item.location?.name,
            location: formatAddress(item.location?.address),
            city: item.location?.address?.addressLocality,
            state: item.location?.address?.addressRegion,
            country: item.location?.address?.addressCountry,
            startDate: item.startDate,
            endDate: item.endDate,
            imageUrl: typeof item.image === 'string' ? item.image : item.image?.url,
            websiteUrl: item.url || sourceUrl,
            registrationUrl: item.url || sourceUrl,
            price: item.offers?.price?.toString(),
            priceAmount: parseFloat(item.offers?.price) || undefined,
            currency: item.offers?.priceCurrency,
            confidence: 0.9,
          });
        }
      }
    } catch {
      // Invalid JSON-LD, skip
    }
  });

  return results;
}

/**
 * Strategy 2: Extract from Open Graph and meta tags
 */
function extractFromMetaTags(
  $: cheerio.CheerioAPI,
  sourceUrl: string,
  sourceName: string
): RawClinicData | null {
  const ogTitle = $('meta[property="og:title"]').attr('content');
  const ogDesc = $('meta[property="og:description"]').attr('content');
  const ogImage = $('meta[property="og:image"]').attr('content');
  const title = $('title').text().trim();
  const metaDesc = $('meta[name="description"]').attr('content');

  const name = ogTitle || title;
  const description = ogDesc || metaDesc || '';

  if (!isHockeyRelated(name + ' ' + description)) return null;

  // Look for date patterns in the page
  const pageText = $('body').text();
  const dates = extractDatesFromText(pageText);
  const prices = extractPricesFromText(pageText);
  const emails = extractEmailsFromText(pageText);
  const phones = extractPhonesFromText(pageText);

  return {
    source: sourceName,
    sourceUrl,
    name: cleanText(name),
    description: cleanText(description).substring(0, 500),
    imageUrl: ogImage || $('meta[property="og:image:secure_url"]').attr('content'),
    dateText: dates.length > 0 ? dates[0] : undefined,
    price: prices.length > 0 ? prices[0] : undefined,
    contactEmail: emails.length > 0 ? emails[0] : undefined,
    contactPhone: phones.length > 0 ? phones[0] : undefined,
    websiteUrl: sourceUrl,
    registrationUrl: sourceUrl,
    confidence: 0.5,
  };
}

/**
 * Strategy 3: Extract from event listing patterns
 * Looks for common card/list layouts used by event sites
 */
function extractFromEventListings(
  $: cheerio.CheerioAPI,
  sourceUrl: string,
  sourceName: string
): RawClinicData[] {
  const results: RawClinicData[] = [];

  // Common selectors for event cards/listings
  const eventSelectors = [
    // Generic event card patterns
    '[class*="event-card"]',
    '[class*="event-item"]',
    '[class*="event-listing"]',
    '[class*="camp-card"]',
    '[class*="camp-item"]',
    '[class*="clinic-card"]',
    '[class*="clinic-item"]',
    '[class*="program-card"]',
    '[class*="program-item"]',
    // Article / card patterns
    'article[class*="event"]',
    'article[class*="camp"]',
    'article[class*="clinic"]',
    '.card[class*="event"]',
    '.card[class*="camp"]',
    // List items that look like events
    'li[class*="event"]',
    'li[class*="camp"]',
    'li[class*="clinic"]',
    // Data attribute patterns
    '[data-event-id]',
    '[data-camp-id]',
    '[data-type="event"]',
    // Common CMS patterns
    '.views-row', // Drupal
    '.wp-block-post', // WordPress
    '.elementor-post', // Elementor
    '.grid-item', // Generic grids
    '.list-item', // Generic lists
  ];

  const selector = eventSelectors.join(', ');
  const $events = $(selector);

  $events.each((_, el) => {
    const $el = $(el);
    const text = $el.text();

    if (!isHockeyRelated(text)) return;

    // Extract data from the card
    const name = $el.find('h1, h2, h3, h4, [class*="title"], [class*="name"]').first().text().trim();
    const description = $el.find('p, [class*="desc"], [class*="summary"], [class*="excerpt"]').first().text().trim();
    const link = $el.find('a').first().attr('href');
    const image = $el.find('img').first().attr('src') || $el.find('img').first().attr('data-src');
    const dateText = $el.find('[class*="date"], time, [datetime]').first().text().trim() ||
      $el.find('[class*="date"]').first().attr('datetime');
    const priceText = $el.find('[class*="price"], [class*="cost"], [class*="fee"]').first().text().trim();
    const locationText = $el.find('[class*="location"], [class*="venue"], [class*="place"], address').first().text().trim();

    if (!name) return;

    const fullUrl = link ? resolveUrl(link, sourceUrl) : sourceUrl;

    results.push({
      source: sourceName,
      sourceUrl: fullUrl,
      name: cleanText(name),
      description: cleanText(description).substring(0, 500),
      imageUrl: image ? resolveUrl(image, sourceUrl) : undefined,
      dateText: dateText || undefined,
      price: priceText || undefined,
      location: locationText || undefined,
      websiteUrl: fullUrl,
      registrationUrl: fullUrl,
      confidence: 0.7,
    });
  });

  return results;
}

/**
 * Strategy 4: Extract from HTML tables
 * Many hockey association sites use tables for camp/clinic listings
 */
function extractFromTables(
  $: cheerio.CheerioAPI,
  sourceUrl: string,
  sourceName: string
): RawClinicData[] {
  const results: RawClinicData[] = [];

  $('table').each((_, table) => {
    const $table = $(table);
    const tableText = $table.text().toLowerCase();

    // Only process tables that appear to contain hockey event data
    if (!isHockeyRelated(tableText)) return;

    // Get headers
    const headers: string[] = [];
    $table.find('thead th, thead td, tr:first-child th, tr:first-child td').each((_, th) => {
      headers.push($(th).text().trim().toLowerCase());
    });

    // Map header indices
    const nameIdx = headers.findIndex((h) => /name|program|camp|clinic|event|title/i.test(h));
    const dateIdx = headers.findIndex((h) => /date|when|schedule/i.test(h));
    const locationIdx = headers.findIndex((h) => /location|where|venue|rink|arena/i.test(h));
    const priceIdx = headers.findIndex((h) => /price|cost|fee|tuition/i.test(h));
    const ageIdx = headers.findIndex((h) => /age|level|division|group/i.test(h));

    // Process rows
    $table.find('tbody tr, tr').each((i, row) => {
      if (i === 0 && headers.length > 0) return; // Skip header row

      const $row = $(row);
      const cells: string[] = [];
      $row.find('td').each((_, td) => {
        cells.push($(td).text().trim());
      });

      if (cells.length < 2) return;

      const name = nameIdx >= 0 ? cells[nameIdx] : cells[0];
      if (!name || !isHockeyRelated(name)) return;

      const link = $row.find('a').first().attr('href');
      const fullUrl = link ? resolveUrl(link, sourceUrl) : sourceUrl;

      results.push({
        source: sourceName,
        sourceUrl: fullUrl,
        name: cleanText(name),
        dateText: dateIdx >= 0 ? cells[dateIdx] : undefined,
        location: locationIdx >= 0 ? cells[locationIdx] : undefined,
        price: priceIdx >= 0 ? cells[priceIdx] : undefined,
        ageRange: ageIdx >= 0 ? cells[ageIdx] : undefined,
        websiteUrl: fullUrl,
        registrationUrl: fullUrl,
        confidence: 0.6,
      });
    });
  });

  return results;
}

/**
 * Strategy 5: Generic content extraction as last resort
 */
function extractGenericContent(
  $: cheerio.CheerioAPI,
  sourceUrl: string,
  sourceName: string
): RawClinicData | null {
  const title = $('h1').first().text().trim() || $('title').text().trim();
  const bodyText = $('main, #content, .content, article, body').first().text();

  if (!isHockeyRelated(title + ' ' + bodyText)) return null;

  // Extract all dates, prices, emails, phones from the page
  const dates = extractDatesFromText(bodyText);
  const prices = extractPricesFromText(bodyText);
  const emails = extractEmailsFromText(bodyText);
  const phones = extractPhonesFromText(bodyText);
  const coaches = extractCoachNames($);
  const images = extractImages($, sourceUrl);

  // Find registration links
  const regUrl = findRegistrationLink($, sourceUrl);

  // Extract description from first meaningful paragraph
  const description = $('main p, .content p, article p, .description, .about')
    .first()
    .text()
    .trim()
    .substring(0, 500);

  return {
    source: sourceName,
    sourceUrl,
    name: cleanText(title),
    description: cleanText(description),
    dateText: dates[0],
    price: prices[0],
    contactEmail: emails[0],
    contactPhone: phones[0],
    coaches: coaches.slice(0, 5),
    imageUrl: images[0],
    websiteUrl: sourceUrl,
    registrationUrl: regUrl || sourceUrl,
    confidence: 0.4,
  };
}

// ── Helper Functions ────────────────────────────────────────

function isHockeyRelated(text: string): boolean {
  const lower = text.toLowerCase();
  const hockeyTerms = [
    'hockey', 'skating', 'ice rink', 'arena', 'puck', 'goaltend',
    'slap shot', 'power play', 'face-off', 'faceoff', 'blue line',
    'goalie', 'skate', 'stick handling', 'stickhandling',
  ];
  return hockeyTerms.some((term) => lower.includes(term));
}

function cleanText(text: string): string {
  return text
    .replace(/[\n\r\t]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function resolveUrl(href: string, baseUrl: string): string {
  try {
    return new URL(href, baseUrl).toString();
  } catch {
    return href;
  }
}

function formatAddress(address: unknown): string {
  if (!address) return '';
  if (typeof address === 'string') return address;
  if (typeof address === 'object' && address !== null) {
    const a = address as Record<string, string>;
    return [a.streetAddress, a.addressLocality, a.addressRegion, a.postalCode, a.addressCountry]
      .filter(Boolean)
      .join(', ');
  }
  return '';
}

function extractDatesFromText(text: string): string[] {
  const patterns = [
    // "July 14-18, 2026" or "July 14 - 18, 2026"
    /(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}\s*[-–]\s*\d{1,2},?\s*\d{4}/gi,
    // "July 14, 2026 - July 18, 2026"
    /(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s*\d{4}\s*[-–]\s*(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s*\d{4}/gi,
    // "7/14/2026" or "07/14/2026"
    /\d{1,2}\/\d{1,2}\/\d{4}/g,
    // "2026-07-14"
    /\d{4}-\d{2}-\d{2}/g,
    // "Jul 14, 2026"
    /(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2},?\s*\d{4}/gi,
  ];

  const dates: string[] = [];
  for (const pattern of patterns) {
    const matches = text.match(pattern);
    if (matches) dates.push(...matches);
  }
  return [...new Set(dates)];
}

function extractPricesFromText(text: string): string[] {
  const patterns = [
    /\$\d[\d,]*(?:\.\d{2})?/g,
    /€\d[\d,]*(?:\.\d{2})?/g,
    /£\d[\d,]*(?:\.\d{2})?/g,
    /(?:USD|CAD|EUR|GBP|AUD|CHF)\s*\$?\d[\d,]*(?:\.\d{2})?/gi,
    /\d[\d,]*(?:\.\d{2})?\s*(?:USD|CAD|EUR|GBP|AUD|CHF)/gi,
  ];

  const prices: string[] = [];
  for (const pattern of patterns) {
    const matches = text.match(pattern);
    if (matches) prices.push(...matches);
  }
  return [...new Set(prices)];
}

function extractEmailsFromText(text: string): string[] {
  const matches = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g);
  return matches ? [...new Set(matches)] : [];
}

function extractPhonesFromText(text: string): string[] {
  const matches = text.match(/(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g);
  return matches ? [...new Set(matches)] : [];
}

function extractCoachNames($: cheerio.CheerioAPI): string[] {
  const coaches: string[] = [];
  const coachSelectors = [
    '[class*="coach"]',
    '[class*="instructor"]',
    '[class*="staff"]',
    '[class*="trainer"]',
  ];

  $(coachSelectors.join(', ')).each((_, el) => {
    const name = $(el).find('h3, h4, [class*="name"]').text().trim();
    if (name && name.split(' ').length >= 2 && name.length < 50) {
      coaches.push(name);
    }
  });

  return [...new Set(coaches)];
}

function extractImages($: cheerio.CheerioAPI, baseUrl: string): string[] {
  const images: string[] = [];

  $('img[src]').each((_, el) => {
    const src = $(el).attr('src');
    const alt = ($(el).attr('alt') || '').toLowerCase();
    if (
      src &&
      !src.includes('logo') &&
      !src.includes('icon') &&
      !src.includes('avatar') &&
      !src.includes('pixel') &&
      (alt.includes('hockey') || alt.includes('camp') || alt.includes('clinic') || alt.includes('skating') || alt === '')
    ) {
      images.push(resolveUrl(src, baseUrl));
    }
  });

  return images.slice(0, 5);
}

function findRegistrationLink($: cheerio.CheerioAPI, baseUrl: string): string | null {
  const regPatterns = ['register', 'sign up', 'signup', 'enroll', 'book now', 'apply'];

  let regUrl: string | null = null;
  $('a').each((_, el) => {
    const text = $(el).text().toLowerCase();
    const href = $(el).attr('href');
    if (href && regPatterns.some((p) => text.includes(p))) {
      regUrl = resolveUrl(href, baseUrl);
      return false; // break
    }
  });

  return regUrl;
}

function deduplicatePageResults(results: RawClinicData[]): RawClinicData[] {
  const seen = new Map<string, RawClinicData>();

  for (const result of results) {
    const key = (result.name || '').toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 50);
    if (!key) continue;

    const existing = seen.get(key);
    if (!existing || result.confidence > existing.confidence) {
      // Merge data from both if they exist
      if (existing) {
        seen.set(key, {
          ...existing,
          ...result,
          description: result.description || existing.description,
          imageUrl: result.imageUrl || existing.imageUrl,
          dateText: result.dateText || existing.dateText,
          price: result.price || existing.price,
          contactEmail: result.contactEmail || existing.contactEmail,
          coaches: result.coaches?.length ? result.coaches : existing.coaches,
          confidence: Math.max(result.confidence, existing.confidence),
        });
      } else {
        seen.set(key, result);
      }
    }
  }

  return Array.from(seen.values());
}
