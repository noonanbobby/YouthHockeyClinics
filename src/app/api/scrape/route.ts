import { NextRequest, NextResponse } from 'next/server';
import { extractClinicsFromHTML } from '@/lib/extractor';

/**
 * On-demand scraping endpoint
 * Accepts a URL to scrape and returns extracted clinic data
 */
export async function POST(request: NextRequest) {
  try {
    const { url, sourceName } = await request.json();

    if (!url) {
      return NextResponse.json(
        { success: false, error: 'URL is required' },
        { status: 400 }
      );
    }

    // Validate URL
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid URL' },
        { status: 400 }
      );
    }

    // Fetch the page
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(parsedUrl.toString(), {
      signal: controller.signal,
      headers: {
        'User-Agent': 'HockeyClinicsBot/1.0 (youth hockey clinic aggregator)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return NextResponse.json(
        { success: false, error: `HTTP ${response.status} from target URL` },
        { status: 502 }
      );
    }

    const html = await response.text();
    const results = extractClinicsFromHTML(html, url, sourceName || parsedUrl.hostname);

    return NextResponse.json({
      success: true,
      results,
      meta: {
        url,
        resultsCount: results.length,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Scrape API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Scraping failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
