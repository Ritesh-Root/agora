import { Info, KeyRound, Maximize2, Settings, Users, Scale, Play, BarChart2, X, Brain } from 'lucide-react';
import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import packageJson from '../../package.json';
import { useCoreStore } from '../integration/store/coreStore';
import { useUiStore } from '../integration/store/uiStore';
import { useRosterStore } from '../network/RosterStore';
import { useSocietyStore } from '../integration/store/societyStore';
import { MAX_PLAYERS } from '../../shared/protocol';
import { networkClient } from '../network/NetworkClient';
import BYOKModal from './BYOKModal';
import InfoModal from './InfoModal';
import { NegotiationArena } from './NegotiationArena';

const version = packageJson.version;

const Header: React.FC = () => {
  const { llmConfig, isBYOKOpen, setBYOKOpen, isNegotiationOpen, setNegotiationOpen } = useUiStore();
  const { setViewMode } = useCoreStore();
  const roster = useRosterStore((s) => s.roster);
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  const hasKey = !!llmConfig.apiKey;

  // New Brief Input Modal State
  const [briefModalOpen, setBriefModalOpen] = useState(false);
  const [briefType, setBriefType] = useState<'society' | 'benchmark'>('society');
  const [briefInput, setBriefInput] = useState('');

  const handleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  };

  const handleRunAction = () => {
    if (!briefInput.trim()) return;
    
    if (briefType === 'society') {
      networkClient.send({ type: 'run-society', brief: briefInput.trim() });
    } else {
      // open the panel locally — the relay only sends the final benchmark-result
      useSocietyStore.getState().startBenchmark(briefInput.trim());
      networkClient.send({ type: 'run-benchmark', brief: briefInput.trim() });
    }
    
    setBriefInput('');
    setBriefModalOpen(false);
  };

  return (
    <header className="h-14 border-b border-zinc-100 flex items-center justify-between px-6 bg-white shrink-0 relative z-40">
      {/* Left: Project Title */}
      <div className="flex items-center min-w-0">
        <span className="text-lg font-black tracking-tight text-ink shrink-0">AGORA</span>

        <div className="flex items-center gap-3 self-start mt-3 ml-2 min-w-0">
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => setIsInfoOpen(true)}
              className="text-zinc-300 hover:text-zinc-500 transition-colors cursor-pointer"
            >
              <Info size={14} strokeWidth={2} />
            </button>
            <span className="text-[10px] font-medium text-zinc-400 font-mono">v{version}</span>
          </div>

          <div className="flex items-center gap-3 min-w-0">
            <a
              href="https://github.com/Ritesh-Root/agora"
              target="_blank"
              rel="noopener"
              className="text-zinc-300 hover:text-ink transition-colors shrink-0"
              title="View on GitHub"
            >
              <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"></path></svg>
            </a>
          </div>
        </div>
      </div>

      {/* Right: Global Controls */}
      <div className="flex items-center gap-3">
        {/* Run Society Button */}
        <button
          onClick={() => { setBriefType('society'); setBriefModalOpen(true); }}
          className="flex items-center gap-2 px-3 py-1 bg-ink hover:bg-black text-white rounded-lg transition-all shadow-lg shadow-black/10 active:scale-95 cursor-pointer h-9 shrink-0"
          title="Run Agent Society"
        >
          <Play size={12} fill="currentColor" />
          <span className="text-[10px] font-black uppercase tracking-wider ml-1 hidden md:inline">Run Swarm</span>
        </button>

        {/* Swarm Bench Button */}
        <button
          onClick={() => { setBriefType('benchmark'); setBriefModalOpen(true); }}
          className="flex items-center gap-2 px-3 py-1 bg-zinc-800 hover:bg-zinc-900 text-white rounded-lg transition-all shadow-lg shadow-zinc-800/10 active:scale-95 cursor-pointer h-9 shrink-0"
          title="Swarm Benchmark"
        >
          <BarChart2 size={12} />
          <span className="text-[10px] font-black uppercase tracking-wider ml-1 hidden md:inline">Swarm Bench</span>
        </button>

        <button
          onClick={() => setViewMode('design')}
          className="flex items-center gap-2 px-3 py-1 bg-ink hover:bg-zinc-900 text-white rounded-lg transition-all shadow-lg shadow-black/10 active:scale-95 cursor-pointer h-9 shrink-0 ml-1"
          title="Manage Teams"
        >
          <Settings size={14} className="group-hover:rotate-45 transition-transform" />
          <span className="text-[10px] font-black uppercase tracking-wider ml-1 hidden sm:inline">Manage Teams</span>
        </button>

        <div className="w-px h-4 bg-zinc-200" />

        <div className="relative group">
          <button
            className="flex items-center gap-1.5 text-zinc-400 hover:text-ink transition-colors px-2 py-1 cursor-default"
            title="Players connected"
          >
            <Users size={16} />
            <span className="text-[10px] font-black uppercase tracking-wider">{roster.length}/{MAX_PLAYERS}</span>
          </button>

          <div className="absolute top-full right-0 mt-2 w-52 bg-white rounded-2xl shadow-[0_16px_40px_-8px_rgba(0,0,0,0.15)] border border-zinc-100 p-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
            {roster.length === 0 ? (
              <p className="text-[10px] font-medium text-zinc-300 px-2 py-1.5">No players connected yet</p>
            ) : (
              roster.map((p) => (
                <div key={p.id} className="flex items-center gap-2 px-2 py-1.5 rounded-xl">
                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
                  <span className="text-xs font-medium text-ink truncate flex-1">{p.name}</span>
                  {p.isHost && (
                    <span className="text-[8px] font-black uppercase tracking-wider text-zinc-400 bg-zinc-100 px-1.5 py-0.5 rounded-full shrink-0">
                      Host
                    </span>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        <div className="w-px h-4 bg-zinc-200" />

        <div className="flex items-center gap-2">
          <button
            onClick={handleFullscreen}
            className="text-zinc-400 hover:text-ink transition-colors p-1"
            title="Fullscreen Browser"
          >
            <Maximize2 size={16} />
          </button>
          <button
            onClick={() => setNegotiationOpen(true)}
            className="text-zinc-400 hover:text-ink transition-colors p-1"
            title="Negotiation Arena — agents debate to resolve conflicts"
          >
            <Scale size={16} />
          </button>
          <button
            onClick={() => setBYOKOpen(true)}
            className="relative text-zinc-400 hover:text-ink transition-colors p-1"
            title="API Key (BYOK)"
          >
            <KeyRound size={16} className={hasKey ? 'text-emerald-500 hover:text-emerald-600' : ''} />
            {hasKey && (
              <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-emerald-400" />
            )}
          </button>
        </div>
      </div>

      {isInfoOpen && (
        <InfoModal key="info-modal" onClose={() => setIsInfoOpen(false)} />
      )}

      {isBYOKOpen && (
        <BYOKModal key="byok-modal" onClose={() => setBYOKOpen(false)} />
      )}

      {isNegotiationOpen && (
        <NegotiationArena key="negotiation-arena" onClose={() => setNegotiationOpen(false)} />
      )}

      {/* Brief Input Premium Modal */}
      {briefModalOpen && createPortal(
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-6 pointer-events-auto">
          <div onClick={() => setBriefModalOpen(false)} className="absolute inset-0 bg-white/40 backdrop-blur-xl" />
          <div className="relative w-full max-w-md bg-white rounded-3xl shadow-[0_32px_64px_-12px_rgba(0,0,0,0.12)] border border-zinc-100 overflow-hidden flex flex-col p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
              <div className="flex items-center gap-2">
                <Brain size={16} className="text-ink" />
                <h3 className="font-black text-ink uppercase tracking-tight text-xs">
                  {briefType === 'society' ? 'Initialize Swarm Run' : 'Swarm Benchmark Harness'}
                </h3>
              </div>
              <button onClick={() => setBriefModalOpen(false)} className="text-zinc-300 hover:text-zinc-600 transition-colors">
                <X size={16} />
              </button>
            </div>
            
            <div className="space-y-1">
              <label className="text-[9px] font-black uppercase tracking-widest text-zinc-400">Brief Description</label>
              <textarea
                value={briefInput}
                onChange={(e) => setBriefInput(e.target.value)}
                placeholder={
                  briefType === 'society'
                    ? "Enter what you want the society to build (e.g. Design a landing page for a coffee shop, or Research and write a report on quantum computing)."
                    : "Enter brief to compare Society vs Single Agent performance side-by-side..."
                }
                className="w-full h-32 px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-2xl text-xs focus:outline-none focus:ring-2 focus:ring-black/5 resize-none"
              />
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <button
                onClick={() => setBriefModalOpen(false)}
                className="px-4 py-2 border border-zinc-200 hover:bg-zinc-50 text-zinc-500 rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors active:scale-95"
              >
                Cancel
              </button>
              <button
                onClick={handleRunAction}
                disabled={!briefInput.trim()}
                className="px-4 py-2 bg-ink hover:bg-black disabled:opacity-40 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors active:scale-95"
              >
                {briefType === 'society' ? 'Execute Swarm' : 'Run Benchmark'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </header>
  );
};

export default Header;
