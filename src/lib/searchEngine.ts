/**
 * Multi-Source Hockey Clinic Search Engine
 *
 * This engine searches across multiple internet sources to discover
 * youth hockey clinics globally. It combines:
 *
 * 1. Direct web scraping of known hockey organization websites
 * 2. Search engine APIs (Google Custom Search, SerpAPI, Bing)
 * 3. Event platform APIs (Eventbrite, etc.)
 * 4. RSS/Atom feed aggregation
 * 5. Intelligent HTML parsing and data extraction
 * 6. Deduplication and geo-enrichment
 *
 * Each source provider implements a common interface and results
 * are merged, deduplicated, scored for relevance, and cached.
 */

import { Clinic } from '@/types';
import { extractClinicsFromHTML } from './extractor';
import { deduplicateClinics } from './deduplicator';
import { geocodeLocation } from './geocoder';

export interface SearchSource {
  name: string;
  type: 'scraper' | 'search_api' | 'event_api' | 'rss';
  enabled: boolean;
  requiresApiKey: boolean;
  search: (query: string, config: SearchConfig) => Promise<RawClinicData[]>;
}

export interface SearchConfig {
  serpApiKey?: string;
  googleApiKey?: string;
  googleCseId?: string;
  bingApiKey?: string;
  eventbriteApiKey?: string;
  maxResultsPerSource?: number;
  timeout?: number;
}

export interface RawClinicData {
  source: string;
  sourceUrl: string;
  name?: string;
  description?: string;
  location?: string;
  venue?: string;
  city?: string;
  state?: string;
  country?: string;
  dateText?: string;
  startDate?: string;
  endDate?: string;
  price?: string;
  priceAmount?: number;
  currency?: string;
  ageRange?: string;
  skillLevel?: string;
  imageUrl?: string;
  registrationUrl?: string;
  websiteUrl?: string;
  contactEmail?: string;
  contactPhone?: string;
  coaches?: string[];
  amenities?: string[];
  rawHtml?: string;
  confidence: number; // 0-1, how confident we are this is a real hockey clinic
}

/**
 * The primary search queries we use across all sources.
 * These are carefully crafted to maximize discovery.
 */
export const SEARCH_QUERIES = [
  // English - broad
  'youth hockey clinic 2026',
  'youth hockey camp 2026',
  'hockey skills camp kids',
  'youth hockey development program',
  'learn to play hockey kids',
  'hockey skating clinic youth',
  'junior hockey camp summer 2026',
  'hockey school registration',
  'youth hockey showcase',
  'hockey training camp children',
  // Positional / specialized
  'youth goaltending camp',
  'hockey power skating clinic',
  'hockey defense clinic youth',
  'hockey forward skills camp',
  // Regional - North America
  'USA hockey camp registration',
  'hockey canada camp youth',
  'AAA hockey camp',
  'travel hockey clinic',
  'NHL hockey school youth',
  // Regional - Europe
  'ice hockey camp europe',
  'hockey camp sweden',
  'hockey camp finland',
  'eishockey camp jugend', // German
  'hockey sur glace stage jeunes', // French
  'hokej na lodzie obóz młodzieżowy', // Polish
  'ishockey camp ungdom', // Swedish/Norwegian
  'jääkiekkokoulu', // Finnish - hockey school
  // Regional - Other
  'ice hockey camp japan',
  'ice hockey camp australia',
  'hockey camp south korea',
  'ice hockey development asia',
];

/**
 * Known hockey organization URLs to scrape for clinic data.
 * These are major organizations that regularly post youth events.
 */
