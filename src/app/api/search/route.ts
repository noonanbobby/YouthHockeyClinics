import { NextRequest, NextResponse } from 'next/server';
import { createSearchEngine, SearchConfig } from '@/lib/searchEngine';

// In-memory server-side cache
let cachedResults: { data: unknown; timestamp: number } | null = null;
const CACHE_TTL = 15 * 60 * 1000; // 15 minutes

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q') || undefined;
  const forceRefresh = searchParams.get('refresh') === 'true';

  // Check server-side cache
  if (!forceRefresh && cachedResults && Date.now() - cachedResults.timestamp < CACHE_TTL) {
    return NextResponse.json(cachedResults.data, {
      headers: {
        'Cache-Control': 'public, max-age=900, stale-while-revalidate=1800',
        'X-Cache': 'HIT',
      },
    });
  }

  try {
    // Build search config from env vars or request headers
    const config: SearchConfig = {
      serpApiKey: process.env.SERP_API_KEY || searchParams.get('serpApiKey') || undefined,
      googleApiKey: process.env.GOOGLE_API_KEY || searchParams.get('googleApiKey') || undefined,
      googleCseId: process.env.GOOGLE_CSE_ID || searchParams.get('googleCseId') || undefined,
      bingApiKey: process.env.BING_API_KEY || searchParams.get('bingApiKey') || undefined,
      eventbriteApiKey: process.env.EVENTBRITE_API_KEY || searchParams.get('eventbriteApiKey') || undefined,
      maxResultsPerSource: 50,
      timeout: 12000,
    };

    const engine = createSearchEngine(config);
    const results = await engine.search(query, forceRefresh);

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

    // Cache the results
    cachedResults = { data: responseData, timestamp: Date.now() };

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
        success: false,
        error: 'Search failed',
        message: error instanceof Error ? error.message : 'Unknown error',
        clinics: [],
        meta: { totalClinics: 0, sources: [], searchDuration: 0 },
      },
      { status: 500 }
    );
  }
}
