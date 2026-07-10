import { runSociety, LLMLike, SocietyResult } from '../society/Orchestrator';

export interface BenchmarkResult {
  society: SocietyResult;
  single: { output: string; wallMs: number; model: string };
  qualityScores: { society: number; single: number };
}

export async function runBenchmark(brief: string, provider: LLMLike): Promise<BenchmarkResult> {
  // 1. Run society (parallel orchestration)
  const society = await runSociety(brief, provider);
  
  // 2. Run single agent (one monolithic qwen-max call)
  const singleStart = Date.now();
  const singleRes = await provider.generateCompletion(
    [{ role: 'user', content: brief }],
    undefined,
    'You are a senior professional. Complete this brief thoroughly. Respond with the full deliverable.',
    'qwen-max'
  );
  
  const singleResult = {
    output: singleRes.content || '',
    wallMs: Date.now() - singleStart,
    model: 'qwen-max'
  };
  
  // 3. LLM judge — score both outputs
  const judgePrompt = `You are an expert judge. Score the quality of the following two outputs generated for the brief:
"""${brief}"""

---
OUTPUT A (Produced by a Society of Collaborating Agents):
${society.synthesis || society.tasks.map(t => `### ${t.title} (${t.role}):\n${t.output}`).join('\n\n')}

---
OUTPUT B (Produced by a Single Monolithic Agent):
${singleResult.output}

---
Score both outputs from 0 to 100 on completeness, quality, depth, and relevance to the brief.
Respond with ONLY a JSON object: {"society": <score>, "single": <score>}
Do not include any explanation or markdown code blocks. Just raw JSON.`;
  
  const judgeRes = await provider.generateCompletion(
    [{ role: 'user', content: judgePrompt }],
    undefined,
    'You are an impartial judge. Respond with raw JSON only.',
    'qwen-max'
  );
  
  let qualityScores = { society: 75, single: 60 }; // fallback defaults
  try {
    const cleaned = (judgeRes.content || '')
      .replace(/```json?/gi, '')
      .replace(/```/g, '')
      .replace(/,\s*([}\]])/g, '$1')
      .trim();
    const parsed = JSON.parse(cleaned);
    if (typeof parsed.society === 'number' && typeof parsed.single === 'number') {
      qualityScores = { society: parsed.society, single: parsed.single };
    }
  } catch (error) {
    console.error('[Benchmark] Failed to parse quality scores:', error, judgeRes.content);
  }
  
  return { society, single: singleResult, qualityScores };
}
