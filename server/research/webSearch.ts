export interface SearchHit {
  title: string;
  url: string;
  snippet: string;
}

interface ExaResult {
  title?: string;
  url?: string;
  highlights?: string[];
}

/** Exa search. The key stays on the server. No key, or a failed call, returns no hits. */
export async function searchWeb(
  query: string,
  limit = 3,
  fetchImpl: typeof fetch = fetch,
): Promise<SearchHit[]> {
  const key = process.env.EXA_API_KEY?.trim();
  if (!key || !query.trim()) return [];
  const response = await fetchImpl('https://api.exa.ai/search', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': key,
    },
    body: JSON.stringify({
      query: query.slice(0, 240),
      numResults: limit,
      contents: { highlights: { maxCharacters: 300 } },
    }),
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) throw new Error(`exa http ${response.status}`);
  const body = await response.json() as { results?: ExaResult[] };
  return (body.results ?? []).slice(0, limit).flatMap((row) => {
    const url = row.url ?? '';
    if (!url.startsWith('http')) return [];
    return [{
      title: row.title?.trim() || url,
      url,
      snippet: (row.highlights?.[0] ?? '').slice(0, 300),
    }];
  });
}
