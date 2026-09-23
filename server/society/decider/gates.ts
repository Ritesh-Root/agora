import { decide, DecisionRecord } from './index';
import { consultBoss } from './live';
import { Question } from './types';

export type DeciderMode = 'legacy' | 'jev';
export type WorkerVerdict = 'accept' | 'retry' | 'escalate' | 'legacy';
export type ConflictVerdict = 'debate' | 'skip' | 'ask_boss' | 'legacy';
export type EscalateVerdict = 'consensus' | 'escalate' | 'legacy';

type DecideFn = typeof decide;

export function deciderMode(): DeciderMode {
  return process.env.AGORA_DECIDER === 'jev' ? 'jev' : 'legacy';
}

function unavailable(records: DecisionRecord[]): boolean {
  return records.length === 0 || records.some((record) => record.answer.type === 'uncertain');
}

export async function judgeWorkerOutput(
  input: {
    brief: string;
    task: { title: string; role: string; prompt: string; acceptanceCriteria?: string[] };
    output: string;
  },
  decideImpl: DecideFn = decide,
): Promise<WorkerVerdict> {
  if (deciderMode() !== 'jev') return 'legacy';
  const questions: Record<string, Question> = {
    meets_criterion: {
      type: 'noul',
      instructions: 'Does `output` satisfy `task.acceptanceCriteria` and complete `task.prompt` for `brief`?',
      criteria: {
        true: 'The output meets the criteria and answers the task',
        false: 'The output misses a criterion, contradicts the task, or does not answer it',
      },
    },
    is_deliverable: {
      type: 'noul',
      instructions: 'Is `output` a finished deliverable rather than an error, refusal, or placeholder?',
      criteria: {
        true: 'A usable deliverable',
        false: 'Empty, an error, a refusal, or a promise to do the work later',
      },
    },
  };
  const records = await decideImpl({
    brief: input.brief,
    task: input.task,
    output: input.output,
  }, questions);
  if (unavailable(records)) return 'legacy';
  const byKey = Object.fromEntries(records.map((record) => [record.question, record]));
  const answers = [byKey.meets_criterion, byKey.is_deliverable];
  if (answers.some((record) => record?.policy === 'fallback')) return 'retry';
  const ask = answers.find((record) => record?.policy === 'ask_boss');
  if (ask) {
    const action = await consultBoss(ask);
    if (action === 'approve' || action === 'edit') return 'accept';
    return 'escalate';
  }
  if (answers.every((record) => record?.policy === 'proceed')) return 'accept';
  return 'legacy';
}

export async function judgeConflict(
  input: { brief: string; outputs: { title: string; output: string }[] },
  decideImpl: DecideFn = decide,
): Promise<ConflictVerdict> {
  if (deciderMode() !== 'jev') return 'legacy';
  const records = await decideImpl({
    brief: input.brief,
    outputs: input.outputs.map((item) => ({ title: item.title, output: item.output.slice(0, 1500) })),
  }, {
    outputs_conflict: {
      type: 'noul',
      instructions: 'Do `outputs` contradict each other on a decision `brief` needs resolved?',
      criteria: {
        true: 'They recommend incompatible actions or facts',
        false: 'They can be merged without a boss deciding between them',
      },
    },
  });
  const record = records[0];
  if (!record || record.answer.type === 'uncertain') return 'legacy';
  if (record.policy === 'proceed') return 'debate';
  if (record.policy === 'ask_boss') {
    const action = await consultBoss(record);
    if (action === 'approve') return 'debate';
    if (action === 'reject') return 'skip';
    return 'ask_boss';
  }
  return 'skip';
}

export async function judgeEscalation(
  input: {
    topic: string;
    scores: { agent: string; score: number; reason: string }[];
    arguments: { agent: string; argument: string }[];
  },
  decideImpl: DecideFn = decide,
): Promise<EscalateVerdict> {
  if (deciderMode() !== 'jev') return 'legacy';
  const records = await decideImpl({
    topic: input.topic,
    scores: input.scores,
    arguments: input.arguments,
  }, {
    boss_decision: {
      type: 'choice',
      instructions: 'Should the boss decide, or is one position clear enough to adopt?',
      criteria: {
        consensus: 'One position is clearly stronger and safe to adopt',
        escalate: 'The boss must decide because the positions are too close, too weak, or still in conflict',
      },
    },
  });
  const record = records[0];
  if (!record || record.answer.type === 'uncertain') return 'legacy';
  if (record.policy !== 'proceed') {
    if (record.policy === 'ask_boss' && await consultBoss(record) === 'approve') return 'consensus';
    return 'escalate';
  }
  if (record.answer.type === 'choice' && record.answer.choice === 'consensus') return 'consensus';
  return 'escalate';
}
