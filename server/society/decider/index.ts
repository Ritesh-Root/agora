import { callJev, JevClientOptions } from './jevClient';
import { policyFor } from './policy';
import { noteDecisionCall } from './runStats';
import { Answer, JsonText, PolicyOutcome, Question, Thresholds, TokenUsage } from './types';

export interface DecisionRecord {
  question: string;
  answer: Answer;
  probabilities: Record<string, number> | null;
  policy: PolicyOutcome;
  latencyMs: number;
  pinnedModel: string;
  returnedModel: string | null;
  tokens: TokenUsage | null;
  error?: string;
}

export interface DecideOptions extends JevClientOptions {
  thresholds?: Record<string, Thresholds>;
  log?: (record: DecisionRecord) => void;
}

function probabilitiesOf(answer: Answer): Record<string, number> | null {
  if (answer.type === 'choice' || answer.type === 'score') return answer.probabilities;
  return null;
}

/**
 * One Jev call for every question at this moment in the run.
 * A failed call returns uncertain, and the policy routes that to fallback.
 */
export async function decide(
  state: JsonText,
  questions: Record<string, Question>,
  options?: DecideOptions,
): Promise<DecisionRecord[]> {
  const call = await callJev(state, questions, options);
  const records = Object.entries(questions).map(([key, question]): DecisionRecord => ({
    question: key,
    answer: call.answers[key] ?? { type: 'uncertain' },
    probabilities: probabilitiesOf(call.answers[key] ?? { type: 'uncertain' }),
    policy: policyFor(question, call.answers[key] ?? { type: 'uncertain' }, options?.thresholds?.[key]),
    latencyMs: call.latencyMs,
    pinnedModel: call.pinnedModel,
    returnedModel: call.returnedModel,
    tokens: call.usage,
    error: call.error,
  }));
  noteDecisionCall(records, call.error);

  const log = options?.log ?? ((record) => console.info('[agora-decider]', JSON.stringify(record)));
  for (const record of records) log(record);
  return records;
}

export { callJev, parseSystemOneBody } from './jevClient';
export { policyFor } from './policy';
export type { Answer, PolicyOutcome, Question, Thresholds } from './types';
