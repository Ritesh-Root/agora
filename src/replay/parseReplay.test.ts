import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseReplay } from './parseReplay';

const shipped = ['launch-note', 'chat-retention', 'task-statuses'];

describe('parseReplay', () => {
  it('parses each shipped recording into ordered server messages', () => {
    for (const name of shipped) {
      const text = readFileSync(new URL(`../../public/replays/${name}.jsonl`, import.meta.url), 'utf8');
      const events = parseReplay(text);
      expect(events.length).toBeGreaterThan(5);
      expect(events.map((event) => event.t)).toEqual([...events.map((event) => event.t)].sort((a, b) => a - b));
      expect(events.some((event) => event.message.type === 'society-started')).toBe(true);
      expect(events.some((event) => event.message.type === 'society-negotiation')).toBe(true);
      expect(events.some((event) => event.message.type === 'society-complete')).toBe(true);
      expect(events.some((event) => event.message.type === 'npc-state')).toBe(true);
    }
  });

  it('skips blank lines and rejects a line without a timestamp', () => {
    const events = parseReplay('\n{"t":10,"message":{"type":"society-error","error":"x"}}\n\n');
    expect(events).toHaveLength(1);
    expect(() => parseReplay('{"message":{"type":"society-error","error":"x"}}')).toThrow(/timestamp/);
  });
});
