/** Shapes from the TypeSafe System One API. Noul has no confidence field. */

export type JsonText = string | Record<string, unknown> | unknown[];

export interface NoulQuestion {
  type: 'noul';
  instructions: JsonText;
  criteria?: { true?: JsonText; false?: JsonText };
}

export interface ChoiceQuestion {
  type: 'choice';
  instructions: JsonText;
  criteria: Record<string, JsonText | null>;
}

export interface ScoreQuestion {
  type: 'score';
  instructions: JsonText;
  criteria: JsonText[];
}

export type Question = NoulQuestion | ChoiceQuestion | ScoreQuestion;

export interface NoulAnswer {
  type: 'noul';
  noul: number;
}

export interface ChoiceAnswer {
  type: 'choice';
  choice: string;
  probabilities: Record<string, number>;
  confidence: number;
}

export interface ScoreAnswer {
  type: 'score';
  score: number;
  legend: Record<string, string>;
  probabilities: Record<string, number>;
  confidence: number;
}

/** Local marker. Jev never returns this. A failed call must not look like a yes. */
export interface UncertainAnswer {
  type: 'uncertain';
}

export type Answer = NoulAnswer | ChoiceAnswer | ScoreAnswer | UncertainAnswer;

export interface Thresholds {
  noulYes?: number;
  noulNo?: number;
  confidence?: number;
}

export type PolicyOutcome = 'proceed' | 'fallback' | 'ask_boss';

export interface TokenUsage {
  input_tokens: number;
  output_tokens: number;
}
