import { create } from 'zustand';
import type { DecisionWire } from '../../shared/protocol';

export interface PendingDecision extends DecisionWire {
  id: string;
}

interface DecisionState {
  decisions: DecisionWire[];
  pending: PendingDecision | null;
  add: (decision: DecisionWire) => void;
  setPending: (pending: PendingDecision | null) => void;
  reset: () => void;
}

export const useDecisionStore = create<DecisionState>((set) => ({
  decisions: [],
  pending: null,
  add: (decision) => set((state) => ({ decisions: [...state.decisions, decision] })),
  setPending: (pending) => set({ pending }),
  reset: () => set({ decisions: [], pending: null }),
}));
