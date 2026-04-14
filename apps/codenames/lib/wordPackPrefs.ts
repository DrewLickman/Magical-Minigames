const STORAGE_KEY = "codenames:word-pack-selection:v1";

export function readWordPackSelection(): string[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return null;
    const ids = parsed.filter((x): x is string => typeof x === "string");
    return ids.length ? ids : null;
  } catch {
    return null;
  }
}

export function writeWordPackSelection(enabledPackIds: readonly string[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...enabledPackIds]));
  } catch {
    /* quota / private mode */
  }
}
