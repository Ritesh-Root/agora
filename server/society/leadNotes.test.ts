import { describe, expect, it } from 'vitest';
import { leadNotesFromConflict } from './leadNotes';
import type { LLMLike, TaskResult } from './Orchestrator';

describe('leadNotesFromConflict', () => {
  it('uses the selected model for the debate', async () => {
    const models: Array<string | undefined> = [];
    const provider: LLMLike = {
      async generateCompletion(_messages, _tools, _system, modelName) {
        models.push(modelName);
        return { content: '[{"agent":"A","score":90,"reason":"clear"},{"agent":"B","score":40,"reason":"thin"}]' };
      },
    };
    const tasks: TaskResult[] = [
      { id: '1', title: 'A', role: 'A', status: 'done', output: 'one', attempts: 1, healed: false },
      { id: '2', title: 'B', role: 'B', status: 'done', output: 'two', attempts: 1, healed: false },
    ];

    await leadNotesFromConflict('Agree the film before shooting', tasks, provider, undefined, 'deepseek-v4.1-flash');

    expect(models.length).toBeGreaterThan(0);
    expect(models.every((model) => model === 'deepseek-v4.1-flash')).toBe(true);
  });
});
