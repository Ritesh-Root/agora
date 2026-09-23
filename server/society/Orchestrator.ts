/**
 * Society Orchestrator — the core of AGORA's "agent society".
 *
 * Lifecycle (Track 3 mechanics):
 *   1. Manager (qwen-max) decomposes a brief into parallelizable subtasks + roles.
 *   2. Workers (qwen-plus) execute concurrently (Promise.all).
 *   3. Worker self-heal: an invalid output is diagnosed and retried ONCE before
 *      escalating to a human-in-the-loop.
 *
 * Provider-agnostic: depends only on the minimal `LLMLike` shape, which both
 * QwenProvider and NvidiaProvider satisfy structurally. Kept free of DOM/React
 * so it runs server-side (Alibaba FC/ECS) and under the strict server tsconfig.
 */

import { judgeWorkerOutput } from './decider/gates';
import { takeBossEdit } from './decider/live';
import { beginResearch, researchForTask, sourcesMarkdown } from '../research/research';

/** Minimal structural type any LLM provider satisfies. */
export interface LLMLike {
  generateCompletion(
    messages: { role: string; content: string }[],
    tools?: unknown[],
    systemInstruction?: string,
    modelName?: string,
  ): Promise<{ content: string | null }>;
}

export interface SocietyTask {
  id: string;
  title: string;
  /** Worker specialization, e.g. "researcher", "designer". */
  role: string;
  /** What this worker must produce. */
  prompt: string;
  /** Task ids this depends on. Execution waits for those outputs. */
  deps?: string[];
  acceptanceCriteria?: string[];
}

export type TaskStatus = 'done' | 'escalated';

export interface TaskResult {
  id: string;
  title: string;
  role: string;
  status: TaskStatus;
  output: string;
  /** 1 = first try; 2 = one self-heal retry. */
  attempts: number;
  /** True if a retry turned an invalid output into a valid one. */
  healed: boolean;
}

export interface SocietyResult {
  brief: string;
  tasks: TaskResult[];
  /** Lead-merged final deliverable (empty if every worker failed). */
  synthesis: string;
  metrics: {
    taskCount: number;
    /** Peak simultaneous workers — proves real parallelism. */
    maxConcurrency: number;
    escalated: number;
    healed: number;
    wallMs: number;
    phases: {
      managerMs: number;
      workersMs: number;
      beforeSynthesisMs: number;
      leadMs: number;
    };
  };
}

export interface OrchestratorOptions {
  models?: { manager?: string; worker?: string };
  /** Returns false to mark a worker output invalid (triggers self-heal). */
  isValidOutput?: (task: SocietyTask, output: string) => boolean;
  /** Jev path. `legacy` means use isValidOutput. */
  judgeOutput?: (
    task: SocietyTask,
    output: string,
  ) => Promise<'accept' | 'retry' | 'escalate' | 'legacy'>;
  onEvent?: (event: { type: string; [key: string]: any }) => void;
  /** Called with worker results before the Lead writes the deliverable. */
  beforeSynthesis?: (results: TaskResult[]) => Promise<string | void>;
}

const DEFAULT_MANAGER_MODEL = 'qwen-max';
const DEFAULT_WORKER_MODEL = 'qwen-plus';
const MAX_ATTEMPTS = 2; // first attempt + one self-heal retry

function defaultIsValid(_task: SocietyTask, output: string): boolean {
  const trimmed = output.trim();
  return trimmed.length > 0 && !trimmed.toUpperCase().startsWith('ERROR');
}

/** Tracks peak concurrency across overlapping workers. */
function makeConcurrencyTracker() {
  let current = 0;
  let peak = 0;
  return {
    enter() {
      current += 1;
      if (current > peak) peak = current;
    },
    exit() {
      current -= 1;
    },
    peak: () => peak,
  };
}

function normalizeTask(raw: unknown, index: number): SocietyTask {
  const obj = (raw && typeof raw === 'object') ? (raw as Record<string, unknown>) : {};
  const str = (v: unknown, fallback: string): string =>
    typeof v === 'string' && v.trim() ? v : fallback;
  const deps = Array.isArray(obj.deps)
    ? obj.deps.filter((d): d is string => typeof d === 'string')
    : undefined;
  const acceptanceCriteria = Array.isArray(obj.acceptanceCriteria)
    ? obj.acceptanceCriteria.filter((c): c is string => typeof c === 'string' && !!c.trim())
    : undefined;
  return {
    id: str(obj.id, `t${index + 1}`),
    title: str(obj.title, `Task ${index + 1}`),
    role: str(obj.role, 'worker'),
    prompt: str(obj.prompt, str(obj.title, `Task ${index + 1}`)),
    deps,
    acceptanceCriteria,
  };
}

