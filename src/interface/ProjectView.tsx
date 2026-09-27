import { Info, RefreshCcw, ScrollText, FileText, Image, Music, Video } from 'lucide-react';
import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';

import { getAgentSet, getAllAgents } from '../data/agents';
import { modelPriceKnown } from '../core/llm/pricing';
import { useCoreStore } from '../integration/store/coreStore';
import { useTeamStore, useActiveTeam } from '../integration/store/teamStore';
import { useUiStore } from '../integration/store/uiStore';
import { useSceneManager } from '../simulation/SceneContext';
import { USER_COLOR } from '../theme/brand';
import ResetModal from './ResetModal';
import PricingModal from './PricingModal';

export function formatTokens(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
  }
  return num.toString();
}

const ProjectView: React.FC = () => {
  const {
    userBrief,
    finalOutput,
    referenceImages,
    phase,
    actionLog,
    resetProject,
  } = useCoreStore();
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [isPricingModalOpen, setIsPricingModalOpen] = useState(false);
  const activeTeam = useActiveTeam();
  const selectedModel = useUiStore((s) => s.llmConfig.model);
  const estimatedCost = useCoreStore((s) => s.totalEstimatedCost);
  const costLabel = modelPriceKnown(selectedModel)
    ? `Total Est. $${estimatedCost.toFixed(3)}`
    : 'Cost unavailable';
  const scene = useSceneManager();

  const hasLogs = actionLog.length > 0;

  const handleResetConfirm = () => {
    // 1. Reset the 3D scene (teleport agents, clear chat)
    scene?.resetScene();
    // 3. Clear project state
    resetProject();
    setIsResetModalOpen(false);
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto p-6 bg-white/50">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xl font-black text-ink leading-tight">Project Info</h2>
          <div className="flex items-center gap-2">
            <div
              className="px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 transition-colors border border-transparent"
              style={{
                backgroundColor: phase === 'working' ? '#f2cc46' : (phase === 'done' ? '#22c55e' : '#ece7d9'),
                color: phase === 'working' ? '#17150f' : (phase === 'done' ? 'white' : '#98917b'),
                borderColor: phase === 'idle' ? '#ded7c4' : 'transparent'
              }}
              data-testid="project-phase-chip"
            >
              <div className={`w-1.5 h-1.5 rounded-full ${phase === 'working' ? 'bg-ink animate-pulse' : 'bg-white opacity-40'}`} />
              {phase === 'idle' ? 'Ready to Start' : phase}
            </div>
          </div>
        </div>
      </div>

      <div className="h-px bg-zinc-100 w-full mb-6" />

      {/* Reset Project Button */}
      {hasLogs && (
        <div className="mb-8 w-full">
          <button
            onClick={() => setIsResetModalOpen(true)}
            className={`w-full flex items-center justify-center gap-2 px-4 py-4 rounded-2xl transition-all active:scale-[0.98] group ${phase === 'done'
                ? 'bg-ink hover:bg-black text-white shadow-xl shadow-ink/10'
                : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-400 hover:text-zinc-600'
              }`}
          >
            <RefreshCcw size={14} strokeWidth={3} className="transition-transform group-hover:rotate-180 duration-500" />
            <span className="text-[10px] font-black uppercase tracking-widest">Start New Project</span>
          </button>
        </div>
      )}

      {/* Brief */}
      <div className="mb-10">
        <div className="flex items-center gap-2 mb-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">User Brief</p>
          <div className="h-px flex-1 bg-zinc-100" />
        </div>
        {userBrief ? (
          <div className="space-y-4">
            <div className="markdown-content text-xs text-zinc-600 leading-relaxed font-medium bg-white/40 p-4 rounded-xl border border-zinc-100/50 max-h-[300px] overflow-y-auto custom-scrollbar">
              <ReactMarkdown>
                {userBrief}
              </ReactMarkdown>
            </div>

            {(activeTeam.outputType === 'image' || activeTeam.outputType === 'video') && referenceImages.length > 0 && (
              <div className="flex flex-col gap-2">
                <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400">Brief Logic References</p>
                <div className="grid grid-cols-3 gap-2">
                  {referenceImages.map((img, idx) => (
                    <div key={idx} className="aspect-square rounded-xl overflow-hidden border border-zinc-100 shadow-sm bg-zinc-50">
                      <img src={img} alt={`Ref ${idx}`} className="w-full h-full object-cover" />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <p className="text-xs text-zinc-400 italic">No active brief. Talk to the Lead Agent to define your project.</p>
        )}
        {finalOutput && (
          <div className="mt-4 p-4 rounded-xl border border-zinc-100 bg-white/40">
            <p className="text-[10px] text-zinc-500">This document is only in this tab. A reload clears it.</p>
            <button
              type="button"
              onClick={() => {
                const blob = new Blob([finalOutput], { type: 'text/markdown' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = 'agora-document.md';
                link.click();
                URL.revokeObjectURL(url);
              }}
              className="mt-2 px-3 py-1.5 rounded-lg border border-zinc-200 text-[10px] font-black uppercase tracking-widest text-ink"
            >
              Save a copy
            </button>
          </div>
        )}
      </div>

      {/* Token Usage */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 flex-1">
            <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Token Usage</p>
            <div className="h-px flex-1 bg-zinc-100" />
          </div>
          <button
            onClick={() => setIsPricingModalOpen(true)}
            className="flex items-center gap-2 px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 border border-emerald-100 hover:border-emerald-200 rounded-lg transition-all active:scale-95 group ml-4 cursor-pointer"
          >
            <span className="text-[10px] font-black uppercase tracking-tight text-emerald-600">
              {costLabel}
            </span>
            <Info size={11} className="text-emerald-500 group-hover:text-emerald-600" />
          </button>
        </div>

        <div className="bg-ink dot-grid-dark rounded-2xl p-5 mb-6 relative overflow-hidden">
          <div className="flex flex-col gap-1 mb-6">
            <span className="text-4xl font-mono font-black text-white tracking-tighter">
              {formatTokens(useCoreStore.getState().totalTokenUsage.totalTokens)}
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] font-bold font-mono">
            <span className="text-butter">{formatTokens(useCoreStore.getState().totalTokenUsage.promptTokens)} <span className="text-zinc-400 font-medium">input</span></span>
            <span className="text-zinc-500">+</span>
            <span className="text-butter">{formatTokens(useCoreStore.getState().totalTokenUsage.completionTokens)} <span className="text-zinc-400 font-medium">output</span></span>
          </div>
        </div>

        <div className="space-y-1">
          {Object.entries(useCoreStore.getState().agentTokenUsage)
            .sort(([, a], [, b]) => b.totalTokens - a.totalTokens)
            .map(([idx, usage]) => {
              const agentIndex = parseInt(idx);
              const agents = getAllAgents(activeTeam);
              const agent = agentIndex === -1
                ? { name: 'System', color: '#6e6754' }
                : agents.find(a => a.index === agentIndex);

              if (!agent || usage.totalTokens === 0) return null;

              return (
                <div key={idx} className="flex items-center justify-between py-2 px-2 hover:bg-zinc-100/50 rounded-lg transition-colors group">
                  <div className="flex items-center gap-3">
                    <div className="w-1.5 h-1.5 rounded-full shadow-[0_0_8px_rgba(0,0,0,0.1)]" style={{ backgroundColor: agent.color }} />
                    <span className="text-[11px] font-bold text-zinc-600 uppercase tracking-tight group-hover:text-ink transition-colors">
                      {agent.name}
                    </span>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <div className="flex items-center gap-2">
                      {useCoreStore.getState().agentEstimatedCost[agentIndex] > 0 && (
                        <span className="text-[9px] font-mono font-bold text-emerald-600/70">
                          ${useCoreStore.getState().agentEstimatedCost[agentIndex].toFixed(4)}
                        </span>
                      )}
                      <span className="text-[11px] font-mono font-black text-ink">
                        {formatTokens(usage.totalTokens)}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-[9px] font-bold font-mono text-zinc-400">
                      <span>{formatTokens(usage.promptTokens)} <span className="font-medium opacity-60">input</span></span>
                      <span className="text-zinc-200">+</span>
                      <span>{formatTokens(usage.completionTokens)} <span className="font-medium opacity-60">output</span></span>
                    </div>
                  </div>
                </div>
              );
            })}
        </div>
      </div>

      <ResetModal
        isOpen={isResetModalOpen}
        onClose={() => setIsResetModalOpen(false)}
        onConfirm={handleResetConfirm}
      />

      {isPricingModalOpen && (
        <PricingModal onClose={() => setIsPricingModalOpen(false)} />
      )}
    </div>
  );
};

export default ProjectView;
