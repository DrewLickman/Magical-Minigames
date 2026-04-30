const ROOM_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const DEFAULT_ROOM_CODE_LENGTH = 6;

export function normalizeRoomCode(raw: string): string {
  const upper = raw.toUpperCase();
  return [...upper].filter((ch) => ROOM_CODE_ALPHABET.includes(ch)).join("");
}

export function randomRoomCode(length = DEFAULT_ROOM_CODE_LENGTH): string {
  let out = "";
  for (let i = 0; i < length; i++) {
    out += ROOM_CODE_ALPHABET[Math.floor(Math.random() * ROOM_CODE_ALPHABET.length)];
  }
  return out;
}