export const KNOWN_SOURCES: { name: string; url: string; region: string }[] = [
  // USA
  { name: 'USA Hockey', url: 'https://www.usahockey.com/camps', region: 'US' },
  { name: 'USA Hockey Events', url: 'https://www.usahockey.com/events', region: 'US' },
  // Canada
  { name: 'Hockey Canada', url: 'https://www.hockeycanada.ca/en-ca/hockey-programs/players/develop', region: 'CA' },
  // International
  { name: 'IIHF Development', url: 'https://www.iihf.hockey/en/events', region: 'International' },
  // Sweden
  { name: 'Swedish Hockey', url: 'https://www.swehockey.se/for-spelare/hockeyskolor/', region: 'SE' },
  // Finland
  { name: 'Finnish Hockey', url: 'https://www.leijonat.fi/index.php/pelaajalle', region: 'FI' },
  // Platforms
  { name: 'Eventbrite Hockey', url: 'https://www.eventbrite.com/d/online/youth-hockey-camp/', region: 'Global' },
  { name: 'Active.com Hockey', url: 'https://www.active.com/hockey/camps', region: 'US' },
  // Major camp organizers
  { name: 'Hockey Night in Canada Camps', url: 'https://www.hockeycanada.ca/en-ca/hockey-programs/players/camps', region: 'CA' },
  { name: 'Pro Ambitions', url: 'https://www.proambitions.com/', region: 'US' },
  { name: 'Laura Stamm Power Skating', url: 'https://www.laurastamm.com/', region: 'US' },
  { name: 'Bauer Hockey', url: 'https://www.bauer.com/en-US/hockey-camps/', region: 'Global' },
  { name: 'CCM Hockey', url: 'https://www.ccmhockey.com/en/camps', region: 'Global' },
  // State/Provincial associations
  { name: 'Massachusetts Hockey', url: 'https://www.mahockey.org/camps', region: 'US' },
  { name: 'Minnesota Hockey', url: 'https://www.minnesotahockey.org/camps', region: 'US' },
  { name: 'Michigan Hockey', url: 'https://www.maha.org/camps', region: 'US' },
  { name: 'Ontario Hockey', url: 'https://www.ohf.on.ca/programs', region: 'CA' },
  { name: 'BC Hockey', url: 'https://www.bchockey.net/Programs.aspx', region: 'CA' },
];

/**
 * Main search engine class that orchestrates all sources
 */
export class ClinicSearchEngine {
  private config: SearchConfig;
  private cache: Map<string, { data: Clinic[]; timestamp: number }> = new Map();
  private cacheTTL = 30 * 60 * 1000; // 30 minutes

  constructor(config: SearchConfig = {}) {
    this.config = {
      maxResultsPerSource: 50,
      timeout: 15000,
      ...config,
    };
  }

  updateConfig(config: Partial<SearchConfig>) {
    this.config = { ...this.config, ...config };
  }

  /**
   * Main search method - searches across all available sources
   */
  async search(query?: string, forceRefresh = false): Promise<{
    clinics: Clinic[];
    sources: { name: string; count: number; status: 'success' | 'error'; error?: string }[];
    totalRaw: number;
    searchDuration: number;
  }> {
    const startTime = Date.now();
    const cacheKey = query || '__all__';

    // Check cache
    if (!forceRefresh) {
      const cached = this.cache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
        return {
          clinics: cached.data,
          sources: [{ name: 'cache', count: cached.data.length, status: 'success' }],
          totalRaw: cached.data.length,
          searchDuration: Date.now() - startTime,
        };
      }
    }

    const allRawData: RawClinicData[] = [];
    const sourceResults: { name: string; count: number; status: 'success' | 'error'; error?: string }[] = [];

    // 1. Scrape known sources
    const scrapePromises = KNOWN_SOURCES.map(async (source) => {
      try {
        const results = await this.scrapeSource(source.url, source.name);
        return { name: source.name, results, status: 'success' as const };
      } catch (e) {
        return { name: source.name, results: [] as RawClinicData[], status: 'error' as const, error: String(e) };
      }
    });

    // 2. Search via APIs (if configured)
    const searchPromises: Promise<{ name: string; results: RawClinicData[]; status: 'success' | 'error'; error?: string }>[] = [];

