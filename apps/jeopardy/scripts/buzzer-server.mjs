import { WebSocketServer } from "ws";

const PORT = process.env.JEOPARDY_BUZZER_PORT
  ? Number(process.env.JEOPARDY_BUZZER_PORT)
  : 8787;

/** @typedef {{ host?: import('ws').WebSocket, unlocked: boolean, firstBuzz: null | { id: string, name: string, at: number }, buzzers: Map<string, import('ws').WebSocket>, names: Map<string, string> }} Room */

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

`,
    );
  } else {
    console.error("Jeopardy buzzer server error:", err);
  }
  process.exit(1);
});

wss.on("listening", () => {
  console.log(
    `Jeopardy buzzer WebSocket server listening on ws://0.0.0.0:${PORT}`,
  );
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
        broadcastBuzzers(room, { type: "roundOpen" });
        announceHostState(room);
      } else if (msg.type === "lock") {
        room.unlocked = false;
        broadcastBuzzers(room, { type: "roundLocked" });
        announceHostState(room);
      } else if (msg.type === "resetRound") {
        room.firstBuzz = null;
        room.unlocked = false;
        broadcastBuzzers(room, { type: "roundLocked" });
        announceHostState(room);
      }
      return;
    }

    if (role === "buzzer" && msg.type === "buzz") {
      if (!room.unlocked || room.firstBuzz) {
        safeSend(ws, { type: "reject", reason: "locked" });
        return;
      }
      const name = room.names.get(buzzerId) ?? "Player";
      room.firstBuzz = { id: buzzerId, name, at: Date.now() };
      room.unlocked = false;
      broadcastBuzzers(room, { type: "roundLocked" });
      if (room.host) {
        safeSend(room.host, {
          type: "firstBuzz",
          playerId: buzzerId,
          name,
          at: room.firstBuzz.at,
        });
        announceHostState(room);
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
    }
  });
});
