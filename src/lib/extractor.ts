/**
 * INTELLIGENT HTML DATA EXTRACTION ENGINE
 *
 * This module is the brain that parses raw HTML from hockey organization
 * websites and extracts structured clinic/camp data using multiple
 * sophisticated strategies:
 *
 * EXTRACTION STRATEGIES (in priority order):
 * 1. Schema.org / JSON-LD structured data
 * 2. Microdata (itemscope/itemprop) extraction
 * 3. Open Graph / meta tag extraction
 * 4. Semantic HTML event card/listing patterns
 * 5. Table-based listings (common on hockey association sites)
 * 6. WordPress / CMS-specific patterns
 * 7. Generic content extraction with deep text analysis
 *
 * TEXT ANALYSIS CAPABILITIES:
 * - 15+ date format patterns including international formats
 * - Multi-currency price extraction (USD, CAD, EUR, GBP, SEK, CHF, etc.)
 * - Coach/instructor name detection with credential awareness
 * - Venue/rink/arena recognition from text patterns
 * - Age group extraction (mites through midget + international terms)
 * - Skill level detection from text cues
 * - Registration link discovery with 20+ button/link patterns
 * - Amenity extraction from feature lists
 * - Email and phone extraction with international formats
 * - Schedule/time extraction
 */

import * as cheerio from 'cheerio';
import type { AnyNode } from 'domhandler';
import { RawClinicData } from './searchEngine';

// ═══════════════════════════════════════════════════════════════
// MAIN EXTRACTION ENTRY POINT
// ═══════════════════════════════════════════════════════════════

/**
 * Main extraction function — runs all strategies and merges results
 */
export function extractClinicsFromHTML(
  html: string,
  sourceUrl: string,
  sourceName: string
): RawClinicData[] {
  const $ = cheerio.load(html);
  const results: RawClinicData[] = [];

  // Strategy 1: JSON-LD structured data (highest confidence)
  results.push(...extractFromJsonLd($, sourceUrl, sourceName));

  // Strategy 2: Microdata (itemscope/itemprop)
  results.push(...extractFromMicrodata($, sourceUrl, sourceName));

  // Strategy 3: Open Graph and meta tags
  const ogData = extractFromMetaTags($, sourceUrl, sourceName);
  if (ogData) results.push(ogData);

  // Strategy 4: Event listing patterns (cards, list items, etc.)
  results.push(...extractFromEventListings($, sourceUrl, sourceName));

  // Strategy 5: Table-based listings
  results.push(...extractFromTables($, sourceUrl, sourceName));

  // Strategy 6: CMS-specific patterns (WordPress, Squarespace, Wix, etc.)
  results.push(...extractFromCMSPatterns($, sourceUrl, sourceName));

  // Strategy 7: Generic content extraction as fallback
  if (results.length === 0) {
    const generic = extractGenericContent($, sourceUrl, sourceName);
    if (generic) results.push(generic);
  }

  // Enrich all results with additional page-level data
  const enriched = enrichResults(results, $, sourceUrl);

  // Filter out low-confidence duplicates within same page
  return deduplicatePageResults(enriched);
}

// ═══════════════════════════════════════════════════════════════
// STRATEGY 1: JSON-LD STRUCTURED DATA
// ═══════════════════════════════════════════════════════════════

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
        const itemType = item['@type'];
        const isEvent =
          itemType === 'Event' ||
          itemType === 'SportsEvent' ||
          itemType === 'EducationEvent' ||
          itemType === 'SocialEvent' ||
          (Array.isArray(itemType) && itemType.some((t: string) => /event/i.test(t))) ||
          (typeof itemType === 'string' && /event/i.test(itemType));

        if (!isEvent) continue;

        const nameText = item.name || item.headline || '';
        const descText = item.description || '';
        if (!isHockeyRelated(nameText + ' ' + descText)) continue;

        // Extract offers/pricing from multiple schemas
        const offers = Array.isArray(item.offers) ? item.offers[0] : item.offers;
        const priceText = offers?.price?.toString();
        const lowPrice = offers?.lowPrice?.toString();
        const highPrice = offers?.highPrice?.toString();

        // Extract performer/instructor
        const performers = Array.isArray(item.performer) ? item.performer : item.performer ? [item.performer] : [];
        const coaches = performers.map((p: { name?: string }) => p.name).filter(Boolean);

        // Extract organizer
        const organizer = item.organizer?.name || item.organizer;

        results.push({
          source: sourceName,
          sourceUrl,
          name: nameText,
          description: descText?.substring(0, 500),
          venue: item.location?.name || item.location?.['@id'],
          location: formatJsonLdAddress(item.location?.address),
          city: extractCityFromJsonLd(item.location),
          state: item.location?.address?.addressRegion,
          country: item.location?.address?.addressCountry,
          startDate: item.startDate,
          endDate: item.endDate || item.startDate,
          imageUrl: resolveImageUrl(item.image, sourceUrl),
          websiteUrl: item.url || sourceUrl,
          registrationUrl: offers?.url || item.url || sourceUrl,
          price: lowPrice && highPrice ? `${lowPrice}-${highPrice}` : priceText,
          priceAmount: parseFloat(offers?.price || offers?.lowPrice) || undefined,
          currency: offers?.priceCurrency,
          coaches: coaches.length > 0 ? coaches : organizer ? [organizer] : undefined,
          confidence: 0.92,
        });
      }
    } catch {
      // Invalid JSON-LD, skip
    }
  });

  return results;
}

// ═══════════════════════════════════════════════════════════════
// STRATEGY 2: MICRODATA (itemscope/itemprop)
// ═══════════════════════════════════════════════════════════════

