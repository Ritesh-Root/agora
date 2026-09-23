import { Answer, ChoiceQuestion, JsonText, Question, TokenUsage } from './types';

export const JEV_DEFAULTS = {
  baseUrl: 'https://api.typesafe.ai',
  model: 'jev-1.13.0',
  timeoutMs: 1500,
} as const;

export interface JevClientOptions {
  baseUrl?: string;
  model?: string;
  timeoutMs?: number;
  apiKey?: string;
  fetchImpl?: typeof fetch;
}

export interface JevCall {
  pinnedModel: string;
  returnedModel: string | null;
  answers: Record<string, Answer>;
  usage: TokenUsage | null;
  latencyMs: number;
  error?: string;
}

function uncertainFor(questions: Record<string, Question>): Record<string, Answer> {
  return Object.fromEntries(Object.keys(questions).map((key) => [key, { type: 'uncertain' as const }]));
}

function unit(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;
}

function probabilityMap(value: unknown): Record<string, number> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length === 0) return null;
  const probabilities: Record<string, number> = {};
  for (const [key, probability] of entries) {
    if (typeof probability !== 'number' || !Number.isFinite(probability)) return null;
    probabilities[key] = probability;
  }
  return probabilities;
}

function parseNoul(raw: Record<string, unknown>): Answer | null {
  if (raw.type !== 'noul' || !unit(raw.noul)) return null;
  return { type: 'noul', noul: raw.noul };
}

function parseChoice(question: ChoiceQuestion, raw: Record<string, unknown>): Answer | null {
  const probabilities = probabilityMap(raw.probabilities);
  if (
    raw.type !== 'choice'
    || typeof raw.choice !== 'string'
    || !(raw.choice in question.criteria)
    || !probabilities
    || !unit(raw.confidence)
  ) return null;
  return { type: 'choice', choice: raw.choice, probabilities, confidence: raw.confidence };
}

function parseScore(raw: Record<string, unknown>): Answer | null {
  const probabilities = probabilityMap(raw.probabilities);
  if (
    raw.type !== 'score'
    || typeof raw.score !== 'number'
    || !Number.isFinite(raw.score)
    || !raw.legend
    || typeof raw.legend !== 'object'
    || Array.isArray(raw.legend)
    || !probabilities
    || !unit(raw.confidence)
  ) return null;
  const legend: Record<string, string> = {};
  for (const [key, label] of Object.entries(raw.legend as Record<string, unknown>)) {
    if (typeof label !== 'string') return null;
    legend[key] = label;
  }
  return { type: 'score', score: raw.score, legend, probabilities, confidence: raw.confidence };
}

export function parseAnswer(question: Question, raw: unknown): Answer {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { type: 'uncertain' };
  const row = raw as Record<string, unknown>;
  const parsed = question.type === 'noul'
    ? parseNoul(row)
    : question.type === 'choice'
      ? parseChoice(question, row)
      : parseScore(row);
  return parsed ?? { type: 'uncertain' };
}

export function parseSystemOneBody(
  body: unknown,
  questions: Record<string, Question>,
): Pick<JevCall, 'returnedModel' | 'answers' | 'usage'> {
  const empty = {
    returnedModel: null as string | null,
    answers: uncertainFor(questions),
    usage: null as TokenUsage | null,
  };
  if (!body || typeof body !== 'object' || Array.isArray(body)) return empty;
  const record = body as Record<string, unknown>;
  const answersRaw = record.answers;
  if (!answersRaw || typeof answersRaw !== 'object' || Array.isArray(answersRaw)) return empty;

  const answers: Record<string, Answer> = {};
  for (const [key, question] of Object.entries(questions)) {
    answers[key] = parseAnswer(question, (answersRaw as Record<string, unknown>)[key]);
  }

  const usageRaw = record.usage;
  const usage = usageRaw && typeof usageRaw === 'object' && !Array.isArray(usageRaw)
    ? usageRaw as Record<string, unknown>
    : null;

  return {
    returnedModel: typeof record.model === 'string' ? record.model : null,
    answers,
    usage: usage && typeof usage.input_tokens === 'number' && typeof usage.output_tokens === 'number'
      ? { input_tokens: usage.input_tokens, output_tokens: usage.output_tokens }
      : null,
  };
}

function resolvedOptions(options?: JevClientOptions) {
  const baseUrl = (options?.baseUrl ?? process.env.TYPESAFE_BASE_URL ?? JEV_DEFAULTS.baseUrl).replace(/\/$/, '');
  return {
    url: `${baseUrl}/v1/systemone`,
    model: options?.model ?? process.env.JEV_MODEL ?? JEV_DEFAULTS.model,
    timeoutMs: options?.timeoutMs ?? JEV_DEFAULTS.timeoutMs,
    apiKey: options?.apiKey ?? process.env.TYPESAFE_API_KEY?.trim() ?? process.env.JEV_API_KEY?.trim() ?? '',
    fetchImpl: options?.fetchImpl ?? fetch,
  };
}

function failedCall(questions: Record<string, Question>, pinnedModel: string, started: number, error?: string): JevCall {
  return {
    pinnedModel,
    returnedModel: null,
    answers: uncertainFor(questions),
    usage: null,
    latencyMs: Date.now() - started,
    error,
  };
}

export async function callJev(
  state: JsonText,
  questions: Record<string, Question>,
  options?: JevClientOptions,
): Promise<JevCall> {
  const started = Date.now();
  const { url, model, timeoutMs, apiKey, fetchImpl } = resolvedOptions(options);
  if (!apiKey) return failedCall(questions, model, started, 'missing api key');

  const body = JSON.stringify({ model, state, questions });
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const response = await fetchImpl(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body,
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (response.status >= 500 && response.status <= 599) {
        if (attempt === 1) continue;
        return failedCall(questions, model, started, `http ${response.status}`);
      }
      if (!response.ok) return failedCall(questions, model, started, `http ${response.status}`);
      const parsed = parseSystemOneBody(JSON.parse(await response.text()) as unknown, questions);
      return { pinnedModel: model, latencyMs: Date.now() - started, ...parsed };
    } catch (error) {
      const message = error instanceof Error ? error.name : 'network';
      if (error instanceof SyntaxError) return failedCall(questions, model, started, 'malformed json');
      if (attempt === 1) continue;
      return failedCall(questions, model, started, message);
    }
  }
  return failedCall(questions, model, started, 'failed');
}
