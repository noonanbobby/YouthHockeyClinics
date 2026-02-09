import { NextRequest, NextResponse } from 'next/server';
import { createSearchEngine, SearchConfig } from '@/lib/searchEngine';
import SEED_CLINICS from '@/lib/seedClinics';
import { deduplicateClinics } from '@/lib/deduplicator';
import { calculateDistance } from '@/lib/geocoder';

// Vercel serverless function config
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

// In-memory server-side cache (persists between warm invocations)
let cachedResults: { data: unknown; timestamp: number; key: string } | null = null;
const CACHE_TTL = 15 * 60 * 1000; // 15 minutes

/**
 * Score and sort clinics by relevance (distance + quality).
 * Duplicated here so seeds can be scored even without the search engine.
 */
function scoreAndSort(
  clinics: typeof SEED_CLINICS,
  userLat?: number,
  userLng?: number,
  query?: string,
) {
  // Filter seeds by query if provided
  let filtered = clinics;
  if (query) {
    const q = query.toLowerCase();
    filtered = clinics.filter((c) => {
      const text = `${c.name} ${c.description} ${c.location.city} ${c.location.state} ${c.location.country} ${c.tags.join(' ')}`.toLowerCase();
      return q.split(/\s+/).some((word) => text.includes(word));
    });
  }

  const hasLocation = userLat !== undefined && userLng !== undefined && userLat !== 0;

  return filtered
    .map((clinic) => {
      let score = 0;
      if (hasLocation && clinic.location.lat !== 0 && clinic.location.lng !== 0) {
        const dist = calculateDistance(userLat!, userLng!, clinic.location.lat, clinic.location.lng);
        if (dist < 50) score += 50;
        else if (dist < 150) score += 40;
        else if (dist < 500) score += 30;
        else if (dist < 2000) score += 20;
        else score += 5;
      } else {
        score += 15;
      }
      if (clinic.featured) score += 15;
      if (clinic.rating >= 4.5) score += 10;
      else if (clinic.rating >= 4.0) score += 5;
      if (clinic.reviewCount > 50) score += 5;
      if (clinic.isNew) score += 5;
      if (clinic.featured && clinic.rating >= 4.7 && clinic.reviewCount > 100) score += 20;
      return { clinic, score };
    })
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.clinic.dates.start.localeCompare(b.clinic.dates.start);
    })
    .map((s) => s.clinic);
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q') || undefined;
  const forceRefresh = searchParams.get('refresh') === 'true';

  // Location params for tiered search
  const userLat = parseFloat(searchParams.get('lat') || '0');
  const userLng = parseFloat(searchParams.get('lng') || '0');
  const userCity = searchParams.get('city') || undefined;
  const userState = searchParams.get('state') || undefined;
  const userCountry = searchParams.get('country') || undefined;

  // Build a location-aware cache key so different locations get different results
  const locationKey = userLat ? `${userLat.toFixed(1)},${userLng.toFixed(1)}` : 'global';
  const cacheKey = `${query || '__all__'}:${locationKey}`;

  // Check server-side cache first — instant response
  if (!forceRefresh && cachedResults && cachedResults.key === cacheKey && Date.now() - cachedResults.timestamp < CACHE_TTL) {
    return NextResponse.json(cachedResults.data, {
      headers: {
        'Cache-Control': 'public, max-age=900, stale-while-revalidate=1800',
        'X-Cache': 'HIT',
      },
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // SEEDS-FIRST ARCHITECTURE: Seed clinics are ALWAYS returned.
  // Network-based search results are additive — they can only ADD
  // clinics, never prevent seeds from showing.
  // ═══════════════════════════════════════════════════════════════

  // Prepare seed clinics (always available, no network needed)
  const seedClinics = scoreAndSort(SEED_CLINICS, userLat || undefined, userLng || undefined, query);

  // Build search config from server-side environment variables only (secure)
  const config: SearchConfig = {
    googleApiKey: process.env.GOOGLE_API_KEY || undefined,
    googleCseId: process.env.GOOGLE_CSE_ID || undefined,
    braveApiKey: process.env.BRAVE_API_KEY || undefined,
    tavilyApiKey: process.env.TAVILY_API_KEY || undefined,
    eventbriteApiKey: process.env.EVENTBRITE_API_KEY || undefined,
    maxResultsPerSource: 50,
    timeout: 4000,
    maxConcurrent: 6,
    userLat: userLat || undefined,
    userLng: userLng || undefined,
    userCity,
    userState,
    userCountry,
  };

  const hasAnyApiKey = !!((config.googleApiKey && config.googleCseId) || config.braveApiKey || config.tavilyApiKey || config.eventbriteApiKey);

  // If no API keys and no force refresh, just return seeds immediately (fast path)
  if (!hasAnyApiKey && !forceRefresh && !query) {
    const responseData = {
      success: true,
      clinics: seedClinics,
      meta: {
        totalClinics: seedClinics.length,
        totalRawResults: seedClinics.length,
        sources: [{ name: 'Curated Database', count: seedClinics.length, status: 'success' }],
        searchDuration: 0,
        timestamp: new Date().toISOString(),
        query: null,
        hasApiKeys: { google: false, brave: false, tavily: false, eventbrite: false },
      },
    };
    cachedResults = { data: responseData, timestamp: Date.now(), key: cacheKey };
    return NextResponse.json(responseData, {
      headers: {
        'Cache-Control': 'public, max-age=900, stale-while-revalidate=1800',
        'X-Cache': 'SEEDS',
      },
    });
  }

  // Try network search — but if it fails, we still return seeds
  let networkClinics: typeof SEED_CLINICS = [];
  let networkSources: { name: string; count: number; status: string; error?: string }[] = [];
  let networkRaw = 0;
  let searchDuration = 0;

  try {
    const engine = createSearchEngine(config);

    const results = await Promise.race([
      engine.search(query, forceRefresh),
      // Safety valve — return what we have after 25 seconds
      new Promise<{
        clinics: typeof SEED_CLINICS;
        sources: { name: string; count: number; status: 'error'; error: string }[];
        totalRaw: number;
        searchDuration: number;
      }>((resolve) =>
        setTimeout(() => resolve({
          clinics: [],
          sources: [{ name: 'deadline', count: 0, status: 'error' as const, error: 'Hard deadline reached' }],
          totalRaw: 0,
          searchDuration: 25000,
        }), 25000)
      ),
    ]);

    networkClinics = results.clinics;
    networkSources = results.sources;
    networkRaw = results.totalRaw;
    searchDuration = results.searchDuration;
  } catch (error) {
    console.error('Search engine error (seeds still returned):', error);
    networkSources = [{ name: 'error', count: 0, status: 'error', error: String(error) }];
  }

  // ALWAYS combine seeds + network results, then deduplicate
  const combined = deduplicateClinics([...seedClinics, ...networkClinics]);
  const finalClinics = scoreAndSort(combined, userLat || undefined, userLng || undefined, query);

  const allSources = [
    { name: 'Curated Database', count: seedClinics.length, status: 'success' },
    ...networkSources,
  ];

  const responseData = {
    success: true,
    clinics: finalClinics,
    meta: {
      totalClinics: finalClinics.length,
      totalRawResults: networkRaw + seedClinics.length,
      sources: allSources,
      searchDuration,
      timestamp: new Date().toISOString(),
      query: query || null,
      hasApiKeys: {
        google: !!(config.googleApiKey && config.googleCseId),
        brave: !!config.braveApiKey,
        tavily: !!config.tavilyApiKey,
        eventbrite: !!config.eventbriteApiKey,
      },
    },
  };

  // Cache results
  if (finalClinics.length > 0) {
    cachedResults = { data: responseData, timestamp: Date.now(), key: cacheKey };
  }

  return NextResponse.json(responseData, {
    headers: {
      'Cache-Control': 'public, max-age=900, stale-while-revalidate=1800',
      'X-Cache': 'MISS',
    },
  });
}
