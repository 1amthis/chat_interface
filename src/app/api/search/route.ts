import { NextRequest, NextResponse } from 'next/server';
import { performWebSearch, performBraveSearch, performFallbackSearch } from '@/lib/websearch';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query, tavilyApiKey, braveApiKey } = body as {
      query: string;
      tavilyApiKey?: string;
      braveApiKey?: string;
    };

    if (!query) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 });
    }

    let result;

    // Use Tavily if API key is provided
    if (tavilyApiKey) {
      result = await performWebSearch(query, tavilyApiKey);
    }
    // Use Brave Search if API key is provided
    else if (braveApiKey) {
      result = await performBraveSearch(query, braveApiKey);
    }
    // Fall back to free alternatives (Wikipedia)
    else {
      result = await performFallbackSearch(query);
    }

    return NextResponse.json(result);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Search API error:', error);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
