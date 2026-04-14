export function normalizeLobbySeed(raw: string): string {
  return raw.trim().toUpperCase();
}

export function safeDecodeParam(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

export function readEntryQuery(search: string): {
  lobby: string;
  name: string;
  hadQuery: boolean;
} {
  const params = new URLSearchParams(search);
  const lobbyRaw = params.get("lobby");
  const nameRaw = params.get("name");
  const lobby = lobbyRaw ? normalizeLobbySeed(safeDecodeParam(lobbyRaw)) : "";
  const name = nameRaw ? safeDecodeParam(nameRaw).trim() : "";
  return {
    lobby,
    name,
    hadQuery: Boolean(lobbyRaw || nameRaw),
  };
}

export function buildGamePath(lobby: string): string {
  return `/game/${encodeURIComponent(normalizeLobbySeed(lobby))}`;
}
