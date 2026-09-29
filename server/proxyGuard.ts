import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

export const MAX_PROXY_BODY = 1_000_000;

/** True for loopback, private, link-local, and CGNAT addresses. */
export function isPrivateAddress(ip: string): boolean {
  const normalized = ip.toLowerCase().replace(/^::ffff:/, '');
  if (normalized === '::1' || normalized === '0.0.0.0') return true;
  if (normalized.startsWith('fe80:') || normalized.startsWith('fc') || normalized.startsWith('fd')) return true;

  const parts = normalized.split('.').map((part) => Number(part));
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
    return false;
  }
  const [a, b] = parts;
  if (a === 10 || a === 127 || a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 192 && b === 168) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  return false;
}

async function defaultResolve(hostname: string): Promise<string[]> {
  if (isIP(hostname)) return [hostname];
  const records = await lookup(hostname, { all: true });
  return records.map((record) => record.address);
}

/** HTTPS only, and the host must not resolve to a private or loopback address. */
export async function assertPublicHttpsTarget(
  raw: string,
  resolve: (hostname: string) => Promise<string[]> = defaultResolve,
): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error('Invalid target URL');
  }
  if (url.protocol !== 'https:' || url.username || url.password) {
    throw new Error('Only https targets are allowed');
  }
  const host = url.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (!host || host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal')) {
    throw new Error('Target host is not allowed');
  }
  if (isIP(host) && isPrivateAddress(host)) {
    throw new Error('Target host is not allowed');
  }
  const ips = await resolve(host);
  if (ips.length === 0 || ips.some(isPrivateAddress)) {
    throw new Error('Target host is not allowed');
  }
  return url;
}

/** Chat-completions proxy target. Not a general open proxy. */
export async function assertChatProxyTarget(
  raw: string,
  resolve: (hostname: string) => Promise<string[]> = defaultResolve,
): Promise<URL> {
  const url = await assertPublicHttpsTarget(raw, resolve);
  if (!url.pathname.endsWith('/chat/completions')) {
    throw new Error('Target host is not allowed');
  }
  return url;
}

/** Public http or https. Private, loopback, and link-local hosts are refused. */
export async function assertPublicWebTarget(
  raw: string,
  resolve: (hostname: string) => Promise<string[]> = defaultResolve,
): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error('Invalid target URL');
  }
  if ((url.protocol !== 'http:' && url.protocol !== 'https:') || url.username || url.password) {
    throw new Error('Only public http(s) targets are allowed');
  }
  const host = url.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (!host || host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal')) {
    throw new Error('Target host is not allowed');
  }
  if (isIP(host) && isPrivateAddress(host)) {
    throw new Error('Target host is not allowed');
  }
  const ips = await resolve(host);
  if (ips.length === 0 || ips.some(isPrivateAddress)) {
    throw new Error('Target host is not allowed');
  }
  return url;
}
