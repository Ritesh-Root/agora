/**
 * A word is a non-empty span separated by whitespace.
 * Headings count. A mark such as ** stays on the word it touches and is not an extra word.
 */
export function countDocumentWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

export interface BriefConstraints {
  /** Null when the brief does not ask for a 400-word cap. The cap is 399. */
  wordLimit: number | null;
  sections: boolean;
}

/** The film brief says "under 400 words" and names the four sections. Other briefs are left alone. */
export function constraintsFromBrief(brief: string): BriefConstraints {
  return {
    wordLimit: /under\s+400\s+words/i.test(brief) ? 399 : null,
    sections: /\bproblem\b/i.test(brief)
      && /\baudience\b/i.test(brief)
      && /\bpriorit/i.test(brief)
      && /next steps/i.test(brief),
  };
}

export interface DocumentProblem {
  kind: 'words' | 'sections';
  detail: string;
}

const SECTION_CHECKS: Array<[string, RegExp]> = [
  ['problem', /\bproblem\b/i],
  ['audience', /\baudience\b/i],
  ['priorities', /\bpriorit(?:y|ies)\b/i],
  ['assigned next steps', /next steps/i],
];

export function documentProblems(text: string, constraints: BriefConstraints): DocumentProblem[] {
  const problems: DocumentProblem[] = [];
  if (constraints.wordLimit !== null) {
    const words = countDocumentWords(text);
    if (words > constraints.wordLimit) {
      problems.push({
        kind: 'words',
        detail: `The document is ${words} words. The limit is ${constraints.wordLimit}, including headings.`,
      });
    }
  }
  if (constraints.sections) {
    const missing = SECTION_CHECKS.filter(([, pattern]) => !pattern.test(text)).map(([name]) => name);
    if (missing.length > 0) {
      problems.push({ kind: 'sections', detail: `Missing sections: ${missing.join(', ')}.` });
    }
  }
  return problems;
}

export const WORD_LIMIT_LABEL = 'Needs revision: exceeds word limit';
export const SECTIONS_LABEL = 'Needs revision: missing required sections';
export const MAX_DOCUMENT_REPAIRS = 2;

export function revisionLabel(problems: DocumentProblem[]): string | undefined {
  if (problems.some((problem) => problem.kind === 'words')) return WORD_LIMIT_LABEL;
  if (problems.some((problem) => problem.kind === 'sections')) return SECTIONS_LABEL;
  return undefined;
}
