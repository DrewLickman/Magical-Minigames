import { networkInterfaces } from "node:os";
import { WebSocketServer } from "ws";

const PORT = process.env.JEOPARDY_BUZZER_PORT
  ? Number(process.env.JEOPARDY_BUZZER_PORT)
  : 8787;
const HOST_APP_PORT = 3003;
const BASE_PATH =
  (process.env.NEXT_PUBLIC_BASE_PATH?.trim() || "/jeopardy").replace(
    /\/$/,
    "",
  ) || "";

function isPrivateIpv4(ip) {
  return (
    ip.startsWith("10.") ||
    ip.startsWith("192.168.") ||
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(ip)
  );
}

function detectLanIpv4() {
  const interfaces = networkInterfaces();
  const candidates = [];
  for (const addrs of Object.values(interfaces)) {
    if (!addrs) continue;
    for (const addr of addrs) {
      if (
        addr.family === "IPv4" &&
        !addr.internal &&
        typeof addr.address === "string"
      ) {
        candidates.push(addr.address);
      }
    }
  }
  const privateCandidate = candidates.find((ip) => isPrivateIpv4(ip));
  return privateCandidate ?? candidates[0] ?? null;
}

/** Max base64 length (~150KB PNG) for signaturePngBase64 */
const MAX_SIGNATURE_B64_CHARS = 200_000;

/**
 * @typedef {{
 *   host?: import('ws').WebSocket,
 *   unlocked: boolean,
 *   firstBuzz: null | { id: string, name: string, at: number },
 *   buzzers: Map<string, import('ws').WebSocket>,
 *   names: Map<string, string>,
 *   signatures: Map<string, string>,
 *   buzzQueue: Array<{ id: string, name: string, at: number }>,
 *   fjPhase: "off" | "wager" | "answer" | "closed",
 *   fjCategory: string,
 *   fjQuestion: string,
 *   fjAnswerEndsAt: number,
 *   fjMaxWagerByPlayer: Map<string, number>,
 *   fjWagers: Map<string, number>,
 *   fjAnswers: Map<string, string>,
 * }} Room
 */

/**
 * @param {unknown} raw
 * @returns {string | null}
 */
function normalizeSignaturePngBase64(raw) {
  if (typeof raw !== "string") return null;
  const s = raw.trim().replace(/\s+/g, "");
  if (!s || s.length > MAX_SIGNATURE_B64_CHARS) return null;
  if (!/^[A-Za-z0-9+/]+=*$/.test(s)) return null;
  return s;
}

/** @type {Map<string, Room>} */
const rooms = new Map();

function createFjFields() {
  return {
    fjPhase: /** @type {Room["fjPhase"]} */ ("off"),
    fjCategory: "",
    fjQuestion: "",
    fjAnswerEndsAt: 0,
    fjMaxWagerByPlayer: new Map(),
    fjWagers: new Map(),
    fjAnswers: new Map(),
  };
}

/**
 * @param {Room} r
 */
function ensureFjFields(r) {
  if (!("fjPhase" in r)) {
    Object.assign(r, createFjFields());
  }
}

function getRoom(roomId) {
  let r = rooms.get(roomId);
  if (!r) {
    r = {
      host: undefined,
      unlocked: false,
      firstBuzz: null,
      buzzers: new Map(),
      names: new Map(),
      signatures: new Map(),
      buzzQueue: [],
      ...createFjFields(),
    };
    rooms.set(roomId, r);
  } else {
    ensureFjFields(r);
  }
  return r;
}

/**
 * @param {Room} room
 */
function sendFjStateToBuzzer(room, buzzerId, ws) {
  if (room.fjPhase === "wager") {
    safeSend(ws, {
      type: "finalJeopardyWagerPrompt",
      category: room.fjCategory,
      maxWager: room.fjMaxWagerByPlayer.get(buzzerId) ?? 0,
    });
  } else if (room.fjPhase === "answer") {
    safeSend(ws, {
      type: "finalJeopardyQuestion",
      question: room.fjQuestion,
      answerEndsAt: room.fjAnswerEndsAt,
    });
  } else if (room.fjPhase === "closed") {
    safeSend(ws, { type: "finalJeopardyAnswerPhaseEnded" });
  }
}

function safeSend(ws, obj) {
  if (ws.readyState === 1) ws.send(JSON.stringify(obj));
}

function broadcastBuzzers(room, obj) {
  for (const c of room.buzzers.values()) {
    safeSend(c, obj);
  }
}

function announceHostState(room) {
  if (!room.host) return;
  safeSend(room.host, {
    type: "state",
    unlocked: room.unlocked,
    firstBuzz: room.firstBuzz,
    connectedCount: room.buzzers.size,
    connectedBuzzers: Array.from(room.names.entries()).map(([id, name]) => ({
      id,
      name,
      signatureImage: room.signatures.get(id) ?? undefined,
    })),
  });
}

const wss = new WebSocketServer({ host: "0.0.0.0", port: PORT });

