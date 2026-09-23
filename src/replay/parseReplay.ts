import type { ServerMessage } from '../../shared/protocol';

export interface ReplayEvent {
  t: number;
  message: ServerMessage;
}

/** Parse a timestamped JSONL recording of server messages. Times are milliseconds from the start. */
export function parseReplay(text: string): ReplayEvent[] {
  const events: ReplayEvent[] = [];
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    let row: { t?: unknown; message?: { type?: unknown } };
    try {
      row = JSON.parse(line);
    } catch {
      throw new Error(`Replay line ${i + 1} is not JSON`);
    }
    if (typeof row.t !== 'number' || !Number.isFinite(row.t) || row.t < 0) {
      throw new Error(`Replay line ${i + 1} needs a timestamp`);
    }
    if (!row.message || typeof row.message.type !== 'string') {
      throw new Error(`Replay line ${i + 1} needs a message`);
    }
    events.push({ t: row.t, message: row.message as ServerMessage });
  }
  events.sort((a, b) => a.t - b.t);
  return events;
}
