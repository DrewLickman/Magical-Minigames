import classicWords from "../standard-words.json";
import { WORD_PACK_DEFINITIONS } from "./definitions";
import animals from "./packs/animals.json";
import foodDrink from "./packs/food-drink.json";
import geographyTravel from "./packs/geography-travel.json";
import musicMedia from "./packs/music-media.json";
import natureOutdoors from "./packs/nature-outdoors.json";
import popCulture from "./packs/pop-culture.json";
import sciFiFantasy from "./packs/sci-fi-fantasy.json";
import sportsGames from "./packs/sports-games.json";
import stemDeep from "./packs/stem-deep.json";

export const WORDS_BY_PACK_ID: Readonly<Record<string, readonly string[]>> = {
  classic: classicWords,
  "nature-outdoors": natureOutdoors,
  "food-drink": foodDrink,
  animals,
  "sports-games": sportsGames,
  "geography-travel": geographyTravel,
  "stem-deep": stemDeep,
  "sci-fi-fantasy": sciFiFantasy,
  "pop-culture": popCulture,
  "music-media": musicMedia,
};

function assertPackWordsValid() {
  for (const def of WORD_PACK_DEFINITIONS) {
    const words = WORDS_BY_PACK_ID[def.id];
    if (!words) {
      throw new Error(`word-packs: missing word list for pack "${def.id}"`);
    }
    const lower = words.map((w) => w.trim().toLowerCase());
    const set = new Set(lower);
    if (set.size !== words.length) {
      throw new Error(`word-packs: duplicate word inside pack "${def.id}"`);
    }
    for (const w of words) {
      if (w.trim() !== w || w !== w.toLowerCase() || w.includes(" ")) {
        throw new Error(
          `word-packs: word "${w}" in "${def.id}" must be lowercase single-token`,
        );
      }
    }
  }
}

assertPackWordsValid();
