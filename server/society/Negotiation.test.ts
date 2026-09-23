import { afterEach, describe, expect, it, vi } from 'vitest';
import { runNegotiation, type NegotiationLLM } from './Negotiation';

const provider: NegotiationLLM = {
  async generateCompletion(_messages, _tools, systemInstruction) {
    if (systemInstruction?.includes('Score each debater')) {
      return { content: JSON.stringify([
        { agent: 'Ada', score: 90, reason: 'clear' },
        { agent: 'Bea', score: 40, reason: 'thin' },
      ]) };
    }
    return { content: 'A short argument.' };
  },
};

describe('negotiation escalation gate', () => {
  afterEach(() => {
    delete process.env.AGORA_DECIDER;
    vi.unstubAllGlobals();
  });

  it('keeps the score margin when Jev is not selected', async () => {
    const result = await runNegotiation('retention', [
      { agent: 'Ada', stance: '7 days' },
      { agent: 'Bea', stance: '30 days' },
    ], provider, { maxRounds: 2 });
    expect(result.outcome).toBe('consensus');
    expect(result.winner).toBe('Ada');
  });

  it('escalates when Jev says the boss must decide, even if the scores look decisive', async () => {
    process.env.AGORA_DECIDER = 'jev';
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      model: 'jev-1.13.0',
      answers: {
        boss_decision: {
          type: 'choice',
          choice: 'escalate',
          probabilities: { escalate: 0.91, consensus: 0.09 },
          confidence: 0.88,
        },
      },
      usage: { input_tokens: 12, output_tokens: 4 },
    }), { status: 200 })));

    const result = await runNegotiation('retention', [
      { agent: 'Ada', stance: '7 days' },
      { agent: 'Bea', stance: '30 days' },
    ], provider, { maxRounds: 2 });
    expect(result.outcome).toBe('escalate');
    expect(result.rounds).toBe(1);
  });

  it('falls back to the score margin when Jev returns an error', async () => {
    process.env.AGORA_DECIDER = 'jev';
    vi.stubGlobal('fetch', vi.fn(async () => new Response('no', { status: 401 })));
    const result = await runNegotiation('retention', [
      { agent: 'Ada', stance: '7 days' },
      { agent: 'Bea', stance: '30 days' },
    ], provider, { maxRounds: 2 });
    expect(result.outcome).toBe('consensus');
    expect(result.winner).toBe('Ada');
  });
});
