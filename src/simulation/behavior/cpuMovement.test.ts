import { describe, expect, it } from 'vitest';
import { DEFAULT_STEP, stepAgentMovement } from './cpuMovement';

function buffers() {
  const positions = new Float32Array(8);
  const velocities = new Float32Array(8);
  const state = new Float32Array(16);
  state[6] = 1;
  state[14] = 1;
  return { positions, velocities, state };
}

describe('cpu agent movement', () => {
  it('walks toward a GOTO waypoint by the same per-frame step', () => {
    const { positions, velocities, state } = buffers();
    positions[0] = 0;
    positions[2] = 0;
    state[0] = 10;
    state[2] = 0;
    state[3] = 1;
    stepAgentMovement(positions, velocities, state, 1);
    expect(positions[0]).toBeCloseTo(DEFAULT_STEP, 5);
    expect(positions[2]).toBeCloseTo(0, 5);
    expect(velocities[0]).toBeCloseTo(DEFAULT_STEP, 5);
  });

  it('snaps onto a nearby waypoint and leaves idle agents still', () => {
    const { positions, velocities, state } = buffers();
    positions[0] = 1;
    positions[2] = 1;
    velocities[0] = 0.2;
    state[0] = 1.05;
    state[2] = 1;
    state[3] = 1;
    state[8] = 4;
    state[10] = 4;
    state[11] = 0;
    positions[4] = 3;
    positions[6] = 3;
    velocities[4] = 1;
    stepAgentMovement(positions, velocities, state, 2);
    expect(positions[0]).toBeCloseTo(1.05, 5);
    expect(positions[2]).toBeCloseTo(1, 5);
    expect(positions[4]).toBe(3);
    expect(velocities[4]).toBe(0);
  });

  it('treats SEATED like idle', () => {
    const { positions, velocities, state } = buffers();
    positions[0] = 2;
    velocities[0] = 0.4;
    state[3] = 2;
    stepAgentMovement(positions, velocities, state, 1);
    expect(positions[0]).toBe(2);
    expect(velocities[0]).toBe(0);
  });
});
