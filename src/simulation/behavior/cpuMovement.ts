/** Same step the old GPU compute pass used. Speed is units per frame, not per second. */
export const DEFAULT_STEP = 0.015 * 3;
const ARRIVE = 0.2;

export function stepAgentMovement(
  positions: Float32Array,
  velocities: Float32Array,
  state: Float32Array,
  count: number,
  speed = DEFAULT_STEP,
): void {
  for (let i = 0; i < count; i++) {
    const p = i * 4;
    const s = i * 8;
    const mode = state[s + 3];
    const isGoto = mode > 0.5 && mode < 1.5;
    if (!isGoto) {
      velocities[p] = 0;
      velocities[p + 1] = 0;
      velocities[p + 2] = 0;
      velocities[p + 3] = 0;
      positions[p + 3] = 1;
      continue;
    }

    const dx = state[s] - positions[p];
    const dy = -positions[p + 1];
    const dz = state[s + 2] - positions[p + 2];
    const dist = Math.hypot(dx, dy, dz);
    if (dist > ARRIVE) {
      const vx = (dx / dist) * speed;
      const vy = (dy / dist) * speed;
      const vz = (dz / dist) * speed;
      velocities[p] = vx;
      velocities[p + 1] = vy;
      velocities[p + 2] = vz;
      velocities[p + 3] = 0;
      positions[p] += vx;
      positions[p + 1] += vy;
      positions[p + 2] += vz;
      positions[p + 3] = 1;
    } else {
      positions[p] = state[s];
      positions[p + 2] = state[s + 2];
      positions[p + 3] = 1;
    }
  }
}
