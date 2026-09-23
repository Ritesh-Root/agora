import React, { useEffect, useState } from 'react';
import { networkClient } from '../network/NetworkClient';
import { useDecisionStore } from './decisionStore';

const BossCard: React.FC = () => {
  const pending = useDecisionStore((state) => state.pending);
  const [text, setText] = useState('');

  useEffect(() => {
    setText('');
    if (!pending) return;
    const timer = window.setTimeout(() => useDecisionStore.getState().setPending(null), 30_000);
    return () => window.clearTimeout(timer);
  }, [pending?.id]);

  if (!pending) return null;

  const reply = (action: 'approve' | 'edit' | 'reject') => {
    networkClient.send({ type: 'decision-reply', id: pending.id, action, text: action === 'edit' ? text : undefined });
    useDecisionStore.getState().setPending(null);
  };

  const confidence = pending.confidence == null ? 0 : Math.max(0, Math.min(1, pending.confidence));

  return (
    <div
      data-testid="boss-decision-card"
      className="fixed bottom-6 left-1/2 z-[80] w-[min(420px,calc(100%-2rem))] -translate-x-1/2 rounded-3xl border border-zinc-200 bg-white p-4 shadow-2xl pointer-events-auto"
    >
      <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Jev wants a decision</p>
      <p className="mt-1 text-sm font-black text-ink">{pending.question}</p>
      <p className="mt-1 text-xs font-medium text-zinc-600">
        {pending.policy} · {pending.confidence == null ? pending.answer : pending.confidence.toFixed(2)} · {pending.latencyMs} ms
      </p>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-100">
        <div className="h-full bg-butter" style={{ width: `${confidence * 100}%` }} />
      </div>
      <textarea
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder="Edit the answer"
        className="mt-3 w-full resize-none rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-ink outline-none focus:border-butter"
        rows={2}
      />
      <div className="mt-3 flex gap-2">
        <button type="button" onClick={() => reply('approve')} className="flex-1 rounded-full bg-ink py-2 text-[10px] font-black uppercase tracking-widest text-white cursor-pointer">Approve</button>
        <button type="button" onClick={() => reply('edit')} disabled={!text.trim()} className="flex-1 rounded-full border border-zinc-200 py-2 text-[10px] font-black uppercase tracking-widest text-ink cursor-pointer disabled:opacity-40">Edit</button>
        <button type="button" onClick={() => reply('reject')} className="flex-1 rounded-full border border-zinc-200 py-2 text-[10px] font-black uppercase tracking-widest text-ink cursor-pointer">Reject</button>
      </div>
    </div>
  );
};

export default BossCard;
