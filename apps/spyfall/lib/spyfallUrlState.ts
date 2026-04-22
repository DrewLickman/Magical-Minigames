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

export type BuildGamePathOptions = {
  player: number;
  players: number;
  spies: number;
};

/** Lobby entry path with pre-filled code (used when leaving the game). */
export function buildHomePathWithLobby(lobby: string): string {
  const normalized = normalizeLobbySeed(lobby);
  return `/?lobby=${encodeURIComponent(normalized)}`;
}

export function buildGamePath(
  lobby: string,
  options?: BuildGamePathOptions,
): string {
  const normalized = normalizeLobbySeed(lobby);
  const path = `/game/${encodeURIComponent(normalized)}`;
  if (!options) return path;
  const query = new URLSearchParams({
    player: String(options.player),
    players: String(options.players),
    spies: String(options.spies),
  });
  return `${path}?${query.toString()}`;
}
