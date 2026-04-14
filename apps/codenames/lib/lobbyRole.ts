export type LobbyRole = "host" | "red_spymaster" | "blue_spymaster";

export const RED_AGENT_GOAL = 9;
export const BLUE_AGENT_GOAL = 8;

export function lobbyRoleStorageKey(normalizedSeed: string) {
  return `codenames-role:${normalizedSeed}`;
}

export function readLobbyRole(normalizedSeed: string): LobbyRole | null {
  if (typeof window === "undefined") return null;
  try {
    const v = localStorage.getItem(lobbyRoleStorageKey(normalizedSeed));
    if (v === "host" || v === "red_spymaster" || v === "blue_spymaster") {
      return v;
    }
  } catch {
    /* private mode */
  }
  return null;
}

export function writeLobbyRole(normalizedSeed: string, role: LobbyRole) {
  localStorage.setItem(lobbyRoleStorageKey(normalizedSeed), role);
}
