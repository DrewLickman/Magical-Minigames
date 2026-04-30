import type { BoardModel } from "./boardJson";

const STORAGE_PREFIX = "magical_jeopardy_host_v1";

export type Contestant = {
  id: string;
  name: string;
  score: number;
};

export type PersistedHostState = {
  contestants: Contestant[];
  boardJson: string | null;
};

function key(part: string): string {
  return `${STORAGE_PREFIX}:${part}`;
}

export function loadPersistedHostState(): PersistedHostState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key("state"));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    const contestants = (parsed as PersistedHostState).contestants;
    const boardJson = (parsed as PersistedHostState).boardJson;
    if (!Array.isArray(contestants)) return null;
    const normalized: Contestant[] = contestants.map((c) => {
      const row = c as Contestant;
      return {
        id: typeof row.id === "string" ? row.id : crypto.randomUUID(),
        name: typeof row.name === "string" ? row.name : "",
        score: typeof row.score === "number" && Number.isFinite(row.score) ? row.score : 0,
      };
    });
    return {
      contestants: normalized,
      boardJson: typeof boardJson === "string" ? boardJson : null,
    };
  } catch {
    return null;
  }
}

export function savePersistedHostState(state: PersistedHostState): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key("state"), JSON.stringify(state));
  } catch {
    /* ignore quota */
  }
}

export function createContestant(name: string): Contestant {
  return {
    id: crypto.randomUUID(),
    name,
    score: 0,
  };
}

export type BuzzerRoomPersist = {
  roomCode: string;
};

export type BuzzerConnectionPrefs = {
  roomCode: string;
  lanHost: string;
  buzzerPort: number;
};

const BUZZER_CONN_KEY = "buzzer_connection";

function parseConnectionPrefs(raw: string): BuzzerConnectionPrefs | null {
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (!parsed || typeof parsed !== "object") return null;
    const roomCode =
      typeof parsed.roomCode === "string" ? parsed.roomCode : "";
    const lanHost = typeof parsed.lanHost === "string" ? parsed.lanHost : "";
    const buzzerPort =
      typeof parsed.buzzerPort === "number" &&
      Number.isFinite(parsed.buzzerPort)
        ? parsed.buzzerPort
        : 8787;
    return { roomCode, lanHost, buzzerPort };
  } catch {
    return null;
  }
}

export function loadBuzzerConnectionPrefs(): BuzzerConnectionPrefs | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key(BUZZER_CONN_KEY));
    if (raw) {
      const p = parseConnectionPrefs(raw);
      if (p) return p;
    }
    const legacy = window.localStorage.getItem(key("buzzer_room"));
    if (legacy) {
      const old = JSON.parse(legacy) as BuzzerRoomPersist;
      if (typeof old.roomCode === "string") {
        return {
          roomCode: old.roomCode,
          lanHost: "",
          buzzerPort: 8787,
        };
      }
    }
  } catch {
    return null;
  }
  return null;
}

export function saveBuzzerConnectionPrefs(prefs: BuzzerConnectionPrefs): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key(BUZZER_CONN_KEY), JSON.stringify(prefs));
  } catch {
    /* ignore */
  }
}

/** @deprecated Prefer loadBuzzerConnectionPrefs */
export function loadBuzzerRoom(): string | null {
  return loadBuzzerConnectionPrefs()?.roomCode ?? null;
}

/** @deprecated Prefer saveBuzzerConnectionPrefs with full prefs */
export function saveBuzzerRoom(roomCode: string): void {
  const prev = loadBuzzerConnectionPrefs();
  saveBuzzerConnectionPrefs({
    roomCode,
    lanHost: prev?.lanHost ?? "",
    buzzerPort: prev?.buzzerPort ?? 8787,
  });
}

/** Serialize board for persistence (categories order preserved in JSON). */
export function boardToImportJson(board: BoardModel): string {
  const obj: Record<
    string,
    Record<string, { question: string; answer: string }>
  > = {};
  const points = ["100", "200", "300", "400", "500"] as const;
  for (let col = 0; col < board.categories.length; col++) {
    const cat = board.categories[col];
    const colObj: Record<string, { question: string; answer: string }> = {};
    for (let row = 0; row < 5; row++) {
      const clue = board.clues[col][row];
      colObj[points[row]] = {
        question: clue.question,
        answer: clue.answer,
      };
    }
    obj[cat] = colObj;
  }
  return `${JSON.stringify(obj, null, 2)}\n`;
}
