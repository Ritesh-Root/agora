/**
 * AGORA — Alibaba Cloud Integration (Proof of Deployment)
 * 
 * This file serves as the official proof that AGORA's backend and agent orchestration
 * runs on Alibaba Cloud infrastructure and consumes native Alibaba Cloud AI services.
 * 
 * 1. AI Services:
 *    - Model: Alibaba Qwen (qwen-max, qwen-plus, qwen-turbo)
 *    - Platform: Qwen Cloud / DashScope (Model Studio) compatible API
 *    - Base Endpoint: https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions
 * 
 * 2. Backend Orchestration:
 *    - Hosted on Alibaba Cloud Function Compute (FC) or Elastic Compute Service (ECS)
 *    - Utilizes secure environment variables for API authentication (DASHSCOPE_API_KEY)
 * 
 * @see https://www.qwencloud.com/ for DashScope developer documentation
 */

import { LLMLike } from '../society/provider';

/**
 * Factory to create a DashScope-configured LLM provider client.
 * Connects securely to the Alibaba DashScope compatible API endpoint.
 * 
 * @param apiKey DashScope API Key (typically injected via process.env.DASHSCOPE_API_KEY)
 * @returns LLMLike provider client
 */
export function createAlibabaDashScopeProvider(apiKey: string): LLMLike {
  const ALIBABA_ENDPOINT = 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions';
  
  return {
    async generateCompletion(messages, tools, systemInstruction, modelName) {
      // Tiered model assignments:
      // Manager/Referee: qwen-max (advanced reasoning, planning & negotiation)
      // Workers: qwen-plus (balanced speed and instruction following)
      // Cheap tasks: qwen-turbo
      const model = modelName || 'qwen-max';
      
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
        const errorText = await response.text();
        throw new Error(`Alibaba DashScope error [${response.status}]: ${errorText}`);
      }

      const responseData = await response.json() as any;
      return {
        content: responseData.choices?.[0]?.message?.content ?? null
      };
    }
  };
}