function extractFromMicrodata(
  $: cheerio.CheerioAPI,
  sourceUrl: string,
  sourceName: string
): RawClinicData[] {
  const results: RawClinicData[] = [];

  // Find elements with itemtype containing Event
  $('[itemtype*="Event"], [itemtype*="event"]').each((_, el) => {
    const $el = $(el);
    const name = $el.find('[itemprop="name"]').first().text().trim() ||
      $el.find('[itemprop="headline"]').first().text().trim();
    const description = $el.find('[itemprop="description"]').first().text().trim();

    if (!name || !isHockeyRelated(name + ' ' + description)) return;

    const startDate = $el.find('[itemprop="startDate"]').attr('content') ||
      $el.find('[itemprop="startDate"]').attr('datetime') ||
      $el.find('[itemprop="startDate"]').text().trim();
    const endDate = $el.find('[itemprop="endDate"]').attr('content') ||
      $el.find('[itemprop="endDate"]').attr('datetime') ||
      $el.find('[itemprop="endDate"]').text().trim();
    const location = $el.find('[itemprop="location"]').text().trim();
    const venue = $el.find('[itemprop="location"] [itemprop="name"]').text().trim();
    const image = $el.find('[itemprop="image"]').attr('src') ||
      $el.find('[itemprop="image"]').attr('content');
    const price = $el.find('[itemprop="price"]').attr('content') ||
      $el.find('[itemprop="price"]').text().trim();
    const url = $el.find('[itemprop="url"]').attr('href');

    results.push({
      source: sourceName,
      sourceUrl: url ? resolveUrl(url, sourceUrl) : sourceUrl,
      name: cleanText(name),
      description: cleanText(description).substring(0, 500),
      venue: venue || undefined,
      location: location || undefined,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      imageUrl: image ? resolveUrl(image, sourceUrl) : undefined,
      price: price || undefined,
      websiteUrl: url ? resolveUrl(url, sourceUrl) : sourceUrl,
      registrationUrl: url ? resolveUrl(url, sourceUrl) : sourceUrl,
      confidence: 0.85,
    });
  });

  return results;
}

// ═══════════════════════════════════════════════════════════════
// STRATEGY 3: META TAGS / OPEN GRAPH
// ═══════════════════════════════════════════════════════════════

function extractFromMetaTags(
  $: cheerio.CheerioAPI,
  sourceUrl: string,
  sourceName: string
): RawClinicData | null {
  const ogTitle = $('meta[property="og:title"]').attr('content');
  const ogDesc = $('meta[property="og:description"]').attr('content');
  const ogImage = $('meta[property="og:image"]').attr('content');
  const ogType = $('meta[property="og:type"]').attr('content');
  const ogSiteName = $('meta[property="og:site_name"]').attr('content');
  const title = $('title').text().trim();
  const metaDesc = $('meta[name="description"]').attr('content');

  // Twitter cards can have additional info
  const twitterTitle = $('meta[name="twitter:title"]').attr('content');
  const twitterImage = $('meta[name="twitter:image"]').attr('content');

  const name = ogTitle || twitterTitle || title;
  const description = ogDesc || metaDesc || '';

  if (!isHockeyRelated(name + ' ' + description + ' ' + (ogSiteName || ''))) return null;

  // Look for date, price, contact info in the page
  const pageText = $('body').text();
  const dates = extractDatesFromText(pageText);
  const prices = extractPricesFromText(pageText);
  const emails = extractEmailsFromText(pageText);
  const phones = extractPhonesFromText(pageText);
  const venues = extractVenueFromText(pageText);

  // Boost confidence if it's explicitly an event page
  const isEventPage = ogType === 'event' ||
    /event|camp|clinic|hockey/i.test(ogSiteName || '');

  return {
    source: sourceName,
    sourceUrl,
    name: cleanText(name),
    description: cleanText(description).substring(0, 500),
    imageUrl: ogImage || twitterImage ||
      $('meta[property="og:image:secure_url"]').attr('content'),
    dateText: dates.length > 0 ? dates[0] : undefined,
    price: prices.length > 0 ? prices[0] : undefined,
    contactEmail: emails.length > 0 ? emails[0] : undefined,
    contactPhone: phones.length > 0 ? phones[0] : undefined,
    venue: venues.length > 0 ? venues[0] : undefined,
    websiteUrl: sourceUrl,
    registrationUrl: sourceUrl,
    confidence: isEventPage ? 0.65 : 0.5,
  };
}

// ═══════════════════════════════════════════════════════════════
// STRATEGY 4: EVENT LISTING PATTERNS
// ═══════════════════════════════════════════════════════════════

function extractFromEventListings(
  $: cheerio.CheerioAPI,
  sourceUrl: string,
  sourceName: string
): RawClinicData[] {
  const results: RawClinicData[] = [];

  // Comprehensive selectors for event cards/listings across many site designs
  const eventSelectors = [
    // Direct event card patterns
    '[class*="event-card"]', '[class*="event-item"]', '[class*="event-listing"]',
    '[class*="eventCard"]', '[class*="eventItem"]', '[class*="eventListing"]',
    // Camp/clinic specific
    '[class*="camp-card"]', '[class*="camp-item"]', '[class*="camp-listing"]',
    '[class*="campCard"]', '[class*="campItem"]',
    '[class*="clinic-card"]', '[class*="clinic-item"]', '[class*="clinic-listing"]',
    '[class*="clinicCard"]', '[class*="clinicItem"]',
    // Program/course patterns
    '[class*="program-card"]', '[class*="program-item"]', '[class*="program-listing"]',
    '[class*="programCard"]', '[class*="programItem"]',
    '[class*="course-card"]', '[class*="course-item"]',
    '[class*="session-card"]', '[class*="session-item"]',
    // Article / card patterns
    'article[class*="event"]', 'article[class*="camp"]', 'article[class*="clinic"]',
    'article[class*="program"]', 'article[class*="post"]',
    '.card[class*="event"]', '.card[class*="camp"]',
    // List items
    'li[class*="event"]', 'li[class*="camp"]', 'li[class*="clinic"]',
    'li[class*="program"]', 'li[class*="session"]',
    // Data attribute patterns
    '[data-event-id]', '[data-camp-id]', '[data-clinic-id]',
    '[data-type="event"]', '[data-type="camp"]', '[data-type="clinic"]',
    '[data-post-type="event"]', '[data-post-type="tribe_events"]',
    // Common CMS patterns
    '.views-row',           // Drupal
    '.wp-block-post',       // WordPress block editor
    '.elementor-post',      // Elementor
    '.jet-listing-grid__item', // JetEngine
    '.tribe-events-calendar-list__event-row', // The Events Calendar
    '.type-tribe_events',   // Tribe Events
    '.tribe_events',        // Tribe Events
    '.em-item',             // Events Manager
    '.eo-event',            // Event Organiser
    '.ai1ec-event',         // All-in-One Event Calendar
    '.mec-event-article',   // Modern Events Calendar
    '.eael-event-calendar-item', // Essential Addons
    '.grid-item',           // Generic grids
    '.list-item',           // Generic lists
    '.post-item',           // Generic posts
    '.entry',               // Generic entries
    // Squarespace / Wix patterns
    '.eventlist-event',     // Squarespace Events
    '.summary-item',        // Squarespace Summary
    '.blog-item',           // Squarespace Blog
  ];

  const selector = eventSelectors.join(', ');
  const $events = $(selector);

  $events.each((_, el) => {
    const $el = $(el);
    const text = $el.text();

    if (!isHockeyRelated(text)) return;

    // Extract data from the card with multiple fallback selectors
    const name = extractCardTitle($el);
    const description = extractCardDescription($el);
    const link = extractCardLink($el);
    const image = extractCardImage($el);
    const dateText = extractCardDate($el);
    const priceText = extractCardPrice($el);
    const locationText = extractCardLocation($el);

    if (!name) return;

    const fullUrl = link ? resolveUrl(link, sourceUrl) : sourceUrl;

    // Extract additional info from card text
    const ageRange = extractAgeRangeFromText(text);
    const skillLevel = extractSkillLevelFromText(text);

    results.push({
      source: sourceName,
      sourceUrl: fullUrl,
      name: cleanText(name),
      description: cleanText(description).substring(0, 500),
      imageUrl: image ? resolveUrl(image, sourceUrl) : undefined,
      dateText: dateText || undefined,
      price: priceText || undefined,
      location: locationText || undefined,
      ageRange: ageRange || undefined,
      skillLevel: skillLevel || undefined,
      websiteUrl: fullUrl,
      registrationUrl: fullUrl,
      confidence: 0.72,
    });
  });

  return results;
}

