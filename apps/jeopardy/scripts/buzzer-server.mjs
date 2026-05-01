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

/** @typedef {{ host?: import('ws').WebSocket, unlocked: boolean, firstBuzz: null | { id: string, name: string, at: number }, buzzers: Map<string, import('ws').WebSocket>, names: Map<string, string>, buzzQueue: Array<{ id: string, name: string, at: number }> }} Room */

/** @type {Map<string, Room>} */
const rooms = new Map();

function getRoom(roomId) {
  let r = rooms.get(roomId);
  if (!r) {
    r = {
      host: undefined,
      unlocked: false,
      firstBuzz: null,
      buzzers: new Map(),
      names: new Map(),
      buzzQueue: [],
    };
    rooms.set(roomId, r);
  }
  return r;
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

      room.buzzers.set(buzzerId, ws);
      room.names.set(buzzerId, displayName);
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
      }
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
    }
    if (role === "buzzer" && buzzerId) {
      room.buzzers.delete(buzzerId);
      room.names.delete(buzzerId);
      announceHostState(room);
    }
  });
});
