import { NextRequest, NextResponse } from 'next/server';
import { createSearchEngine, SearchConfig } from '@/lib/searchEngine';
import SEED_CLINICS from '@/lib/seedClinics';
import { deduplicateClinics } from '@/lib/deduplicator';
import { calculateDistance } from '@/lib/geocoder';
import type { Clinic } from '@/types';

// Vercel serverless function config
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

// In-memory server-side cache (persists between warm invocations)
let cachedResults: { data: unknown; timestamp: number; key: string } | null = null;
const CACHE_TTL = 15 * 60 * 1000; // 15 minutes

/**
 * Score and sort clinics by relevance (distance + quality).
 * Works with both seed clinics and network-sourced Clinic objects.
 */
function scoreAndSort(
  clinics: Clinic[],
  userLat?: number,
  userLng?: number,
  query?: string,
): Clinic[] {
  // Filter by query if provided
  let filtered = clinics;
  if (query && query.trim().length > 0) {
    const words = query
      .toLowerCase()
      .trim()
      .split(/\s+/)
      .filter((w) => w.length > 1);

    if (words.length > 0) {
      filtered = clinics.filter((c) => {
        const text = [
          c.name,
          c.description,
          c.location.city,
          c.location.state ?? '',
          c.location.country,
          ...(c.tags ?? []),
        ]
          .join(' ')
          .toLowerCase();
        return words.some((word) => text.includes(word));
      });
    }
  }

  const hasLocation =
    userLat !== undefined &&
    userLng !== undefined &&
    !isNaN(userLat) &&
    !isNaN(userLng) &&
    userLat !== 0 &&
    userLng !== 0;

  return filtered
    .map((clinic) => {
      let score = 0;

      if (
        hasLocation &&
        clinic.location.lat !== 0 &&
        clinic.location.lng !== 0
      ) {
        const dist = calculateDistance(
          userLat!,
          userLng!,
          clinic.location.lat,
          clinic.location.lng,
        );
        if (dist < 50) score += 50;
        else if (dist < 150) score += 40;
        else if (dist < 500) score += 30;
        else if (dist < 2000) score += 20;
        else score += 5;
      } else {
        score += 15;
      }

      if (clinic.featured) score += 15;
      if ((clinic.rating ?? 0) >= 4.5) score += 10;
      else if ((clinic.rating ?? 0) >= 4.0) score += 5;
      if ((clinic.reviewCount ?? 0) > 50) score += 5;
      if (clinic.isNew) score += 5;
      if (
        clinic.featured &&
        (clinic.rating ?? 0) >= 4.7 &&
        (clinic.reviewCount ?? 0) > 100
      )
        score += 20;

      return { clinic, score };
    })
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return (a.clinic.dates?.start ?? '').localeCompare(
        b.clinic.dates?.start ?? '',
      );
    })
    .map((s) => s.clinic);
}

/**
 * Validate and sanitize a numeric coordinate from query params.
 */