// ═══════════════════════════════════════════════════════════════
// STRATEGY 5: TABLE-BASED LISTINGS
// ═══════════════════════════════════════════════════════════════

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

    // Map header indices with broader matching
    const nameIdx = headers.findIndex((h) => /name|program|camp|clinic|event|title|session/i.test(h));
    const dateIdx = headers.findIndex((h) => /date|when|schedule|time|start/i.test(h));
    const locationIdx = headers.findIndex((h) => /location|where|venue|rink|arena|facility|address/i.test(h));
    const priceIdx = headers.findIndex((h) => /price|cost|fee|tuition|rate|amount/i.test(h));
    const ageIdx = headers.findIndex((h) => /age|level|division|group|category|born/i.test(h));
    const linkIdx = headers.findIndex((h) => /register|sign\s*up|link|details|more|info|action/i.test(h));
    const descIdx = headers.findIndex((h) => /description|detail|note|info|about/i.test(h));

    // Process rows
    $table.find('tbody tr, tr').each((i, row) => {
      if (i === 0 && headers.length > 0) return; // Skip header row

      const $row = $(row);
      const cells: string[] = [];
      $row.find('td, th').each((_, td) => {
        cells.push($(td).text().trim());
      });

      if (cells.length < 2) return;

      const name = nameIdx >= 0 ? cells[nameIdx] : cells[0];
      if (!name || name.length < 3) return;

      // For tables without clear hockey headers, validate each row
      if (!isHockeyRelated(name + ' ' + cells.join(' '))) return;

      const link = $row.find('a').first().attr('href');
      const fullUrl = link ? resolveUrl(link, sourceUrl) : sourceUrl;

      results.push({
        source: sourceName,
        sourceUrl: fullUrl,
        name: cleanText(name),
        description: descIdx >= 0 ? cleanText(cells[descIdx]) : undefined,
        dateText: dateIdx >= 0 ? cells[dateIdx] : undefined,
        location: locationIdx >= 0 ? cells[locationIdx] : undefined,
        price: priceIdx >= 0 ? cells[priceIdx] : undefined,
        ageRange: ageIdx >= 0 ? cells[ageIdx] : undefined,
        websiteUrl: fullUrl,
        registrationUrl: linkIdx >= 0 ? (
          $row.find('td').eq(linkIdx).find('a').attr('href') ?
            resolveUrl($row.find('td').eq(linkIdx).find('a').attr('href')!, sourceUrl) : fullUrl
        ) : fullUrl,
        confidence: 0.62,
      });
    });
  });

  return results;
}

// ═══════════════════════════════════════════════════════════════
// STRATEGY 6: CMS-SPECIFIC PATTERNS
// ═══════════════════════════════════════════════════════════════

function extractFromCMSPatterns(
  $: cheerio.CheerioAPI,
  sourceUrl: string,
  sourceName: string
): RawClinicData[] {
  const results: RawClinicData[] = [];

  // WordPress: The Events Calendar (very popular for hockey sites)
  $('.tribe-events-single, .tribe-events-list .tribe-events-event').each((_, el) => {
    const $el = $(el);
    const name = $el.find('.tribe-events-single-event-title, .tribe-events-list-event-title, h2 a').text().trim();
    const desc = $el.find('.tribe-events-content p, .tribe-events-list-event-description').first().text().trim();

    if (!name || !isHockeyRelated(name + ' ' + desc)) return;

    const dateText = $el.find('.tribe-event-schedule-details, .tribe-events-schedule').text().trim();
    const location = $el.find('.tribe-venue, .tribe-events-location').text().trim();
    const price = $el.find('.tribe-events-cost, .tribe-events-event-cost').text().trim();
    const link = $el.find('a.tribe-event-url, h2 a, .tribe-events-read-more').attr('href');
    const image = $el.find('.tribe-events-event-image img').attr('src');

    results.push({
      source: sourceName,
      sourceUrl: link ? resolveUrl(link, sourceUrl) : sourceUrl,
      name: cleanText(name),
      description: cleanText(desc).substring(0, 500),
      dateText: dateText || undefined,
      location: location || undefined,
      price: price || undefined,
      imageUrl: image ? resolveUrl(image, sourceUrl) : undefined,
      websiteUrl: link ? resolveUrl(link, sourceUrl) : sourceUrl,
      registrationUrl: link ? resolveUrl(link, sourceUrl) : sourceUrl,
      confidence: 0.78,
    });
  });

  // WordPress: Events Manager plugin
  $('.event, .em-event').each((_, el) => {
    const $el = $(el);
    const name = $el.find('.event-title, h3 a, h2 a').text().trim();
    if (!name || !isHockeyRelated(name + ' ' + $el.text())) return;

    const link = $el.find('a').first().attr('href');
    results.push({
      source: sourceName,
      sourceUrl: link ? resolveUrl(link, sourceUrl) : sourceUrl,
      name: cleanText(name),
      dateText: $el.find('.event-date, .event-time, time').text().trim() || undefined,
      location: $el.find('.event-location, .location').text().trim() || undefined,
      websiteUrl: link ? resolveUrl(link, sourceUrl) : sourceUrl,
      registrationUrl: link ? resolveUrl(link, sourceUrl) : sourceUrl,
      confidence: 0.68,
    });
  });

  // Squarespace event pages
  $('.eventlist-event').each((_, el) => {
    const $el = $(el);
    const name = $el.find('.eventlist-title').text().trim();
    if (!name || !isHockeyRelated(name + ' ' + $el.text())) return;

    const link = $el.find('.eventlist-title a').attr('href');
    results.push({
      source: sourceName,
      sourceUrl: link ? resolveUrl(link, sourceUrl) : sourceUrl,
      name: cleanText(name),
      dateText: $el.find('.event-date, .eventlist-meta-date').text().trim() || undefined,
      location: $el.find('.eventlist-meta-address, .event-location').text().trim() || undefined,
      description: $el.find('.eventlist-description').text().trim().substring(0, 500) || undefined,
      imageUrl: $el.find('img').attr('src') ? resolveUrl($el.find('img').attr('src')!, sourceUrl) : undefined,
      websiteUrl: link ? resolveUrl(link, sourceUrl) : sourceUrl,
      registrationUrl: link ? resolveUrl(link, sourceUrl) : sourceUrl,
      confidence: 0.7,
    });
  });

  // Generic blog post / news item pattern (many hockey sites post clinics as news)
  $('article.post, .blog-post, .news-item, .hentry').each((_, el) => {
    const $el = $(el);
    const title = $el.find('.entry-title, .post-title, h2, h3').first().text().trim();
    const content = $el.text();

    if (!title || !isHockeyRelated(title)) return;
    // Must contain at least one event indicator to avoid regular blog posts
    if (!/camp|clinic|program|registration|sign\s*up|dates?:/i.test(content)) return;

    const link = $el.find('.entry-title a, .post-title a, h2 a, h3 a').attr('href');
    const image = $el.find('img').first().attr('src');
    const dates = extractDatesFromText(content);
    const prices = extractPricesFromText(content);

    results.push({
      source: sourceName,
      sourceUrl: link ? resolveUrl(link, sourceUrl) : sourceUrl,
      name: cleanText(title),
      description: $el.find('.entry-content, .post-content, .excerpt, p').first().text().trim().substring(0, 500) || undefined,
      dateText: dates[0] || undefined,
      price: prices[0] || undefined,
      imageUrl: image ? resolveUrl(image, sourceUrl) : undefined,
      websiteUrl: link ? resolveUrl(link, sourceUrl) : sourceUrl,
      registrationUrl: link ? resolveUrl(link, sourceUrl) : sourceUrl,
      confidence: 0.55,
    });
  });

  return results;
}

