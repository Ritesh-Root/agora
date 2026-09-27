import { describe, expect, it } from 'vitest';
import { clearedLlmConfig, QWEN_CLOUD_BASE_URL } from './constants';
import { modelPriceKnown } from './pricing';

describe('clearedLlmConfig', () => {
  it('drops the key and restores the provider default address and model', () => {
    const cleared = clearedLlmConfig('qwen');
    expect(cleared.apiKey).toBe('');
    expect(cleared.baseUrl).toBe(QWEN_CLOUD_BASE_URL);
    expect(cleared.model).toBe('deepseek-v4.1-flash');
  });
});

describe('modelPriceKnown', () => {
  it('does not treat an unpriced model as free', () => {
    expect(modelPriceKnown('deepseek-v4.1-flash')).toBe(false);
    expect(modelPriceKnown('qwen3.8-flash')).toBe(true);
  });
});
