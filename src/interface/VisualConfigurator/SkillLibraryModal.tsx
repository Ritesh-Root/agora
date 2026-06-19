import React, { useState } from 'react';
import { X, Plus, Pencil, Trash2, Sparkles } from 'lucide-react';
import { useSkillStore } from '../../integration/store/skillStore';
import { AgentSkill, BUILTIN_SKILLS } from '../../data/agents';

const BUILTIN_IDS = new Set(BUILTIN_SKILLS.map((s) => s.id));

/** Manage the reusable skill library — edits propagate to every agent that uses a skill. */
export const SkillLibraryModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const library = useSkillStore((s) => s.library);
  const upsertSkill = useSkillStore((s) => s.upsertSkill);
  const removeSkill = useSkillStore((s) => s.removeSkill);

  const [editing, setEditing] = useState<AgentSkill | null>(null);
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [instr, setInstr] = useState('');

  const startNew = () => { setEditing({ id: '', name: '', description: '', instructions: '' }); setName(''); setDesc(''); setInstr(''); };
  const startEdit = (s: AgentSkill) => { setEditing(s); setName(s.name); setDesc(s.description); setInstr(s.instructions); };
  const cancel = () => setEditing(null);

  const save = () => {
    const n = name.trim();
    const ins = instr.trim();
    if (!n || !ins) return;
    const id = editing?.id || `custom-${n.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now().toString(36)}`;
    upsertSkill({ id, name: n, description: desc.trim() || 'Custom skill', instructions: ins });
    setEditing(null);
  };

  const inputCls = 'w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-black/5';

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-6 pointer-events-auto">
      <div onClick={onClose} className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
      <div className="relative w-full max-w-lg max-h-[80vh] bg-white rounded-[32px] shadow-2xl border border-zinc-100 flex flex-col overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles size={18} className="text-darkDelegation" />
            <h2 className="font-black text-darkDelegation uppercase tracking-tight text-sm">Skill Library</h2>
          </div>
          <button onClick={onClose} className="text-zinc-300 hover:text-zinc-600 transition-colors"><X size={18} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {editing ? (
            <div className="space-y-2">
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Skill name (e.g. SEO Strategy)" className={`${inputCls} font-bold`} />
              <input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="One-line description (optional)" className={inputCls} />
              <textarea value={instr} onChange={(e) => setInstr(e.target.value)} placeholder="Instructions — how should an agent apply this skill?" className={`${inputCls} h-36 resize-none leading-relaxed text-zinc-600`} />
              <div className="flex gap-2 pt-1">
                <button onClick={save} disabled={!name.trim() || !instr.trim()} className="flex-1 py-2.5 bg-darkDelegation hover:bg-black text-white rounded-xl text-[11px] font-black uppercase tracking-widest disabled:opacity-40 disabled:cursor-not-allowed transition-colors">Save skill</button>
                <button onClick={cancel} className="px-4 py-2.5 text-zinc-500 hover:bg-zinc-100 rounded-xl text-[11px] font-black uppercase tracking-widest transition-colors">Cancel</button>
              </div>
            </div>
          ) : (
            library.map((s) => (
              <div key={s.id} className="p-3 rounded-2xl border border-zinc-100 bg-zinc-50/50 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-darkDelegation">{s.name}</span>
                    {BUILTIN_IDS.has(s.id) && <span className="text-[8px] font-black uppercase tracking-widest text-zinc-400 bg-zinc-100 px-1.5 py-0.5 rounded">Built-in</span>}
                  </div>
                  <p className="text-[11px] text-zinc-500 leading-snug mt-0.5 line-clamp-2">{s.instructions}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => startEdit(s)} className="p-1.5 text-zinc-400 hover:text-darkDelegation hover:bg-zinc-100 rounded-lg transition-colors"><Pencil size={13} /></button>
                  {!BUILTIN_IDS.has(s.id) && (
                    <button onClick={() => removeSkill(s.id)} className="p-1.5 text-zinc-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={13} /></button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {!editing && (
          <div className="p-4 border-t border-zinc-100">
            <button onClick={startNew} className="w-full py-2.5 bg-darkDelegation hover:bg-black text-white rounded-2xl text-[11px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-colors">
              <Plus size={14} /> New skill
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
