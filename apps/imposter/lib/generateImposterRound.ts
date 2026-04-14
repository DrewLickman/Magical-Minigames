import { IMPOSTER_WORD_POOL } from "./imposterWordPool";
import { mulberry32, stringToSeed } from "./seededRandom";

export type ImposterRoundParams = {
  lobbySeed: string;
  players: number;
  imposters: number;
  playerSeat: number;
};

export type ImposterRoundView = {
  confirmationWord: string;
  secretWord: string;
};

function shuffleInPlace<T>(items: T[], rand: () => number) {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const tmp = items[i];
    items[i] = items[j]!;
    items[j] = tmp!;
  }
}

function pickDistinctWords(
  pool: readonly string[],
  count: number,
  rand: () => number,
): string[] {
  if (pool.length < count) {
    throw new Error(`Word pool too small: need ${count}, have ${pool.length}`);
  }
  const copy = [...pool];
  shuffleInPlace(copy, rand);
  return copy.slice(0, count);
}

function pickImposterSeats(
  players: number,
  imposters: number,
  rand: () => number,
): Set<number> {
  const seats = Array.from({ length: players }, (_, i) => i + 1);
  shuffleInPlace(seats, rand);
  return new Set(seats.slice(0, imposters));
}

export function generateImposterRound(
  params: ImposterRoundParams,
): ImposterRoundView {
  const { lobbySeed, players, imposters, playerSeat } = params;
  const roundKey = `${lobbySeed}|p=${players}|i=${imposters}`;
  const rand = mulberry32(stringToSeed(roundKey));

  const [confirmationWord, innocentSecret, imposterSecret] = pickDistinctWords(
    IMPOSTER_WORD_POOL,
    3,
    rand,
  );

  const imposterSeats = pickImposterSeats(players, imposters, rand);
  // All imposter seats share the same fake word (not one draw per imposter).
  const secretWord = imposterSeats.has(playerSeat)
    ? imposterSecret
    : innocentSecret;

  return {
    confirmationWord,
    secretWord,
  };
}
