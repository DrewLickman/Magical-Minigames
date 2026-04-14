export const PLAYER_PROFILE_STORAGE_KEY = "minigames:player-profile:v1";

export type PlayerProfile = {
  displayName: string;
  playerNumber: string;
};

export function defaultPlayerProfile(): PlayerProfile {
  return { displayName: "", playerNumber: "" };
}

export function readPlayerProfile(): PlayerProfile | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(PLAYER_PROFILE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PlayerProfile>;
    return {
      displayName:
        typeof parsed.displayName === "string" ? parsed.displayName : "",
      playerNumber:
        typeof parsed.playerNumber === "string" ? parsed.playerNumber : "",
    };
  } catch {
    return null;
  }
}

export function writePlayerProfile(profile: PlayerProfile): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    PLAYER_PROFILE_STORAGE_KEY,
    JSON.stringify(profile),
  );
}
