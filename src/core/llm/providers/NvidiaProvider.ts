import { LLMMessage, LLMProvider, LLMResponse, LLMToolCall, LLMToolDefinition } from '../types';

const NVIDIA_CHAT_URL = 'https://integrate.api.nvidia.com/v1/chat/completions';
const NVIDIA_DEFAULT_MODEL = 'minimaxai/minimax-m3';

function extractTextContent(content: unknown): string | null {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    const text = content
      .map((part) => {
        if (typeof part === 'string') return part;
        if (part && typeof part === 'object' && 'text' in part && typeof (part as { text?: unknown }).text === 'string') {
          return (part as { text: string }).text;
        }
        return '';
      })
      .join('');

    return text || null;
  }

  return null;
}

export class NvidiaProvider implements LLMProvider {
  constructor(private readonly apiKey: string, private readonly baseUrl: string = NVIDIA_CHAT_URL) {}

  async generateCompletion(
    messages: LLMMessage[],
    tools?: LLMToolDefinition[],
    systemInstruction?: string,
    modelName: string = NVIDIA_DEFAULT_MODEL
  ): Promise<LLMResponse> {
    const requestMessages: any[] = [];

    if (systemInstruction) {
      requestMessages.push({ role: 'system', content: systemInstruction });
    }

    for (const message of messages) {
      if (message.role === 'system') {
        requestMessages.push({ role: 'system', content: message.content });
        continue;
      }

      if (message.images?.length) {
        throw new Error('NVIDIA chat completions do not support image inputs in this build.');
      }

      const payload: Record<string, unknown> = {
        role: message.role,
        content: message.content,
      };

      if (message.role === 'tool') {
        payload.tool_call_id = message.name || 'tool';
      }

      if (message.name) {
        payload.name = message.name;
      }

      if (message.tool_calls?.length) {
        payload.tool_calls = message.tool_calls.map((call) => ({
          id: call.id,
          type: call.type,
          function: {
            name: call.function.name,
            arguments: call.function.arguments,
          },
        }));
      }

      requestMessages.push(payload);
    }

    const payload: Record<string, unknown> = {
      model: modelName,
      messages: requestMessages,
      max_tokens: 8192,
      // qwen3.5 NIM backends 500 ("unit variant") unless max_completion_tokens is present;
      // other NIM models tolerate both, so always send both.
      max_completion_tokens: 8192,
      temperature: 1,
      top_p: 0.95,
      stream: false,
    };

    if (tools?.length) {
      payload.tools = tools;
      payload.tool_choice = 'auto';
    }

    if (modelName.startsWith('qwen/')) {
      // Without this, qwen3.5 NIM reasons for minutes and can return empty content.
      payload.chat_template_kwargs = { thinking: false };
    }

    const isBrowser = typeof window !== 'undefined';
    const fetchUrl = isBrowser ? '/api/cors-proxy' : this.baseUrl;
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.apiKey}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    };
    if (isBrowser) {
      headers['X-Target-URL'] = this.baseUrl;
    }

    // NIM's qwen3.5 pool intermittently 500s on identical requests — retry transient 5xx.
    let response!: Response;
    let data: any = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      response = await fetch(fetchUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });
      data = await response.json().catch(() => null);
      if (response.ok || response.status < 500 || attempt === 3) break;
      await new Promise((r) => setTimeout(r, attempt * 1500));
    }

    if (!response.ok) {
      const detail = data ? JSON.stringify(data) : response.statusText;
      throw new Error(`NVIDIA API error (${response.status}): ${detail}`);
    }

    const choice = data?.choices?.[0];
    const message = choice?.message ?? {};
    const toolCalls: LLMToolCall[] | undefined = Array.isArray(message.tool_calls)
      ? message.tool_calls.map((call: any) => ({
          id: call.id || Math.random().toString(36).slice(2),
          type: 'function',
          function: {
            name: call.function?.name || call.name,
            arguments: typeof call.function?.arguments === 'string'
              ? call.function.arguments
              : JSON.stringify(call.function?.arguments ?? {}),
          },
        }))
      : undefined;

    const usage = data?.usage
      ? {
          promptTokens: data.usage.prompt_tokens || 0,
          completionTokens: data.usage.completion_tokens || 0,
          totalTokens: data.usage.total_tokens || 0,
        }
      : undefined;

    return {
      content: extractTextContent(message.content),
      tool_calls: toolCalls,
      usage,
      finishReason: choice?.finish_reason,
      raw: data,
      request: {
        contents: requestMessages,
        systemInstruction,
        tools,
      },
    };
  }
}
