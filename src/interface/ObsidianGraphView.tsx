import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { ReactFlow, Background, BackgroundVariant, Edge, Node, NodeChange, applyNodeChanges, Handle, Position, NodeTypes } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useTeamStore } from '../integration/store/teamStore';
import { useCoreStore } from '../integration/store/coreStore';
import { useUiStore } from '../integration/store/uiStore';
import { getAllCharacters, getAgentSet, USER_COLOR } from '../data/agents';
import { Settings, Sliders, RotateCcw } from 'lucide-react';

// ── Shared node label (Obsidian shows a text label under every node) ──
const NodeLabel: React.FC<{ text: string; size: number; muted?: boolean }> = ({ text, size, muted }) => (
  <div
    className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap pointer-events-none select-none text-center"
    style={{ top: `${size + 5}px` }}
  >
    <span
      className={muted
        ? 'text-[7px] font-semibold uppercase tracking-wider text-zinc-400'
        : 'text-[9px] font-semibold tracking-tight text-zinc-600'}
      style={{ textShadow: '0 1px 2px #fcfaf4, 0 0 2px #fcfaf4' }}
    >
      {text}
    </span>
  </div>
);

// ── User Node ──────────────────────────────────────────────
const GraphUserNode = ({ data }: any) => {
  const size = data.nodeSize || 18;
  return (
    <div
      className="rounded-full relative pointer-events-auto cursor-grab active:cursor-grabbing transition-transform duration-200 hover:scale-110"
      style={{
        width: `${size}px`,
        height: `${size}px`,
        backgroundColor: USER_COLOR,
        border: '2px solid #fcfaf4',
        boxShadow: '0 2px 6px rgba(99,102,201,0.35), 0 0 0 4px rgba(99,102,201,0.10)',
      }}
      onMouseEnter={() => data.onHover(data)}
      onMouseLeave={data.onLeave}
    >
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0, top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }} />
      {data.showLabels && <NodeLabel text={data.name} size={size} />}
    </div>
  );
};

// ── Agent Node ─────────────────────────────────────────────
const GraphAgentNode = ({ data }: any) => {
  const { color, status } = data;
  const isWorking = status === 'working' || status === 'talking';
  const size = data.nodeSize || 15;
  return (
    <div
      className="rounded-full relative pointer-events-auto cursor-grab active:cursor-grabbing transition-transform duration-200 hover:scale-110"
      style={{
        width: `${size}px`,
        height: `${size}px`,
        backgroundColor: color,
        border: '2px solid #fcfaf4',
        boxShadow: isWorking
          ? `0 2px 8px ${color}66, 0 0 0 5px ${color}22`
          : `0 1px 4px rgba(0,0,0,0.14)`,
      }}
      onMouseEnter={() => data.onHover(data)}
      onMouseLeave={data.onLeave}
    >
      <Handle type="target" position={Position.Top} style={{ opacity: 0, top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }} />
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0, top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }} />
      {isWorking && (
        <span
          className="absolute inset-0 rounded-full animate-ping"
          style={{ boxShadow: `0 0 0 2px ${color}`, opacity: 0.4 }}
        />
      )}
      {data.showLabels && <NodeLabel text={data.name} size={size} />}
    </div>
  );
};

// ── Skill Node ─────────────────────────────────────────────
const GraphSkillNode = ({ data }: any) => {
  const size = Math.max(7, (data.nodeSize || 15) * 0.5);
  return (
    <div
      className="rounded-full relative pointer-events-auto cursor-grab active:cursor-grabbing transition-transform duration-200 hover:scale-125"
      style={{
        width: `${size}px`,
        height: `${size}px`,
        backgroundColor: '#34d399',
        border: '1.5px solid #fcfaf4',
        boxShadow: '0 1px 3px rgba(16,185,129,0.35)',
      }}
      onMouseEnter={() => data.onHover(data)}
      onMouseLeave={data.onLeave}
    >
      <Handle type="target" position={Position.Top} style={{ opacity: 0, top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }} />
      {data.showLabels && data.showSkillLabels && <NodeLabel text={data.name} size={size} muted />}
    </div>
  );
};

const nodeTypes: NodeTypes = {
  glowingUser: GraphUserNode,
  glowingAgent: GraphAgentNode,
  glowingSkill: GraphSkillNode,
};

// Obsidian light-theme link colors
const EDGE_IDLE = '#d9d2bf';
const EDGE_SKILL = '#e6e0ce';

