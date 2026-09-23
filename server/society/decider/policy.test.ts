import { describe, expect, it } from 'vitest';
import { policyFor } from './policy';
import { Question } from './types';

const noul: Question = { type: 'noul', instructions: 'Is this acceptable?' };
const choice: Question = {
  type: 'choice',
  instructions: 'Which route?',
  criteria: { accept: 'use it', retry: 'try again' },
};
const score: Question = { type: 'score', instructions: 'Strength', criteria: ['Weak', 'Strong'] };

describe('decision policy', () => {
  it('treats noul at the boundaries as yes or no, and the middle as ask_boss', () => {
    expect(policyFor(noul, { type: 'noul', noul: 0.9 })).toBe('proceed');
    expect(policyFor(noul, { type: 'noul', noul: 0.1 })).toBe('fallback');
    expect(policyFor(noul, { type: 'noul', noul: 0.5 })).toBe('ask_boss');
  });

  it('proceeds on choice and score only when confidence is at least 0.8', () => {
    expect(policyFor(choice, {
      type: 'choice',
      choice: 'accept',
      probabilities: { accept: 0.9, retry: 0.1 },
      confidence: 0.8,
    })).toBe('proceed');
    expect(policyFor(score, {
      type: 'score',
      score: 1,
      legend: { '0': 'Weak', '1': 'Strong' },
      probabilities: { '0': 0.2, '1': 0.8 },
      confidence: 0.79,
    })).toBe('ask_boss');
  });

  it('routes a failed call to fallback and never to yes', () => {
    expect(policyFor(noul, { type: 'uncertain' })).toBe('fallback');
  });

  it('accepts per-question thresholds', () => {
    expect(policyFor(noul, { type: 'noul', noul: 0.95 }, { noulYes: 0.99 })).toBe('ask_boss');
  });
});
