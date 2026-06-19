/**
 * Wire protocol shared between the client (src/network) and the relay server (server/).
 * Kept dependency-free (no DOM, no Node) so it can be imported by both tsconfigs unmodified.
 */

export const MAX_PLAYERS = 5;

export interface PlayerInfo {
  id: string;
  name: string;
  color: string;
  slotIndex: number;
  cabinPoiId: string | null;
  isHost: boolean;
}

export interface RemoteNpcState {
  aiIndex: number; // logical AI agent index (1..N), translated to render-index on the receiving client
  pos: [number, number, number];
  facing: [number, number]; // xz facing direction, same convention as player-state's `vel`
  animState: string;
  speaking: boolean;
}

export type ClientMessage =
  | { type: 'join'; name: string; color: string }
  | { type: 'player-state'; pos: [number, number, number]; vel: [number, number]; animState: string; speaking: boolean }
  | { type: 'npc-state'; npcs: RemoteNpcState[] }
  | { type: 'leave' }
  | { type: 'register-cabins'; cabinPoiIds: string[] };

export type ServerMessage =
  | { type: 'joined'; me: PlayerInfo; roster: PlayerInfo[] }
  | { type: 'room-full' }
  | { type: 'cabins-not-ready' }
  | { type: 'roster-update'; roster: PlayerInfo[] }
  | { type: 'player-state'; playerId: string; pos: [number, number, number]; vel: [number, number]; animState: string; speaking: boolean }
  | { type: 'npc-state'; npcs: RemoteNpcState[] }
  | { type: 'player-left'; playerId: string };
