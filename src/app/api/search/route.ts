import { NextRequest, NextResponse } from 'next/server';
import { createSearchEngine, SearchConfig } from '@/lib/searchEngine';

// Vercel serverless function config
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

// In-memory server-side cache (persists between warm invocations)
let cachedResults: { data: unknown; timestamp: number } | null = null;
const CACHE_TTL = 15 * 60 * 1000; // 15 minutes

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q') || undefined;
  const forceRefresh = searchParams.get('refresh') === 'true';

  // Check server-side cache first — instant response
  if (!forceRefresh && cachedResults && Date.now() - cachedResults.timestamp < CACHE_TTL) {
    return NextResponse.json(cachedResults.data, {
      headers: {
        'Cache-Control': 'public, max-age=900, stale-while-revalidate=1800',
        'X-Cache': 'HIT',
      },
    });
  }

  // Build search config
  const config: SearchConfig = {
    serpApiKey: process.env.SERP_API_KEY || searchParams.get('serpApiKey') || undefined,
    googleApiKey: process.env.GOOGLE_API_KEY || searchParams.get('googleApiKey') || undefined,
    googleCseId: process.env.GOOGLE_CSE_ID || searchParams.get('googleCseId') || undefined,
    bingApiKey: process.env.BING_API_KEY || searchParams.get('bingApiKey') || undefined,
    eventbriteApiKey: process.env.EVENTBRITE_API_KEY || searchParams.get('eventbriteApiKey') || undefined,
    maxResultsPerSource: 50,
    timeout: 4000,   // 4 seconds per individual source
    maxConcurrent: 6, // 6 parallel fetches at a time
  };

  // HARD DEADLINE: This function MUST return within 50 seconds no matter what.
  // We race the search against a timer. If the timer wins, we return whatever we have.
  try {
    const engine = createSearchEngine(config);

    const results = await Promise.race([
      engine.search(query, forceRefresh),
      // Safety valve — return empty after 48 seconds
      new Promise<{
        clinics: never[];
        sources: { name: string; count: number; status: 'error'; error: string }[];
        totalRaw: number;
        searchDuration: number;
      }>((resolve) =>
        setTimeout(() => resolve({
          clinics: [],
          sources: [{ name: 'deadline', count: 0, status: 'error', error: 'Hard deadline reached' }],
          totalRaw: 0,
          searchDuration: 48000,
        }), 48000)
      ),
    ]);

    const responseData = {
      success: true,
      clinics: results.clinics,
      meta: {
        totalClinics: results.clinics.length,
        totalRawResults: results.totalRaw,
        sources: results.sources,
        searchDuration: results.searchDuration,
        timestamp: new Date().toISOString(),
        query: query || null,
        hasApiKeys: {
          serpApi: !!config.serpApiKey,
          googleCse: !!config.googleApiKey,
          bing: !!config.bingApiKey,
          eventbrite: !!config.eventbriteApiKey,
        },
      },
    };

    // Cache results (even empty ones, to avoid repeated slow searches)
    if (results.clinics.length > 0) {
      cachedResults = { data: responseData, timestamp: Date.now() };
    }

    return NextResponse.json(responseData, {
      headers: {
        'Cache-Control': 'public, max-age=900, stale-while-revalidate=1800',
        'X-Cache': 'MISS',
      },
    });
  } catch (error) {
    console.error('Search API error:', error);
    return NextResponse.json(
      {
        success: true, // Still "success" so the client doesn't show a hard error
        error: error instanceof Error ? error.message : 'Unknown error',
        clinics: [],
        meta: {
          totalClinics: 0,
          totalRawResults: 0,
          sources: [],
          searchDuration: 0,
          timestamp: new Date().toISOString(),
          query: query || null,
          hasApiKeys: {
            serpApi: !!config.serpApiKey,
            googleCse: !!config.googleApiKey,
            bing: !!config.bingApiKey,
            eventbrite: !!config.eventbriteApiKey,
          },
        },
      },
      { status: 200 } // Return 200 so the client can still parse the response
    );
  }
}
