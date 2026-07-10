import { LLMMessage, LLMProvider, LLMResponse, LLMToolCall, LLMToolDefinition } from '../types';

const QWEN_CHAT_URL = 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions';
const QWEN_DEFAULT_MODEL = 'qwen-plus';

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

export class QwenProvider implements LLMProvider {
  constructor(private readonly apiKey: string, private readonly baseUrl: string = QWEN_CHAT_URL) {}

  async generateCompletion(
    messages: LLMMessage[],
    tools?: LLMToolDefinition[],
    systemInstruction?: string,
    modelName: string = QWEN_DEFAULT_MODEL
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
        throw new Error('Qwen chat completions do not support image inputs in this build.');
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
      temperature: 1,
      top_p: 0.95,
      stream: false,
    };

    if (tools?.length) {
      payload.tools = tools;
      payload.tool_choice = 'auto';
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

    const response = await fetch(fetchUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      const detail = data ? JSON.stringify(data) : response.statusText;
      throw new Error(`Qwen/DashScope API error (${response.status}): ${detail}`);
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
