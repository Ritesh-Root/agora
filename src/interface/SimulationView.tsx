import { Maximize2, Minimize2, Eye, Network, Building2 } from 'lucide-react';
import React, { useState } from 'react';
import { useCoreStore } from '../integration/store/coreStore';
import { useTeamStore, useActiveTeam } from '../integration/store/teamStore';
import { useUiStore } from '../integration/store/uiStore';
import InspectorPanel from './InspectorPanel';
import UIOverlay from './UIOverlay';
import TeamFlowModal from './TeamFlowModal';
import { AuditModal } from './AuditModal';
import { TeamBadge } from './components/TeamBadge';
import { TeamOutputBadge } from './components/TeamOutputBadge';
import { ObsidianGraphView } from './ObsidianGraphView';

interface SimulationViewProps {
  canvasRef: React.RefObject<HTMLDivElement>;
  isFullscreen: boolean;
  setIsFullscreen: (value: boolean) => void;
}

const SimulationView: React.FC<SimulationViewProps> = ({ canvasRef, isFullscreen, setIsFullscreen }) => {
  const { selectedNpcIndex, activeAuditTaskId, setActiveAuditTaskId } = useUiStore();
  const activeSet = useActiveTeam();
  const [isFlowModalOpen, setIsFlowModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'office' | 'graph'>('office');

  React.useEffect(() => {
    if (activeAuditTaskId) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
  }, [activeAuditTaskId]);

  return (
    <div className="flex flex-col flex-1 min-w-0 min-h-0 relative bg-zinc-950">
      {/* Simulation View Header */}
      <div className="h-14 border-b border-black/5 flex items-center justify-between px-5 bg-white shrink-0">
        <div className="flex-1 flex items-center gap-4">
          <button
            onClick={() => setIsFlowModalOpen(true)}
            className="flex items-center gap-4 hover:bg-zinc-50 px-2.5 py-1.5 rounded-2xl transition-all active:scale-95 group cursor-pointer"
            title="View Team Flow"
          >
            <TeamBadge system={activeSet} />
            <div className="w-8 h-8 rounded-full border border-zinc-100 flex items-center justify-center text-zinc-300 group-hover:text-ink group-hover:border-zinc-200 transition-colors">
              <Eye size={14} />
            </div>
          </button>

          <TeamOutputBadge system={activeSet} className="hidden md:flex" />

          {/* Obsidian Graph Toggle Tab Segment */}
          <div className="flex items-center gap-1 bg-zinc-100/80 p-0.5 rounded-xl border border-zinc-200/40 ml-2">
            <button
              onClick={() => setActiveTab('office')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                activeTab === 'office' 
                  ? 'bg-white text-ink shadow-sm font-extrabold' 
                  : 'text-zinc-400 hover:text-zinc-600'
              }`}
            >
              <Building2 size={10} />
              Office 3D
            </button>
            <button
              onClick={() => setActiveTab('graph')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                activeTab === 'graph' 
                  ? 'bg-white text-ink shadow-sm font-extrabold' 
                  : 'text-zinc-400 hover:text-zinc-600'
              }`}
            >
              <Network size={10} />
              Obsidian Graph
            </button>
          </div>
        </div>

        <div className="flex items-center justify-end gap-1">
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-2 text-zinc-400 hover:text-ink transition-colors cursor-pointer"
            title={isFullscreen ? "Exit Fullscreen" : "Fullscreen Panel"}
          >
            {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 relative flex flex-col">
        {/* Obsidian style node graph view */}
        {activeTab === 'graph' && (
          <div className="absolute inset-0 z-10">
            <ObsidianGraphView />
          </div>
        )}

        {/* ThreeJS viewport — visibility: hidden instead of display: none to prevent Canvas/WebGL context loss */}
        <div 
          ref={canvasRef} 
          className="w-full h-full relative bg-zinc-50"
          style={{ visibility: activeTab === 'office' ? 'visible' : 'hidden', position: activeTab === 'office' ? 'relative' : 'absolute' }}
        >
          <UIOverlay />
          {isFullscreen && selectedNpcIndex !== null && (
            <div className="absolute top-4 right-4 bottom-4 w-96 z-50 pointer-events-none flex flex-col gap-4">
              <InspectorPanel isFloating />
            </div>
          )}
        </div>
      </div>

      {isFlowModalOpen && (
        <TeamFlowModal
          isOpen={isFlowModalOpen}
          onClose={() => setIsFlowModalOpen(false)}
          system={activeSet}
        />
      )}

      {activeAuditTaskId && (
        <AuditModal
          isOpen={!!activeAuditTaskId}
          taskId={activeAuditTaskId}
          onClose={() => setActiveAuditTaskId(null)}
        />
      )}
    </div>
  );
};

export default SimulationView;
