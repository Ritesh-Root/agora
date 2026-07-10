/**
 * Server-side OpenAI-compatible LLM provider interface and factory.
 * Automatically routes and maps request payloads dynamically depending on the key:
 * - NVIDIA NIM Catalog keys (starting with `nvapi-`) route to NVIDIA Integrate API
 * - Qwen/DashScope keys (starting with `sk-`) route to Alibaba Cloud DashScope API
 */

export interface LLMLike {
  generateCompletion(
    messages: { role: string; content: string }[],
    tools?: unknown[],
    systemInstruction?: string,
    modelName?: string,
  ): Promise<{ content: string | null }>;
}

export function createServerProvider(apiKey: string): LLMLike {
  const isNvidia = apiKey.trim().startsWith('nvapi-');
  const baseUrl = isNvidia
    ? 'https://integrate.api.nvidia.com/v1/chat/completions'
    : 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions';

  return {
    async generateCompletion(messages, tools, systemInstruction, modelName) {
      // If using NVIDIA NIM, map Qwen Cloud model tiers to the hosted qwen3.5 MoE model
      let model = modelName || 'qwen-max';
      if (isNvidia) {
        if (model.includes('qwen-max') || model.includes('qwen-plus') || model.includes('qwen-turbo')) {
          model = 'qwen/qwen3.5-122b-a10b';
        }
      }

      const body: any = {
        model,
        messages: []
      };

      if (systemInstruction) {
        body.messages.push({ role: 'system', content: systemInstruction });
      }

      // Convert messages to standard chat completions format
      body.messages.push(...messages.map(m => ({
        role: m.role,
        content: m.content
      })));

      if (tools && tools.length > 0) {
        body.tools = tools;
      }

      if (isNvidia) {
        // qwen3.5 NIM backends 500 ("unit variant") unless max_completion_tokens is present.
        body.max_completion_tokens = 8192;
        if (model.startsWith('qwen/')) {
          // Without this, qwen3.5 reasons for minutes and can spend the whole
          // completion budget on hidden reasoning, returning empty content.
          body.chat_template_kwargs = { thinking: false };
        }
      }

      // NIM's qwen3.5 pool intermittently 500s on identical requests (~1 in 6),
      // so transient 5xx/network failures get retried with backoff.
      const MAX_TRIES = 3;
      for (let attempt = 1; ; attempt++) {
        try {
          const response = await fetch(baseUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify(body),
            signal: AbortSignal.timeout(120_000),
          });

          if (!response.ok) {
            const text = await response.text();
            if (response.status >= 500 && attempt < MAX_TRIES) {
              await new Promise((r) => setTimeout(r, attempt * 1500));
              continue;
            }
            throw new Error(`Inference API error (${response.status}): ${text}`);
          }

          const data = await response.json() as any;
          const content = data.choices?.[0]?.message?.content ?? null;
          if ((content === null || !String(content).trim()) && attempt < MAX_TRIES) {
            // NIM sometimes returns 200 with empty content — treat as transient
            await new Promise((r) => setTimeout(r, attempt * 1500));
            continue;
          }
          return { content };
        } catch (error) {
          const transient = error instanceof TypeError ||
            (error instanceof DOMException && (error.name === 'TimeoutError' || error.name === 'AbortError'));
          if (attempt < MAX_TRIES && transient) {
            // network failure or request timeout — retry
            await new Promise((r) => setTimeout(r, attempt * 1500));
            continue;
          }
          console.error('[ServerProvider] Completion failed:', error);
          throw error;
        }
      }
    }
  };
}
