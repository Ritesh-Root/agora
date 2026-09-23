export interface NotedDecision {
  policy: string;
  latencyMs: number;
  answer: { type: string };
  tokens: { input_tokens: number; output_tokens: number } | null;
}

export interface RunStats {
  decisionCalls: number;
  decisionLatencyMs: number[];
  outcomes: Record<string, number>;
  uncertain: number;
  inputTokens: number;
  outputTokens: number;
  researchCalls: number;
}

let current: RunStats | null = null;

export function beginRunStats(): RunStats {
  current = {
    decisionCalls: 0,
    decisionLatencyMs: [],
    outcomes: {},
    uncertain: 0,
    inputTokens: 0,
    outputTokens: 0,
    researchCalls: 0,
  };
  return current;
}

export function currentRunStats(): RunStats | null {
  return current;
}

export function endRunStats(): void {
  current = null;
}

export function noteResearchCall(): void {
  if (!current) return;
  current.researchCalls += 1;
}

export function noteDecisionCall(records: NotedDecision[], _error?: string): void {
  if (!current || records.length === 0) return;
  current.decisionCalls += 1;
  current.decisionLatencyMs.push(records[0].latencyMs);
  if (records[0].tokens) {
    current.inputTokens += records[0].tokens.input_tokens;
    current.outputTokens += records[0].tokens.output_tokens;
  }
  for (const record of records) {
    current.outcomes[record.policy] = (current.outcomes[record.policy] ?? 0) + 1;
    if (record.answer.type === 'uncertain') current.uncertain += 1;
  }
}
