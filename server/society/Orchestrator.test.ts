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