// ═══════════════════════════════════════════════════════════════
// STRATEGY 7: GENERIC CONTENT EXTRACTION
// ═══════════════════════════════════════════════════════════════

function extractGenericContent(
  $: cheerio.CheerioAPI,
  sourceUrl: string,
  sourceName: string
): RawClinicData | null {
  const title = $('h1').first().text().trim() || $('title').text().trim();
  const bodyText = $('main, #content, .content, article, .main-content, #main, body').first().text();

  if (!isHockeyRelated(title + ' ' + bodyText)) return null;

  // Extract all structured data from page text
  const dates = extractDatesFromText(bodyText);
  const prices = extractPricesFromText(bodyText);
  const emails = extractEmailsFromText(bodyText);
  const phones = extractPhonesFromText(bodyText);
  const coaches = extractCoachNames($);
  const images = extractImages($, sourceUrl);
  const venues = extractVenueFromText(bodyText);
  const schedules = extractScheduleFromText(bodyText);
  const ageRange = extractAgeRangeFromText(bodyText);
  const skillLevel = extractSkillLevelFromText(bodyText);
  const amenitiesList = extractAmenitiesFromText(bodyText);

  // Find registration links
  const regUrl = findRegistrationLink($, sourceUrl);

  // Extract description from first meaningful paragraph
  const description = $('main p, .content p, article p, .description, .about, .overview, .intro, #content p')
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
    startDate: dates.length >= 2 ? dates[0] : undefined,
    endDate: dates.length >= 2 ? dates[1] : undefined,
    price: prices[0],
    contactEmail: emails[0],
    contactPhone: phones[0],
    coaches: coaches.slice(0, 10),
    imageUrl: images[0],
    venue: venues[0],
    location: venues[0],
    ageRange,
    skillLevel,
    amenities: amenitiesList.length > 0 ? amenitiesList : undefined,
    websiteUrl: sourceUrl,
    registrationUrl: regUrl || sourceUrl,
    confidence: schedules.length > 0 ? 0.5 : 0.4,
  };
}

// ═══════════════════════════════════════════════════════════════
// ENRICHMENT — Add page-level data to all results
// ═══════════════════════════════════════════════════════════════

function enrichResults(
  results: RawClinicData[],
  $: cheerio.CheerioAPI,
  sourceUrl: string
): RawClinicData[] {
  if (results.length === 0) return results;

  // Gather page-level data once
  const pageText = $('body').text();
  const pageCoaches = extractCoachNames($);
  const pageEmails = extractEmailsFromText(pageText);
  const pagePhones = extractPhonesFromText(pageText);
  const regUrl = findRegistrationLink($, sourceUrl);
  const heroImage = $('meta[property="og:image"]').attr('content') ||
    $('meta[name="twitter:image"]').attr('content');

  return results.map((result) => ({
    ...result,
    // Fill in missing coach data from page-level
    coaches: result.coaches?.length ? result.coaches : (pageCoaches.length > 0 ? pageCoaches.slice(0, 5) : undefined),
    // Fill in missing contact info from page-level
    contactEmail: result.contactEmail || pageEmails[0],
    contactPhone: result.contactPhone || pagePhones[0],
    // Fill in missing registration URL from page-level
    registrationUrl: result.registrationUrl || regUrl || sourceUrl,
    // Fill in missing image from OG image
    imageUrl: result.imageUrl || (heroImage ? resolveUrl(heroImage, sourceUrl) : undefined),
  }));
}

// ═══════════════════════════════════════════════════════════════
// CARD ELEMENT EXTRACTION HELPERS
// ═══════════════════════════════════════════════════════════════

function extractCardTitle($el: cheerio.Cheerio<AnyNode>): string {
  const selectors = [
    'h1', 'h2', 'h3', 'h4',
    '[class*="title"]', '[class*="Title"]',
    '[class*="name"]', '[class*="Name"]',
    '[class*="heading"]', '[class*="Heading"]',
    '.entry-title', '.post-title', '.event-title',
  ];
  for (const sel of selectors) {
    const text = $el.find(sel).first().text().trim();
    if (text && text.length > 2 && text.length < 200) return text;
  }
  // Fallback: first link text
  const linkText = $el.find('a').first().text().trim();
  if (linkText && linkText.length > 2 && linkText.length < 200) return linkText;
  return '';
}

