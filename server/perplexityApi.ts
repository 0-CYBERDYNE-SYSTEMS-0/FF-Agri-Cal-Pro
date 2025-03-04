/**
 * Utility functions for interacting with the Perplexity.ai API
 */

interface PerplexitySearchOptions {
  query: string;
  max_results?: number;
  search_mode?: 'fast' | 'full';
}

interface Citation {
  text: string;
  url: string;
}

interface PerplexityResponse {
  id: string;
  model: string;
  object: string;
  created: number;
  choices: Array<{
    index: number;
    finish_reason: string;
    message: {
      role: string;
      content: string;
    };
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  citations: string[];
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
    
    // Using the chat/completions endpoint with web search enabled
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: "llama-3.1-sonar-small-128k-online",
        messages: [
          {
            role: "system",
            content: "You are a helpful assistant focused on providing accurate and up-to-date information. Be precise and concise in your responses."
          },
          {
            role: "user",
            content: options.query
          }
        ],
        max_tokens: 500,
        temperature: 0.2,
        search_domain_filter: [],
        search_recency_filter: "month"
      }),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Perplexity API error: ${response.status} ${errorText}`);
    }
    
    const data = await response.json() as PerplexityResponse;
    
    // Get the main content from Perplexity response
    const searchContent = data.choices[0].message.content;
    
    // Format sources/citations
    let sourcesText = "";
    if (data.citations && data.citations.length > 0) {
      sourcesText = "\n\nSources:\n" + data.citations
        .map((url, index) => `[${index + 1}] ${url}`)
        .join('\n');
    }
    
    return searchContent + sourcesText;
  } catch (error: unknown) {
    console.error('Error searching web with Perplexity:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return `Error searching the web: ${errorMessage}`;
  }
}