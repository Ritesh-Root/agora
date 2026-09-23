import { assertPublicWebTarget } from '../proxyGuard';

const READ_LIMIT = 4_000;
const READ_TIMEOUT_MS = 8_000;

/** Fetch a public page as markdown through the Jina reader. Private URLs are refused before any request. */
export async function readUrl(
  raw: string,
  fetchImpl: typeof fetch = fetch,
  resolve?: (hostname: string) => Promise<string[]>,
): Promise<string> {
  const url = await assertPublicWebTarget(raw, resolve);
  const response = await fetchImpl(`https://r.jina.ai/${url.toString()}`, {
    headers: { accept: 'text/markdown' },
    signal: AbortSignal.timeout(READ_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`read http ${response.status}`);
  const text = await response.text();
  return text.slice(0, READ_LIMIT);
}