function extractCardDescription($el: cheerio.Cheerio<AnyNode>): string {
  const selectors = [
    'p', '[class*="desc"]', '[class*="Desc"]',
    '[class*="summary"]', '[class*="Summary"]',
    '[class*="excerpt"]', '[class*="Excerpt"]',
    '[class*="content"]', '[class*="Content"]',
    '[class*="body"]', '[class*="Body"]',
    '.entry-summary', '.post-excerpt',
  ];
  for (const sel of selectors) {
    const text = $el.find(sel).first().text().trim();
    if (text && text.length > 10) return text;
  }
  return '';
}

function extractCardLink($el: cheerio.Cheerio<AnyNode>): string | undefined {
  // Check for link on title first
  const titleLink = $el.find('h2 a, h3 a, h4 a, [class*="title"] a, [class*="name"] a').first().attr('href');
  if (titleLink) return titleLink;
  // Check for "read more" / "learn more" links
  const moreLink = $el.find('a[class*="more"], a[class*="read"], a[class*="detail"], a[class*="learn"]').first().attr('href');
  if (moreLink) return moreLink;
  // First link as fallback
  return $el.find('a').first().attr('href') || undefined;
}

function extractCardImage($el: cheerio.Cheerio<AnyNode>): string | undefined {
  // Direct img src
  const img = $el.find('img').first();
  const src = img.attr('src') || img.attr('data-src') || img.attr('data-lazy-src');
  if (src) return src;
  // Background image from style
  const bgEl = $el.find('[style*="background-image"]').first();
  const style = bgEl.attr('style') || '';
  const bgMatch = style.match(/url\(['"]?([^'")\s]+)['"]?\)/);
  if (bgMatch) return bgMatch[1];
  return undefined;
}

function extractCardDate($el: cheerio.Cheerio<AnyNode>): string {
  const selectors = [
    'time', '[datetime]',
    '[class*="date"]', '[class*="Date"]',
    '[class*="time"]', '[class*="Time"]',
    '[class*="when"]', '[class*="When"]',
    '[class*="schedule"]', '[class*="Schedule"]',
    '.tribe-event-schedule-details',
  ];
  for (const sel of selectors) {
    const el = $el.find(sel).first();
    const datetime = el.attr('datetime') || el.attr('content');
    if (datetime) return datetime;
    const text = el.text().trim();
    if (text && text.length > 3 && text.length < 100) return text;
  }
  return '';
}

function extractCardPrice($el: cheerio.Cheerio<AnyNode>): string {
  const selectors = [
    '[class*="price"]', '[class*="Price"]',
    '[class*="cost"]', '[class*="Cost"]',
    '[class*="fee"]', '[class*="Fee"]',
    '[class*="rate"]', '[class*="Rate"]',
    '[class*="tuition"]', '[class*="amount"]',
  ];
  for (const sel of selectors) {
    const text = $el.find(sel).first().text().trim();
    if (text && /[\$€£]|\d/.test(text)) return text;
  }
  return '';
}

function extractCardLocation($el: cheerio.Cheerio<AnyNode>): string {
  const selectors = [
    '[class*="location"]', '[class*="Location"]',
    '[class*="venue"]', '[class*="Venue"]',
    '[class*="place"]', '[class*="Place"]',
    '[class*="address"]', '[class*="Address"]',
    '[class*="facility"]', '[class*="rink"]', '[class*="arena"]',
    'address',
  ];
  for (const sel of selectors) {
    const text = $el.find(sel).first().text().trim();
    if (text && text.length > 2 && text.length < 200) return text;
  }
  return '';
}

// ═══════════════════════════════════════════════════════════════
// HOCKEY RELEVANCE DETECTION
// ═══════════════════════════════════════════════════════════════

function isHockeyRelated(text: string): boolean {
  const lower = text.toLowerCase();

  // Strong hockey indicators — any one of these is enough
  const strongTerms = [
    'hockey', 'ice hockey', 'ice rink', 'hockey rink',
    'hockey camp', 'hockey clinic', 'hockey school',
    'hockey training', 'hockey development',
    'hockey skills', 'hockey program',
    'puck handling', 'puck skills',
    'goaltending', 'goaltender', 'goalie camp',
    'power skating', 'stickhandling', 'stick handling',
    'slap shot', 'slapshot', 'wrist shot',
    'blue line', 'blueline', 'power play', 'penalty kill',
    'face-off', 'faceoff', 'face off',
    'hockey league', 'hockey association',
    'hockey tournament', 'hockey showcase',
  ];

  if (strongTerms.some((term) => lower.includes(term))) return true;

  // Multi-language hockey terms
  const intlTerms = [
    'ishockey',       // Swedish/Danish/Norwegian
    'jääkiekko',      // Finnish
    'eishockey',      // German
    'hokej',          // Czech/Slovak/Polish
    'хоккей',         // Russian
    'hockey sur glace', // French
    'hóquei no gelo', // Portuguese
    'hockey su ghiaccio', // Italian
    'アイスホッケー',    // Japanese
    '아이스하키',       // Korean
    '冰球',           // Chinese
  ];

  if (intlTerms.some((term) => lower.includes(term))) return true;

  // Combination signals — need at least 2 of these together
  const softTerms = [
    'skating', 'skate', 'arena', 'rink', 'ice',
    'goalie', 'netminder', 'defenseman', 'defenceman',
    'forward', 'winger', 'center', 'centre',
    'nhl', 'ahl', 'ohl', 'whl', 'ushl', 'echl',
    'bantam', 'midget', 'peewee', 'pee-wee', 'squirt', 'mite',
    'aaa', 'aa ', 'tier 1', 'tier 2',
  ];

  let softCount = 0;
  for (const term of softTerms) {
    if (lower.includes(term)) softCount++;
    if (softCount >= 2) return true;
  }

  return false;
}

// ═══════════════════════════════════════════════════════════════
// TEXT EXTRACTION HELPERS
// ═══════════════════════════════════════════════════════════════

