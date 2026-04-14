import {
  WORD_PACK_DEFINITIONS,
  getDefaultEnabledPackIds,
  getRequiredPackIds,
} from "./definitions";
import { WORDS_BY_PACK_ID } from "./wordsByPack";

export const MIN_WORD_POOL_SIZE = 25;

const VALID_PACK_IDS = new Set(
  WORD_PACK_DEFINITIONS.map((definition) => definition.id),
);

/** Build the `packs` query value (comma-separated, stable definition order). */
export function formatPacksQuery(enabledPackIds: readonly string[]): string {
  return enabledPackIds.join(",");
}

/** Parse the `packs` URL query segment (comma-separated ids). */
export function parsePacksQuery(param: string | null): string[] | null {
  if (param === null) return null;
  const trimmed = param.trim();
  if (!trimmed) return null;
  const parts = trimmed
    .split(",")
    .map((segment) => segment.trim().toLowerCase())
    .filter(Boolean);
  return parts.length ? parts : null;
}

/**
 * Normalize enabled pack ids: drop unknowns, always include required packs,
 * preserve canonical order from {@link WORD_PACK_DEFINITIONS}.
 */
export function resolveEnabledPackIds(
  fromUrl: string[] | null,
  fromStorage: string[] | null,
): string[] {
  const required = new Set(getRequiredPackIds());
  const raw = fromUrl ?? fromStorage ?? getDefaultEnabledPackIds();

  const requested = new Set<string>();
  for (const id of raw) {
    if (VALID_PACK_IDS.has(id)) requested.add(id);
  }
  for (const id of required) requested.add(id);

  return WORD_PACK_DEFINITIONS.filter((definition) =>
    requested.has(definition.id),
  ).map((definition) => definition.id);
}

/**
 * Merge words from enabled packs in definition order. First occurrence wins
 * when the same word appears in multiple packs (case-insensitive).
 */
export function mergeEnabledWordPacks(enabledPackIds: readonly string[]): string[] {
  const enabledSet = new Set(enabledPackIds);
  const orderedIds = WORD_PACK_DEFINITIONS.filter((definition) =>
    enabledSet.has(definition.id),
  ).map((definition) => definition.id);

  const seenWords = new Set<string>();
  const merged: string[] = [];

  for (const id of orderedIds) {
    const words = WORDS_BY_PACK_ID[id];
    if (!words) continue;
    for (const word of words) {
      const key = word.trim().toLowerCase();
      if (!key || seenWords.has(key)) continue;
      seenWords.add(key);
      merged.push(key);
    }
  }

  return merged;
}

export function buildWordPoolForEnabledPacks(
  enabledPackIds: readonly string[],
): string[] {
  const pool = mergeEnabledWordPacks(enabledPackIds);
  if (pool.length < MIN_WORD_POOL_SIZE) {
    throw new Error(
      `Word pool is too small (${pool.length}). Need at least ${MIN_WORD_POOL_SIZE}. Enable more packs or restore defaults.`,
    );
  }
  return pool;
}
