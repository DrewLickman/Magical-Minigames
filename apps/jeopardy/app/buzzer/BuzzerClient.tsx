"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { readPlayerProfile } from "@minigames/shared";
import {
  effectiveBuzzerWsUrl,
  getEnvBuzzerWsOverride,
  parseBuzzerPort,
} from "@/lib/buzzerWsUrl";
import { normalizeRoomCode } from "@/lib/roomCode";

const PLAYER_STORAGE_KEY = "magical_jeopardy_buzzer_player_v1";
const REMEMBER_KEY = "magical_jeopardy_buzzer_remember_v1";

type Remembered = { wsHost: string; wsPort: number };

function loadRemembered(): Remembered | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(REMEMBER_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Remembered;
    if (typeof p.wsHost !== "string" || typeof p.wsPort !== "number")
      return null;
    return { wsHost: p.wsHost, wsPort: p.wsPort };
  } catch {
    return null;
  }
}

function saveRemembered(r: Remembered) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(REMEMBER_KEY, JSON.stringify(r));
  } catch {
    /* ignore */
  }
}

function loadStoredPlayerId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(PLAYER_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { playerId?: string };
    return typeof parsed.playerId === "string" ? parsed.playerId : null;
  } catch {
    return null;
  }
}

function saveStoredPlayerId(playerId: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      PLAYER_STORAGE_KEY,
      JSON.stringify({ playerId }),
    );
  } catch {
    /* ignore */
  }
}

