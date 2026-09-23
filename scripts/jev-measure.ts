/**
 * Step 4. Runs five briefs on the legacy path and the Jev path.
 * Writes a report to ~/Downloads. Does not print API keys.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { judgeWorkerOutput } from '../server/society/decider/gates';
import { beginRunStats, endRunStats, type RunStats } from '../server/society/decider/runStats';
import { leadNotesFromConflict } from '../server/society/leadNotes';
import { runSociety, type LLMLike } from '../server/society/Orchestrator';
import { createServerProvider } from '../server/society/provider';

const BRIEFS = [
  'In 120 words, explain a shared Markdown room where a host approves lasting edits and guests can chat.',
  'List five risks of letting guests spend a host API key, and one mitigation for each. Keep each line under 20 words.',
  'Write a short checklist for joining an office when the 3D view is unavailable.',
  'Define task statuses open, in progress, in review, and done. One sentence each.',
  'Two workers disagree: keep room chat for 7 days, or for 30 days. State both positions in two short paragraphs.',
];

const JEV_USD_PER_MILLION_INPUT = 0.042;

function loadEnvFile(path: string): void {
  try {
    const text = readFileSync(path, 'utf8');
    for (const line of text.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
      const index = trimmed.indexOf('=');
      const key = trimmed.slice(0, index).replace(/^export /, '');
      const value = trimmed.slice(index + 1).trim().replace(/^['"]|['"]$/g, '');
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {
    // Missing files are handled by the checks below.
  }
}

function legacyAccepts(output: string): boolean {
  const trimmed = output.trim();
  return trimmed.length > 0 && !trimmed.toUpperCase().startsWith('ERROR');
}

async function probeJev(): Promise<string | null> {
  const apiKey = process.env.TYPESAFE_API_KEY?.trim() || '';
  if (!apiKey) return 'TYPESAFE_API_KEY is missing';
  const base = (process.env.TYPESAFE_BASE_URL || 'https://api.typesafe.ai').replace(/\/$/, '');
  const response = await fetch(`${base}/v1/systemone`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: process.env.JEV_MODEL || 'jev-1.13.0',
      state: { output: 'A finished note.' },
      questions: { is_deliverable: { type: 'noul', instructions: 'Is `output` a finished deliverable?' } },
    }),
  });
  if (!response.ok) return `Jev probe returned HTTP ${response.status}`;
  const body = await response.json() as { answers?: { is_deliverable?: { type?: string; noul?: number } } };
  if (body.answers?.is_deliverable?.type !== 'noul' || typeof body.answers.is_deliverable.noul !== 'number') {
    return 'Jev probe response did not contain a noul answer';
  }
  return null;
}

interface Arm {
  mode: 'legacy' | 'jev';
  brief: string;
  wallMs: number;
  phases: { managerMs: number; workersMs: number; beforeSynthesisMs: number; leadMs: number };
  writeCalls: number;
  promptTokens: number;
  completionTokens: number;
  decisions: RunStats;
  conflict: string;
  negotiation: string;
  tasks: { title: string; status: string; attempts: number; legacyAccepts: boolean; output: string }[];
  error?: string;
}

async function runArm(mode: 'legacy' | 'jev', brief: string, provider: LLMLike): Promise<Arm> {
  process.env.AGORA_DECIDER = mode;
  const decisions = beginRunStats();
  let writeCalls = 0;
  let promptTokens = 0;
  let completionTokens = 0;
  const wrapped: LLMLike = {
    async generateCompletion(messages, tools, systemInstruction, modelName) {
      writeCalls += 1;
      const result = await provider.generateCompletion(messages, tools, systemInstruction, modelName) as {
        content: string | null;
        usage?: { promptTokens?: number; completionTokens?: number };
      };
      promptTokens += result.usage?.promptTokens ?? 0;
      completionTokens += result.usage?.completionTokens ?? 0;
      return result;
    },
  };
  let conflict = 'none';
  let negotiation = 'not-run';
  try {
    const result = await runSociety(brief, wrapped, {
      models: { manager: 'qwen-turbo', worker: 'qwen-turbo' },
      beforeSynthesis: async (tasks) => {
        const prepared = await leadNotesFromConflict(brief, tasks, wrapped);
        conflict = prepared.conflict;
        negotiation = prepared.negotiation?.outcome ?? 'not-run';
        return prepared.notes;
      },
    });
    return {
      mode,
      brief,
      wallMs: result.metrics.wallMs,
      phases: result.metrics.phases,
      writeCalls,
      promptTokens,
      completionTokens,
      decisions: { ...decisions, outcomes: { ...decisions.outcomes }, decisionLatencyMs: [...decisions.decisionLatencyMs] },
      conflict,
      negotiation,
      tasks: result.tasks.map((task) => ({
        title: task.title,
        status: task.status,
        attempts: task.attempts,
        legacyAccepts: legacyAccepts(task.output),
        output: task.output,
      })),
    };
  } catch (error) {
    return {
      mode,
      brief,
      wallMs: 0,
      phases: { managerMs: 0, workersMs: 0, beforeSynthesisMs: 0, leadMs: 0 },
      writeCalls,
      promptTokens,
      completionTokens,
      decisions: { ...decisions, outcomes: { ...decisions.outcomes }, decisionLatencyMs: [...decisions.decisionLatencyMs] },
      conflict,
      negotiation,
      tasks: [],
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    endRunStats();
  }
}

async function qualityOn(arm: Arm): Promise<{ jevAcceptedLegacyRejected: number; jevRejectedLegacyAccepted: number; unavailable: number }> {
  process.env.AGORA_DECIDER = 'jev';
  const totals = { jevAcceptedLegacyRejected: 0, jevRejectedLegacyAccepted: 0, unavailable: 0 };
  for (const task of arm.tasks) {
    const judged = await judgeWorkerOutput({
      brief: arm.brief,
      task: { title: task.title, role: 'worker', prompt: task.title },
      output: task.output,
    });
    if (judged === 'legacy') {
      totals.unavailable += 1;
      continue;
    }
    const jevAccepts = judged === 'accept';
    if (jevAccepts && !task.legacyAccepts) totals.jevAcceptedLegacyRejected += 1;
    if (!jevAccepts && task.legacyAccepts) totals.jevRejectedLegacyAccepted += 1;
  }
  return totals;
}

function sum(rows: Arm[], pick: (row: Arm) => number): number {
  return rows.reduce((total, row) => total + pick(row), 0);
}

function line(arm: Arm): string {
  const decisionMs = arm.decisions.decisionLatencyMs.reduce((total, value) => total + value, 0);
  return `| ${arm.mode} | ${arm.wallMs} | ${arm.phases.managerMs} | ${arm.phases.workersMs} | ${arm.phases.beforeSynthesisMs} | ${arm.phases.leadMs} | ${arm.writeCalls} | ${arm.decisions.decisionCalls} | ${decisionMs} | ${arm.promptTokens} | ${arm.completionTokens} | ${arm.decisions.inputTokens} | ${JSON.stringify(arm.decisions.outcomes)} | ${arm.conflict} | ${arm.negotiation} | ${arm.error ?? ''} |`;
}

async function main(): Promise<void> {
  loadEnvFile(fileURLToPath(new URL('../.env', import.meta.url)));
  if (!process.env.DASHSCOPE_API_KEY) loadEnvFile(`${homedir()}/.hermes/.env`);
  if (!process.env.DASHSCOPE_API_KEY && process.env.QWEN_CLOUD_API_KEY) {
    process.env.DASHSCOPE_API_KEY = process.env.QWEN_CLOUD_API_KEY;
  }

  const probeError = await probeJev();
  const writerReady = !!process.env.DASHSCOPE_API_KEY?.trim();
  const lines = [
    '# AGORA Jev phase 1 measurement',
    '',
    probeError
      ? `Jev probe failed: ${probeError}. The five-brief comparison was not run, because a failed key would only measure the fallback path.`
      : 'Jev probe succeeded.',
    writerReady ? 'A writing key was available.' : 'No DashScope writing key was available.',
    '',
    'Both arms use the same writer model, qwen-turbo. Jev input cost uses the published rate of $0.042 per million input tokens. Output tokens are free. Writer cost is not priced here.',
    '',
  ];

  if (probeError || !writerReady) {
    const path = `${homedir()}/Downloads/agora-jev-phase1-results.md`;
    writeFileSync(path, lines.join('\n'));
    console.log(lines.join('\n'));
    console.log(path);
    process.exitCode = 1;
    return;
  }

  const provider = createServerProvider(process.env.DASHSCOPE_API_KEY!.trim());
  const arms: Arm[] = [];
  for (const brief of BRIEFS) {
    console.log('legacy', brief.slice(0, 48));
    arms.push(await runArm('legacy', brief, provider));
    console.log('jev', brief.slice(0, 48));
    arms.push(await runArm('jev', brief, provider));
  }

  const quality = [];
  for (const arm of arms) quality.push({ brief: arm.brief, mode: arm.mode, ...(await qualityOn(arm)) });

  const legacy = arms.filter((arm) => arm.mode === 'legacy');
  const jev = arms.filter((arm) => arm.mode === 'jev');
  const jevInput = sum(jev, (arm) => arm.decisions.inputTokens);
  lines.push(
    '| mode | wall ms | manager | workers | before lead | lead | write calls | decision calls | decision ms | writer in | writer out | jev in | outcomes | conflict | negotiation | error |',
    '| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- | --- | --- |',
    ...arms.map(line),
    '',
    `Legacy wall time: ${sum(legacy, (arm) => arm.wallMs)} ms. Jev wall time: ${sum(jev, (arm) => arm.wallMs)} ms.`,
    `Jev input tokens during the runs: ${jevInput}. Estimated Jev cost: $${(jevInput / 1_000_000 * JEV_USD_PER_MILLION_INPUT).toFixed(6)}.`,
    '',
    'Quality check, judging the same saved output with both the legacy text rule and Jev:',
    '',
    ...quality.map((row) => `- ${row.mode}: Jev accepted ${row.jevAcceptedLegacyRejected} output(s) the legacy rule rejected; Jev rejected ${row.jevRejectedLegacyAccepted} the legacy rule accepted; unavailable ${row.unavailable}. ${row.brief}`),
    '',
  );
  const path = `${homedir()}/Downloads/agora-jev-phase1-results.md`;
  writeFileSync(path, lines.join('\n'));
  console.log(lines.slice(-12).join('\n'));
  console.log(path);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