wss.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(
      `Jeopardy buzzer: port ${PORT} is already in use.

  Stop the other process (or another buzzer-server), or use a different port, for example:

    PowerShell:
      $env:JEOPARDY_BUZZER_PORT=8788; npm run buzzer-server --workspace=jeopardy

  Find what is using port ${PORT}:
      netstat -ano | findstr :${PORT}

  Then stop that PID (PowerShell):
      tasklist /FI "PID eq <PID_FROM_NETSTAT>"
      taskkill /PID <PID_FROM_NETSTAT> /F

`,
    );
  } else {
    console.error("Jeopardy buzzer server error:", err);
  }
  process.exit(1);
});

wss.on("listening", () => {
  const lanIp = detectLanIpv4();
  console.log(
    `Jeopardy buzzer WebSocket server listening on ws://0.0.0.0:${PORT}`,
  );
  const hostForLinks = lanIp ?? "<your-lan-ip>";
  const hostUrl = `http://${hostForLinks}:${HOST_APP_PORT}${BASE_PATH}/host`;
  const playerUrl = `http://${hostForLinks}:${HOST_APP_PORT}${BASE_PATH}/buzzer`;
  console.log(`Host URL: ${hostUrl}`);
  console.log(`Player URL: ${playerUrl}`);
  console.log(
    `Invite template: ${playerUrl}?room=<ROOMCODE>&host=${hostForLinks}&port=${PORT}`,
  );
  console.log(
    "Usage: open Host URL on the game machine, then share Player URL or Invite template with players.",
  );
  if (!lanIp) {
    console.log("LAN IP not detected automatically. Replace <your-lan-ip> using ipconfig.");
  }
});

