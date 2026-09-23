import React, { useEffect, useRef, useState } from 'react';
import { Hash, Send } from 'lucide-react';
import { useCoreStore } from '../integration/store/coreStore';
import { networkClient } from '../network/NetworkClient';
import { useRoomChatStore } from '../network/roomChatStore';
import { useRosterStore } from '../network/RosterStore';

const AGENTS = [
  { name: 'Manager', note: 'Planning' },
  { name: 'Worker', note: 'Execution' },
  { name: 'Referee', note: 'Review' },
  { name: 'Lead', note: 'Synthesis' },
];

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((part) => part[0]?.toUpperCase() ?? '').join('') || '?';
}

function clock(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

const PublicRoom: React.FC = () => {
  const messages = useRoomChatStore((s) => s.messages);
  const roster = useRosterStore((s) => s.roster);
  const self = useRosterStore((s) => s.self);
  const brief = useCoreStore((s) => s.userBrief);
  const [draft, setDraft] = useState('');
  const [copied, setCopied] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const log = logRef.current;
    if (log) log.scrollTop = log.scrollHeight;
  }, [messages]);

  const send = () => {
    const text = draft.trim();
    if (!text) return;
    if (networkClient.isOpen()) {
      networkClient.send({ type: 'room-chat', text });
    } else if (self) {
      useRoomChatStore.getState().add({
        id: `local-${Date.now()}`,
        playerId: self.id,
        name: self.name,
        text,
        timestamp: Date.now(),
      });
    }
    setDraft('');
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="absolute inset-0 z-10 flex bg-[#fbfaf6] text-ink">
      <aside className="hidden md:flex w-56 shrink-0 flex-col border-r border-zinc-200/80 p-4">
        <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">People {roster.length}/5</p>
        <div className="mt-3 space-y-2">
          {roster.map((person) => (
            <div key={person.id} className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-black text-ink" style={{ backgroundColor: person.color }}>
                {initials(person.name)}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold truncate">{person.name}{person.id === self?.id ? ' · you' : ''}</p>
                <p className="text-[10px] text-zinc-400">{person.isHost ? 'Boss' : 'In the room'}</p>
              </div>
            </div>
          ))}
        </div>
        <p className="mt-6 text-[10px] font-black uppercase tracking-widest text-zinc-400">AI agents</p>
        <div className="mt-3 space-y-2">
          {AGENTS.map((agent) => (
            <button
              key={agent.name}
              type="button"
              onClick={() => setDraft((value) => `${value}${value && !value.endsWith(' ') ? ' ' : ''}@${agent.name} `)}
              className="w-full flex items-center gap-2 text-left rounded-xl px-1 py-1 hover:bg-zinc-100"
            >
              <div className="w-8 h-8 rounded-lg bg-zinc-100 flex items-center justify-center text-xs">⌘</div>
              <div>
                <p className="text-xs font-bold">{agent.name}</p>
                <p className="text-[10px] text-zinc-400">{agent.note}</p>
              </div>
            </button>
          ))}
        </div>
        <p className="mt-auto text-[10px] leading-relaxed text-zinc-400">One room. Messages here are visible to everyone connected.</p>
      </aside>

      <main className="flex-1 min-w-0 flex flex-col">
        <div className="h-16 shrink-0 border-b border-zinc-200/80 px-5 flex items-center justify-between">
          <div>
            <h1 className="text-base font-black tracking-tight flex items-center gap-1.5"><Hash size={16} className="text-zinc-400" /> Public room</h1>
            <p className="text-[11px] text-zinc-400">{roster.length} {roster.length === 1 ? 'person' : 'people'} · 4 agents</p>
          </div>
          <button type="button" onClick={copyLink} className="text-[10px] font-black uppercase tracking-wider px-3 py-2 rounded-full border border-zinc-200 hover:border-zinc-400">
            {copied ? 'Link copied' : 'Invite'}
          </button>
        </div>

        <div ref={logRef} className="flex-1 overflow-y-auto px-5 py-4" role="log" aria-label="Public room messages">
          {messages.length === 0 && (
            <p className="text-sm text-zinc-400">No messages yet. Say hello, or @mention an agent so the room can see who you are asking.</p>
          )}
          {messages.map((message) => {
            const mine = message.playerId === self?.id;
            return (
              <div key={message.id} className="flex gap-3 mb-4">
                <div className="w-8 h-8 rounded-full bg-butter flex items-center justify-center text-[10px] font-black shrink-0">
                  {initials(message.name)}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold">{message.name}{mine ? ' · you' : ''} <time className="font-medium text-zinc-400">{clock(message.timestamp)}</time></p>
                  <p className="text-sm leading-relaxed text-zinc-700 whitespace-pre-wrap mt-1">{message.text}</p>
                </div>
              </div>
            );
          })}
        </div>

        <form
          className="shrink-0 px-4 pb-4"
          onSubmit={(event) => {
            event.preventDefault();
            send();
          }}
        >
          <div className="border border-zinc-200 rounded-2xl bg-white p-3">
            <textarea
              aria-label="Message the public room"
              value={draft}
              maxLength={2000}
              rows={2}
              placeholder="Message the room, or @mention an agent…"
              className="w-full resize-none bg-transparent text-sm outline-none"
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                  event.preventDefault();
                  send();
                }
              }}
            />
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-zinc-400">Visible to everyone in this room</span>
              <button type="submit" className="flex items-center gap-1 bg-butter text-ink text-[11px] font-black px-3 py-1.5 rounded-lg">
                Send <Send size={12} />
              </button>
            </div>
          </div>
          <p className="text-center text-[10px] text-zinc-400 mt-2">Enter to send · Shift + Enter for a new line. Agent replies still come from Run Swarm, not from this chat.</p>
        </form>
      </main>

      <aside className="hidden lg:flex w-64 shrink-0 flex-col border-l border-zinc-200/80 p-4">
        <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">The brief</p>
        <p className="text-sm leading-relaxed mt-2 text-zinc-600">{brief.trim() || 'No brief yet. Run Swarm when you want the agents to work.'}</p>
      </aside>
    </div>
  );
};

export default PublicRoom;
