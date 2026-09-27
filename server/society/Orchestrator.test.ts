import { describe, it, expect } from 'vitest';
import { runSociety, parsePlan, type LLMLike } from './Orchestrator';

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Mock provider exercising the full lifecycle:
 *  - Manager returns a 4-task plan.
 *  - Two tasks succeed first try.
 *  - One task (WRITE_TASK) fails once then succeeds on retry → self-heal.
 *  - One task (ALWAYS_FAIL) never succeeds → escalation.
 * A small delay makes worker overlap real so maxConcurrency is meaningful.
 */
function makeMockProvider(): LLMLike {
  return {
    async generateCompletion(messages, _tools, systemInstruction) {
      await delay(5);

      if (systemInstruction?.includes('Manager')) {
        return {
          content: JSON.stringify([
            { id: 't1', title: 'Research', role: 'researcher', prompt: 'gather sources' },
            { id: 't2', title: 'Design', role: 'designer', prompt: 'sketch the layout' },
            { id: 't3', title: 'Write', role: 'writer', prompt: 'WRITE_TASK draft the copy' },
            { id: 't4', title: 'Review', role: 'reviewer', prompt: 'ALWAYS_FAIL audit everything' },
          ]),
        };
      }

      const user = messages[messages.length - 1]?.content ?? '';
      const isRetry = user.includes('previous attempt was rejected');

      if (user.includes('ALWAYS_FAIL')) {
        return { content: 'ERROR: unrecoverable' };
      }
      if (user.includes('WRITE_TASK')) {
        return { content: isRetry ? 'Corrected draft copy.' : 'ERROR: malformed output' };
      }
      return { content: `Completed deliverable for: ${user.slice(0, 24)}` };
    },
  };
}

describe('Society Orchestrator', () => {
  it('decomposes a brief into >=3 tasks and runs workers in parallel', async () => {
    const result = await runSociety('Build a landing page', makeMockProvider());

    expect(result.metrics.taskCount).toBeGreaterThanOrEqual(3);
    // 4 workers overlap behind a 5ms provider delay → peak concurrency proves parallelism.
    expect(result.metrics.maxConcurrency).toBeGreaterThanOrEqual(3);
  });

  it('self-heals an invalid worker output with exactly one retry', async () => {
    const result = await runSociety('Build a landing page', makeMockProvider());
    const writeTask = result.tasks.find((t) => t.id === 't3');

    expect(writeTask).toBeDefined();
    expect(writeTask?.status).toBe('done');
    expect(writeTask?.healed).toBe(true);
    expect(writeTask?.attempts).toBe(2);
    expect(result.metrics.healed).toBe(1);
  });

  it('escalates a worker that stays invalid after its retry', async () => {
    const result = await runSociety('Build a landing page', makeMockProvider());
    const reviewTask = result.tasks.find((t) => t.id === 't4');

    expect(reviewTask?.status).toBe('escalated');
    expect(reviewTask?.attempts).toBe(2);
    expect(reviewTask?.healed).toBe(false);
    expect(result.metrics.escalated).toBe(1);
  });
});

  it('runs the selected team on each agent model', async () => {
    const calls: { model?: string; system?: string }[] = [];
    const provider: LLMLike = {
      async generateCompletion(_messages, _tools, systemInstruction, modelName) {
        calls.push({ model: modelName, system: systemInstruction });
        if (systemInstruction?.includes('You lead this team')) {
          return {
            content: JSON.stringify([
              { id: 'a', title: 'Frame', role: 'Film Director', prompt: 'frame the spot' },
              { id: 'b', title: 'Shoot', role: 'Cinematographer', prompt: 'choose the lens' },
            ]),
          };
        }
        return { content: 'A finished piece of the brief.' };
      },
    };

    await runSociety('Agree the film before shooting', provider, {
      team: [
        { name: 'Film Director', description: 'Directs the spot', model: 'model-lead' },
        { name: 'Cinematographer', description: 'Chooses the lens', model: 'model-camera' },
      ],
    });

    expect(calls[0]?.model).toBe('model-lead');
    expect(calls[0]?.system).toContain('Film Director');
    expect(calls.some((call) => call.system?.includes('You are the Manager'))).toBe(false);
    expect(calls.some((call) => call.system?.includes('You are the Lead'))).toBe(false);
    expect(calls.some((call) => call.model === 'model-camera' && call.system?.includes('Cinematographer'))).toBe(true);
  });

describe('parsePlan', () => {
  it('parses a fenced JSON code block', () => {
    const tasks = parsePlan('```json\n[{"id":"a","title":"A","role":"worker","prompt":"do a"}]\n```');
    expect(tasks).toHaveLength(1);
    expect(tasks[0].id).toBe('a');
  });

  it('extracts a JSON array embedded in prose', () => {
    const tasks = parsePlan('Sure! Here is the plan: [{"title":"X","role":"r","prompt":"p"}] Done.');
    expect(tasks).toHaveLength(1);
    expect(tasks[0].id).toBe('t1'); // id backfilled when missing
    expect(tasks[0].title).toBe('X');
  });

  it('throws on an empty plan', () => {
    expect(() => parsePlan('')).toThrow();
  });
});

describe('dependency waves', () => {
  it('gives a later task the output of the task it depends on', async () => {
    const provider: LLMLike = {
      async generateCompletion(messages, _tools, systemInstruction) {
        if (systemInstruction?.includes('Manager')) {
          return {
            content: JSON.stringify([
              { id: 'a', title: 'A', role: 'researcher', prompt: 'FIRST_TASK' },
              { id: 'b', title: 'B', role: 'writer', prompt: 'SECOND_TASK', deps: ['a'] },
            ]),
          };
        }
        const user = messages[messages.length - 1]?.content ?? '';
        if (user.includes('SECOND_TASK')) {
          return { content: user.includes('output-of-a') ? 'b-done' : 'ERROR: missing dep' };
        }
        return { content: 'output-of-a' };
      },
    };

    const result = await runSociety('A short brief', provider);
    expect(result.tasks.find((task) => task.id === 'b')?.status).toBe('done');
    expect(result.tasks.find((task) => task.id === 'b')?.output).toBe('b-done');
  });
});

describe('Jev worker judgment', () => {
  it('accepts on the first try when the judge accepts an output the legacy check would reject', async () => {
    const provider = makeMockProvider();
    const result = await runSociety('Build a landing page', provider, {
      judgeOutput: async (_task, output) => output.startsWith('ERROR') ? 'accept' : 'accept',
    });
    const writeTask = result.tasks.find((task) => task.id === 't3');
    expect(writeTask?.status).toBe('done');
    expect(writeTask?.attempts).toBe(1);
    expect(writeTask?.output.startsWith('ERROR')).toBe(true);
  });

  it('escalates immediately when the judge asks the boss', async () => {
    const result = await runSociety('Build a landing page', makeMockProvider(), {
      judgeOutput: async () => 'escalate',
    });
    expect(result.tasks.every((task) => task.status === 'escalated' && task.attempts === 1)).toBe(true);
    expect(result.metrics.phases.workersMs).toBeGreaterThanOrEqual(0);
  });
});