function cleanText(text: string): string {
  return text
    .replace(/[\n\r\t]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .replace(/^\s+|\s+$/g, '')
    .trim();
}

function resolveUrl(href: string, baseUrl: string): string {
  try {
    if (href.startsWith('data:') || href.startsWith('javascript:')) return '';
    return new URL(href, baseUrl).toString();
  } catch {
    return href;
  }
}

function resolveImageUrl(image: unknown, baseUrl: string): string | undefined {
  if (!image) return undefined;
  if (typeof image === 'string') return resolveUrl(image, baseUrl);
  if (typeof image === 'object' && image !== null) {
    const img = image as { url?: string; contentUrl?: string };
    return resolveUrl(img.url || img.contentUrl || '', baseUrl);
  }
  if (Array.isArray(image) && image.length > 0) {
    return resolveImageUrl(image[0], baseUrl);
  }
  return undefined;
}

function formatJsonLdAddress(address: unknown): string {
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

function extractCityFromJsonLd(location: Record<string, unknown> | null): string | undefined {
  if (!location) return undefined;
  const address = location.address as Record<string, string> | undefined;
  if (address?.addressLocality) return address.addressLocality;
  // Sometimes location is flat
  if (typeof location.addressLocality === 'string') return location.addressLocality;
  return undefined;
}

// ═══════════════════════════════════════════════════════════════
// DATE EXTRACTION — 15+ patterns, international formats
// ═══════════════════════════════════════════════════════════════

function extractDatesFromText(text: string): string[] {
  const patterns = [
    // "July 14-18, 2026" or "July 14 - 18, 2026"
    /(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}\s*[-–—]\s*\d{1,2},?\s*\d{4}/gi,
    // "July 14, 2026 - July 18, 2026"
    /(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s*\d{4}\s*[-–—]\s*(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s*\d{4}/gi,
    // "Jul 14-18, 2026" abbreviated months
    /(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2}\s*[-–—]\s*\d{1,2},?\s*\d{4}/gi,
    // "Jul 14, 2026 - Jul 18, 2026"
    /(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2},?\s*\d{4}\s*[-–—]\s*(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2},?\s*\d{4}/gi,
    // "14-18 July 2026" (European/international format)
    /\d{1,2}\s*[-–—]\s*\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}/gi,
    // "14 July - 18 July 2026" (European date range)
    /\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s*[-–—]\s*\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}/gi,
    // "July 14, 2026" or "Jul 14, 2026" (single date)
    /(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2},?\s*\d{4}/gi,
    // "14 July 2026" (international single date)
    /\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}/gi,
    // US date format: "7/14/2026" or "07/14/2026"
    /\d{1,2}\/\d{1,2}\/\d{4}/g,
    // European date format: "14.07.2026"
    /\d{1,2}\.\d{1,2}\.\d{4}/g,
    // ISO format: "2026-07-14"
    /\d{4}-\d{2}-\d{2}/g,
    // "Week of July 14" patterns
    /week\s+of\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2}/gi,
    // Swedish date format: "14 juli 2026"
    /\d{1,2}\s+(?:januari|februari|mars|april|maj|juni|juli|augusti|september|oktober|november|december)\s+\d{4}/gi,
    // German date format: "14\. Juli 2026"
    /\d{1,2}\.?\s+(?:Januar|Februar|März|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember)\s+\d{4}/gi,
    // French date format: "14 juillet 2026"
    /\d{1,2}\s+(?:janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre)\s+\d{4}/gi,
  ];

  const dates: string[] = [];
  for (const pattern of patterns) {
    const matches = text.match(pattern);
    if (matches) dates.push(...matches);
  }
  return [...new Set(dates)].slice(0, 10);
}

// ═══════════════════════════════════════════════════════════════
// PRICE EXTRACTION — Multi-currency support
// ═══════════════════════════════════════════════════════════════

function extractPricesFromText(text: string): string[] {
  const patterns = [
    // Dollar amounts: $250, $1,200.00
    /\$\d[\d,]*(?:\.\d{2})?/g,
    // Euro amounts: €250, €1.200,00
    /€\d[\d.,]*(?:,\d{2})?/g,
    // Pound amounts: £250
    /£\d[\d,]*(?:\.\d{2})?/g,
    // Swedish Krona: 2500 kr, 2 500 SEK
    /\d[\d\s,]*\s*(?:kr|SEK)\b/gi,
    // Swiss Franc: CHF 250
    /CHF\s*\d[\d,']*/gi,
    // Norwegian/Danish Krone: 2500 NOK/DKK
    /\d[\d\s,]*\s*(?:NOK|DKK)\b/gi,
    // Currency code prefix: USD $250, CAD $350
    /(?:USD|CAD|EUR|GBP|AUD|CHF|SEK|NOK|DKK|CZK|JPY|KRW|CNY)\s*\$?\d[\d,]*(?:\.\d{2})?/gi,
    // Currency code suffix: 250 USD, 350 CAD
    /\d[\d,]*(?:\.\d{2})?\s*(?:USD|CAD|EUR|GBP|AUD|CHF|SEK|NOK|DKK|CZK|JPY|KRW|CNY)/gi,
    // Russian Rubles: 15000 руб
    /\d[\d\s]*\s*(?:руб|₽)/gi,
    // Czech Koruna: 5000 Kč
    /\d[\d\s]*\s*(?:Kč|CZK)/gi,
    // Japanese Yen: ¥25000
    /¥\d[\d,]*/g,
  ];

  const prices: string[] = [];
  for (const pattern of patterns) {
    const matches = text.match(pattern);
    if (matches) prices.push(...matches.map((m) => m.trim()));
  }
  return [...new Set(prices)].slice(0, 5);
}

// ═══════════════════════════════════════════════════════════════
// EMAIL & PHONE EXTRACTION
// ═══════════════════════════════════════════════════════════════

function extractEmailsFromText(text: string): string[] {
  const matches = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g);
  if (!matches) return [];
  // Filter out common non-contact emails
  return [...new Set(matches)].filter((email) =>
    !/(example|test|noreply|no-reply|unsubscribe|placeholder)/.test(email.toLowerCase())
  ).slice(0, 3);
}

function extractPhonesFromText(text: string): string[] {
  const patterns = [
    // North America: (555) 123-4567, 555-123-4567, +1 555 123 4567
    /(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g,
    // International: +46 8 123 4567, +358 9 1234 5678
    /\+\d{1,3}[-.\s]?\d{1,4}[-.\s]?\d{2,4}[-.\s]?\d{2,4}[-.\s]?\d{0,4}/g,
  ];

  const phones: string[] = [];
  for (const pattern of patterns) {
    const matches = text.match(pattern);
    if (matches) phones.push(...matches);
  }
  return [...new Set(phones)].slice(0, 3);
}

// ═══════════════════════════════════════════════════════════════
// COACH / INSTRUCTOR NAME EXTRACTION
// ═══════════════════════════════════════════════════════════════

function extractCoachNames($: cheerio.CheerioAPI): string[] {
  const coaches: string[] = [];

  // Selector-based extraction
  const coachSelectors = [
    '[class*="coach"]', '[class*="Coach"]',
    '[class*="instructor"]', '[class*="Instructor"]',
    '[class*="staff"]', '[class*="Staff"]',
    '[class*="trainer"]', '[class*="Trainer"]',
    '[class*="director"]', '[class*="Director"]',
    '[class*="faculty"]', '[class*="Faculty"]',
    '[class*="teacher"]', '[class*="Teacher"]',
    '[class*="bio"]', '[class*="team-member"]',
  ];

  $(coachSelectors.join(', ')).each((_, el) => {
    const $el = $(el);
    // Look for names in headings within coach containers
    const nameSelectors = ['h3', 'h4', 'h5', '[class*="name"]', '[class*="Name"]', 'strong', 'b'];
    for (const sel of nameSelectors) {
      const name = $el.find(sel).first().text().trim();
      if (isLikelyPersonName(name)) {
        coaches.push(name);
        break;
      }
    }
  });

  // Also look for "coached by", "led by", "instructor:" patterns in text
  const bodyText = $('body').text();
  const coachPatterns = [
    /(?:coached?\s+by|led\s+by|instructor:?|director:?|taught\s+by|featuring)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})/g,
    /(?:Coach|Instructor|Director)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2})/g,
  ];

  for (const pattern of coachPatterns) {
    let match;
    while ((match = pattern.exec(bodyText)) !== null) {
      const name = match[1].trim();
      if (isLikelyPersonName(name)) {
        coaches.push(name);
      }
    }
  }

  return [...new Set(coaches)].slice(0, 15);
}

