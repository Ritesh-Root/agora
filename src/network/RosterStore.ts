import { create } from 'zustand';
import { PlayerInfo } from '../../shared/protocol';

export type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'disconnected' | 'failed' | 'room-full' | 'cabins-not-ready' | 'left' | 'session-ended';

interface RosterState {
  status: ConnectionStatus;
  self: PlayerInfo | null;
  roster: PlayerInfo[];
  setStatus: (status: ConnectionStatus) => void;
  setSelf: (self: PlayerInfo) => void;
  setRoster: (roster: PlayerInfo[]) => void;
  reset: () => void;
}

/**
 * Per-connection network identity (my slot, roster, connection status).
 * Deliberately NOT wrapped in persist() — unlike teamStore/coreStore, this must
 * never leak across browser tabs sharing localStorage on the same origin.
 */
export const useRosterStore = create<RosterState>()((set) => ({
  status: 'idle',
  self: null,
  roster: [],
  setStatus: (status) => set({ status }),
  setSelf: (self) => set({ self }),
  setRoster: (roster) => set({ roster }),
  reset: () => set({ status: 'idle', self: null, roster: [] }),
}));
