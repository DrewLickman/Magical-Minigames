import { IMPOSTER_CATEGORIES, type ImposterCategory } from "./imposterCategories";
import { mulberry32, stringToSeed } from "./seededRandom";

export type ImposterRoundParams = {
  lobbySeed: string;
  players: number;
  imposters: number;
  playerSeat: number;
};

export type ImposterRoundView = {
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

function pickCategory(rand: () => number): ImposterCategory {
  const categories = [...IMPOSTER_CATEGORIES];
  shuffleInPlace(categories, rand);
  return categories[0]!;
}

/**
 * Pick two different secret words from the same category (crew vs imposters).
 */
function pickCrewAndImposterSecrets(
  category: ImposterCategory,
  rand: () => number,
): { innocentSecret: string; imposterSecret: string } {
  if (category.words.length < 2) {
    throw new Error(
      `Category "${category.id}" needs at least two words for crew vs imposter.`,
    );
  }
  const words = [...category.words];
  shuffleInPlace(words, rand);
  return {
    innocentSecret: words[0]!,
    imposterSecret: words[1]!,
  };
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

  const category = pickCategory(rand);
  const { innocentSecret, imposterSecret } = pickCrewAndImposterSecrets(
    category,
    rand,
  );

  const imposterSeats = pickImposterSeats(players, imposters, rand);
  // All imposter seats share the same fake word (not one draw per imposter).
  const secretWord = imposterSeats.has(playerSeat)
    ? imposterSecret
    : innocentSecret;

  return {
    categoryLabel: category.label,
    secretWord,
  };
}
