import { describe, expect, it } from 'vitest';
import { callJev, parseSystemOneBody } from './jevClient';
import { decide } from './index';
import { Question } from './types';

const questions: Record<string, Question> = {
  ok: { type: 'noul', instructions: 'Is this a deliverable?' },
  route: { type: 'choice', instructions: 'Which route?', criteria: { accept: null, retry: null } },
};

const validBody = {
  model: 'jev-1.13.0',
  answers: {
    ok: { type: 'noul', noul: 0.97 },
    route: {
      type: 'choice',
      choice: 'accept',
      probabilities: { accept: 0.9, retry: 0.1 },
      confidence: 0.86,
    },
  },
  usage: { input_tokens: 20, output_tokens: 4 },
};

describe('Jev response parsing', () => {
  it('marks a missing answer uncertain and keeps the other', () => {
    const parsed = parseSystemOneBody({
      model: 'jev-1.13.0',
      answers: { route: validBody.answers.route },
      usage: validBody.usage,
    }, questions);
    expect(parsed.answers.ok).toEqual({ type: 'uncertain' });
    expect(parsed.answers.route).toMatchObject({ type: 'choice', choice: 'accept' });
  });

  it('marks every question uncertain when the JSON is malformed', async () => {
    let calls = 0;
    const result = await callJev('worker output', questions, {
      apiKey: 'test-key',
      fetchImpl: async () => {
        calls += 1;
        return new Response('not json', { status: 200 });
      },
    });
    expect(calls).toBe(1);
    expect(result.answers.ok).toEqual({ type: 'uncertain' });
    expect(result.answers.route).toEqual({ type: 'uncertain' });
    expect(result.returnedModel).toBeNull();
  });

  it('retries a timeout once, then returns uncertain', async () => {
    let calls = 0;
    const result = await callJev('worker output', questions, {
      apiKey: 'test-key',
      timeoutMs: 20,
      fetchImpl: async () => {
        calls += 1;
        throw new DOMException('The operation was aborted', 'AbortError');
      },
    });
    expect(calls).toBe(2);
    expect(result.answers.ok).toEqual({ type: 'uncertain' });
  });

  it('does not retry a 4xx response', async () => {
    let calls = 0;
    await callJev('worker output', questions, {
      apiKey: 'test-key',
      fetchImpl: async () => {
        calls += 1;
        return new Response('unauthorized', { status: 401 });
      },
    });
    expect(calls).toBe(1);
  });

  it('sends every question in one call', async () => {
    let body = '';
    const records = await decide({ output: 'draft' }, questions, {
      apiKey: 'test-key',
      log: () => undefined,
      fetchImpl: async (_url, init) => {
        body = String(init?.body ?? '');
        return new Response(JSON.stringify(validBody), { status: 200 });
      },
    });
    const sent = JSON.parse(body) as { model: string; questions: Record<string, unknown> };
    expect(sent.model).toBe('jev-1.13.0');
    expect(Object.keys(sent.questions).sort()).toEqual(['ok', 'route']);
    expect(records.find((record) => record.question === 'ok')?.policy).toBe('proceed');
    expect(records.find((record) => record.question === 'route')?.probabilities).toEqual({ accept: 0.9, retry: 0.1 });
  });
});
