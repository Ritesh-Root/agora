import type { DecisionWire } from '../../../shared/protocol';

export interface BossReply {
  action: 'approve' | 'edit' | 'reject';
  text?: string;
}

interface Publishable {
  question: string;
  policy: DecisionWire['policy'];
  latencyMs: number;
  error?: string;
  answer: {
    type: string;
    noul?: number;
    choice?: string;
    score?: number;
    confidence?: number;
  };
}

let sink: ((record: Publishable) => void) | null = null;
let asker: ((record: Publishable) => Promise<BossReply | null>) | null = null;
const edits: string[] = [];

export function setDecisionSink(next: typeof sink): void {
  sink = next;
}

export function setBossAsker(next: typeof asker): void {
  asker = next;
}

export function publishDecision(record: Publishable): void {
  sink?.(record);
}

export function takeBossEdit(): string | null {
  return edits.shift() ?? null;
}

export async function consultBoss(record: Publishable): Promise<'approve' | 'edit' | 'reject' | 'timeout'> {
  if (!asker) return 'timeout';
  const reply = await asker(record);
  if (!reply) return 'timeout';
  if (reply.action === 'edit' && reply.text?.trim()) edits.push(reply.text.trim());
  return reply.action;
}

export function toDecisionWire(record: Publishable): DecisionWire {
  if (record.answer.type === 'noul' && typeof record.answer.noul === 'number') {
    return {
      question: record.question,
      policy: record.policy,
      answer: record.answer.noul.toFixed(2),
      confidence: record.answer.noul,
      latencyMs: record.latencyMs,
      error: record.error,
    };
  }
  if (record.answer.type === 'choice') {
    return {
      question: record.question,
      policy: record.policy,
      answer: record.answer.choice ?? '',
      confidence: record.answer.confidence ?? null,
      latencyMs: record.latencyMs,
      error: record.error,
    };
  }
  if (record.answer.type === 'score') {
    return {
      question: record.question,
      policy: record.policy,
      answer: String(record.answer.score ?? ''),
      confidence: record.answer.confidence ?? null,
      latencyMs: record.latencyMs,
      error: record.error,
    };
  }
  return {
    question: record.question,
    policy: record.policy,
    answer: 'uncertain',
    confidence: null,
    latencyMs: record.latencyMs,
    error: record.error,
  };
}
