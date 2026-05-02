export type FinalJeopardyClue = {
  category: string;
  question: string;
  answer: string;
};

export type FinalJeopardyParseResult =
  | { ok: true; clue: FinalJeopardyClue }
  | { ok: false; error: string };

export function parseFinalJeopardyJsonText(text: string): FinalJeopardyParseResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text) as unknown;
  } catch {
    return { ok: false, error: "Invalid JSON." };
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, error: "Root must be a JSON object." };
  }
  const o = raw as Record<string, unknown>;
  const category = o.category;
  const question = o.question;
  const answer = o.answer;
  if (typeof category !== "string" || !category.trim()) {
    return { ok: false, error: "Missing or invalid category." };
  }
  if (typeof question !== "string" || !question.trim()) {
    return { ok: false, error: "Missing or invalid question." };
  }
  if (typeof answer !== "string" || !answer.trim()) {
    return { ok: false, error: "Missing or invalid answer." };
  }
  return {
    ok: true,
    clue: {
      category: category.trim(),
      question: question.trim(),
      answer: answer.trim(),
    },
  };
}