/** Parse the Manager's plan, tolerating code fences and surrounding prose. */
export function parsePlan(content: string | null): SocietyTask[] {
  if (!content || !content.trim()) {
    throw new Error('Manager returned an empty plan');
  }
  const cleaned = content
    .trim()
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/, '')
    // qwen3.5 sometimes emits trailing commas, which JSON.parse rejects
    .replace(/,\s*([}\]])/g, '$1')
    .trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    const match = cleaned.match(/\[[\s\S]*\]/);
    if (!match) throw new Error('Manager plan is not valid JSON');
    parsed = JSON.parse(match[0]);
  }

  if (!Array.isArray(parsed)) {
    throw new Error('Manager plan must be a JSON array of tasks');
  }
  return parsed.map((raw, i) => normalizeTask(raw, i));
}

function clip(text: string, max = 1500): string {
  const trimmed = text.trim();
  return trimmed.length <= max ? trimmed : `${trimmed.slice(0, max)}…`;
}

/** Group tasks so a task never runs before the tasks it depends on. */
export function dependencyWaves(tasks: SocietyTask[]): SocietyTask[][] {
  const byId = new Map(tasks.map((task) => [task.id, task]));
  const remaining = new Set(tasks.map((task) => task.id));
  const done = new Set<string>();
  const waves: SocietyTask[][] = [];

  while (remaining.size > 0) {
    const ready = [...remaining].filter((id) => {
      const deps = byId.get(id)?.deps ?? [];
      return deps.every((dep) => done.has(dep) || !byId.has(dep));
    });
    const ids = ready.length > 0 ? ready : [...remaining];
    waves.push(ids.map((id) => byId.get(id)!));
    for (const id of ids) {
      remaining.delete(id);
      done.add(id);
    }
  }
  return waves;
}

function workerPrompt(
  task: SocietyTask,
  brief: string,
  siblings: string[],
  depText: string,
  attempt: number,
  lastInvalid: string,
  sources: string,
): string {
  const parts = [
    `Brief:\n${brief}`,
    `Your task (${task.role}): ${task.prompt}`,
    task.acceptanceCriteria?.length
      ? `Acceptance criteria:\n- ${task.acceptanceCriteria.join('\n- ')}`
      : '',
    siblings.length ? `Other tasks in this wave, do not duplicate them: ${siblings.join('; ')}` : '',
    depText ? `Outputs you depend on:\n${depText}` : '',
    sources ? `${sources}\n\nCite the sources you use, by URL.` : '',
  ].filter(Boolean);
  const body = parts.join('\n\n');
  if (attempt === 1) return body;
  return `Your previous attempt was rejected as invalid:\n"""${lastInvalid}"""\nDiagnose what went wrong, then produce a corrected deliverable.\n\n${body}`;
}

async function runWorker(
  task: SocietyTask,
  brief: string,
  siblings: string[],
  depText: string,
  provider: LLMLike,
  model: string,
  isValid: (task: SocietyTask, output: string) => boolean,
  judgeOutput: OrchestratorOptions['judgeOutput'] | undefined,
  tracker: ReturnType<typeof makeConcurrencyTracker>,
  onEvent?: (event: { type: string; [key: string]: any }) => void,
): Promise<TaskResult> {
  tracker.enter();
  onEvent?.({ type: 'task-start', taskId: task.id, title: task.title, role: task.role });
  try {
    let attempts = 0;
    let output = '';
    let lastInvalid = '';

    while (attempts < MAX_ATTEMPTS) {
      attempts += 1;
      if (attempts > 1) {
        onEvent?.({ type: 'task-healing', taskId: task.id, title: task.title, attempt: attempts });
      }
      const system = `You are a ${task.role} worker in an agent society. Complete the task and respond with the deliverable only.`;
      const sources = await researchForTask(task, brief, {
        onStart: () => onEvent?.({ type: 'task-research', taskId: task.id, title: task.title, role: task.role }),
      });
      const userContent = workerPrompt(task, brief, siblings, depText, attempts, lastInvalid, sources);

      const res = await provider.generateCompletion(
        [{ role: 'user', content: userContent }],
        undefined,
        system,
        model,
      );
      output = res.content ?? '';

      const judged = judgeOutput
        ? await judgeOutput(task, output)
        : await judgeWorkerOutput({ brief, task, output });
      const verdict = judged === 'legacy'
        ? (isValid(task, output) ? 'accept' : 'retry')
        : judged;

      if (verdict === 'accept') {
        const edited = takeBossEdit();
        if (edited) output = edited;
        onEvent?.({ type: 'task-done', taskId: task.id, title: task.title, status: 'done', output, attempts, healed: attempts > 1 });
        return {
          id: task.id,
          title: task.title,
          role: task.role,
          status: 'done',
          output,
          attempts,
          healed: attempts > 1,
        };
      }
      if (verdict === 'escalate') break;
      lastInvalid = output;
    }

    // Retries exhausted → escalate to human-in-the-loop.
    onEvent?.({ type: 'task-done', taskId: task.id, title: task.title, status: 'escalated', output, attempts, healed: false });
    return {
      id: task.id,
      title: task.title,
      role: task.role,
      status: 'escalated',
      output,
      attempts,
      healed: false,
    };
  } finally {
    tracker.exit();
  }
}

