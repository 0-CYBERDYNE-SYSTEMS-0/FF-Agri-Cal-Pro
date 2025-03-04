/**
 * Utility functions for interacting with the Perplexity.ai API
 */

interface PerplexitySearchOptions {
  query: string;
  max_results?: number;
  search_mode?: 'fast' | 'full';
}

interface PerplexitySearchResult {
  title: string;
  url: string;
  snippet: string;
}

interface PerplexitySearchResponse {
  answer: string;
  results: PerplexitySearchResult[];
}

/**
 * Search the web using Perplexity.ai API
 */
export async function searchWeb(options: PerplexitySearchOptions): Promise<string> {
  try {
    const apiKey = process.env.PERPLEXITY_API_KEY;
    
    if (!apiKey) {
      throw new Error('PERPLEXITY_API_KEY environment variable is not set');
    }
    
    const response = await fetch('https://api.perplexity.ai/search', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: options.query,
        max_results: options.max_results || 3,
        search_mode: options.search_mode || 'fast',
        highlight: false,
      }),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Perplexity API error: ${response.status} ${errorText}`);
    }
    
    const data = await response.json() as PerplexitySearchResponse;
    
    // Format the search results into a readable string
    const formattedResults = data.results
      .map((result, index) => {
        return `[${index + 1}] ${result.title}\n${result.url}\n${result.snippet}\n`;
      })
      .join('\n');
    
    const searchSummary = data.answer || 'No summary available.';
    
    return `Search Results for: "${options.query}"\n\n${searchSummary}\n\nSources:\n${formattedResults}`;
  } catch (error: unknown) {
    console.error('Error searching web with Perplexity:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return `Error searching the web: ${errorMessage}`;
  }
}