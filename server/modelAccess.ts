import { assertPublicHttpsTarget } from './proxyGuard';

/** The demo server key may be sent only to this host. */
export const APPROVED_SERVER_KEY_HOST = 'token-plan.maas.qwencloudapi.com';

const MISSING_KEY = 'Add an API key in the app, or set DASHSCOPE_API_KEY on the server.';
const CUSTOM_NEEDS_KEY = 'Add an API key for that model endpoint.';

function chatUrl(baseUrl: string): string {
  const root = baseUrl.trim().replace(/\/$/, '');
  return root.endsWith('/chat/completions') ? root : `${root}/chat/completions`;
}

/**
 * Picks the key that may be sent to a model endpoint.
 * The server key is used only for the approved host. Any other URL requires the caller's key.
 */
export async function resolveModelAccess(
  input: { apiKey?: string; baseUrl?: string },
  resolve?: (hostname: string) => Promise<string[]>,
): Promise<{ apiKey: string; baseUrl?: string }> {
  const callerKey = input.apiKey?.trim() ?? '';
  const rawBase = input.baseUrl?.trim() ?? '';
  if (rawBase) {
    const url = await assertPublicHttpsTarget(chatUrl(rawBase), resolve);
    const approved = url.hostname.toLowerCase() === APPROVED_SERVER_KEY_HOST;
    if (!callerKey) {
      if (!approved) throw new Error(CUSTOM_NEEDS_KEY);
      const serverKey = process.env.DASHSCOPE_API_KEY?.trim() ?? '';
      if (!serverKey) throw new Error(MISSING_KEY);
      return { apiKey: serverKey, baseUrl: url.toString() };
    }
    return { apiKey: callerKey, baseUrl: url.toString() };
  }
  const key = callerKey || process.env.DASHSCOPE_API_KEY?.trim() || '';
  if (!key) throw new Error(MISSING_KEY);
  return { apiKey: key };
}
