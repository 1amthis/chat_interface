import { WebSearchResult, WebSearchResponse } from '@/types';

interface TavilySearchResult {
  title: string;
  url: string;
  content: string;
  score: number;
}

interface TavilyResponse {
  query: string;
  results: TavilySearchResult[];
}

// Perform web search using Tavily API
export async function performWebSearch(
  query: string,
  apiKey: string,
  maxResults: number = 5
): Promise<WebSearchResponse> {
  const response = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      api_key: apiKey,
      query,
      search_depth: 'basic',
      max_results: maxResults,
      include_answer: false,
      include_raw_content: false,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Tavily API error: ${response.status} - ${errorText}`);
  }

  const data: TavilyResponse = await response.json();

  const results: WebSearchResult[] = data.results.map((result) => ({
    title: result.title,
    url: result.url,
    snippet: result.content,
    source: new URL(result.url).hostname,
  }));

  return {
    query,
    results,
    timestamp: Date.now(),
  };
}

// DuckDuckGo search result interface
interface DuckDuckGoResult {
  FirstURL?: string;
  Text?: string;
}

interface DuckDuckGoResponse {
  AbstractText?: string;
  AbstractURL?: string;
  AbstractSource?: string;
  RelatedTopics?: DuckDuckGoResult[];
  Results?: DuckDuckGoResult[];
}

// Fallback: Use DuckDuckGo Instant Answer API (free, no key required)
export async function performDuckDuckGoSearch(
  query: string,
  maxResults: number = 5
): Promise<WebSearchResponse> {
  const encodedQuery = encodeURIComponent(query);
  const response = await fetch(
    `https://api.duckduckgo.com/?q=${encodedQuery}&format=json&no_html=1&skip_disambig=1`
  );

  if (!response.ok) {
    throw new Error(`DuckDuckGo search error: ${response.status}`);
  }

  const data: DuckDuckGoResponse = await response.json();
  const results: WebSearchResult[] = [];

  // Add abstract if available
  if (data.AbstractText && data.AbstractURL) {
    results.push({
      title: data.AbstractSource || 'Summary',
      url: data.AbstractURL,
      snippet: data.AbstractText,
      source: data.AbstractSource,
    });
  }

  // Add related topics
  const relatedTopics = data.RelatedTopics || [];
  for (const topic of relatedTopics) {
    if (results.length >= maxResults) break;
    if (topic.FirstURL && topic.Text) {
      let source: string | undefined;
      try {
        source = new URL(topic.FirstURL).hostname;
      } catch {
        source = undefined;
      }
      results.push({
        title: topic.Text.split(' - ')[0] || 'Related',
        url: topic.FirstURL,
        snippet: topic.Text,
        source,
      });
    }
  }

  // Add direct results
  const directResults = data.Results || [];
  for (const result of directResults) {
    if (results.length >= maxResults) break;
    if (result.FirstURL && result.Text) {
      let source: string | undefined;
      try {
        source = new URL(result.FirstURL).hostname;
      } catch {
        source = undefined;
      }
      results.push({
        title: result.Text.split(' - ')[0] || 'Result',
        url: result.FirstURL,
        snippet: result.Text,
        source,
      });
    }
  }

  return {
    query,
    results,
    timestamp: Date.now(),
  };
}

// SearXNG public instance search (free, no key required)
export async function performSearXNGSearch(
  query: string,
  maxResults: number = 5
): Promise<WebSearchResponse> {
  // Use a public SearXNG instance
  const encodedQuery = encodeURIComponent(query);
  const response = await fetch(
    `https://searx.be/search?q=${encodedQuery}&format=json&categories=general`,
    {
      headers: {
        'Accept': 'application/json',
      },
    }
  );

  if (!response.ok) {
    throw new Error(`SearXNG search error: ${response.status}`);
  }

  const data = await response.json();
  const resultsArray = data.results || [];

  const results: WebSearchResult[] = resultsArray
    .slice(0, maxResults)
    .map((item: { title?: string; url?: string; content?: string; engine?: string }) => {
      let source: string | undefined;
      try {
        source = item.url ? new URL(item.url).hostname : undefined;
      } catch {
        source = undefined;
      }
      return {
        title: item.title || 'Untitled',
        url: item.url || '',
        snippet: item.content || '',
        source,
      };
    });

  return {
    query,
    results,
    timestamp: Date.now(),
  };
}

