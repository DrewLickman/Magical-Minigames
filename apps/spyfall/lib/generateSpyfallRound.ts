import { SPYFALL_CATEGORIES, type SpyfallCategory } from "./spyfallCategories";
import { mulberry32, stringToSeed } from "./seededRandom";

export type SpyfallRoundParams = {
  lobbySeed: string;
  players: number;
  spies: number;
  playerSeat: number;
};

export type SpyfallRoundView = {
  /** Shared theme name; everyone sees the same label. */
  categoryLabel: string;
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

function pickCategory(rand: () => number): SpyfallCategory {
  const categories = [...SPYFALL_CATEGORIES];
  shuffleInPlace(categories, rand);
  return categories[0]!;
}

/**
 * Pick two different secret words from the same category (crew vs spies).
 */
function pickCrewAndSpySecrets(
  category: SpyfallCategory,
  rand: () => number,
): { crewSecret: string; spySecret: string } {
  if (category.words.length < 2) {
    throw new Error(
      `Category "${category.id}" needs at least two words for crew vs spy.`,
    );
  }
  const words = [...category.words];
  shuffleInPlace(words, rand);
  return {
    crewSecret: words[0]!,
    spySecret: words[1]!,
  };
}

function pickSpySeats(
  players: number,
  spies: number,
  rand: () => number,
): Set<number> {
  const seats = Array.from({ length: players }, (_, i) => i + 1);
  shuffleInPlace(seats, rand);
  return new Set(seats.slice(0, spies));
}

export function generateSpyfallRound(
  params: SpyfallRoundParams,
): SpyfallRoundView {
  const { lobbySeed, players, spies, playerSeat } = params;
  const roundKey = `${lobbySeed}|p=${players}|s=${spies}`;
  const rand = mulberry32(stringToSeed(roundKey));

  const category = pickCategory(rand);
  const { crewSecret, spySecret } = pickCrewAndSpySecrets(category, rand);

  const spySeats = pickSpySeats(players, spies, rand);
  // All spy seats share the same decoy word (not one draw per spy).
  const secretWord = spySeats.has(playerSeat) ? spySecret : crewSecret;

  return {
    categoryLabel: category.label,
    secretWord,
  };
}
