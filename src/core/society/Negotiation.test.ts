import { describe, it, expect } from 'vitest';
import { runNegotiation, parseScores, type NegotiationLLM, type RefereeScore, type Position } from './Negotiation';

const POSITIONS: Position[] = [
  { agent: 'Alice', stance: 'Use approach A' },
  { agent: 'Bob', stance: 'Use approach B' },
];

/** Mock Referee that returns scripted scores per scoring round, plus canned debater/synthesis text. */
function makeMock(roundScores: RefereeScore[][]): NegotiationLLM {
  let scoreCall = 0;
  return {
    async generateCompletion(messages, _tools, systemInstruction) {
      if (systemInstruction?.includes('Score each debater')) {
        const scores = roundScores[Math.min(scoreCall, roundScores.length - 1)];
        scoreCall += 1;
        return { content: JSON.stringify(scores.map((s) => ({ agent: s.agent, score: s.score, reason: s.reason }))) };
      }
      if (systemInstruction?.includes('State the resolution')) {
        return { content: 'Adopt the winning approach; merge the strongest supporting points.' };
      }
      if (systemInstruction?.includes('No consensus was reached')) {
        return { content: 'Deadlock — the human must choose between approach A and approach B.' };
      }
      const user = messages[messages.length - 1]?.content ?? '';
      return { content: `argument re: ${user.slice(0, 18)}` };
    },
  };
}

const s = (agent: string, score: number): RefereeScore => ({ agent, score, reason: `${score}` });

describe('runNegotiation', () => {
  it('reaches consensus when a debater wins decisively in round 1', async () => {
    const mock = makeMock([[s('Alice', 85), s('Bob', 60)]]);
    const r = await runNegotiation('Which approach?', POSITIONS, mock, { maxRounds: 2 });
    expect(r.outcome).toBe('consensus');
    expect(r.winner).toBe('Alice');
    expect(r.rounds).toBe(1);
    expect(r.scores[0].agent).toBe('Alice'); // sorted high→low
    expect(r.synthesis.length).toBeGreaterThan(0);
    expect(r.transcript.filter((t) => t.round === 1)).toHaveLength(2); // both debaters argued
  });

  it('keeps debating then resolves in a later round', async () => {
    const mock = makeMock([
      [s('Alice', 65), s('Bob', 64)], // round 1: too close (below threshold) → continue
      [s('Alice', 88), s('Bob', 60)], // round 2: decisive
    ]);
    const r = await runNegotiation('Which approach?', POSITIONS, mock, { maxRounds: 3 });
    expect(r.outcome).toBe('consensus');
    expect(r.winner).toBe('Alice');
    expect(r.rounds).toBe(2);
  });

  it('escalates to a human when no consensus after max rounds', async () => {
    const mock = makeMock([
      [s('Alice', 72), s('Bob', 70)], // gap 2 < winMargin 10
      [s('Alice', 71), s('Bob', 70)],
    ]);
    const r = await runNegotiation('Which approach?', POSITIONS, mock, { maxRounds: 2 });
    expect(r.outcome).toBe('escalate');
    expect(r.winner).toBeUndefined();
    expect(r.rounds).toBe(2);
    expect(r.synthesis).toMatch(/deadlock|human/i);
  });
});

describe('parseScores', () => {
  it('parses a fenced JSON array', () => {
    const out = parseScores('```json\n[{"agent":"Alice","score":80,"reason":"x"}]\n```', ['Alice', 'Bob']);
    expect(out.find((x) => x.agent === 'Alice')?.score).toBe(80);
    expect(out.find((x) => x.agent === 'Bob')?.score).toBe(0); // missing → defaulted
  });

  it('clamps out-of-range scores and tolerates prose', () => {
    const out = parseScores('Scores: [{"agent":"Alice","score":140},{"agent":"Bob","score":-5}] done', ['Alice', 'Bob']);
    expect(out.find((x) => x.agent === 'Alice')?.score).toBe(100);
    expect(out.find((x) => x.agent === 'Bob')?.score).toBe(0);
  });
});