function parseCoord(value: string | null): number {
  if (!value) return 0;
  const n = parseFloat(value);
  return isNaN(n) ? 0 : n;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Sanitize query — strip any HTML/script injection attempts
    const rawQuery = searchParams.get('q') ?? '';
    const query = rawQuery.replace(/<[^>]*>/g, '').trim() || undefined;

    const forceRefresh = searchParams.get('refresh') === 'true';

    // Location params — read server-side only, never trust client for auth
    const userLat = parseCoord(searchParams.get('lat'));
    const userLng = parseCoord(searchParams.get('lng'));
    const userCity = searchParams.get('city')?.slice(0, 100) || undefined;
    const userState = searchParams.get('state')?.slice(0, 100) || undefined;
    const userCountry = searchParams.get('country')?.slice(0, 100) || undefined;

    // Build a location-aware cache key
    const locationKey =
      userLat !== 0
        ? `${userLat.toFixed(1)},${userLng.toFixed(1)}`
        : 'global';
    const cacheKey = `${query ?? '__all__'}:${locationKey}`;

    // ── Server-side cache check ──────────────────────────────────────────
    if (
      !forceRefresh &&
      cachedResults &&
      cachedResults.key === cacheKey &&
      Date.now() - cachedResults.timestamp < CACHE_TTL
    ) {
      return NextResponse.json(cachedResults.data, {
        headers: {
          'Cache-Control': 'public, max-age=900, stale-while-revalidate=1800',
          'X-Cache': 'HIT',
        },
      });
    }

    // ═══════════════════════════════════════════════════════════════════
    // SEEDS-FIRST ARCHITECTURE
    // Seed clinics are ALWAYS returned. Network results are additive.
    // API keys are ONLY read from server-side env vars — never from the
    // client request. This prevents key leakage to the browser.
    // ═══════════════════════════════════════════════════════════════════

    // Cast seeds to Clinic[] — seedClinics satisfies the full Clinic type
    const seedClinics = scoreAndSort(
      SEED_CLINICS as unknown as Clinic[],
      userLat || undefined,
      userLng || undefined,
      query,
    );

    // Build config exclusively from server-side environment variables
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

    const hasAnyApiKey = !!(
      (config.googleApiKey && config.googleCseId) ||
      config.braveApiKey ||
      config.tavilyApiKey ||
      config.eventbriteApiKey
    );

    // Fast path: no API keys configured — return seeds immediately
    if (!hasAnyApiKey && !forceRefresh) {
      const responseData = buildResponse({
        finalClinics: seedClinics,
        networkRaw: seedClinics.length,
        sources: [
          {
            name: 'Curated Database',
            count: seedClinics.length,
            status: 'success' as const,
          },
        ],
        searchDuration: 0,
        query,
        config,
      });

      cachedResults = {
        data: responseData,
        timestamp: Date.now(),
        key: cacheKey,
      };

      return NextResponse.json(responseData, {
        headers: {
          'Cache-Control': 'public, max-age=900, stale-while-revalidate=1800',
          'X-Cache': 'SEEDS',
        },
      });
    }

    // ── Network search ───────────────────────────────────────────────────
    let networkClinics: Clinic[] = [];
    let networkSources: {
      name: string;
      count: number;
      status: string;
      error?: string;
    }[] = [];
    let networkRaw = 0;
    let searchDuration = 0;

    try {
      const engine = createSearchEngine(config);

      const HARD_DEADLINE_MS = 25_000;

      const results = await Promise.race([
        engine.search(query, forceRefresh),
        new Promise<{
          clinics: Clinic[];
          sources: { name: string; count: number; status: 'error'; error: string }[];
          totalRaw: number;
          searchDuration: number;
        }>((resolve) =>
          setTimeout(
            () =>
              resolve({
                clinics: [],
                sources: [
                  {
                    name: 'deadline',
                    count: 0,
                    status: 'error' as const,
                    error: 'Hard deadline reached',
                  },
                ],
                totalRaw: 0,
                searchDuration: HARD_DEADLINE_MS,
              }),
            HARD_DEADLINE_MS,
          ),
        ),
      ]);

      networkClinics = results.clinics as Clinic[];
      networkSources = results.sources;
      networkRaw = results.totalRaw;
      searchDuration = results.searchDuration;
    } catch (error) {
      console.error(
        '[search/route] Search engine error (seeds still returned):',
        error,
      );
      networkSources = [
        {
          name: 'error',
          count: 0,
          status: 'error',
          error: error instanceof Error ? error.message : String(error),
        },
      ];
    }

    // ALWAYS combine seeds + network, then deduplicate
    const combined = deduplicateClinics([
      ...seedClinics,
      ...networkClinics,
    ]);

    const finalClinics = scoreAndSort(
      combined,
      userLat || undefined,
      userLng || undefined,
      query,
    );

    const allSources = [
      {
        name: 'Curated Database',
        count: seedClinics.length,
        status: 'success' as const,
      },
      ...networkSources,
    ];

    const responseData = buildResponse({
      finalClinics,
      networkRaw: networkRaw + seedClinics.length,
      sources: allSources,
      searchDuration,
      query,
      config,
    });

    // Only cache non-empty results
    if (finalClinics.length > 0) {
      cachedResults = {
        data: responseData,
        timestamp: Date.now(),
        key: cacheKey,
      };
    }

    return NextResponse.json(responseData, {
      headers: {
        'Cache-Control': 'public, max-age=900, stale-while-revalidate=1800',
        'X-Cache': 'MISS',
      },
    });
  } catch (err) {
    console.error('[search/route] Unhandled error:', err);

    // Always return seeds as a last resort — never a blank 500
    const fallback = scoreAndSort(SEED_CLINICS as unknown as Clinic[]);
    return NextResponse.json(
      {
        success: true,
        clinics: fallback,
        meta: {
          totalClinics: fallback.length,
          totalRawResults: fallback.length,
          sources: [
            {
              name: 'Curated Database (fallback)',
              count: fallback.length,
              status: 'success',
            },
          ],
          searchDuration: 0,
          timestamp: new Date().toISOString(),
          query: null,
          hasApiKeys: {
            google: false,
            brave: false,
            tavily: false,
            eventbrite: false,
          },
          error: 'Search encountered an error; showing curated results.',
        },
      },
      {
        status: 200, // Still 200 — client always gets usable data
        headers: {
          'Cache-Control': 'no-store',
          'X-Cache': 'ERROR-FALLBACK',
        },
      },
    );
  }
}

// ── Helper ────────────────────────────────────────────────────────────────────

interface BuildResponseParams {
  finalClinics: Clinic[];
  networkRaw: number;
  sources: { name: string; count: number; status: string; error?: string }[];
  searchDuration: number;
  query: string | undefined;
  config: SearchConfig;
}

function buildResponse({
  finalClinics,
  networkRaw,
  sources,
  searchDuration,
  query,
  config,
}: BuildResponseParams) {
  return {
    success: true,
    clinics: finalClinics,
    meta: {
      totalClinics: finalClinics.length,
      totalRawResults: networkRaw,
      sources,
      searchDuration,
      timestamp: new Date().toISOString(),
      query: query ?? null,
      // Only expose boolean flags — never the actual key values
      hasApiKeys: {
        google: !!(config.googleApiKey && config.googleCseId),
        brave: !!config.braveApiKey,
        tavily: !!config.tavilyApiKey,
        eventbrite: !!config.eventbriteApiKey,
      },
    },
  };
}
