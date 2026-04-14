import { mulberry32, stringToSeed } from "./seededRandom";

export type CardType = "red" | "blue" | "neutral" | "assassin";

export type Card = {
  word: string;
  role: CardType;
  revealed: boolean;
};

function shuffleInPlace<T>(items: T[], rand: () => number) {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const tmp = items[i];
    items[i] = items[j]!;
    items[j] = tmp!;
  }
}

function normalizeSeed(seedStr: string) {
  return seedStr.trim().toLowerCase();
}

export function generateBoard(
  seedStr: string,
  wordPool: readonly string[],
): Card[] {
  const normalized = normalizeSeed(seedStr);
  if (!normalized) {
    throw new Error("Seed must contain at least one non-space character.");
  }
  if (wordPool.length < 25) {
    throw new Error(
      `Word pool is too small (${wordPool.length}). Need at least 25.`,
    );
  }

  const seed = stringToSeed(normalized);
  const rand = mulberry32(seed);

  const pool = [...wordPool];
  shuffleInPlace(pool, rand);
  const words = pool.slice(0, 25);

  const roles: CardType[] = [
    ...Array<CardType>(9).fill("red"),
    ...Array<CardType>(8).fill("blue"),
    ...Array<CardType>(7).fill("neutral"),
    "assassin",
  ];
  shuffleInPlace(roles, rand);

  return words.map((word, i) => ({
    word,
    role: roles[i]!,
    revealed: false,
  }));
}

export { normalizeSeed };
