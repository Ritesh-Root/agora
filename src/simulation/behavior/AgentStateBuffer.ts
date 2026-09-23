import * as THREE from 'three/webgpu';
import { MAX_PLAYERS } from '../../data/agents';
import { AgentBehavior } from '../../types';

/**
 * CPU/GPU buffer that stores per-instance physics mode and animation state.
 *
 * Each instance maps to two vec4s (8 floats total) per instance.
 *
 * Buffer 0 (vec4):
 *   .x = waypoint X  (used when mode == GOTO)
 *   .y = animation   (animation index to play)
 *   .z = waypoint Z  (used when mode == GOTO)
 *   .w = mode        (0 = IDLE, 1 = GOTO, 2 = SEATED)
 *
 * Buffer 1 (vec4):
 *   .x = startTime   (global time when animation started)
 *   .y = loopMode    (1.0 = loop, 0.0 = clamp)
 *   .z = alpha       (1.0 = opaque, <1.0 = transparent)
 *   .w = (unused)
 *
 * CPU writes metadata. The vertex shader reads two instanced vec4s.
 */
export class AgentStateBuffer {
  /** Raw Float32Array (8 floats per instance). */
  public readonly array: Float32Array;

  /** Waypoint, animation index, and mode. */
  public readonly state0: THREE.InterleavedBufferAttribute;

  /** Start time, loop flag, and alpha. */
  public readonly state1: THREE.InterleavedBufferAttribute;

  private readonly interleaved: THREE.InstancedInterleavedBuffer;

  constructor(private readonly count: number) {
    this.array = new Float32Array(count * 8);
    for (let i = 0; i < count; i++) {
      this.array[i * 8 + 6] = 1.0;
    }
    this.interleaved = new THREE.InstancedInterleavedBuffer(this.array, 8);
    this.state0 = new THREE.InterleavedBufferAttribute(this.interleaved, 4, 0);
    this.state1 = new THREE.InterleavedBufferAttribute(this.interleaved, 4, 4);
  }

  private touch(): void {
    this.interleaved.needsUpdate = true;
  }

  // ── Mode/State ───────────────────────────────────────────────

  public getState(index: number): number {
    return this.array[index * 8 + 3];
  }

  public setState(index: number, state: number): void {
    this.array[index * 8 + 3] = state;
    this.touch();
  }

  // ── Animation ────────────────────────────────────────────────

  public getAnimation(index: number): number {
    return this.array[index * 8 + 1];
  }

  public setAnimation(index: number, animIndex: number, loop: boolean = true, startTime: number = 0): void {
    this.array[index * 8 + 1] = animIndex;
    this.array[index * 8 + 4] = startTime;
    this.array[index * 8 + 5] = loop ? 1.0 : 0.0;
    this.touch();
  }

  // ── Transparency ─────────────────────────────────────────────

  public setAlpha(index: number, alpha: number): void {
    this.array[index * 8 + 6] = alpha;
    this.touch();
  }

  public getAlpha(index: number): number {
    return this.array[index * 8 + 6];
  }

  // ── Waypoint / Orientation ──────────────────────────────────

  public setWaypoint(index: number, x: number, z: number): void {
    this.array[index * 8 + 0] = x;
    this.array[index * 8 + 2] = z;
    this.touch();
  }

  /** Used when mode is IDLE to force a specific facing direction. */
  public setFacing(index: number, x: number, z: number): void {
    this.array[index * 8 + 0] = x;
    this.array[index * 8 + 2] = z;
    this.touch();
  }

  public getWaypoint(index: number): { x: number; z: number } {
    return {
      x: this.array[index * 8 + 0],
      z: this.array[index * 8 + 2],
    };
  }

  // ── Bulk helpers ─────────────────────────────────────────────

  /** Set all NPC states (skips human render-slots 0..MAX_PLAYERS-1). */
  public resetAllNPCsToState(state: AgentBehavior, startIndex = MAX_PLAYERS): void {
    for (let i = startIndex; i < this.count; i++) {
      this.array[i * 8 + 3] = state;
    }
    this.touch();
  }
}
