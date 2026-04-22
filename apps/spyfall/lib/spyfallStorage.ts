const STORAGE_VERSION = 1;
const STORAGE_PREFIX = "imposter:lobby:";

type ImposterLobbyState = {
  v: number;
  notes: string;
};

function keyForLobby(lobby: string): string {
  return `${STORAGE_PREFIX}${lobby}`;
}

export function readImposterState(lobby: string): ImposterLobbyState | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(keyForLobby(lobby));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<ImposterLobbyState>;
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

export function writeImposterState(lobby: string, notes: string): void {
  if (typeof window === "undefined") return;
  const payload: ImposterLobbyState = {
    v: STORAGE_VERSION,
    notes,
  };
  window.localStorage.setItem(keyForLobby(lobby), JSON.stringify(payload));
}
