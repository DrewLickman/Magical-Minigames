const STORAGE_VERSION = 1;
const STORAGE_PREFIX = "spyfall:lobby:";
/** Legacy localStorage prefix; read-only for migration from older builds. */
const LEGACY_STORAGE_PREFIX = "imposter:lobby:";

type SpyfallLobbyState = {
  v: number;
  notes: string;
};

function keyForLobby(lobby: string): string {
  return `${STORAGE_PREFIX}${lobby}`;
}

function legacyKeyForLobby(lobby: string): string {
  return `${LEGACY_STORAGE_PREFIX}${lobby}`;
}

function parseStored(raw: string): SpyfallLobbyState | null {
  try {
    const parsed = JSON.parse(raw) as Partial<SpyfallLobbyState>;
    if (parsed.v !== STORAGE_VERSION) return null;
    if (typeof parsed.notes !== "string") return null;
    return {
      v: STORAGE_VERSION,
      notes: parsed.notes,
    };
  } catch {
    return null;
  }
}

export function readSpyfallState(lobby: string): SpyfallLobbyState | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(keyForLobby(lobby));
  if (raw) {
    const parsed = parseStored(raw);
    if (parsed) return parsed;
  }
  const legacyRaw = window.localStorage.getItem(legacyKeyForLobby(lobby));
  if (!legacyRaw) return null;
  return parseStored(legacyRaw);
}

export function writeSpyfallState(lobby: string, notes: string): void {
  if (typeof window === "undefined") return;
  const payload: SpyfallLobbyState = {
    v: STORAGE_VERSION,
    notes,
  };
  window.localStorage.setItem(keyForLobby(lobby), JSON.stringify(payload));
}
