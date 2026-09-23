import { Answer, PolicyOutcome, Question, Thresholds } from './types';

export const DEFAULT_THRESHOLDS = {
  noulYes: 0.9,
  noulNo: 0.1,
  confidence: 0.8,
} as const;

export function policyFor(
  question: Question,
  answer: Answer,
  thresholds?: Thresholds,
): PolicyOutcome {
  if (answer.type === 'uncertain' || answer.type !== question.type) return 'fallback';

  if (answer.type === 'noul') {
    const yes = thresholds?.noulYes ?? DEFAULT_THRESHOLDS.noulYes;
    const no = thresholds?.noulNo ?? DEFAULT_THRESHOLDS.noulNo;
    if (answer.noul >= yes) return 'proceed';
    if (answer.noul <= no) return 'fallback';
    return 'ask_boss';
  }

  const minimum = thresholds?.confidence ?? DEFAULT_THRESHOLDS.confidence;
  return answer.confidence >= minimum ? 'proceed' : 'ask_boss';
}
