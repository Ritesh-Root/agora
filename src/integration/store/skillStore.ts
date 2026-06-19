import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { AgentSkill, BUILTIN_SKILLS } from '../../data/agents';

interface SkillState {
  /** The reusable skill library: built-in presets + the user's custom skills. */
  library: AgentSkill[];
  /** Create or update a skill (edits propagate to every agent that references it). */
  upsertSkill: (skill: AgentSkill) => void;
  /** Remove a skill from the library (custom skills only; built-ins are re-seeded on load). */
  removeSkill: (id: string) => void;
}

export const useSkillStore = create<SkillState>()(
  persist(
    (set) => ({
      library: BUILTIN_SKILLS,

      upsertSkill: (skill) =>
        set((s) => ({
          library: s.library.some((x) => x.id === skill.id)
            ? s.library.map((x) => (x.id === skill.id ? skill : x))
            : [...s.library, skill],
        })),

      removeSkill: (id) => set((s) => ({ library: s.library.filter((x) => x.id !== id) })),
    }),
    {
      name: 'skill-library',
      storage: createJSONStorage(() => localStorage),
      version: 1,
      // Always keep built-ins available; let persisted edits/customs override by id.
      merge: (persisted: any, current) => {
        const persistedLib: AgentSkill[] = Array.isArray(persisted?.library) ? persisted.library : [];
        const byId = new Map<string, AgentSkill>();
        for (const s of BUILTIN_SKILLS) byId.set(s.id, s);
        for (const s of persistedLib) byId.set(s.id, s);
        return { ...current, ...persisted, library: Array.from(byId.values()) };
      },
    }
  )
);

/** Non-React accessor for the library (safe from services like PromptBuilder). */
export function getSkillLibrary(): AgentSkill[] {
  return useSkillStore.getState().library;
}

/** Resolve a list of skill ids into their full definitions, dropping unknown ids. */
export function resolveSkills(ids?: string[]): AgentSkill[] {
  if (!ids || ids.length === 0) return [];
  const lib = getSkillLibrary();
  return ids
    .map((id) => lib.find((s) => s.id === id))
    .filter((s): s is AgentSkill => !!s);
}
