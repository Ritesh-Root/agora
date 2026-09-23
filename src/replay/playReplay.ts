import { networkClient } from '../network/NetworkClient';
import { parseReplay, type ReplayEvent } from './parseReplay';

export const REPLAYS = ['launch-note', 'chat-retention', 'task-statuses'] as const;

interface Playback {
  setSpeed(speed: number): void;
  stop(): void;
}

let playback: Playback | null = null;
let speed = 1;
const listeners = new Set<() => void>();

export function replaySpeed(): number {
  return speed;
}

export function replayActive(): boolean {
  return playback !== null;
}

export function onReplayChange(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notify() {
  for (const listener of listeners) listener();
}

export function setReplaySpeed(next: number): void {
  speed = next;
  playback?.setSpeed(next);
  notify();
}

function playEvents(events: ReplayEvent[]): void {
  playback?.stop();
  let index = 0;
  let stopped = false;
  let rate = speed;
  let replayNow = 0;
  let wall = performance.now();
  let timer = 0;

  const current = () => replayNow + (performance.now() - wall) * rate;

  const arm = () => {
    window.clearTimeout(timer);
    if (stopped) return;
    const now = current();
    while (index < events.length && events[index].t <= now + 1) {
      networkClient.ingest(events[index].message);
      index += 1;
    }
    if (index >= events.length) {
      playback = null;
      notify();
      return;
    }
    timer = window.setTimeout(arm, Math.max(0, (events[index].t - now) / rate));
  };

  playback = {
    setSpeed(next) {
      replayNow = current();
      wall = performance.now();
      rate = next;
      arm();
    },
    stop() {
      stopped = true;
      window.clearTimeout(timer);
    },
  };
  notify();
  arm();
}

export async function startReplay(name: string): Promise<void> {
  const response = await fetch(`/replays/${encodeURIComponent(name)}.jsonl`);
  if (!response.ok) throw new Error(`Replay ${name} is missing`);
  playEvents(parseReplay(await response.text()));
}

export function stopReplay(): void {
  playback?.stop();
  playback = null;
  notify();
}