export const ObsidianGraphView: React.FC = () => {
  const { selectedAgentSetId, customSystems } = useTeamStore();
  const { agentStatuses, setSelectedNpc } = useUiStore();

  // Tooltip interaction state
  const [hoveredNode, setHoveredNode] = useState<any | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  // Settings Panel Config State
  const [panelOpen, setPanelOpen] = useState(false);
  const [showSkills, setShowSkills] = useState(true);
  const [showLabels, setShowLabels] = useState(true);
  const [showGrid, setShowGrid] = useState(true);
  const [animateEdges, setAnimateEdges] = useState(true);
  const [repulsion, setRepulsion] = useState(120);
  const [spring, setSpring] = useState(0.025);
  const [gravity, setGravity] = useState(0.0025);
  const [nodeSize, setNodeSize] = useState(16);

  // Fast Ref for Physics Loop to prevent frame drop on slider drag
  const configRef = useRef({ repulsion, spring, gravity, nodeSize, animateEdges });
  useEffect(() => {
    configRef.current = { repulsion, spring, gravity, nodeSize, animateEdges };
  }, [repulsion, spring, gravity, nodeSize, animateEdges]);

  const system = useMemo(() => getAgentSet(selectedAgentSetId, customSystems), [selectedAgentSetId, customSystems]);
  const characters = useMemo(() => getAllCharacters(system), [system]);

  const handleHover = (nodeData: any) => setHoveredNode(nodeData);
  const handleLeave = () => setHoveredNode(null);
  const handleMouseMove = (e: React.MouseEvent) => setMousePos({ x: e.clientX, y: e.clientY });

  const handleReset = () => {
    setShowSkills(true);
    setShowLabels(true);
    setShowGrid(true);
    setAnimateEdges(true);
    setRepulsion(120);
    setSpring(0.025);
    setGravity(0.0025);
    setNodeSize(16);
  };

  // Generate nodes & edges dynamically based on configuration
  const { initialNodes, initialEdges } = useMemo(() => {
    const list: Node[] = [];
    const connections: Edge[] = [];

    // 1. User Node
    list.push({
      id: 'user',
      type: 'glowingUser',
      position: { x: 0, y: 0 },
      data: {
        name: 'You',
        role: 'Operator / Prompt Engineer',
        description: 'Human operator driving the swarm simulation.',
        nodeSize: nodeSize * 1.2,
        showLabels,
        onHover: handleHover,
        onLeave: handleLeave,
      },
    });

    // 2. Lead Agent
    const lead = system.leadAgent;
    const leadLogicalIdx = lead.index;
    const leadStatus = agentStatuses[leadLogicalIdx] || 'idle';

    list.push({
      id: lead.id,
      type: 'glowingAgent',
      position: { x: 0, y: 150 },
      data: {
        name: lead.name,
        role: lead.description.split('.')[0] || 'Lead Agent',
        description: lead.description,
        color: lead.color,
        status: leadStatus,
        isLead: true,
        nodeSize,
        showLabels,
        onHover: handleHover,
        onLeave: handleLeave,
      },
    });

    connections.push({
      id: `user-to-${lead.id}`,
      source: 'user',
      target: lead.id,
      animated: animateEdges && leadStatus !== 'idle',
      style: { stroke: leadStatus !== 'idle' ? lead.color : EDGE_IDLE, strokeWidth: 1.4 },
    });

    const getSkillsForRole = (roleName: string, skillIds: string[] = []): string[] => {
      const skills = [...skillIds];
      const lower = roleName.toLowerCase();
      if (lower.includes('director') || lower.includes('lead') || lower.includes('orchestrator')) {
        skills.push('strategy', 'orchestration', 'negotiation');
      } else if (lower.includes('programmer') || lower.includes('developer') || lower.includes('engineer')) {
        skills.push('coding', 'execution', 'lint repair');
      } else if (lower.includes('writer') || lower.includes('copywriter') || lower.includes('editor')) {
        skills.push('copywriting', 'seo tuning', 'editing');
      } else if (lower.includes('researcher') || lower.includes('analyst')) {
        skills.push('search', 'reading', 'synthesis');
      } else if (lower.includes('qa') || lower.includes('tester')) {
        skills.push('audit', 'testing', 'self healing');
      } else {
        skills.push('task execution', 'context sync');
      }
      return Array.from(new Set(skills)).map(s => s.replace(/-/g, ' ').toUpperCase());
    };

    // Add Lead Agent Skills (if enabled)
    if (showSkills) {
      const leadSkills = getSkillsForRole(lead.name, lead.skillIds);
      leadSkills.forEach((skill, idx) => {
        const angle = (idx / leadSkills.length) * Math.PI - Math.PI;
        const rad = 65;
        const sx = Math.cos(angle) * rad;
        const sy = 150 + Math.sin(angle) * rad;

        const skillNodeId = `skill-lead-${idx}`;
        list.push({
          id: skillNodeId,
          type: 'glowingSkill',
          position: { x: sx, y: sy },
          data: {
            name: skill,
            role: 'Agent Skill Capability',
            description: `Specialized tooling skill assigned to ${lead.name}.`,
            nodeSize,
            showLabels,
            showSkillLabels: true,
            onHover: handleHover,
            onLeave: handleLeave,
          },
        });

        connections.push({
          id: `edge-${lead.id}-to-${skillNodeId}`,
          source: lead.id,
          target: skillNodeId,
          style: { stroke: EDGE_SKILL, strokeWidth: 1 },
        });
      });
    }

    // 3. Subagents
    const subagents = lead.subagents || [];
    const numSubs = subagents.length;

    subagents.forEach((agent, i) => {
      const ax = numSubs > 1 ? (i - (numSubs - 1) / 2) * 200 : 0;
      const ay = 300;
      const agentStatus = agentStatuses[agent.index] || 'idle';

      list.push({
        id: agent.id,
        type: 'glowingAgent',
        position: { x: ax, y: ay },
        data: {
          name: agent.name,
          role: agent.description.split('.')[0] || 'Subagent',
          description: agent.description,
          color: agent.color,
          status: agentStatus,
          isLead: false,
          nodeSize: nodeSize * 0.92,
          showLabels,
          onHover: handleHover,
          onLeave: handleLeave,
        },
      });

      connections.push({
        id: `${lead.id}-to-${agent.id}`,
        source: lead.id,
        target: agent.id,
        animated: animateEdges && agentStatus !== 'idle',
        style: { stroke: agentStatus !== 'idle' ? agent.color : EDGE_IDLE, strokeWidth: 1.4 },
      });

      if (showSkills) {
        const skills = getSkillsForRole(agent.name, agent.skillIds);
        skills.forEach((skill, idx) => {
          const angle = (idx / skills.length) * Math.PI;
          const rad = 55;
          const sx = ax + Math.cos(angle) * rad;
          const sy = ay + Math.sin(angle) * rad;

          const skillNodeId = `skill-${agent.id}-${idx}`;
          list.push({
            id: skillNodeId,
            type: 'glowingSkill',
            position: { x: sx, y: sy },
            data: {
              name: skill,
              role: 'Agent Skill Capability',
              description: `Specialized tooling skill assigned to ${agent.name}.`,
              nodeSize,
              showLabels,
              showSkillLabels: true,
              onHover: handleHover,
              onLeave: handleLeave,
            },
          });

          connections.push({
            id: `edge-${agent.id}-to-${skillNodeId}`,
            source: agent.id,
            target: skillNodeId,
            style: { stroke: EDGE_SKILL, strokeWidth: 1 },
          });
        });
      }
    });

    return { initialNodes: list, initialEdges: connections };
  }, [system, agentStatuses, showSkills, showLabels, nodeSize, animateEdges]);

  // Manage nodes and edges in state so they can animate dynamically
  const [nodes, setNodes] = useState<Node[]>(initialNodes);
  const [edges, setEdges] = useState<Edge[]>(initialEdges);

  useEffect(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
  }, [initialNodes, initialEdges]);

  // Ref to hold current velocities & positions for physical simulation
  const physicsRef = useRef<Record<string, { x: number; y: number; vx: number; vy: number }>>({});

  // Physics animation tick
  useEffect(() => {
    let active = true;

    const tick = () => {
      if (!active) return;

      setNodes((prevNodes) => {
        prevNodes.forEach(node => {
          if (!physicsRef.current[node.id]) {
            physicsRef.current[node.id] = { x: node.position.x, y: node.position.y, vx: 0, vy: 0 };
          }
        });

        const keys = prevNodes.map(n => n.id);
        const physics = physicsRef.current;
        const currentConfig = configRef.current;

        // 1. Pairwise Repulsion Force
        for (let i = 0; i < keys.length; i++) {
          for (let j = i + 1; j < keys.length; j++) {
            const pA = physics[keys[i]];
            const pB = physics[keys[j]];
            if (!pA || !pB) continue;
            const dx = pB.x - pA.x;
            const dy = pB.y - pA.y;
            const distSq = dx * dx + dy * dy + 0.1;
            const dist = Math.sqrt(distSq);
            if (dist < 200) {
              const force = currentConfig.repulsion / distSq;
              const fx = (dx / dist) * force;
              const fy = (dy / dist) * force;
              pA.vx -= fx; pA.vy -= fy;
              pB.vx += fx; pB.vy += fy;
            }
          }
        }

        // 2. Edge spring attraction
        edges.forEach(edge => {
          const pA = physics[edge.source];
          const pB = physics[edge.target];
          if (!pA || !pB) return;
          const dx = pB.x - pA.x;
          const dy = pB.y - pA.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 0.1;
          const isSkill = edge.target.includes('skill');
          const targetDist = isSkill ? 40 : 120;
          const kSpring = isSkill ? currentConfig.spring * 2.2 : currentConfig.spring;
          const force = (dist - targetDist) * kSpring;
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;
          pA.vx += fx; pA.vy += fy;
          pB.vx -= fx; pB.vy -= fy;
        });

        // 3. Global gravity toward layout center (0, 150)
        keys.forEach(id => {
          const p = physics[id];
          if (!p) return;
          p.vx += (0 - p.x) * currentConfig.gravity;
          p.vy += (150 - p.y) * currentConfig.gravity;
        });

        // 4. Update Node coordinates
        return prevNodes.map(node => {
          const p = physics[node.id];
          if (!p) return node;
          if (node.dragging) {
            p.x = node.position.x; p.y = node.position.y; p.vx = 0; p.vy = 0;
            return node;
          }
          p.vx *= 0.82; p.vy *= 0.82;
          p.x += p.vx; p.y += p.vy;
          return { ...node, position: { x: p.x, y: p.y } };
        });
      });

      requestAnimationFrame(tick);
    };

    const frameId = requestAnimationFrame(tick);
    return () => { active = false; cancelAnimationFrame(frameId); };
  }, [edges]);

  // REQUIRED for controlled nodes: applies ReactFlow's measurement (dimension) changes
  // back into node state. Without this, nodes stay measured:undefined → visibility:hidden forever.
  const onNodesChange = useCallback((changes: NodeChange[]) => {
    setNodes((nds) => applyNodeChanges(changes, nds));
  }, []);

  const onNodeDrag = (_: any, node: Node) => {
    const p = physicsRef.current[node.id];
    if (p) { p.x = node.position.x; p.y = node.position.y; p.vx = 0; p.vy = 0; }
  };

  const onNodeClick = (_: any, node: Node) => {
    const agent = characters.find(a => a.id === node.id);
    if (agent) setSelectedNpc(agent.index);
  };

  return (
    <div
      className="w-full h-full relative bg-white overflow-hidden flex flex-col animate-fade-in"
      onMouseMove={handleMouseMove}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onNodeClick={onNodeClick}
        onNodeDrag={onNodeDrag}
        fitView
        fitViewOptions={{ padding: 0.35, maxZoom: 1.4 }}
        proOptions={{ hideAttribution: true }}
        nodesDraggable={true}
        zoomOnScroll={true}
        maxZoom={2.5}
        minZoom={0.5}
        className="relative z-10"
        style={{ background: '#fcfaf4' }}
      >
        {showGrid && <Background variant={BackgroundVariant.Dots} gap={26} color="#ddd6c2" size={1.1} />}
      </ReactFlow>

      {/* Floating Gear Settings Toggle */}
      <div className="absolute top-4 right-4 z-20">
        <button
          onClick={() => setPanelOpen(!panelOpen)}
          className={`p-2 rounded-xl transition-all border shadow-sm cursor-pointer flex items-center justify-center ${
            panelOpen
              ? 'bg-zinc-900 text-white border-zinc-900'
              : 'bg-white/90 text-zinc-500 border-zinc-200 hover:text-zinc-900 hover:border-zinc-300 backdrop-blur-md'
          }`}
          title="Graph Settings"
        >
          <Settings size={14} className={panelOpen ? 'rotate-45 transition-transform' : ''} />
        </button>
      </div>

      {/* Collapsible settings panel — light Obsidian style */}
      {panelOpen && (
        <div className="absolute top-16 right-4 z-20 w-64 bg-white/95 border border-zinc-200 rounded-2xl p-4 shadow-[0_20px_50px_rgba(0,0,0,0.12)] backdrop-blur-md text-[10px] space-y-4 animate-in fade-in slide-in-from-top-2 duration-150">

          <div className="flex items-center justify-between border-b border-zinc-100 pb-2">
            <div className="flex items-center gap-1.5 font-black text-zinc-900 uppercase tracking-wider">
              <Sliders size={12} className="text-zinc-400" />
              <span>Graph Configuration</span>
            </div>
            <button
              onClick={handleReset}
              className="text-zinc-400 hover:text-zinc-700 transition-colors flex items-center gap-0.5 font-bold cursor-pointer"
              title="Restore default settings"
            >
              <RotateCcw size={10} />
              Reset
            </button>
          </div>

          {/* Filters Section */}
          <div className="space-y-2">
            <span className="font-bold text-zinc-400 uppercase tracking-widest text-[8px]">Filters</span>
            {[
              { label: 'Show Labels', value: showLabels, set: setShowLabels },
              { label: 'Show Skills', value: showSkills, set: setShowSkills },
              { label: 'Show Grid', value: showGrid, set: setShowGrid },
              { label: 'Animate Flow Edges', value: animateEdges, set: setAnimateEdges },
            ].map(({ label, value, set }) => (
              <div key={label} className="flex items-center justify-between">
                <span className="text-zinc-600 font-medium">{label}</span>
                <button
                  onClick={() => set(!value)}
                  className={`w-9 h-5 rounded-full transition-colors flex items-center p-0.5 cursor-pointer ${value ? 'bg-emerald-500 justify-end' : 'bg-zinc-200 justify-start'}`}
                >
                  <span className="w-4 h-4 rounded-full bg-white shadow-sm" />
                </button>
              </div>
            ))}
          </div>

          {/* Forces Section */}
          <div className="space-y-3 pt-1 border-t border-zinc-100">
            <span className="font-bold text-zinc-400 uppercase tracking-widest text-[8px]">Forces</span>

            <div className="space-y-1">
              <div className="flex justify-between text-zinc-500">
                <span>Repelling Force</span>
                <span className="font-mono text-zinc-400">{repulsion}</span>
              </div>
              <input type="range" min="30" max="400" value={repulsion} onChange={(e) => setRepulsion(Number(e.target.value))}
                className="w-full accent-emerald-500 bg-zinc-100 rounded-lg appearance-none h-1 cursor-pointer" />
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-zinc-500">
                <span>Link Spring Tension</span>
                <span className="font-mono text-zinc-400">{(spring * 100).toFixed(1)}%</span>
              </div>
              <input type="range" min="0.005" max="0.1" step="0.005" value={spring} onChange={(e) => setSpring(Number(e.target.value))}
                className="w-full accent-emerald-500 bg-zinc-100 rounded-lg appearance-none h-1 cursor-pointer" />
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-zinc-500">
                <span>Center Gravity</span>
                <span className="font-mono text-zinc-400">{(gravity * 1000).toFixed(1)}</span>
              </div>
              <input type="range" min="0.0005" max="0.01" step="0.0005" value={gravity} onChange={(e) => setGravity(Number(e.target.value))}
                className="w-full accent-emerald-500 bg-zinc-100 rounded-lg appearance-none h-1 cursor-pointer" />
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-zinc-500">
                <span>Node Scale</span>
                <span className="font-mono text-zinc-400">{nodeSize}px</span>
              </div>
              <input type="range" min="8" max="26" value={nodeSize} onChange={(e) => setNodeSize(Number(e.target.value))}
                className="w-full accent-emerald-500 bg-zinc-100 rounded-lg appearance-none h-1 cursor-pointer" />
            </div>
          </div>
        </div>
      )}

      {/* Floating tooltip following the cursor — light */}
      {hoveredNode && (
        <div
          className="fixed z-50 px-3 py-2.5 bg-white/98 border border-zinc-200 rounded-xl shadow-[0_10px_30px_rgba(0,0,0,0.15)] text-left pointer-events-none flex flex-col gap-1 select-none animate-in fade-in zoom-in-95 duration-100 max-w-[240px]"
          style={{ left: mousePos.x + 15, top: mousePos.y + 15 }}
        >
          <div className="flex items-center gap-2">
            {hoveredNode.color && (
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: hoveredNode.color }} />
            )}
            <span className="text-[10px] font-black text-zinc-900 uppercase tracking-wider">{hoveredNode.name}</span>
          </div>
          <span className="text-[8px] font-bold text-zinc-400 uppercase tracking-widest leading-none mt-0.5">{hoveredNode.role}</span>
          <p className="text-[9px] text-zinc-500 leading-normal mt-1">{hoveredNode.description}</p>

          {hoveredNode.status && hoveredNode.status !== 'idle' && (
            <div className="mt-1.5 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full animate-ping bg-emerald-500" />
              <span className="text-[8px] font-black uppercase text-emerald-600 tracking-widest">
                Status: {hoveredNode.status}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
