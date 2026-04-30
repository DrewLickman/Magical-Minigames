export type ClueCell = {
  question: string;
  answer: string;
};

export type BoardModel = {
  categories: string[];
  /** clues[colIndex][rowIndex] — row 0 = 100 … row 4 = 500 */
  clues: ClueCell[][];
  pointValues: readonly [100, 200, 300, 400, 500];
};

const POINT_KEYS = ["100", "200", "300", "400", "500"] as const;

export type BoardParseResult =
  | { ok: true; board: BoardModel }
  | { ok: false; error: string };

export function parseBoardJsonText(text: string): BoardParseResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text) as unknown;
  } catch {
    return { ok: false, error: "Invalid JSON." };
  }

  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, error: "Root must be a JSON object." };
  }

  const categories = Object.keys(raw as Record<string, unknown>);
  if (categories.length !== 5) {
    return {
      ok: false,
      error: `Expected exactly 5 category keys; found ${categories.length}.`,
    };
  }

  const clues: ClueCell[][] = [];

  for (const category of categories) {
    const column = (raw as Record<string, unknown>)[category];
    if (!column || typeof column !== "object" || Array.isArray(column)) {
      return { ok: false, error: `Category "${category}" must be an object.` };
    }

    const rowCells: ClueCell[] = [];

    for (const pk of POINT_KEYS) {
      const cell = (column as Record<string, unknown>)[pk];
      if (!cell || typeof cell !== "object" || Array.isArray(cell)) {
        return {
          ok: false,
          error: `Missing or invalid "${pk}" under "${category}".`,
        };
      }
      const question = (cell as Record<string, unknown>).question;
      const answer = (cell as Record<string, unknown>).answer;
      if (typeof question !== "string" || !question.trim()) {
        return {
          ok: false,
          error: `Invalid question for "${category}" / ${pk}.`,
        };
      }
      if (typeof answer !== "string" || !answer.trim()) {
        return {
          ok: false,
          error: `Invalid answer for "${category}" / ${pk}.`,
        };
      }
      rowCells.push({
        question: question.trim(),
        answer: answer.trim(),
      });
    }

    clues.push(rowCells);
  }

  return {
    ok: true,
    board: {
      categories,
      clues,
      pointValues: [100, 200, 300, 400, 500],
    },
  };
}
