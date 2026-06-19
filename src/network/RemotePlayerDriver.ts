import * as THREE from 'three/webgpu';
import { AgentBehavior, CharacterStateKey, IAgentDriver } from '../types';
import { CharacterController } from '../simulation/CharacterController';

/**
 * RemotePlayerDriver — renders a human player controlled by another connected
 * browser tab. Purely passive: applies the latest network snapshot whenever
 * one arrives, never paths or decides locally (the sender already computed
 * its own movement).
 */
export class RemotePlayerDriver implements IAgentDriver {
  public readonly agentIndex: number;

  constructor(agentIndex: number, private readonly controller: CharacterController) {
    this.agentIndex = agentIndex;
    this.controller.setPhysicsMode(agentIndex, AgentBehavior.IDLE);
  }

  /** Apply a state snapshot received from the network. */
  public applyState(
    pos: [number, number, number],
    facing: [number, number],
    animState: string,
    speaking: boolean,
  ): void {
    this.controller.characterManager.setPositionAndZeroVelocity(
      this.agentIndex,
      new THREE.Vector3(pos[0], pos[1], pos[2]),
    );
    if (facing[0] !== 0 || facing[1] !== 0) {
      this.controller.characterManager.setFacing(this.agentIndex, facing[0], facing[1]);
    }
    this.controller.play(this.agentIndex, animState as CharacterStateKey);
    this.controller.setSpeaking(this.agentIndex, speaking);
  }

  // ── IAgentDriver — this slot is network-driven, not locally simulated ──

  public update(_positions: Float32Array, _delta: number): void {}
  public dispose(): void {}
}