function isLikelyPersonName(name: string): boolean {
  if (!name || name.length < 3 || name.length > 60) return false;
  const words = name.split(/\s+/);
  if (words.length < 2 || words.length > 5) return false;
  // Check that words look like names (capitalized, no numbers)
  return words.every((w) => /^[A-Z][a-z'-]+$/.test(w) || /^(Jr|Sr|III?|IV|Dr|Mr|Mrs|Ms|Coach)\.?$/.test(w));
}

// ═══════════════════════════════════════════════════════════════
// VENUE / RINK EXTRACTION
// ═══════════════════════════════════════════════════════════════

function extractVenueFromText(text: string): string[] {
  const venues: string[] = [];

  // Match common venue name patterns
  const venuePatterns = [
    // "at [Venue Name]" or "held at [Venue Name]"
    /(?:held\s+)?at\s+(?:the\s+)?([A-Z][A-Za-z\s'.-]+(?:Arena|Rink|Center|Centre|Ice|Complex|Forum|Coliseum|Pavilion|Sports|Stadium|Facility|Hub))/g,
    // "[Name] Arena/Rink/etc." standalone
    /([A-Z][A-Za-z\s'.-]{3,40}(?:Arena|Rink|Ice Center|Ice Centre|Ice Complex|Ice Forum|Coliseum|Ice Pavilion|Sportsplex|Ice Plex|IcePlex))/g,
    // "Location: [Name]" or "Venue: [Name]"
    /(?:Location|Venue|Facility|Arena|Rink|Place):\s*([A-Z][A-Za-z\s'.,\-#]+)/g,
  ];

  for (const pattern of venuePatterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const venue = match[1].trim();
      if (venue.length > 3 && venue.length < 100) {
        venues.push(venue);
      }
    }
  }

  return [...new Set(venues)].slice(0, 5);
}

// ═══════════════════════════════════════════════════════════════
// AGE & SKILL LEVEL EXTRACTION
// ═══════════════════════════════════════════════════════════════

function extractAgeRangeFromText(text: string): string | undefined {
  const lower = text.toLowerCase();

  // Look for explicit age range patterns
  const agePatterns = [
    /ages?\s*(\d{1,2})\s*[-–—to]+\s*(\d{1,2})/i,
    /(\d{1,2})\s*[-–—to]+\s*(\d{1,2})\s*(?:years?\s*old|year\s*olds?|yrs?)/i,
    /(?:ages?|for)\s*(\d{1,2})\s*(?:and\s*)?(?:up|older|\+)/i,
    /(?:under|u)[-\s]?(\d{1,2})/i,
    /birth\s*years?\s*(\d{4})\s*[-–—to]+\s*(\d{4})/i,
  ];

  for (const pattern of agePatterns) {
    const match = lower.match(pattern);
    if (match) return match[0];
  }

  // Look for hockey division names
  const divisions = [
    { pattern: /\bmites?\b/i, label: 'Mites (6-8)' },
    { pattern: /\bsquirts?\b/i, label: 'Squirts (9-10)' },
    { pattern: /\bpee\s*wee\b|\bpeewee\b/i, label: 'Peewee (11-12)' },
    { pattern: /\bbantam\b/i, label: 'Bantam (13-14)' },
    { pattern: /\bmidget\b|\bu-?18\b|\bu-?16\b/i, label: 'Midget (15-18)' },
    { pattern: /\bjunior\b|\bjuniors\b/i, label: 'Junior (16-20)' },
    { pattern: /\blearn\s*to\s*(?:play|skate)\b/i, label: 'Learn to Play (4-8)' },
  ];

  const found: string[] = [];
  for (const div of divisions) {
    if (div.pattern.test(lower)) found.push(div.label);
  }

  return found.length > 0 ? found.join(', ') : undefined;
}

function extractSkillLevelFromText(text: string): string | undefined {
  const lower = text.toLowerCase();
  const levels: string[] = [];

  if (/beginner|introduct|learn\s*to\s*play|first\s*time|novice|never\s*played/i.test(lower)) levels.push('beginner');
  if (/intermediate|some\s*experience|recreational|rec\s*level|house\s*league/i.test(lower)) levels.push('intermediate');
  if (/advanced|experienced|competitive|travel\s*team/i.test(lower)) levels.push('advanced');
  if (/elite|aaa|aa[^a-z]|tier\s*1|select|high\s*performance|prospect|pre-?nhl|showcase/i.test(lower)) levels.push('elite');
  if (/all\s*levels|any\s*level|all\s*skill|every\s*level|open\s*to\s*all/i.test(lower)) levels.push('all levels');

  return levels.length > 0 ? levels.join(', ') : undefined;
}

// ═══════════════════════════════════════════════════════════════
// SCHEDULE / TIME EXTRACTION
// ═══════════════════════════════════════════════════════════════

function extractScheduleFromText(text: string): string[] {
  const schedules: string[] = [];

  // Time range patterns: "9:00 AM - 3:00 PM", "09:00-15:00"
  const timePatterns = [
    /\d{1,2}:\d{2}\s*(?:AM|PM|am|pm)?\s*[-–—to]+\s*\d{1,2}:\d{2}\s*(?:AM|PM|am|pm)?/g,
    /(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|Mon|Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*\s*[-–:]\s*\d{1,2}:\d{2}/gi,
  ];

  for (const pattern of timePatterns) {
    const matches = text.match(pattern);
    if (matches) schedules.push(...matches);
  }

  return [...new Set(schedules)].slice(0, 10);
}

// ═══════════════════════════════════════════════════════════════
// AMENITY EXTRACTION
// ═══════════════════════════════════════════════════════════════

function extractAmenitiesFromText(text: string): string[] {
  const lower = text.toLowerCase();
  const amenities: string[] = [];

  const amenityPatterns: [RegExp, string][] = [
    [/jersey|jerseys?\s*included/i, 'Jersey included'],
    [/lunch\s*(?:included|provided)/i, 'Lunch included'],
    [/meals?\s*(?:included|provided)/i, 'Meals included'],
    [/snack|snacks?\s*(?:included|provided)/i, 'Snacks included'],
    [/video\s*(?:analysis|review|breakdown)/i, 'Video analysis'],
    [/off[- ]?ice\s*training/i, 'Off-ice training'],
    [/dryland|dry[- ]?land/i, 'Dryland training'],
    [/classroom/i, 'Classroom sessions'],
    [/pro\s*shop\s*discount/i, 'Pro shop discount'],
    [/equipment\s*(?:rental|included|provided)/i, 'Equipment provided'],
    [/locker\s*room/i, 'Locker room access'],
    [/goalie\s*equipment/i, 'Goalie equipment available'],
    [/parking/i, 'Parking available'],
    [/transportation|shuttle/i, 'Transportation available'],
    [/accommodation|lodging|housing|dorm/i, 'Accommodation available'],
    [/swim|pool/i, 'Swimming pool'],
    [/certificate|certification/i, 'Certificate of completion'],
    [/photo|photography/i, 'Photo package'],
    [/live\s*stream/i, 'Live streaming'],
    [/parent\s*(?:viewing|area|lounge)/i, 'Parent viewing area'],
  ];

  for (const [pattern, label] of amenityPatterns) {
    if (pattern.test(lower)) amenities.push(label);
  }

  return amenities;
}

// ═══════════════════════════════════════════════════════════════
// IMAGE EXTRACTION
// ═══════════════════════════════════════════════════════════════

function extractImages($: cheerio.CheerioAPI, baseUrl: string): string[] {
  const images: string[] = [];

  $('img[src], img[data-src], img[data-lazy-src]').each((_, el) => {
    const $el = $(el);
    const src = $el.attr('src') || $el.attr('data-src') || $el.attr('data-lazy-src');
    const alt = ($el.attr('alt') || '').toLowerCase();
    const width = parseInt($el.attr('width') || '0', 10);
    const height = parseInt($el.attr('height') || '0', 10);

    if (!src) return;
    // Skip tiny images, icons, tracking pixels
    if (src.includes('pixel') || src.includes('spacer') || src.includes('blank')) return;
    if (src.includes('logo') && !src.includes('hockey')) return;
    if (src.includes('icon') || src.includes('favicon')) return;
    if (src.includes('avatar') || src.includes('gravatar')) return;
    if (src.startsWith('data:') && !src.includes('base64')) return;
    if (width > 0 && width < 50) return;
    if (height > 0 && height < 50) return;

    // Prefer images with hockey-related alt text
    const isRelevant = /hockey|camp|clinic|skating|ice|rink|arena|training|player/i.test(alt) || alt === '';

    if (isRelevant) {
      const resolved = resolveUrl(src, baseUrl);
      if (resolved) images.push(resolved);
    }
  });

  return [...new Set(images)].slice(0, 10);
}

// ═══════════════════════════════════════════════════════════════
// REGISTRATION LINK DISCOVERY
// ═══════════════════════════════════════════════════════════════

function findRegistrationLink($: cheerio.CheerioAPI, baseUrl: string): string | null {
  // Button/link text patterns that indicate registration
  const regTextPatterns = [
    'register now', 'register today', 'register here',
    'sign up now', 'sign up today', 'sign up here',
    'signup', 'enroll now', 'enroll today',
    'book now', 'book your spot', 'reserve your spot',
    'apply now', 'apply today',
    'get tickets', 'buy tickets',
    'join now', 'join today',
    'secure your spot', 'claim your spot',
    'registration', 'learn more and register',
    'click here to register', 'register for',
  ];

  // URL patterns that suggest registration pages
  const regUrlPatterns = [
    /register/, /signup/, /sign-up/, /enroll/,
    /book/, /reserve/, /apply/, /ticket/,
    /registration/, /checkout/,
  ];

  // Check link text first (higher confidence)
  let regUrl: string | null = null;
  $('a').each((_, el) => {
    const $el = $(el);
    const text = $el.text().toLowerCase().trim();
    const href = $el.attr('href');
    if (!href) return;

    // Check button text
    if (regTextPatterns.some((p) => text.includes(p))) {
      regUrl = resolveUrl(href, baseUrl);
      return false; // break
    }

    // Check CSS classes for registration buttons
    const classes = ($el.attr('class') || '').toLowerCase();
    if (/register|signup|enroll|book|cta-button|action-button/.test(classes)) {
      regUrl = resolveUrl(href, baseUrl);
      return false;
    }
  });

  if (regUrl) return regUrl;

  // Fallback: check URLs themselves
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href');
    if (href && regUrlPatterns.some((p) => p.test(href))) {
      regUrl = resolveUrl(href, baseUrl);
      return false;
    }
  });

  return regUrl;
}

// ═══════════════════════════════════════════════════════════════
// PAGE-LEVEL DEDUPLICATION
// ═══════════════════════════════════════════════════════════════

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
          // Keep the more complete field from either source
          description: (result.description && result.description.length > (existing.description?.length || 0))
            ? result.description : existing.description,
          imageUrl: result.imageUrl || existing.imageUrl,
          dateText: result.dateText || existing.dateText,
          startDate: result.startDate || existing.startDate,
          endDate: result.endDate || existing.endDate,
          price: result.price || existing.price,
          contactEmail: result.contactEmail || existing.contactEmail,
          contactPhone: result.contactPhone || existing.contactPhone,
          venue: result.venue || existing.venue,
          location: result.location || existing.location,
          city: result.city || existing.city,
          state: result.state || existing.state,
          country: result.country || existing.country,
          ageRange: result.ageRange || existing.ageRange,
          skillLevel: result.skillLevel || existing.skillLevel,
          coaches: (result.coaches?.length ?? 0) > (existing.coaches?.length ?? 0)
            ? result.coaches : existing.coaches,
          amenities: (result.amenities?.length ?? 0) > (existing.amenities?.length ?? 0)
            ? result.amenities : existing.amenities,
          confidence: Math.max(result.confidence, existing.confidence),
        });
      } else {
        seen.set(key, result);
      }
    }
  }

  return Array.from(seen.values());
}
