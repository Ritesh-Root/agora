import { DEFAULT_MODELS } from './constants';

export interface ModelPricing {
  inputPer1M?: number;
  outputPer1M?: number;
  perImage?: number;
  perSong?: number;
  perSecond?: number;
}

// USD per 1M tokens. Approximate Qwen Cloud list prices,
// used only for the in-app cost/token estimate — not billing-accurate.
export const MODEL_PRICING: Record<string, ModelPricing> = {
  'qwen3.8-max': { inputPer1M: 1.6, outputPer1M: 6.4 },
  'qwen3.7-plus': { inputPer1M: 0.4, outputPer1M: 1.2 },
  'qwen3.8-flash': { inputPer1M: 0.05, outputPer1M: 0.2 },
  'glm-5.3': { inputPer1M: 0.4, outputPer1M: 1.2 },
  // Legacy DashScope ids (kept for old agent configs / estimates)
  'qwen-max': { inputPer1M: 1.6, outputPer1M: 6.4 },
  'qwen-plus': { inputPer1M: 0.4, outputPer1M: 1.2 },
  'qwen-turbo': { inputPer1M: 0.05, outputPer1M: 0.2 },
};

export const DEFAULT_PRICING: ModelPricing =
  MODEL_PRICING[DEFAULT_MODELS.text] || { inputPer1M: 0, outputPer1M: 0 };

/** True when this app has a price for the model. An unpriced model must not be shown as $0. */
export function modelPriceKnown(modelName: string): boolean {
  const lowerName = modelName.toLowerCase();
  if (lowerName.includes('minimaxai/')) return true;
  return Object.keys(MODEL_PRICING).some((key) => lowerName.includes(key.toLowerCase()));
}

export function calculateCost(promptTokens: number, completionTokens: number, modelName: string, durationOrCount?: number): number {
  const lowerName = modelName.toLowerCase();

  // NVIDIA build credits are free-tier in this app; surface $0 rather than guess.
  if (lowerName.includes('minimaxai/')) {
    return 0;
  }

  const pricingKey = Object.keys(MODEL_PRICING).find(key => lowerName.includes(key.toLowerCase()));
  const pricing = pricingKey ? MODEL_PRICING[pricingKey] : DEFAULT_PRICING;

  // 1. Per Image
  if (pricing.perImage !== undefined) {
    return (durationOrCount || 1) * pricing.perImage;
  }

  // 2. Per Song
  if (pricing.perSong !== undefined) {
    return (durationOrCount || 1) * pricing.perSong;
  }

  // 3. Per Second (Video)
  if (pricing.perSecond !== undefined) {
    return (durationOrCount || 4) * pricing.perSecond; // Default 4s if not specified
  }

  // 4. Token based (Text)
  const inputCost = (promptTokens / 1000000) * (pricing.inputPer1M || 0);
  const outputCost = (completionTokens / 1000000) * (pricing.outputPer1M || 0);

  return inputCost + outputCost;
}

export function calculateTokensForCost(modelName: string, durationOrCount?: number): number {
  const lowerName = modelName.toLowerCase();

  if (lowerName.includes('minimaxai/')) {
    return 0;
  }

  const cost = calculateCost(0, 0, modelName, durationOrCount);
  const baseOutputPrice = MODEL_PRICING[DEFAULT_MODELS.text]?.outputPer1M || 3.0;

  return Math.floor((cost / baseOutputPrice) * 1000000);
}
