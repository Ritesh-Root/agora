/**
 * Step 0 smoke test. Reads TYPESAFE_API_KEY from the environment or .env.
 * Prints answers, usage, and latency. Does not print the key.
 */
import { readFileSync } from 'node:fs';

const JEV_URL = 'https://api.typesafe.ai';
const JEV_MODEL = 'jev-1.13.0';

function loadEnvFile(): void {
  try {
    const text = readFileSync(new URL('../.env', import.meta.url), 'utf8');
    for (const line of text.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
      const index = trimmed.indexOf('=');
      const key = trimmed.slice(0, index);
      const value = trimmed.slice(index + 1).trim();
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {
    // The shell environment is enough when .env is absent.
  }
}

function percentile(sorted: number[], p: number): number {
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[index];
}

const state = {
  brief: 'Write a one-page launch note for a public room where a host and guests edit one Markdown project.',
  task: {
    id: 't1',
    title: 'Draft the launch note',
    role: 'writer',
    acceptanceCriteria: ['States who the room is for', 'Explains that the host approves lasting edits'],
  },
  output: 'AGORA is a shared room for a host and guests. The host approves lasting edits to the project Markdown. Guests can chat and work open tasks immediately.',
};

const questions = {
  meets_criterion: {
    type: 'noul',
    instructions: 'Does `output` satisfy `task.acceptanceCriteria`?',
    criteria: { true: 'Every criterion is met', false: 'A criterion is missing' },
  },
  next_step: {
    type: 'choice',
    instructions: 'What should the run do with `output`?',
    criteria: { accept: 'Use the output', retry: 'Ask the worker to revise', escalate: 'Ask the boss' },
  },
  completeness: {
    type: 'score',
    instructions: 'How complete is `output` as a launch note?',
    criteria: ['Missing the point', 'Partial', 'Complete enough to ship'],
  },
};

function problems(body: unknown): string[] {
  const issues: string[] = [];
  if (!body || typeof body !== 'object') return ['response is not an object'];
  const record = body as Record<string, unknown>;
  if (typeof record.model !== 'string') issues.push('model is missing');
  const answers = record.answers as Record<string, Record<string, unknown>> | undefined;
  if (!answers) return [...issues, 'answers is missing'];
  const noul = answers.meets_criterion;
  if (!noul || noul.type !== 'noul' || typeof noul.noul !== 'number') issues.push('noul answer shape differs');
  if (noul && 'confidence' in noul) issues.push('noul included a confidence field');
  const choice = answers.next_step;
  if (!choice || choice.type !== 'choice' || typeof choice.choice !== 'string' || typeof choice.confidence !== 'number' || !choice.probabilities || typeof choice.probabilities !== 'object') {
    issues.push('choice answer shape differs');
  }
  const score = answers.completeness;
  if (!score || score.type !== 'score' || typeof score.score !== 'number' || typeof score.confidence !== 'number' || !score.legend || !score.probabilities) {
    issues.push('score answer shape differs');
  }
  const usage = record.usage as Record<string, unknown> | undefined;
  if (!usage || typeof usage.input_tokens !== 'number' || typeof usage.output_tokens !== 'number') issues.push('usage shape differs');
  return issues;
}

async function main(): Promise<void> {
  loadEnvFile();
  const apiKey = process.env.TYPESAFE_API_KEY?.trim() || process.env.JEV_API_KEY?.trim() || '';
  if (!apiKey) throw new Error('TYPESAFE_API_KEY is not set');
  const base = (process.env.TYPESAFE_BASE_URL || JEV_URL).replace(/\/$/, '');
  const headers = { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' };

  const modelsResponse = await fetch(`${base}/v1/models`, { headers });
  const models = await modelsResponse.json() as unknown;
  console.log('GET /v1/models', modelsResponse.status);
  console.log(JSON.stringify(models, null, 2));

  const latencies: number[] = [];
  for (let i = 0; i < 10; i += 1) {
    const started = Date.now();
    const response = await fetch(`${base}/v1/systemone`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ model: process.env.JEV_MODEL || JEV_MODEL, state, questions }),
    });
    const latencyMs = Date.now() - started;
    latencies.push(latencyMs);
    const body = await response.json() as unknown;
    if (i === 0) {
      console.log('POST /v1/systemone', response.status, `${latencyMs}ms`);
      console.log(JSON.stringify(body, null, 2));
      const issues = !response.ok
        ? [`http ${response.status}`]
        : problems(body);
      if (issues.length) {
        console.error('Stopped:', issues.join('; '));
        console.log(JSON.stringify(body, null, 2));
        process.exitCode = 1;
        return;
      }
    } else {
      const issues = problems(body);
      if (!response.ok || issues.length) {
        console.error(`Call ${i + 1} differs:`, issues.join('; ') || response.status);
        process.exitCode = 1;
        return;
      }
      console.log(`call ${i + 1}`, `${latencyMs}ms`);
    }
  }
  const sorted = [...latencies].sort((a, b) => a - b);
  console.log(JSON.stringify({
    calls: latencies.length,
    latenciesMs: latencies,
    p50Ms: percentile(sorted, 50),
    p95Ms: percentile(sorted, 95),
  }, null, 2));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
