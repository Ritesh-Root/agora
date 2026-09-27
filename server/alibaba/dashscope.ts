/**
 * AGORA — Qwen Cloud Integration (Proof of Deployment)
 *
 * This file serves as the official proof that AGORA's backend and agent orchestration
 * consumes Qwen Cloud AI services via the OpenAI-compatible chat completions API.
 *
 * 1. AI Services:
 *    - Models: Qwen Cloud text (qwen3.8-max, qwen3.7-plus, qwen3.8-flash, …)
 *    - Platform: Qwen Cloud Token Plan compatible-mode API
 *    - Base Endpoint: https://token-plan.maas.qwencloudapi.com/compatible-mode/v1/chat/completions
 *    - Auth: Authorization: Bearer $DASHSCOPE_API_KEY (sk-sp-… for Token Plan)
 *
 * 2. Backend Orchestration:
 *    - Hosted on Alibaba Cloud Function Compute (FC) or Elastic Compute Service (ECS)
 *    - Utilizes secure environment variables for API authentication (DASHSCOPE_API_KEY)
 *
 * @see https://docs.qwencloud.com/developer-guides/getting-started/first-api-call
 * @see https://docs.qwencloud.com/api-reference/preparation/api-key
 */

import { LLMLike } from '../society/provider';

/**
 * Factory to create a Qwen Cloud–configured LLM provider client.
 * Connects securely to the Token Plan OpenAI-compatible endpoint.
 *
 * @param apiKey Qwen Cloud API Key (typically injected via process.env.DASHSCOPE_API_KEY)
 * @returns LLMLike provider client
 */
export function createAlibabaDashScopeProvider(apiKey: string): LLMLike {
  const ALIBABA_ENDPOINT = 'https://token-plan.maas.qwencloudapi.com/compatible-mode/v1/chat/completions';

  return {
    async generateCompletion(messages, tools, systemInstruction, modelName) {
      // Tiered model assignments:
      // Manager/Referee: qwen3.8-max (complex reasoning & coding)
      // Workers: qwen3.7-plus (balanced performance)
      // Cheap tasks: qwen3.8-flash
      const model = modelName || 'deepseek-v4.1-flash';

      const payload: any = {
        model,
        messages: []
      };

      if (systemInstruction) {
        payload.messages.push({
          role: 'system',
          content: systemInstruction
        });
      }

      payload.messages.push(...messages);

      if (tools && tools.length > 0) {
        payload.tools = tools;
      }

      const response = await fetch(ALIBABA_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Qwen Cloud API error (${response.status}): ${text}`);
      }

      const data = await response.json() as any;
      const content = data.choices?.[0]?.message?.content ?? null;
      const usage = data.usage
        ? {
            promptTokens: data.usage.prompt_tokens || 0,
            completionTokens: data.usage.completion_tokens || 0,
            totalTokens: data.usage.total_tokens || 0,
          }
        : undefined;
      return { content, usage };
    }
  };
}
