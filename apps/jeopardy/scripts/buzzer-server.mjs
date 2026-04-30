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
  const inviteLink = lanIp
    ? `http://${lanIp}:${HOST_APP_PORT}${BASE_PATH}/buzzer`
    : null;
  console.log(
    `Jeopardy buzzer WebSocket server listening on ws://0.0.0.0:${PORT}`,
  );
  if (inviteLink) {
    console.log(`Share this link with the contestants: ${inviteLink}`);
    console.log(`Open host screen: http://${lanIp}:${HOST_APP_PORT}${BASE_PATH}/host`);
    console.log(
      `Room-ready invite template: ${inviteLink}?room=<ROOMCODE>&host=${lanIp}&port=${PORT}`,
    );
  } else {
    console.log(
      `Share this link with the contestants: http://<your-lan-ip>:${HOST_APP_PORT}${BASE_PATH}/buzzer`,
    );
    console.log(
      `Open host screen: http://<your-lan-ip>:${HOST_APP_PORT}${BASE_PATH}/host`,
    );
    console.log(
      `Room-ready invite template: http://<your-lan-ip>:${HOST_APP_PORT}${BASE_PATH}/buzzer?room=<ROOMCODE>&host=<your-lan-ip>&port=${PORT}`,
    );
    console.log(
      "Could not detect LAN IP automatically. Use your Wi-Fi IP from ipconfig.",
    );
  }
  console.log(
    "Contestants join with this link, then enter the room code shown on the host screen.",
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
        // #region agent log
        fetch('http://127.0.0.1:7622/ingest/1302b181-d6d7-4b6e-bbe5-61c8fc200112',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'4a45cf'},body:JSON.stringify({sessionId:'4a45cf',runId:'run1',hypothesisId:'H4',location:'buzzer-server.mjs:hello-invalid',message:'Rejected hello missing room or role',data:{room:msg.room,role:msg.role},timestamp:Date.now()})}).catch(()=>{});
        // #endregion
        safeSend(ws, { type: "error", message: "hello requires room and role" });
        ws.close();
        return;
      }

      const room = getRoom(roomId);
      // #region agent log
      fetch('http://127.0.0.1:7622/ingest/1302b181-d6d7-4b6e-bbe5-61c8fc200112',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'4a45cf'},body:JSON.stringify({sessionId:'4a45cf',runId:'run1',hypothesisId:'H2',location:'buzzer-server.mjs:hello-accepted',message:'Accepted hello',data:{roomId,role,buzzerCount:room.buzzers.size,hasHost:Boolean(room.host)},timestamp:Date.now()})}).catch(()=>{});
      // #endregion

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
