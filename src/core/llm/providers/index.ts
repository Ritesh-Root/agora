import { LLMProvider, ProviderId } from '../types';
import { PROVIDERS, DEFAULT_PROVIDER } from '../constants';
import { NvidiaProvider } from './NvidiaProvider';
import { QwenProvider } from './QwenProvider';

/** Instantiate the LLM provider for a base URL. NVIDIA keeps its own request quirks. */
export function createProvider(
  provider: ProviderId | undefined,
  apiKey: string,
  baseUrl?: string,
): LLMProvider {
  const spec = PROVIDERS[provider ?? DEFAULT_PROVIDER];
  const root = (baseUrl?.trim() || spec.baseUrl).replace(/\/$/, '');
  const url = root.endsWith('/chat/completions') ? root : `${root}/chat/completions`;
  if ((provider ?? DEFAULT_PROVIDER) === 'nvidia' || url.includes('api.nvidia.com')) {
    return new NvidiaProvider(apiKey, url);
  }
  return new QwenProvider(apiKey, url);
}

/** Any non-empty key is accepted. Preset prefixes are not required for a custom endpoint. */
export function isValidKey(_provider: ProviderId | undefined, apiKey: string | undefined): boolean {
  return !!apiKey?.trim();
}

export function modelsForProvider(provider: ProviderId | undefined): string[] {
  return PROVIDERS[provider ?? DEFAULT_PROVIDER].models;
}

export function defaultModelFor(provider: ProviderId | undefined): string {
  return PROVIDERS[provider ?? DEFAULT_PROVIDER].defaultModel;
}
