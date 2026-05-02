export type ClueCell = {
  question: string;
  answer: string;
};

export type BoardModel = {
  categories: string[];
  /** clues[colIndex][rowIndex] — row 0 = lowest dollar row for this board */
  clues: ClueCell[][];
  /** Five values, low to high, matching JSON keys under each category */
  pointValues: readonly [number, number, number, number, number];
};

export type BoardParseResult =
  | { ok: true; board: BoardModel }
  | { ok: false; error: string };

function numericKeysForColumn(column: Record<string, unknown>): string[] | null {
  const keys = Object.keys(column).filter((k) => /^\d+$/.test(k));
  if (keys.length !== 5) return null;
  keys.sort((a, b) => Number(a) - Number(b));
  return keys;
}

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

  const firstCat = categories[0];
  const firstColumn = (raw as Record<string, unknown>)[firstCat];
  if (!firstColumn || typeof firstColumn !== "object" || Array.isArray(firstColumn)) {
    return { ok: false, error: `Category "${firstCat}" must be an object.` };
  }

  const pointKeys = numericKeysForColumn(firstColumn as Record<string, unknown>);
  if (!pointKeys) {
    return {
      ok: false,
      error: `Category "${firstCat}" must have exactly five numeric dollar keys (e.g. "200" … "1000").`,
    };
  }

  const pointValues = pointKeys.map((k) => Number(k)) as [
    number,
    number,
    number,
    number,
    number,
  ];

  const clues: ClueCell[][] = [];

  for (const category of categories) {
    const column = (raw as Record<string, unknown>)[category];
    if (!column || typeof column !== "object" || Array.isArray(column)) {
      return { ok: false, error: `Category "${category}" must be an object.` };
    }

    const colKeys = numericKeysForColumn(column as Record<string, unknown>);
    if (!colKeys || colKeys.join(",") !== pointKeys.join(",")) {
      return {
        ok: false,
        error: `Category "${category}" must use the same five dollar keys as the first category (${pointKeys.join(", ")}).`,
      };
    }

    const rowCells: ClueCell[] = [];

    for (const pk of pointKeys) {
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
      pointValues,
    },
  };
}
