import { runSociety, LLMLike, SocietyResult } from '../society/Orchestrator';

export interface BenchmarkResult {
  society: SocietyResult;
  single: { output: string; wallMs: number; model: string };
  qualityScores: { society: number; single: number } | null;
}

export async function runBenchmark(brief: string, provider: LLMLike, model = 'qwen-max'): Promise<BenchmarkResult> {
  const society = await runSociety(brief, provider, { models: { manager: model, worker: model } });

  const singleStart = Date.now();
  const singleRes = await provider.generateCompletion(
    [{ role: 'user', content: brief }],
    undefined,
    'You are a senior professional. Complete this brief thoroughly. Respond with the full deliverable.',
    model
  );

  const singleResult = {
    output: singleRes.content || '',
    wallMs: Date.now() - singleStart,
    model
  };

  const societyText = society.synthesis || society.tasks.map(t => `### ${t.title} (${t.role}):\n${t.output}`).join('\n\n');
  const qualityScores = await blindScores(provider, brief, societyText, singleResult.output, model);

  return { society, single: singleResult, qualityScores };
}

function judgePrompt(brief: string, left: string, right: string): string {
  return `Score these two answers to the brief from 0 to 100 on completeness, quality, depth, and relevance.
Brief:
"""${brief}"""

ANSWER A:
${left}

ANSWER B:
${right}

Respond with ONLY raw JSON: {"a": <score>, "b": <score>}`;
}

function parsePair(content: string | null): { a: number; b: number } | null {
  try {
    const cleaned = (content || '')
      .replace(/```json?/gi, '')
      .replace(/```/g, '')
      .replace(/,\s*([}\]])/g, '$1')
      .trim();
    const parsed = JSON.parse(cleaned);
    if (typeof parsed.a === 'number' && typeof parsed.b === 'number') {
      return { a: parsed.a, b: parsed.b };
    }
  } catch {
    return null;
  }
  return null;
}

/** Score both orders so the judge never knows which answer came from the society. */
async function blindScores(
  provider: LLMLike,
  brief: string,
  societyText: string,
  singleText: string,
  model: string,
): Promise<{ society: number; single: number } | null> {
  const first = await provider.generateCompletion(
    [{ role: 'user', content: judgePrompt(brief, societyText, singleText) }],
    undefined,
    'You are an impartial judge. Respond with raw JSON only.',
    model,
  );
  const second = await provider.generateCompletion(
    [{ role: 'user', content: judgePrompt(brief, singleText, societyText) }],
    undefined,
    'You are an impartial judge. Respond with raw JSON only.',
    model,
  );
  const forward = parsePair(first.content);
  const reversed = parsePair(second.content);
  const societyScores = [forward?.a, reversed?.b].filter((n): n is number => typeof n === 'number');
  const singleScores = [forward?.b, reversed?.a].filter((n): n is number => typeof n === 'number');
  if (!societyScores.length || !singleScores.length) return null;
  const avg = (nums: number[]) => nums.reduce((sum, n) => sum + n, 0) / nums.length;
  return { society: avg(societyScores), single: avg(singleScores) };
}
