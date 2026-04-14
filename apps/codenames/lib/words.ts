import standardWords from "./standard-words.json";

/** Baseline list used by the `classic` word pack (see `lib/word-packs/`). */
export const WORDS: readonly string[] = standardWords;

if (new Set(WORDS).size !== WORDS.length) {
  throw new Error("Duplicate words in WORDS");
}
