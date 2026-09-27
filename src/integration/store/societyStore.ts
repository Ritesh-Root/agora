import { create } from 'zustand';

export interface SocietyTask {
  id: string;
  title: string;
  role: string;
  status: 'pending' | 'running' | 'done' | 'healing' | 'escalated';
  output?: string;
  attempt?: number;
  researching?: boolean;
}

export interface NegotiationRound {
  round: number;
  agent: string;
  argument: string;
}

export interface NegotiationScore {
  agent: string;
  score: number;
  reason: string;
}

export interface SocietyNegotiation {
  topic: string;
  transcript: NegotiationRound[];
  scores: NegotiationScore[];
  outcome?: 'consensus' | 'escalate';
  winner?: string;
  synthesis?: string;
}

import { SocietyResultWire } from '../../../shared/protocol';

export interface BenchmarkResult {
  society: SocietyResultWire;
  single: {
    output: string;
    wallMs: number;
    model: string;
  };
  qualityScores: {
    society: number;
    single: number;
  } | null;
}

interface SocietyState {
  // Society run state
  isRunning: boolean;
  stage: 'planning' | 'working' | 'debating' | 'assembling' | null;
  brief: string;
  tasks: SocietyTask[];
  negotiation: SocietyNegotiation | null;
  result: any | null;
  error: string | null;
  
  // Benchmark
  isBenchmarking: boolean;
  benchmarkResult: BenchmarkResult | null;
  
  // Actions
  startSociety: (brief: string) => void;
  setStage: (stage: SocietyState['stage']) => void;
  updateTask: (taskId: string, update: Partial<SocietyTask>) => void;
  addNegotiationTurn: (topic: string, turn: NegotiationRound) => void;
  setNegotiationScores: (topic: string, scores: NegotiationScore[]) => void;
  setSocietyComplete: (result: any) => void;
  setSocietyError: (error: string) => void;
  resetSociety: () => void;
  
  startBenchmark: (brief: string) => void;
  setBenchmarkResult: (result: BenchmarkResult) => void;
  resetBenchmark: () => void;
  
  // Panel visibility
  isSocietyPanelOpen: boolean;
  isBenchmarkPanelOpen: boolean;
  setSocietyPanelOpen: (open: boolean) => void;
  setBenchmarkPanelOpen: (open: boolean) => void;
}

export const useSocietyStore = create<SocietyState>((set) => ({
  isRunning: false,
  stage: null,
  brief: '',
  tasks: [],
  negotiation: null,
  result: null,
  error: null,
  isBenchmarking: false,
  benchmarkResult: null,
  isSocietyPanelOpen: false,
  isBenchmarkPanelOpen: false,

  startSociety: (brief) => set({
    isRunning: true,
    brief,
    tasks: [],
    negotiation: null,
    result: null,
    error: null,
    stage: 'planning',
    isSocietyPanelOpen: true,
  }),

  setStage: (stage) => set({ stage }),

  updateTask: (taskId, update) => set((state) => {
    const exists = state.tasks.some((t) => t.id === taskId);
    let nextTasks = [...state.tasks];
    
    if (exists) {
      nextTasks = nextTasks.map((t) => 
        t.id === taskId ? { ...t, ...update } : t
      );
    } else {
      nextTasks.push({
        id: taskId,
        title: update.title || 'Untitled Task',
        role: update.role || 'worker',
        status: update.status || 'pending',
        output: update.output,
        attempt: update.attempt || 1,
        researching: update.researching,
      });
    }

    const stage = state.stage === 'debating' || state.stage === 'assembling' ? state.stage : 'working';
    return { tasks: nextTasks, stage };
  }),

  addNegotiationTurn: (topic, turn) => set((state) => {
    const currentNeg = state.negotiation || { topic, transcript: [], scores: [] };
    
    // Check if turn already exists in transcript
    const turnExists = currentNeg.transcript.some(
      (t) => t.round === turn.round && t.agent === turn.agent && t.argument === turn.argument
    );

    if (turnExists) return {};

    return {
      negotiation: {
        ...currentNeg,
        transcript: [...currentNeg.transcript, turn],
      }
    };
  }),

  setNegotiationScores: (topic, scores) => set((state) => {
    const currentNeg = state.negotiation || { topic, transcript: [], scores: [] };
    return {
      negotiation: {
        ...currentNeg,
        scores,
      }
    };
  }),

  setSocietyComplete: (result) => set((state) => {
    let nextNeg = state.negotiation;
    if (result.negotiation) {
      nextNeg = {
        topic: result.negotiation.topic,
        transcript: result.negotiation.transcript,
        scores: result.negotiation.scores,
        outcome: result.negotiation.outcome,
        winner: result.negotiation.winner,
        synthesis: result.negotiation.synthesis,
      };
    }

    // Map tasks
    const nextTasks = result.tasks.map((t: any) => ({
      id: t.id,
      title: t.title,
      role: t.role,
      status: t.status === 'done' ? 'done' : 'escalated',
      output: t.output,
      attempt: t.attempts,
    }));

    return {
      isRunning: false,
      stage: null,
      result,
      tasks: nextTasks,
      negotiation: nextNeg,
      isSocietyPanelOpen: true,
    };
  }),

  setSocietyError: (error) => set((state) => ({
    isRunning: false,
    stage: null,
    isBenchmarking: false,
    error,
    isSocietyPanelOpen: !state.isBenchmarking,
    isBenchmarkPanelOpen: state.isBenchmarking,
  })),

  resetSociety: () => set({
    isRunning: false,
    stage: null,
    brief: '',
    tasks: [],
    negotiation: null,
    result: null,
    error: null,
    isSocietyPanelOpen: false,
  }),

  startBenchmark: (brief) => set({
    isBenchmarking: true,
    brief,
    benchmarkResult: null,
    error: null,
    isBenchmarkPanelOpen: false,
  }),

  setBenchmarkResult: (benchmarkResult) => set({
    isBenchmarking: false,
    benchmarkResult,
    isBenchmarkPanelOpen: true,
  }),

  resetBenchmark: () => set({
    isBenchmarking: false,
    benchmarkResult: null,
    error: null,
    isBenchmarkPanelOpen: false,
  }),

  setSocietyPanelOpen: (isSocietyPanelOpen) => set({ isSocietyPanelOpen }),
  setBenchmarkPanelOpen: (isBenchmarkPanelOpen) => set({ isBenchmarkPanelOpen }),
}));
