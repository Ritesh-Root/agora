import { afterEach, describe, expect, it } from 'vitest';
import { judgeConflict, judgeEscalation, judgeWorkerOutput } from './gates';
import { DecisionRecord } from './index';
import { setBossAsker } from './live';

function record(partial: Partial<DecisionRecord> & Pick<DecisionRecord, 'question' | 'answer' | 'policy'>): DecisionRecord {
  return {
    probabilities: null,
    latencyMs: 10,
    pinnedModel: 'jev-1.13.0',
    returnedModel: 'jev-1.13.0',
    tokens: { input_tokens: 3, output_tokens: 1 },
    ...partial,
  };
}

describe('critical-path gates', () => {
  afterEach(() => {
    delete process.env.AGORA_DECIDER;
  });

  it('accepts a worker output only when both checks proceed', async () => {
    process.env.AGORA_DECIDER = 'jev';
    const verdict = await judgeWorkerOutput({
      brief: 'Write a note',
      task: { title: 'Note', role: 'writer', prompt: 'Write a note' },
      output: 'The note.',
    }, async () => [
      record({ question: 'meets_criterion', policy: 'proceed', answer: { type: 'noul', noul: 0.95 } }),
      record({ question: 'is_deliverable', policy: 'proceed', answer: { type: 'noul', noul: 0.99 } }),
    ]);
    expect(verdict).toBe('accept');
    delete process.env.AGORA_DECIDER;
  });

  it('retries a hard no and escalates the middle band', async () => {
    process.env.AGORA_DECIDER = 'jev';
    const retry = await judgeWorkerOutput({
      brief: 'Write a note',
      task: { title: 'Note', role: 'writer', prompt: 'Write a note' },
      output: 'ERROR',
    }, async () => [
      record({ question: 'meets_criterion', policy: 'fallback', answer: { type: 'noul', noul: 0.02 } }),
      record({ question: 'is_deliverable', policy: 'proceed', answer: { type: 'noul', noul: 0.99 } }),
    ]);
    const escalate = await judgeWorkerOutput({
      brief: 'Write a note',
      task: { title: 'Note', role: 'writer', prompt: 'Write a note' },
      output: 'Maybe.',
    }, async () => [
      record({ question: 'meets_criterion', policy: 'ask_boss', answer: { type: 'noul', noul: 0.5 } }),
      record({ question: 'is_deliverable', policy: 'proceed', answer: { type: 'noul', noul: 0.99 } }),
    ]);
    expect(retry).toBe('retry');
    expect(escalate).toBe('escalate');
    delete process.env.AGORA_DECIDER;
  });

  it('uses the old path when Jev is down or the mode is legacy', async () => {
    delete process.env.AGORA_DECIDER;
    expect(await judgeConflict({ brief: 'b', outputs: [] }, async () => [])).toBe('legacy');
    process.env.AGORA_DECIDER = 'jev';
    const failed = await judgeConflict({ brief: 'b', outputs: [{ title: 'A', output: 'one' }] }, async () => [
      record({ question: 'outputs_conflict', policy: 'fallback', answer: { type: 'uncertain' }, error: 'http 401' }),
    ]);
    expect(failed).toBe('legacy');
    delete process.env.AGORA_DECIDER;
  });

  it('debates a clear conflict, skips a clear agreement, and asks the boss in between', async () => {
    process.env.AGORA_DECIDER = 'jev';
    const debate = await judgeConflict({ brief: 'b', outputs: [] }, async () => [
      record({ question: 'outputs_conflict', policy: 'proceed', answer: { type: 'noul', noul: 0.94 } }),
    ]);
    const skip = await judgeConflict({ brief: 'b', outputs: [] }, async () => [
      record({ question: 'outputs_conflict', policy: 'fallback', answer: { type: 'noul', noul: 0.05 } }),
    ]);
    const ask = await judgeConflict({ brief: 'b', outputs: [] }, async () => [
      record({ question: 'outputs_conflict', policy: 'ask_boss', answer: { type: 'noul', noul: 0.4 } }),
    ]);
    expect(debate).toBe('debate');
    expect(skip).toBe('skip');
    expect(ask).toBe('ask_boss');
    delete process.env.AGORA_DECIDER;
  });

  it('does not treat a low-confidence choice as consensus', async () => {
    process.env.AGORA_DECIDER = 'jev';
    const verdict = await judgeEscalation({
      topic: 'retention',
      scores: [],
      arguments: [],
    }, async () => [
      record({
        question: 'boss_decision',
        policy: 'ask_boss',
        answer: {
          type: 'choice',
          choice: 'consensus',
          probabilities: { consensus: 0.55, escalate: 0.45 },
          confidence: 0.4,
        },
        probabilities: { consensus: 0.55, escalate: 0.45 },
      }),
    ]);
    expect(verdict).toBe('escalate');
    delete process.env.AGORA_DECIDER;
  });

  it('accepts a worker output when the boss approves the ask', async () => {
    process.env.AGORA_DECIDER = 'jev';
    setBossAsker(async () => ({ action: 'approve' }));
    try {
      const verdict = await judgeWorkerOutput({
        brief: 'Write a note',
        task: { title: 'Note', role: 'writer', prompt: 'Write a note' },
        output: 'Maybe.',
      }, async () => [
        record({ question: 'meets_criterion', policy: 'ask_boss', answer: { type: 'noul', noul: 0.5 } }),
        record({ question: 'is_deliverable', policy: 'proceed', answer: { type: 'noul', noul: 0.99 } }),
      ]);
      expect(verdict).toBe('accept');
    } finally {
      setBossAsker(null);
      delete process.env.AGORA_DECIDER;
    }
  });
});
