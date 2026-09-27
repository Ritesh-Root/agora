import { describe, expect, it } from 'vitest';
import { constraintsFromBrief, countDocumentWords, documentProblems, revisionLabel, WORD_LIMIT_LABEL } from './documentCheck';

const FILM = 'Required sections: problem, audience, priorities, and assigned next steps. Constraints: under 400 words.';

describe('countDocumentWords', () => {
  it('counts whitespace-separated spans, including headings', () => {
    expect(countDocumentWords('**Problem**\n\nOne two')).toBe(3);
    expect(countDocumentWords('  a   b  ')).toBe(2);
    expect(countDocumentWords('')).toBe(0);
  });

  it('treats 399 as inside the cap and 400 as over', () => {
    const words = Array.from({ length: 399 }, () => 'word').join(' ');
    expect(countDocumentWords(words)).toBe(399);
    expect(countDocumentWords(`${words} extra`)).toBe(400);
  });
});

describe('constraintsFromBrief', () => {
  it('reads the film brief cap and sections', () => {
    const constraints = constraintsFromBrief(FILM);
    expect(constraints.wordLimit).toBe(399);
    expect(constraints.sections).toBe(true);
  });

  it('does not invent a cap for an unconstrained brief', () => {
    expect(constraintsFromBrief('Write three sentences about a red door.').wordLimit).toBeNull();
  });
});

describe('revisionLabel', () => {
  it('names the word limit when the draft is too long', () => {
    const text = Array.from({ length: 400 }, () => 'word').join(' ');
    const problems = documentProblems(`${text}\n\nProblem audience priorities next steps`, constraintsFromBrief(FILM));
    expect(revisionLabel(problems)).toBe(WORD_LIMIT_LABEL);
  });
});