/** Run a full society pass over a brief. */
export async function runSociety(
  brief: string,
  provider: LLMLike,
  options: OrchestratorOptions = {},
): Promise<SocietyResult> {
  const start = Date.now();
  const managerStarted = Date.now();
  const managerModel = options.models?.manager ?? DEFAULT_MANAGER_MODEL;
  const workerModel = options.models?.worker ?? DEFAULT_WORKER_MODEL;
  const isValid = options.isValidOutput ?? defaultIsValid;
  const onEvent = options.onEvent;
  beginResearch();

  // 1. Manager decomposes the brief.
  const managerSystem =
    'You are the Manager of an agent society. Decompose the user brief into subtasks. ' +
    'Tasks that can run together should have no deps. A task that needs another task\'s output lists that id in deps. ' +
    'Respond with ONLY a JSON array: [{"id","title","role","prompt","deps"?,"acceptanceCriteria"?}]. Aim for at least 3 tasks.';
  const plan = await provider.generateCompletion(
    [{ role: 'user', content: brief }],
    undefined,
    managerSystem,
    managerModel,
  );
  const tasks = parsePlan(plan.content);
  const managerMs = Date.now() - managerStarted;

  const tracker = makeConcurrencyTracker();
  const outputs = new Map<string, string>();
  const results: TaskResult[] = [];
  const workersStarted = Date.now();
  for (const wave of dependencyWaves(tasks)) {
    const waveResults = await Promise.all(wave.map((task) => {
      const siblings = wave.filter((other) => other.id !== task.id).map((other) => other.title);
      const depText = (task.deps ?? [])
        .map((id) => outputs.get(id))
        .filter((text): text is string => !!text)
        .map((text) => clip(text))
        .join('\n\n');
      return runWorker(task, brief, siblings, depText, provider, workerModel, isValid, options.judgeOutput, tracker, onEvent);
    }));
    for (const result of waveResults) {
      outputs.set(result.id, result.output);
      results.push(result);
    }
  }
  const workersMs = Date.now() - workersStarted;

  const beforeStarted = Date.now();
  const leadNotes = (await options.beforeSynthesis?.(results)) || '';
  const beforeSynthesisMs = Date.now() - beforeStarted;

  let synthesis = '';
  const doneOutputs = results.filter((r) => r.status === 'done' && r.output);
  const leadStarted = Date.now();
  if (doneOutputs.length > 0) {
    onEvent?.({ type: 'society-synthesizing' });
    try {
      const leadSystem =
        'You are the Lead of an agent society. Merge the worker outputs into ONE coherent, ' +
        'complete, non-redundant deliverable that fully answers the brief. Respond with the ' +
        'final deliverable only.';
      const leadRes = await provider.generateCompletion(
        [{
          role: 'user',
          content: `Brief:\n${brief}\n\nWorker outputs:\n${doneOutputs
            .map((r) => `### ${r.title} (${r.role})\n${r.output}`)
            .join('\n\n')}${leadNotes ? `\n\nResolved disagreement:\n${leadNotes}` : ''}`,
        }],
        undefined,
        leadSystem,
        managerModel,
      );
      synthesis = leadRes.content ?? '';
      const cited = sourcesMarkdown();
      if (cited && !synthesis.includes('## Sources')) synthesis += cited;
    } catch {
      // synthesis is best-effort; the task outputs still stand on their own
    }
  }
  const leadMs = Date.now() - leadStarted;

  return {
    brief,
    tasks: results,
    synthesis,
    metrics: {
      taskCount: tasks.length,
      maxConcurrency: tracker.peak(),
      escalated: results.filter((r) => r.status === 'escalated').length,
      healed: results.filter((r) => r.healed).length,
      wallMs: Date.now() - start,
      phases: { managerMs, workersMs, beforeSynthesisMs, leadMs },
    },
  };
}
