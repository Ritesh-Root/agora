import { LLMProvider, ProviderId } from '../types';
import { PROVIDERS, DEFAULT_PROVIDER } from '../constants';
import { NvidiaProvider } from './NvidiaProvider';
import { QwenProvider } from './QwenProvider';

/** Instantiate the LLM provider backing a given config. */
export function createProvider(provider: ProviderId | undefined, apiKey: string): LLMProvider {
  switch (provider ?? DEFAULT_PROVIDER) {
    case 'nvidia':
      return new NvidiaProvider(apiKey);
    case 'qwen':
    default:
      return new QwenProvider(apiKey);
  }
}

/** Lightweight client-side check that a key looks right for the chosen provider. */
export function isValidKey(provider: ProviderId | undefined, apiKey: string | undefined): boolean {
  if (!apiKey) return false;
  const prefix = PROVIDERS[provider ?? DEFAULT_PROVIDER].keyPrefix.toLowerCase();
  return apiKey.trim().toLowerCase().startsWith(prefix);
}

export function modelsForProvider(provider: ProviderId | undefined): string[] {
  return PROVIDERS[provider ?? DEFAULT_PROVIDER].models;
}

export function defaultModelFor(provider: ProviderId | undefined): string {
  return PROVIDERS[provider ?? DEFAULT_PROVIDER].defaultModel;
}