wss.on("connection", (ws) => {
  let roomId = "";
  let role = "";
  let buzzerId = "";

  ws.on("message", (data) => {
    let msg;
    try {
      msg = JSON.parse(data.toString());
    } catch {
      return;
    }
    if (!msg || typeof msg !== "object") return;

    if (msg.type === "hello") {
      roomId =
        typeof msg.room === "string" && msg.room.trim()
          ? msg.room.trim().slice(0, 64)
          : "";
      role =
        msg.role === "host"
          ? "host"
          : msg.role === "buzzer"
            ? "buzzer"
            : "";
      if (!roomId || !role) {
        safeSend(ws, { type: "error", message: "hello requires room and role" });
        ws.close();
        return;
      }

      const room = getRoom(roomId);

      if (role === "host") {
        if (room.host && room.host !== ws) {
          try {
            room.host.close();
          } catch {
            /* ignore */
          }
        }
        room.host = ws;
        safeSend(ws, { type: "helloAck", role: "host", room: roomId });
        announceHostState(room);
        return;
      }

      buzzerId =
        typeof msg.playerId === "string" && msg.playerId.trim()
          ? msg.playerId.trim().slice(0, 128)
          : `bz-${Math.random().toString(36).slice(2)}`;
      const displayName =
        typeof msg.name === "string"
          ? msg.name.trim().slice(0, 48) || "Player"
          : "Player";

      const signaturePng = normalizeSignaturePngBase64(
        msg.signaturePngBase64,
      );
      if (!signaturePng) {
        safeSend(ws, {
          type: "error",
          message:
            "hello requires valid signaturePngBase64 (PNG base64, size limit applies)",
        });
        ws.close();
        return;
      }

      room.buzzers.set(buzzerId, ws);
      room.names.set(buzzerId, displayName);
      room.signatures.set(buzzerId, signaturePng);
      announceHostState(room);

      safeSend(ws, {
        type: "helloAck",
        role: "buzzer",
        room: roomId,
        playerId: buzzerId,
      });
      safeSend(ws, {
        type: "state",
        unlocked: room.unlocked,
      });
      sendFjStateToBuzzer(room, buzzerId, ws);
      return;
    }

    const room = rooms.get(roomId);
    if (!room) return;

    if (role === "host") {
      if (msg.type === "unlock") {
        room.unlocked = true;
        room.firstBuzz = null;
        room.buzzQueue = [];
        broadcastBuzzers(room, { type: "roundOpen" });
        announceHostState(room);
      } else if (msg.type === "lock") {
        room.unlocked = false;
        broadcastBuzzers(room, { type: "roundLocked" });
        announceHostState(room);
      } else if (msg.type === "resetRound") {
        room.firstBuzz = null;
        room.unlocked = false;
        room.buzzQueue = [];
        broadcastBuzzers(room, { type: "roundLocked" });
        announceHostState(room);
      } else if (msg.type === "pushScores") {
        const raw = msg.scores;
        if (!raw || typeof raw !== "object") return;
        for (const [buzzerKey, wsClient] of room.buzzers) {
          const v = raw[buzzerKey];
          const score =
            typeof v === "number" && Number.isFinite(v) ? Math.trunc(v) : null;
          if (score !== null) {
            safeSend(wsClient, { type: "yourScore", score });
          }
        }
      } else if (msg.type === "finalJeopardyStart") {
        const category =
          typeof msg.category === "string" ? msg.category.trim() : "";
        const rawMax = msg.maxWagers;
        if (!category || !rawMax || typeof rawMax !== "object") return;
        room.fjWagers.clear();
        room.fjAnswers.clear();
        room.fjMaxWagerByPlayer.clear();
        for (const [k, v] of Object.entries(rawMax)) {
          if (typeof k !== "string" || !k.trim()) continue;
          const n =
            typeof v === "number" && Number.isFinite(v) ? Math.max(0, Math.trunc(v)) : 0;
          room.fjMaxWagerByPlayer.set(k.trim(), n);
        }
        room.fjCategory = category;
        room.fjQuestion = "";
        room.fjAnswerEndsAt = 0;
        room.fjPhase = "wager";
        for (const [bid, wsClient] of room.buzzers) {
          safeSend(wsClient, {
            type: "finalJeopardyWagerPrompt",
            category: room.fjCategory,
            maxWager: room.fjMaxWagerByPlayer.get(bid) ?? 0,
          });
        }
      } else if (msg.type === "finalJeopardyRevealQuestion") {
        const question =
          typeof msg.question === "string" ? msg.question.trim() : "";
        const answerEndsAt =
          typeof msg.answerEndsAt === "number" && Number.isFinite(msg.answerEndsAt)
            ? Math.trunc(msg.answerEndsAt)
            : 0;
        if (!question || answerEndsAt <= 0) return;
        room.fjQuestion = question;
        room.fjAnswerEndsAt = answerEndsAt;
        room.fjPhase = "answer";
        broadcastBuzzers(room, {
          type: "finalJeopardyQuestion",
          question: room.fjQuestion,
          answerEndsAt: room.fjAnswerEndsAt,
        });
      } else if (msg.type === "finalJeopardyCloseAnswers") {
        room.fjPhase = "closed";
        const wagers = Object.fromEntries(room.fjWagers);
        const answers = Object.fromEntries(room.fjAnswers);
        if (room.host) {
          safeSend(room.host, {
            type: "finalJeopardyGradingBundle",
            wagers,
            answers,
          });
        }
        broadcastBuzzers(room, { type: "finalJeopardyAnswerPhaseEnded" });
      }
      return;
    }

    if (role === "buzzer" && msg.type === "finalJeopardyWager") {
      if (room.fjPhase !== "wager") return;
      const w =
        typeof msg.wager === "number" && Number.isFinite(msg.wager)
          ? Math.trunc(msg.wager)
          : NaN;
      if (!Number.isFinite(w)) return;
      const cap = room.fjMaxWagerByPlayer.get(buzzerId);
      if (cap === undefined) return;
      const wager = Math.min(Math.max(0, w), cap);
      room.fjWagers.set(buzzerId, wager);
      const name = room.names.get(buzzerId) ?? "Player";
      if (room.host) {
        safeSend(room.host, {
          type: "finalJeopardyWagerPlaced",
          playerId: buzzerId,
          name,
        });
      }
      return;
    }

    if (role === "buzzer" && msg.type === "finalJeopardyAnswer") {
      if (room.fjPhase !== "answer") return;
      const text =
        typeof msg.text === "string" ? msg.text.trim().slice(0, 4000) : "";
      room.fjAnswers.set(buzzerId, text);
      return;
    }

    if (role === "buzzer" && msg.type === "buzz") {
      const name = room.names.get(buzzerId) ?? "Player";
      const attempt = { id: buzzerId, name, at: Date.now() };
      if (!room.buzzQueue.some((q) => q.id === buzzerId)) {
        room.buzzQueue.push(attempt);
      }
      if (room.host) {
        safeSend(room.host, {
          type: "buzzQueue",
          playerId: attempt.id,
          name: attempt.name,
          at: attempt.at,
        });
      }
      if (!room.unlocked) {
        safeSend(ws, { type: "reject", reason: "locked" });
        return;
      }
      if (!room.firstBuzz) {
        room.firstBuzz = { id: buzzerId, name, at: Date.now() };
        if (room.host) {
          safeSend(room.host, {
            type: "firstBuzz",
            playerId: buzzerId,
            name,
            at: room.firstBuzz.at,
          });
          announceHostState(room);
        }
      } else if (room.host) {
        safeSend(room.host, {
          type: "buzzQueue",
          playerId: buzzerId,
          name,
          at: attempt.at,
        });
      }
    }
  });

  ws.on("close", () => {
    const room = rooms.get(roomId);
    if (!room) return;
    if (role === "host" && room.host === ws) {
      room.host = undefined;
      ensureFjFields(room);
      room.fjPhase = "off";
      room.fjWagers.clear();
      room.fjAnswers.clear();
      room.fjMaxWagerByPlayer.clear();
      room.fjCategory = "";
      room.fjQuestion = "";
      room.fjAnswerEndsAt = 0;
    }
    if (role === "buzzer" && buzzerId) {
      room.buzzers.delete(buzzerId);
      room.names.delete(buzzerId);
      room.signatures.delete(buzzerId);
      announceHostState(room);
    }
  });
});
