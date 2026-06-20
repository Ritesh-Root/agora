import { create } from 'zustand';
import { getAllAgents, MAX_PLAYERS } from '../../data/agents';
import { AgentState, CharacterState } from '../../types';
import { useTeamStore, getActiveAgentSet } from './teamStore';
import { DEFAULT_MODELS, DEFAULT_PROVIDER, PROVIDERS } from '../../core/llm/constants';
import { ProviderId } from '../../core/llm/types';

export const useUiStore = create<CharacterState>()(
  (set) => ({
    isThinking: false,
    instanceCount: MAX_PLAYERS + getAllAgents(getActiveAgentSet()).length,

    selectedNpcIndex: null,
    selectedPosition: null,
    hoveredNpcIndex: null,
    hoveredPoiId: null,
    hoveredPoiLabel: null,
    hoverPosition: null,
    npcScreenPositions: {},
    isChatting: false,
    isTyping: false,
    chatMessages: [],
    inspectorTab: 'info',
    agentStatuses: {},
    setAgentStatus: (index: number, status: AgentState) => set((s) => ({
      agentStatuses: { ...s.agentStatuses, [index]: status }
    })),

    isBYOKOpen: false,
    byokError: null,
    setBYOKOpen: (open: boolean, error: string | null = null) =>
      set({ isBYOKOpen: open, byokError: error }),

    isNegotiationOpen: false,
    setNegotiationOpen: (open: boolean) => set({ isNegotiationOpen: open }),

    activeAuditTaskId: null,
    setActiveAuditTaskId: (taskId: string | null) => set({ activeAuditTaskId: taskId }),

    llmConfig: (() => {
      try {
        const saved = localStorage.getItem('byok-config');
        if (saved) {
          const parsed = JSON.parse(saved);
          const provider: ProviderId = parsed.provider === 'nvidia' ? 'nvidia' : DEFAULT_PROVIDER;
          const known = PROVIDERS[provider].models;
          return {
            provider,
            apiKey: typeof parsed.apiKey === 'string' ? parsed.apiKey.trim() : '',
            model: typeof parsed.model === 'string' && known.includes(parsed.model)
              ? parsed.model
              : PROVIDERS[provider].defaultModel
          };
        }
      } catch { }
      return {
        provider: DEFAULT_PROVIDER,
        apiKey: '',
        model: DEFAULT_MODELS.text
      };
    })(),

    setThinking: (isThinking: boolean) => set({ isThinking }),
    setIsTyping: (isTyping: boolean) => set({ isTyping }),
    setInspectorTab: (tab: 'info' | 'chat') => set({ inspectorTab: tab }),
    setInstanceCount: (count: number) => set({ instanceCount: count }),

    setSelectedNpc: (index: number | null) => set({
      selectedNpcIndex: index,
      selectedPosition: null,
    }),
    setSelectedPosition: (pos: { x: number; y: number } | null) => set({ selectedPosition: pos }),
    setHoveredNpc: (index: number | null, pos: { x: number; y: number } | null) => set({
      hoveredNpcIndex: index,
      hoverPosition: pos,
      hoveredPoiId: null,
      hoveredPoiLabel: null,
    }),
    setHoveredPoi: (id: string | null, label: string | null, pos: { x: number; y: number } | null) => set({
      hoveredPoiId: id,
      hoveredPoiLabel: label,
      hoverPosition: pos,
      hoveredNpcIndex: null,
    }),
    setLlmConfig: (config) => set((s) => ({ llmConfig: { ...s.llmConfig, ...config } })),
    setChatting: (isChatting: boolean) => set((s) => ({ 
      isChatting, 
      isTyping: isChatting ? s.isTyping : false,
      isThinking: isChatting ? s.isThinking : false,
      chatMessages: isChatting ? s.chatMessages : []
    })),
  })
);

// Keep instanceCount in sync whenever the active agent set changes
useTeamStore.subscribe((state, prevState) => {
  if (state.selectedAgentSetId !== prevState.selectedAgentSetId) {
    const system = getActiveAgentSet();
    useUiStore.getState().setInstanceCount(MAX_PLAYERS + getAllAgents(system).length);
  }
});
