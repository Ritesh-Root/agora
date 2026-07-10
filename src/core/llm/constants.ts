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

export const PROVIDERS: Record<ProviderId, ProviderSpec> = {
  qwen: {
    id: 'qwen',
    label: 'Qwen Cloud (DashScope)',
    baseUrl: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1',
    keyPrefix: 'sk-',
    keyPlaceholder: 'sk-...',
    consoleUrl: 'https://modelstudio.console.alibabacloud.com/',
    models: ['qwen-max', 'qwen-plus', 'qwen-turbo'],
    defaultModel: 'qwen-plus',
    tiers: { manager: 'qwen-max', worker: 'qwen-plus', cheap: 'qwen-turbo' },
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

/** Qwen Cloud is the default — it is the hackathon's required core provider. */
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