export function BuzzerClient() {
  const params = useSearchParams();
  const roomFromQuery = normalizeRoomCode(params.get("room")?.trim() ?? "");
  const hostFromQuery = params.get("host")?.trim() ?? "";
  const portFromQuery = params.get("port");

  const [room, setRoom] = useState(() => normalizeRoomCode(roomFromQuery));
  const [displayName, setDisplayName] = useState("");
  const [wsHost, setWsHost] = useState("");
  const [wsPort, setWsPort] = useState(8787);
  const [connected, setConnected] = useState(false);
  const [roundOpen, setRoundOpen] = useState(false);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [highlight, setHighlight] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const autoJoinAttemptedRef = useRef(false);

  const resolvedWsUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    if (getEnvBuzzerWsOverride()) return getEnvBuzzerWsOverride()!;
    return effectiveBuzzerWsUrl({
      pageIsSecure: window.location.protocol === "https:",
      lanHost: wsHost.trim() || window.location.hostname,
      port: wsPort,
    });
  }, [wsHost, wsPort]);

  const fullInvite = useMemo(() => {
    const roomOk = roomFromQuery.trim().length > 0;
    const hostOk = hostFromQuery.trim().length > 0;
    if (typeof window === "undefined") return roomOk && hostOk;
    return (
      roomOk &&
      (hostOk || Boolean(getEnvBuzzerWsOverride()))
    );
  }, [roomFromQuery, hostFromQuery]);

  useEffect(() => {
    queueMicrotask(() => {
      const profile = readPlayerProfile();
      const initial = profile?.displayName?.trim() ?? "";
      setDisplayName(initial);

      const remembered = loadRemembered();
      const portParsed = parseBuzzerPort(portFromQuery);

      if (roomFromQuery) setRoom(normalizeRoomCode(roomFromQuery));
      if (hostFromQuery) {
        setWsHost(hostFromQuery);
      } else if (remembered?.wsHost) {
        setWsHost(remembered.wsHost);
      }

      if (portFromQuery?.trim()) {
        setWsPort(portParsed);
      } else if (remembered?.wsPort) {
        setWsPort(remembered.wsPort);
      } else {
        setWsPort(portParsed);
      }
    });
  }, [roomFromQuery, hostFromQuery, portFromQuery]);

  const canConnect =
    normalizeRoomCode(room).length > 0 &&
    displayName.trim().length > 0 &&
    resolvedWsUrl.trim().startsWith("ws");

  const disconnect = useCallback(() => {
    try {
      wsRef.current?.close();
    } catch {
      /* ignore */
    }
    wsRef.current = null;
    setConnected(false);
    setRoundOpen(false);
    setScore(0);
  }, []);

  const connect = useCallback(() => {
    disconnect();
    const r = normalizeRoomCode(room);
    const url = resolvedWsUrl;
    if (!r || !url.startsWith("ws")) return;

    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      if (!getEnvBuzzerWsOverride()) {
        saveRemembered({
          wsHost: wsHost.trim() || window.location.hostname,
          wsPort,
        });
      }
      const pid = loadStoredPlayerId();
      ws.send(
        JSON.stringify({
          type: "hello",
          role: "buzzer",
          room: r,
          name: displayName.trim(),
          ...(pid ? { playerId: pid } : {}),
        }),
      );
    };

    ws.onclose = () => {
      setConnected(false);
      if (wsRef.current === ws) wsRef.current = null;
    };

    ws.onerror = () => {
      setConnected(false);
    };

    ws.onmessage = (ev) => {
      let msg: Record<string, unknown>;
      try {
        msg = JSON.parse(String(ev.data)) as Record<string, unknown>;
      } catch {
        return;
      }

      if (msg.type === "helloAck") {
        const pid = msg.playerId;
        if (typeof pid === "string" && pid) {
          setPlayerId(pid);
          saveStoredPlayerId(pid);
        }
      }

      if (msg.type === "roundOpen") {
        setRoundOpen(true);
      }

      if (msg.type === "roundLocked") {
        setRoundOpen(false);
      }

      if (msg.type === "state") {
        setRoundOpen(Boolean(msg.unlocked));
      }
    };
  }, [disconnect, displayName, resolvedWsUrl, room, wsHost, wsPort]);

  useEffect(() => {
    if (!fullInvite || autoJoinAttemptedRef.current || connected) return;
    if (!room.trim() || !resolvedWsUrl.startsWith("ws")) return;
    if (!displayName.trim()) return;
    autoJoinAttemptedRef.current = true;
    queueMicrotask(() => connect());
  }, [fullInvite, connected, room, resolvedWsUrl, displayName, connect]);

  useEffect(() => () => disconnect(), [disconnect]);

  const buzz = () => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({ type: "buzz" }));
    setHighlight(true);
    window.setTimeout(() => setHighlight(false), 180);
  };

  const retryConnection = useCallback(() => {
    disconnect();
    queueMicrotask(() => connect());
  }, [connect, disconnect]);

  const hostHref = useMemo(() => "/host", []);

  const envOverride =
    typeof window !== "undefined" ? Boolean(getEnvBuzzerWsOverride()) : false;
  const pageHost =
    typeof window !== "undefined" ? window.location.hostname : "";
  const showLocalhostHint =
    !fullInvite &&
    !envOverride &&
    (pageHost === "localhost" || pageHost === "127.0.0.1") &&
    !wsHost.trim();

  if (connected) {
    return (
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col gap-3 px-4 py-4">
        <div className="flex items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2">
          <p className="truncate text-sm font-medium text-[var(--foreground)]">
            {displayName.trim()}
          </p>
          <p className="font-mono text-sm font-semibold text-[var(--foreground)]">
            ${score}
          </p>
        </div>
        <button
          type="button"
          disabled={!roundOpen}
          onClick={buzz}
          className={`min-h-[8rem] flex-1 rounded-2xl border-4 text-3xl font-black transition sm:text-4xl ${
            highlight
              ? "scale-95 border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-foreground)]"
              : roundOpen
                ? "border-[var(--accent)] bg-[var(--surface)] text-[var(--foreground)] active:scale-[0.98]"
                : "cursor-not-allowed border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] opacity-60"
          }`}
        >
          BUZZ
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col gap-6 px-4 py-10">
      <header className="space-y-2 text-center">
        <h1 className="text-xl font-semibold text-[var(--foreground)]">
          Buzzer
        </h1>
        <p className="text-sm text-[var(--muted)]">
          {fullInvite
            ? "You are using the host invite. Add your name, then Join."
            : "Same Wi-Fi as the host. Set the server below (or open the full invite link), then Join."}
        </p>
        <Link
          href={hostHref}
          className="text-sm text-[var(--accent)] underline"
        >
          Wrong room? Host setup
        </Link>
      </header>

      {fullInvite ? (
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-center">
          <p className="text-xs text-[var(--muted)]">Room</p>
          <p className="font-mono text-lg font-semibold text-[var(--foreground)]">
            {room.trim() || "—"}
          </p>
        </div>
      ) : (
        <label className="block space-y-1">
          <span className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
            Room code
          </span>
          <input
            value={room}
            onChange={(e) => setRoom(normalizeRoomCode(e.target.value))}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 font-mono text-[var(--foreground)] outline-none ring-[var(--accent)] focus:ring-2"
            autoComplete="off"
          />
        </label>
      )}

      <label className="block space-y-1">
        <span className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
          Your name
        </span>
        <input
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="Name"
          className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[var(--foreground)] outline-none ring-[var(--accent)] focus:ring-2"
          autoComplete="nickname"
        />
      </label>

      {envOverride ? (
        <p className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs text-[var(--muted)]">
          Server address is set by the host app configuration.
        </p>
      ) : null}

      {!fullInvite && !envOverride ? (
        <details className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2">
          <summary className="cursor-pointer text-xs font-medium text-[var(--foreground)]">
            Set buzzer server (use this if you don’t have the full invite link)
          </summary>
          <div className="mt-3 space-y-3 border-t border-[var(--border)] pt-3">
            <label className="block space-y-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                Server IP or hostname
              </span>
              <input
                value={wsHost}
                onChange={(e) => setWsHost(e.target.value)}
                placeholder="192.168.x.x"
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 font-mono text-sm text-[var(--foreground)] outline-none ring-[var(--accent)] focus:ring-2"
                autoComplete="off"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                Port
              </span>
              <input
                type="number"
                min={1}
                max={65535}
                value={wsPort}
                onChange={(e) =>
                  setWsPort(parseBuzzerPort(e.target.value || "8787"))
                }
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 font-mono text-sm text-[var(--foreground)] outline-none ring-[var(--accent)] focus:ring-2"
              />
            </label>
            {showLocalhostHint ? (
              <p className="text-xs text-[var(--accent)]">
                This page is on {pageHost}. Ask the host for the full invite link
                (it includes <code className="font-mono">host=…</code>) or enter
                the laptop&apos;s Wi‑Fi IP above.
              </p>
            ) : null}
          </div>
        </details>
      ) : null}

      <button
        type="button"
        disabled={!canConnect || connected}
        onClick={connect}
        className="w-full rounded-lg bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-[var(--accent-foreground)] disabled:opacity-40"
      >
        Join
      </button>
      {!displayName.trim() ? (
        <p className="text-center text-xs text-[var(--muted)]">
          Enter a name to enable Join.
        </p>
      ) : null}

      <p className="text-center text-xs text-[var(--muted)]">
      {connected ? null : (
        <>
          <span className="text-[var(--danger)]">Not connected</span>
        </>
      )}
        {!connected && canConnect ? (
          <>
            {" "}
            <button
              type="button"
              onClick={retryConnection}
              className="text-[var(--accent)] underline"
            >
              Tap to retry
            </button>
          </>
        ) : null}
      </p>

      <p className="pb-8 text-center text-xs text-[var(--muted)]">
        Connect after the host starts the game.
      </p>
    </div>
  );
}
