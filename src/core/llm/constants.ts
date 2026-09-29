import { ProviderId } from './types';

export interface ProviderSpec {
  id: ProviderId;
  label: string;
  /** OpenAI-compatible base URL (…/v1). Providers append /chat/completions. */
  baseUrl: string;
  /** Expected API key prefix, used for lightweight client-side validation. */
  keyPrefix: string;
  keyPlaceholder: string;
  /** Where a user obtains a key. */
  consoleUrl: string;
  models: string[];
  defaultModel: string;
  /** Cost/capability tiers used by the society's role assignment. */
  tiers: { manager: string; worker: string; cheap: string };
}

/**
 * Qwen Cloud OpenAI-compatible endpoint.
 * Token Plan keys (`sk-sp-…`) must use token-plan.maas… — they are not
 * interchangeable with the pay-as-you-go host (maas.qwencloudapi.com).
 * @see https://docs.qwencloud.com/api-reference/preparation/api-key
 */
export const QWEN_CLOUD_BASE_URL = 'https://token-plan.maas.qwencloudapi.com/compatible-mode/v1';
export const QWEN_CLOUD_PAYG_BASE_URL = 'https://maas.qwencloudapi.com/compatible-mode/v1';

/** Retired DashScope hosts — always migrate away from these. */
export const LEGACY_DASHSCOPE_BASE_URLS = [
  'https://dashscope-intl.aliyuncs.com/compatible-mode/v1',
  'https://dashscope.aliyuncs.com/compatible-mode/v1',
] as const;

export const PROVIDERS: Record<ProviderId, ProviderSpec> = {
  qwen: {
    id: 'qwen',
    label: 'Qwen Cloud',
    baseUrl: QWEN_CLOUD_BASE_URL,
    keyPrefix: 'sk-',
    keyPlaceholder: 'sk-... or sk-sp-...',
    consoleUrl: 'https://www.qwencloud.com/',
    // Chat models that returned text on a live completions call.
    models: ['deepseek-v4.1-flash', 'qwen3.8-max', 'qwen3.7-plus', 'qwen3.8-flash', 'glm-5.3'],
    defaultModel: 'deepseek-v4.1-flash',
    tiers: { manager: 'qwen3.8-max', worker: 'qwen3.7-plus', cheap: 'qwen3.8-flash' },
  },
  nvidia: {
    id: 'nvidia',
    label: 'NVIDIA',
    baseUrl: 'https://integrate.api.nvidia.com/v1',
    keyPrefix: 'nvapi-',
    keyPlaceholder: 'nvapi-...',
    consoleUrl: 'https://build.nvidia.com/',
    models: ['qwen/qwen3.5-122b-a10b', 'qwen/qwen3-next-80b-a3b-instruct', 'minimaxai/minimax-m3'],
    defaultModel: 'qwen/qwen3.5-122b-a10b',
    tiers: {
      manager: 'qwen/qwen3.5-122b-a10b',
      worker: 'qwen/qwen3.5-122b-a10b',
      cheap: 'qwen/qwen3.5-122b-a10b',
    },
  },
};

/** Default browser provider. Other OpenAI-compatible endpoints are allowed with the caller's key. */
export const DEFAULT_PROVIDER: ProviderId = 'qwen';

const fallbackModel = PROVIDERS[DEFAULT_PROVIDER].defaultModel;

export const DEFAULT_MODELS = {
  text: fallbackModel,
  image: fallbackModel,
  music: fallbackModel,
  video: fallbackModel,
};

export const AVAILABLE_MODELS = {
  text: [...PROVIDERS.qwen.models, ...PROVIDERS.nvidia.models],
  image: [] as string[],
  music: [] as string[],
  video: [] as string[],
};

export type ModelType = keyof typeof AVAILABLE_MODELS;

/** Normalize a stored base URL for comparison (trim, no trailing slash). */
export function normalizeBaseUrl(url: string): string {
  return url.trim().replace(/\/$/, '').replace(/\/chat\/completions$/, '');
}

/** True when a saved BYOK base URL points at a retired DashScope host. */
export function isLegacyDashScopeBaseUrl(url: string | undefined): boolean {
  if (!url?.trim()) return false;
  const n = normalizeBaseUrl(url);
  return LEGACY_DASHSCOPE_BASE_URLS.some((legacy) => normalizeBaseUrl(legacy) === n);
}

/**
 * Whether a saved Qwen base URL should be rewritten to the Token Plan default.
 * Token Plan keys (`sk-sp-`) cannot call the pay-as-you-go maas host (401).
 */
/** Saved provider settings after Clear. Drops the key and restores that provider's default address and model. */
export function clearedLlmConfig(provider: ProviderId): { provider: ProviderId; apiKey: string; baseUrl: string; model: string } {
  const spec = PROVIDERS[provider];
  return { provider, apiKey: '', baseUrl: spec.baseUrl, model: spec.defaultModel };
}

export function shouldMigrateToTokenPlanBaseUrl(
  url: string | undefined,
  apiKey: string | undefined,
): boolean {
  if (isLegacyDashScopeBaseUrl(url)) return true;
  if (!url?.trim()) return false;
  const n = normalizeBaseUrl(url);
  const isPayg = n === normalizeBaseUrl(QWEN_CLOUD_PAYG_BASE_URL);
  const key = (apiKey || '').trim();
  // Empty key → server falls back to DASHSCOPE_API_KEY (Token Plan in this workspace).
  return isPayg && (!key || key.startsWith('sk-sp-'));
}