    const searchQueries = query ? [query] : SEARCH_QUERIES.slice(0, 10);

    if (this.config.serpApiKey) {
      for (const q of searchQueries.slice(0, 5)) {
        searchPromises.push(this.searchViaSerpApi(q));
      }
    }

    if (this.config.googleApiKey && this.config.googleCseId) {
      for (const q of searchQueries.slice(0, 5)) {
        searchPromises.push(this.searchViaGoogleCSE(q));
      }
    }

    if (this.config.bingApiKey) {
      for (const q of searchQueries.slice(0, 5)) {
        searchPromises.push(this.searchViaBing(q));
      }
    }

    // 3. Search Eventbrite API if key available
    if (this.config.eventbriteApiKey) {
      searchPromises.push(this.searchEventbrite(query || 'youth hockey'));
    }

    // Execute all searches in parallel with timeout
    const allPromises = [...scrapePromises, ...searchPromises];
    const results = await Promise.allSettled(
      allPromises.map((p) =>
        Promise.race([
          p,
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Timeout')), this.config.timeout)
          ),
        ])
      )
    );

    for (const result of results) {
      if (result.status === 'fulfilled') {
        const r = result.value;
        sourceResults.push({
          name: r.name,
          count: r.results.length,
          status: r.status,
          error: 'error' in r ? r.error : undefined,
        });
        allRawData.push(...r.results);
      } else {
        sourceResults.push({
          name: 'unknown',
          count: 0,
          status: 'error',
          error: result.reason?.message || 'Unknown error',
        });
      }
    }

    // 4. Process raw data into structured clinics
    const processedClinics = await this.processRawData(allRawData);

    // 5. Deduplicate
    const deduped = deduplicateClinics(processedClinics);

    // 6. Geo-enrich (add coordinates)
    const enriched = await this.geoEnrich(deduped);

    // 7. Sort by relevance/date
    const sorted = enriched.sort((a, b) => {
      // Featured first, then by date
      if (a.featured !== b.featured) return a.featured ? -1 : 1;
      return a.dates.start.localeCompare(b.dates.start);
    });

    // Cache results
    this.cache.set(cacheKey, { data: sorted, timestamp: Date.now() });

    return {
      clinics: sorted,
      sources: sourceResults,
      totalRaw: allRawData.length,
      searchDuration: Date.now() - startTime,
    };
  }

  /**
   * Scrape a known source URL for clinic data
   */
  private async scrapeSource(url: string, sourceName: string): Promise<RawClinicData[]> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'HockeyClinicsBot/1.0 (youth hockey clinic aggregator)',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const html = await response.text();
      return extractClinicsFromHTML(html, url, sourceName);
    } catch (error) {
      console.error(`Failed to scrape ${sourceName} (${url}):`, error);
      return [];
    }
  }

  /**
   * Search via SerpAPI
   */
  private async searchViaSerpApi(query: string): Promise<{
    name: string;
    results: RawClinicData[];
    status: 'success' | 'error';
    error?: string;
  }> {
    try {
      const params = new URLSearchParams({
        q: query,
        api_key: this.config.serpApiKey!,
        engine: 'google',
        num: '20',
        gl: 'us',
        hl: 'en',
      });

      const response = await fetch(`https://serpapi.com/search.json?${params}`, {
        signal: AbortSignal.timeout(this.config.timeout!),
      });

      if (!response.ok) throw new Error(`SerpAPI HTTP ${response.status}`);

      const data = await response.json();
      const results: RawClinicData[] = [];

      // Process organic results
      for (const result of data.organic_results || []) {
        results.push({
          source: 'SerpAPI',
          sourceUrl: result.link,
          name: result.title,
          description: result.snippet,
          websiteUrl: result.link,
          registrationUrl: result.link,
          confidence: this.calculateConfidence(result.title, result.snippet),
        });

        // Also try to scrape the actual page for more details
        try {
          const pageResults = await this.scrapeSource(result.link, `SerpAPI>${result.title}`);
          results.push(...pageResults);
        } catch {
          // Failed to scrape detail page, skip
        }
      }

      return { name: `SerpAPI: "${query}"`, results, status: 'success' };
    } catch (error) {
      return { name: `SerpAPI: "${query}"`, results: [], status: 'error', error: String(error) };
    }
  }

  /**
   * Search via Google Custom Search Engine API
   */
  private async searchViaGoogleCSE(query: string): Promise<{
    name: string;
    results: RawClinicData[];
    status: 'success' | 'error';
    error?: string;
  }> {
    try {
      const params = new URLSearchParams({
        key: this.config.googleApiKey!,
        cx: this.config.googleCseId!,
        q: query,
        num: '10',
      });

      const response = await fetch(`https://www.googleapis.com/customsearch/v1?${params}`, {
        signal: AbortSignal.timeout(this.config.timeout!),
      });

      if (!response.ok) throw new Error(`Google CSE HTTP ${response.status}`);

      const data = await response.json();
      const results: RawClinicData[] = [];

      for (const item of data.items || []) {
        results.push({
          source: 'Google CSE',
          sourceUrl: item.link,
          name: item.title,
          description: item.snippet,
          imageUrl: item.pagemap?.cse_image?.[0]?.src,
          websiteUrl: item.link,
          registrationUrl: item.link,
          confidence: this.calculateConfidence(item.title, item.snippet),
        });
      }

      return { name: `Google CSE: "${query}"`, results, status: 'success' };
    } catch (error) {
      return { name: `Google CSE: "${query}"`, results: [], status: 'error', error: String(error) };
    }
  }

  /**
   * Search via Bing Search API
   */
  private async searchViaBing(query: string): Promise<{
    name: string;
    results: RawClinicData[];
    status: 'success' | 'error';
    error?: string;
  }> {
    try {
      const params = new URLSearchParams({
        q: query,
        count: '20',
        mkt: 'en-US',
      });

      const response = await fetch(`https://api.bing.microsoft.com/v7.0/search?${params}`, {
        headers: { 'Ocp-Apim-Subscription-Key': this.config.bingApiKey! },
        signal: AbortSignal.timeout(this.config.timeout!),
      });

      if (!response.ok) throw new Error(`Bing HTTP ${response.status}`);

      const data = await response.json();
      const results: RawClinicData[] = [];

      for (const result of data.webPages?.value || []) {
        results.push({
          source: 'Bing Search',
          sourceUrl: result.url,
          name: result.name,
          description: result.snippet,
          websiteUrl: result.url,
          registrationUrl: result.url,
          confidence: this.calculateConfidence(result.name, result.snippet),
        });
      }

      return { name: `Bing: "${query}"`, results, status: 'success' };
    } catch (error) {
      return { name: `Bing: "${query}"`, results: [], status: 'error', error: String(error) };
    }
  }

  /**
   * Search Eventbrite API for hockey events
   */
  private async searchEventbrite(query: string): Promise<{
    name: string;
    results: RawClinicData[];
    status: 'success' | 'error';
    error?: string;
  }> {
    try {
      const params = new URLSearchParams({
        q: query,
        categories: '108', // Sports & fitness
        subcategories: '8003', // Hockey
        expand: 'venue,organizer',
      });

      const response = await fetch(`https://www.eventbriteapi.com/v3/events/search/?${params}`, {
        headers: {
          Authorization: `Bearer ${this.config.eventbriteApiKey}`,
        },
        signal: AbortSignal.timeout(this.config.timeout!),
      });

      if (!response.ok) throw new Error(`Eventbrite HTTP ${response.status}`);

      const data = await response.json();
      const results: RawClinicData[] = [];

      for (const event of data.events || []) {
        results.push({
          source: 'Eventbrite',
          sourceUrl: event.url,
          name: event.name?.text,
          description: event.description?.text?.substring(0, 500),
          imageUrl: event.logo?.url,
          venue: event.venue?.name,
          city: event.venue?.address?.city,
          state: event.venue?.address?.region,
          country: event.venue?.address?.country,
          startDate: event.start?.utc,
          endDate: event.end?.utc,
          websiteUrl: event.url,
          registrationUrl: event.url,
          confidence: 0.8,
        });
      }

      return { name: 'Eventbrite', results, status: 'success' };
    } catch (error) {
      return { name: 'Eventbrite', results: [], status: 'error', error: String(error) };
    }
  }

  /**
   * Calculate confidence score that a result is a real hockey clinic
   */
  private calculateConfidence(title?: string, description?: string): number {
    if (!title && !description) return 0;
    const text = `${title || ''} ${description || ''}`.toLowerCase();

    let score = 0;

    // Strong indicators
    const strongKeywords = ['hockey clinic', 'hockey camp', 'hockey school', 'hockey academy',
      'skating clinic', 'hockey training', 'hockey program', 'hockey development',
      'learn to play hockey', 'hockey skills', 'hockey tournament', 'hockey showcase'];
    for (const kw of strongKeywords) {
      if (text.includes(kw)) score += 0.3;
    }

    // Youth indicators
    const youthKeywords = ['youth', 'kids', 'children', 'junior', 'minor', 'young',
      'mite', 'squirt', 'peewee', 'bantam', 'midget', 'u14', 'u16', 'u18',
      'ages 6', 'ages 8', 'ages 10', 'ages 12', 'ages 14'];
    for (const kw of youthKeywords) {
      if (text.includes(kw)) score += 0.15;
    }

    // Registration indicators
    const regKeywords = ['register', 'registration', 'sign up', 'enroll', 'book now',
      'spots available', 'limited spots'];
    for (const kw of regKeywords) {
      if (text.includes(kw)) score += 0.1;
    }

    // Negative indicators (reduce score for non-clinic content)
    const negKeywords = ['nhl scores', 'game recap', 'trade rumor', 'fantasy hockey',
      'watch live', 'highlights', 'standings', 'news article', 'opinion'];
    for (const kw of negKeywords) {
      if (text.includes(kw)) score -= 0.2;
    }

    return Math.max(0, Math.min(1, score));
  }

  /**
   * Process raw data into structured Clinic objects
   */
  private async processRawData(rawData: RawClinicData[]): Promise<Clinic[]> {
    // Filter by confidence threshold
    const confident = rawData.filter((r) => r.confidence >= 0.3);

    return confident.map((raw, index) => {
      const id = `clinic-${Date.now()}-${index}-${Math.random().toString(36).substring(2, 8)}`;

      // Parse dates
      const { startDate, endDate } = this.parseDates(raw);

      // Parse price
      const { amount, currency } = this.parsePrice(raw);

      // Determine age groups
      const ageGroups = this.parseAgeGroups(raw);

      // Determine skill levels
      const skillLevels = this.parseSkillLevels(raw);

      // Determine type
      const clinicType = this.parseClinicType(raw);

      // Build location
      const location = {
        venue: raw.venue || raw.location || 'Venue TBD',
        address: '',
        city: raw.city || this.extractCity(raw) || 'Unknown',
        state: raw.state || '',
        country: raw.country || this.inferCountry(raw) || 'Unknown',
        countryCode: this.getCountryCode(raw.country || this.inferCountry(raw) || ''),
        lat: 0,
        lng: 0,
      };

      const clinic: Clinic = {
        id,
        name: raw.name || 'Hockey Clinic',
        type: clinicType,
        description: (raw.description || '').substring(0, 200),
        longDescription: raw.description || '',
        imageUrl: raw.imageUrl || '',
        galleryUrls: raw.imageUrl ? [raw.imageUrl] : [],
        location,
        dates: { start: startDate, end: endDate },
        schedule: [],
        duration: this.calculateDuration(startDate, endDate),
        price: { amount, currency },
        ageGroups,
        skillLevels,
        coaches: (raw.coaches || []).map((name, i) => ({
          id: `coach-${id}-${i}`,
          name,
          title: 'Instructor',
          bio: '',
          photoUrl: '',
          credentials: [],
        })),
        maxParticipants: 50,
        spotsRemaining: 25,
        registrationUrl: raw.registrationUrl || raw.websiteUrl || raw.sourceUrl,
        websiteUrl: raw.websiteUrl || raw.sourceUrl,
        contactEmail: raw.contactEmail || '',
        contactPhone: raw.contactPhone || '',
        amenities: raw.amenities || [],
        includes: [],
        tags: this.generateTags(raw),
        featured: raw.confidence >= 0.7,
        isNew: true,
        rating: 0,
        reviewCount: 0,
        createdAt: new Date().toISOString().split('T')[0],
      };

      return clinic;
    });
  }

  private parseDates(raw: RawClinicData): { startDate: string; endDate: string } {
    if (raw.startDate && raw.endDate) {
      return {
        startDate: raw.startDate.split('T')[0],
        endDate: raw.endDate.split('T')[0],
      };
    }

    if (raw.dateText) {
      // Try to extract dates from text
      const datePatterns = [
        // "July 14-18, 2026"
        /(\w+ \d{1,2})\s*[-–]\s*(\d{1,2}),?\s*(\d{4})/i,
        // "July 14, 2026 - July 18, 2026"
        /(\w+ \d{1,2},?\s*\d{4})\s*[-–]\s*(\w+ \d{1,2},?\s*\d{4})/i,
        // "7/14/2026 - 7/18/2026"
        /(\d{1,2}\/\d{1,2}\/\d{4})\s*[-–]\s*(\d{1,2}\/\d{1,2}\/\d{4})/i,
        // "2026-07-14"
        /(\d{4}-\d{2}-\d{2})/i,
      ];

      for (const pattern of datePatterns) {
        const match = raw.dateText.match(pattern);
        if (match) {
          try {
            const start = new Date(match[1]).toISOString().split('T')[0];
            const end = match[2]
              ? new Date(match[2]).toISOString().split('T')[0]
              : start;
            if (start !== 'Invalid Date') return { startDate: start, endDate: end };
          } catch {
            // Continue to next pattern
          }
        }
      }
    }

    // Default: set to future date
    const future = new Date();
    future.setMonth(future.getMonth() + 3);
    const dateStr = future.toISOString().split('T')[0];
    return { startDate: dateStr, endDate: dateStr };
  }

  private parsePrice(raw: RawClinicData): { amount: number; currency: string } {
    if (raw.priceAmount && raw.currency) {
      return { amount: raw.priceAmount, currency: raw.currency };
    }

    if (raw.price) {
      // Extract price from text like "$299", "€150", "CAD 400"
      const match = raw.price.match(/[$€£¥]?\s*(\d[\d,]*\.?\d*)\s*(USD|CAD|EUR|GBP|AUD|CHF|SEK|NOK|JPY)?/i);
      if (match) {
        const amount = parseFloat(match[1].replace(',', ''));
        let currency = match[2]?.toUpperCase() || 'USD';
        if (raw.price.includes('€')) currency = 'EUR';
        if (raw.price.includes('£')) currency = 'GBP';
        if (raw.price.includes('¥')) currency = 'JPY';
        return { amount, currency };
      }
    }

    return { amount: 0, currency: 'USD' };
  }

  private parseAgeGroups(raw: RawClinicData): Clinic['ageGroups'] {
    const text = `${raw.name || ''} ${raw.description || ''} ${raw.ageRange || ''}`.toLowerCase();
    const groups: Clinic['ageGroups'] = [];

    if (/mite|ages?\s*[4-8]|u[- ]?8/i.test(text)) groups.push('mites');
    if (/squirt|ages?\s*(9|10)|u[- ]?10/i.test(text)) groups.push('squirts');
    if (/peewee|pee.?wee|ages?\s*(11|12)|u[- ]?12/i.test(text)) groups.push('peewee');
    if (/bantam|ages?\s*(13|14)|u[- ]?14/i.test(text)) groups.push('bantam');
    if (/midget|ages?\s*(15|16|17)|u[- ]?16|u[- ]?18/i.test(text)) groups.push('midget');
    if (/junior|ages?\s*(18|19|20)|u[- ]?20/i.test(text)) groups.push('junior');

    return groups.length > 0 ? groups : ['all'];
  }

  private parseSkillLevels(raw: RawClinicData): Clinic['skillLevels'] {
    const text = `${raw.name || ''} ${raw.description || ''} ${raw.skillLevel || ''}`.toLowerCase();
    const levels: Clinic['skillLevels'] = [];

    if (/beginner|learn to play|introduction|introductory|first time|no experience/i.test(text)) levels.push('beginner');
    if (/intermediate/i.test(text)) levels.push('intermediate');
    if (/advanced/i.test(text)) levels.push('advanced');
    if (/elite|aaa|tier 1|select|travel|competitive/i.test(text)) levels.push('elite');

    return levels.length > 0 ? levels : ['all'];
  }

  private parseClinicType(raw: RawClinicData): Clinic['type'] {
    const text = `${raw.name || ''} ${raw.description || ''}`.toLowerCase();

    if (/showcase|exposure|scouting/i.test(text)) return 'showcase';
    if (/tournament|tourney/i.test(text)) return 'tournament';
    if (/camp|summer|week-long|overnight/i.test(text)) return 'camp';
    if (/development|learn to play|intro/i.test(text)) return 'development';
    return 'clinic';
  }

  private extractCity(raw: RawClinicData): string | null {
    const text = `${raw.location || ''} ${raw.description || ''}`;
    // Try to extract city names from common patterns
    const cityMatch = text.match(/(?:in|at|near)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/);
    return cityMatch ? cityMatch[1] : null;
  }

  private inferCountry(raw: RawClinicData): string {
    const text = `${raw.name || ''} ${raw.description || ''} ${raw.location || ''} ${raw.sourceUrl}`.toLowerCase();

    const countryPatterns: [RegExp, string][] = [
      [/canada|ontario|quebec|alberta|british columbia|\.ca\b/i, 'Canada'],
      [/sweden|swedish|stockholm|\.se\b/i, 'Sweden'],
      [/finland|finnish|helsinki|\.fi\b/i, 'Finland'],
      [/czech|prague|\.cz\b/i, 'Czech Republic'],
      [/russia|moscow|\.ru\b/i, 'Russia'],
      [/switzerland|swiss|zurich|davos|\.ch\b/i, 'Switzerland'],
      [/germany|german|munich|berlin|\.de\b/i, 'Germany'],
      [/norway|norwegian|oslo|\.no\b/i, 'Norway'],
      [/japan|japanese|tokyo|sapporo|\.jp\b/i, 'Japan'],
      [/australia|australian|melbourne|sydney|\.au\b/i, 'Australia'],
      [/usa|united states|america|\.com\b/i, 'United States'],
    ];

    for (const [pattern, country] of countryPatterns) {
      if (pattern.test(text)) return country;
    }

    return 'United States'; // Default
  }

  private getCountryCode(country: string): string {
    const codes: Record<string, string> = {
      'United States': 'US', 'Canada': 'CA', 'Sweden': 'SE', 'Finland': 'FI',
      'Czech Republic': 'CZ', 'Russia': 'RU', 'Switzerland': 'CH', 'Germany': 'DE',
      'Norway': 'NO', 'Japan': 'JP', 'Australia': 'AU', 'France': 'FR',
      'United Kingdom': 'GB', 'Denmark': 'DK', 'Austria': 'AT', 'Slovakia': 'SK',
      'South Korea': 'KR', 'China': 'CN', 'Latvia': 'LV', 'Belarus': 'BY',
    };
    return codes[country] || 'US';
  }

  private calculateDuration(start: string, end: string): string {
    const s = new Date(start);
    const e = new Date(end);
    const days = Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    if (days <= 1) return '1 day';
    if (days <= 7) return `${days} days`;
    const weeks = Math.round(days / 7);
    return `${weeks} week${weeks > 1 ? 's' : ''}`;
  }

  private generateTags(raw: RawClinicData): string[] {
    const text = `${raw.name || ''} ${raw.description || ''}`.toLowerCase();
    const tags: string[] = [];

    if (/summer/i.test(text)) tags.push('summer');
    if (/winter/i.test(text)) tags.push('winter');
    if (/spring/i.test(text)) tags.push('spring');
    if (/goaltend|goalie|netminder/i.test(text)) tags.push('goaltending');
    if (/power skat/i.test(text)) tags.push('power-skating');
    if (/shooting/i.test(text)) tags.push('shooting');
    if (/defense|defensive/i.test(text)) tags.push('defense');
    if (/forward/i.test(text)) tags.push('forwards');
    if (/beginner|learn to play/i.test(text)) tags.push('beginner-friendly');
    if (/elite|aaa|select/i.test(text)) tags.push('elite');
    if (/girls|women/i.test(text)) tags.push('girls-hockey');
    if (/overnight|residential/i.test(text)) tags.push('overnight');
    if (raw.city) tags.push(raw.city.toLowerCase().replace(/\s+/g, '-'));

    return [...new Set(tags)];
  }

  /**
   * Add geographic coordinates to clinics that don't have them
   */
  private async geoEnrich(clinics: Clinic[]): Promise<Clinic[]> {
    const enriched = await Promise.all(
      clinics.map(async (clinic) => {
        if (clinic.location.lat !== 0 && clinic.location.lng !== 0) return clinic;

        try {
          const coords = await geocodeLocation(
            `${clinic.location.venue} ${clinic.location.city} ${clinic.location.country}`
          );
          if (coords) {
            return {
              ...clinic,
              location: { ...clinic.location, lat: coords.lat, lng: coords.lng },
            };
          }
        } catch {
          // Skip geo-enrichment on error
        }

        // Fallback: use approximate coordinates for country
        const countryCoords = this.getCountryCoords(clinic.location.country);
        return {
          ...clinic,
          location: { ...clinic.location, ...countryCoords },
        };
      })
    );

    return enriched;
  }

  private getCountryCoords(country: string): { lat: number; lng: number } {
    const coords: Record<string, { lat: number; lng: number }> = {
      'United States': { lat: 39.8283, lng: -98.5795 },
      'Canada': { lat: 56.1304, lng: -106.3468 },
      'Sweden': { lat: 60.1282, lng: 18.6435 },
      'Finland': { lat: 61.9241, lng: 25.7482 },
      'Czech Republic': { lat: 49.8175, lng: 15.4730 },
      'Russia': { lat: 61.5240, lng: 105.3188 },
      'Switzerland': { lat: 46.8182, lng: 8.2275 },
      'Germany': { lat: 51.1657, lng: 10.4515 },
      'Norway': { lat: 60.4720, lng: 8.4689 },
      'Japan': { lat: 36.2048, lng: 138.2529 },
      'Australia': { lat: -25.2744, lng: 133.7751 },
    };
    return coords[country] || { lat: 0, lng: 0 };
  }

  /**
   * Clear the search cache
   */
  clearCache() {
    this.cache.clear();
  }
}

export const createSearchEngine = (config?: SearchConfig) => new ClinicSearchEngine(config);