// Use DuckDuckGo HTML search with lite version (more reliable)
export async function performDuckDuckGoHtmlSearch(
  query: string,
  maxResults: number = 5
): Promise<WebSearchResponse> {
  const encodedQuery = encodeURIComponent(query);

  // Use the lite HTML version and parse results
  const response = await fetch(`https://lite.duckduckgo.com/lite/?q=${encodedQuery}`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; ChatBot/1.0)',
    },
  });

  if (!response.ok) {
    throw new Error(`DuckDuckGo HTML search error: ${response.status}`);
  }

  const html = await response.text();
  const results: WebSearchResult[] = [];

  // Parse the HTML to extract results
  // DDG lite returns results in a table with class "result-link" for URLs
  const linkRegex = /<a[^>]+class="result-link"[^>]*href="([^"]+)"[^>]*>([^<]+)<\/a>/gi;
  const snippetRegex = /<td[^>]+class="result-snippet"[^>]*>([^<]+)/gi;

  const links: { url: string; title: string }[] = [];
  let match;

  while ((match = linkRegex.exec(html)) !== null && links.length < maxResults) {
    links.push({ url: match[1], title: match[2] });
  }

  const snippets: string[] = [];
  while ((match = snippetRegex.exec(html)) !== null && snippets.length < maxResults) {
    snippets.push(match[1].trim());
  }

  for (let i = 0; i < links.length && i < maxResults; i++) {
    let source: string | undefined;
    try {
      source = new URL(links[i].url).hostname;
    } catch {
      source = undefined;
    }
    results.push({
      title: links[i].title,
      url: links[i].url,
      snippet: snippets[i] || '',
      source,
    });
  }

  return {
    query,
    results,
    timestamp: Date.now(),
  };
}

// Wikipedia search API (always works, free, no auth required)
export async function performWikipediaSearch(
  query: string,
  maxResults: number = 5
): Promise<WebSearchResponse> {
  const encodedQuery = encodeURIComponent(query);
  const response = await fetch(
    `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodedQuery}&srlimit=${maxResults}&format=json&origin=*`
  );

  if (!response.ok) {
    throw new Error(`Wikipedia search error: ${response.status}`);
  }

  const data = await response.json();
  const searchResults = data.query?.search || [];

  const results: WebSearchResult[] = searchResults.map(
    (item: { title: string; snippet: string; pageid: number }) => ({
      title: item.title,
      url: `https://en.wikipedia.org/wiki/${encodeURIComponent(item.title.replace(/ /g, '_'))}`,
      snippet: item.snippet.replace(/<[^>]*>/g, ''), // Remove HTML tags
      source: 'Wikipedia',
    })
  );

  return {
    query,
    results,
    timestamp: Date.now(),
  };
}

// Brave Search API (requires free API key from https://brave.com/search/api/)
export async function performBraveSearch(
  query: string,
  apiKey: string,
  maxResults: number = 5
): Promise<WebSearchResponse> {
  const encodedQuery = encodeURIComponent(query);
  const response = await fetch(
    `https://api.search.brave.com/res/v1/web/search?q=${encodedQuery}&count=${maxResults}`,
    {
      headers: {
        'Accept': 'application/json',
        'X-Subscription-Token': apiKey,
      },
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Brave Search error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const webResults = data.web?.results || [];

  const results: WebSearchResult[] = webResults.map(
    (item: { title: string; url: string; description: string }) => {
      let source: string | undefined;
      try {
        source = new URL(item.url).hostname;
      } catch {
        source = undefined;
      }
      return {
        title: item.title,
        url: item.url,
        snippet: item.description,
        source,
      };
    }
  );

  return {
    query,
    results,
    timestamp: Date.now(),
  };
}

// Combined fallback search - tries multiple free services
export async function performFallbackSearch(
  query: string,
  maxResults: number = 5
): Promise<WebSearchResponse> {
  // Try Wikipedia first (most reliable free option, always works)
  try {
    const result = await performWikipediaSearch(query, maxResults);
    if (result.results.length > 0) {
      return result;
    }
  } catch (e) {
    console.error('Wikipedia search failed:', e);
  }

  // Try DuckDuckGo Instant Answers API (may be blocked)
  try {
    const result = await performDuckDuckGoSearch(query, maxResults);
    if (result.results.length > 0) {
      return result;
    }
  } catch (e) {
    console.error('DuckDuckGo API search failed:', e);
  }

  // Return empty results if all fail
  return {
    query,
    results: [],
    timestamp: Date.now(),
  };
}

// Format search results for inclusion in chat context
export function formatSearchResultsForContext(searchResponse: WebSearchResponse): string {
  if (searchResponse.results.length === 0) {
    return `Web search for "${searchResponse.query}" returned no results.`;
  }

  let formatted = `Web search results for "${searchResponse.query}":\n\n`;

  searchResponse.results.forEach((result, index) => {
    formatted += `[${index + 1}] ${result.title}\n`;
    formatted += `    URL: ${result.url}\n`;
    formatted += `    ${result.snippet}\n\n`;
  });

  return formatted;
}
