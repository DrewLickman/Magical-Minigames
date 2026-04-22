export const PLAYER_SEAT_MIN = 1;
export const PLAYER_SEAT_MAX = 6;
export const PLAYERS_MIN = 3;
export const PLAYERS_MAX = 6;
export const SPIES_MIN = 1;
export const SPIES_MAX = 2;

export type RoundSettings = {
  playerSeat: number;
  players: number;
  spies: number;
};

export function isValidRoundSettings(settings: RoundSettings): boolean {
  const { playerSeat, players, spies } = settings;
  if (
    !Number.isInteger(playerSeat) ||
    playerSeat < PLAYER_SEAT_MIN ||
    playerSeat > PLAYER_SEAT_MAX
  ) {
    return false;
  }
  if (
    !Number.isInteger(players) ||
    players < PLAYERS_MIN ||
    players > PLAYERS_MAX
  ) {
    return false;
  }
  if (
    !Number.isInteger(spies) ||
    spies < SPIES_MIN ||
    spies > SPIES_MAX
  ) {
    return false;
  }
  if (players <= spies) return false;
  if (playerSeat > players) return false;
  return true;
}

function parseIntParam(
  raw: string | null,
  min: number,
  max: number,
): number | null {
  if (raw == null || raw === "") return null;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < min || n > max) return null;
  return n;
}

export function parseRoundSettingsFromSearchParams(
  params: URLSearchParams,
): RoundSettings | null {
  const playerSeat = parseIntParam(
    params.get("player"),
    PLAYER_SEAT_MIN,
    PLAYER_SEAT_MAX,
  );
  const players = parseIntParam(
    params.get("players"),
    PLAYERS_MIN,
    PLAYERS_MAX,
  );
  const spiesRaw = params.get("spies") ?? params.get("imposters");
  const spies = parseIntParam(spiesRaw, SPIES_MIN, SPIES_MAX);
  if (playerSeat == null || players == null || spies == null) return null;
  const settings: RoundSettings = { playerSeat, players, spies };
  return isValidRoundSettings(settings) ? settings : null;
}
