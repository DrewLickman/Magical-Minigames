"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { readPlayerProfile } from "@minigames/shared";
import {
  effectiveBuzzerWsUrl,
  getEnvBuzzerWsOverride,
  parseBuzzerPort,
} from "@/lib/buzzerWsUrl";
import { normalizeRoomCode } from "@/lib/roomCode";
import { SignaturePad, type SignaturePadHandle } from "./SignaturePad";

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
  const [score, setScore] = useState(0);
  const [highlight, setHighlight] = useState(false);
  const [hasSignatureInk, setHasSignatureInk] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);
  const signaturePadRef = useRef<SignaturePadHandle | null>(null);

  const [fjCategory, setFjCategory] = useState<string | null>(null);
  const [fjMaxWager, setFjMaxWager] = useState(0);
  const [fjWagerDraft, setFjWagerDraft] = useState("");
  const [fjWagerConfirm, setFjWagerConfirm] = useState(false);
  const [fjWagerSubmitted, setFjWagerSubmitted] = useState(false);
  const [fjQuestionText, setFjQuestionText] = useState<string | null>(null);
  const [fjAnswerEndsAt, setFjAnswerEndsAt] = useState<number | null>(null);
  const [fjAnswerDraft, setFjAnswerDraft] = useState("");
  const [fjAnswerConfirm, setFjAnswerConfirm] = useState(false);
  const [fjAnswerSubmitted, setFjAnswerSubmitted] = useState(false);
  const [fjPhaseEnded, setFjPhaseEnded] = useState(false);
  const [fjSecondsLeft, setFjSecondsLeft] = useState<number | null>(null);
  const fjAutoSubmitDoneRef = useRef(false);

  const wsRef = useRef<WebSocket | null>(null);

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
    hasSignatureInk &&
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
    setFjCategory(null);
    setFjMaxWager(0);
    setFjWagerDraft("");
    setFjWagerConfirm(false);
    setFjWagerSubmitted(false);
    setFjQuestionText(null);
    setFjAnswerEndsAt(null);
    setFjAnswerDraft("");
    setFjAnswerConfirm(false);
    setFjAnswerSubmitted(false);
    setFjPhaseEnded(false);
    setFjSecondsLeft(null);
    fjAutoSubmitDoneRef.current = false;
  }, []);

  const connect = useCallback(() => {
    disconnect();
    setConnectError(null);
    const r = normalizeRoomCode(room);
    const url = resolvedWsUrl;
    if (!r || !url.startsWith("ws")) return;

    const sig = signaturePadRef.current?.getPngBase64();
    if (!sig) {
      setConnectError("Draw your signature before connecting.");
      return;
    }

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
          signaturePngBase64: sig,
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

      if (msg.type === "error") {
        const m =
          typeof msg.message === "string" ? msg.message : "Connection refused";
        setConnectError(m);
        try {
          ws.close();
        } catch {
          /* ignore */
        }
        setConnected(false);
        if (wsRef.current === ws) wsRef.current = null;
        return;
      }

      if (msg.type === "helloAck") {
        const pid = msg.playerId;
        if (typeof pid === "string" && pid) {
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

      if (msg.type === "yourScore") {
        const s = msg.score;
        if (typeof s === "number" && Number.isFinite(s)) {
          setScore(Math.trunc(s));
        }
      }

      if (msg.type === "finalJeopardyWagerPrompt") {
        const cat = typeof msg.category === "string" ? msg.category : "";
        const maxW =
          typeof msg.maxWager === "number" && Number.isFinite(msg.maxWager)
            ? Math.max(0, Math.trunc(msg.maxWager))
            : 0;
        setFjCategory(cat);
        setFjMaxWager(maxW);
        setFjWagerDraft("");
        setFjWagerConfirm(false);
        setFjWagerSubmitted(false);
        setFjQuestionText(null);
        setFjAnswerEndsAt(null);
        setFjAnswerDraft("");
        setFjAnswerConfirm(false);
        setFjAnswerSubmitted(false);
        setFjPhaseEnded(false);
        setFjSecondsLeft(null);
        fjAutoSubmitDoneRef.current = false;
      }

      if (msg.type === "finalJeopardyQuestion") {
        const q = typeof msg.question === "string" ? msg.question : "";
        const end =
          typeof msg.answerEndsAt === "number" && Number.isFinite(msg.answerEndsAt)
            ? Math.trunc(msg.answerEndsAt)
            : 0;
        setFjQuestionText(q);
        setFjAnswerEndsAt(end);
        setFjAnswerDraft("");
        setFjAnswerConfirm(false);
        setFjAnswerSubmitted(false);
        setFjPhaseEnded(false);
        fjAutoSubmitDoneRef.current = false;
      }

      if (msg.type === "finalJeopardyAnswerPhaseEnded") {
        setFjPhaseEnded(true);
      }
    };
  }, [disconnect, displayName, resolvedWsUrl, room, wsHost, wsPort]);

  useEffect(() => {
    if (fjAnswerEndsAt == null || fjAnswerSubmitted || fjPhaseEnded) {
      setFjSecondsLeft(null);
      return;
    }
    const tick = () => {
      const left = Math.max(0, Math.ceil((fjAnswerEndsAt - Date.now()) / 1000));
      setFjSecondsLeft(left);
    };
    tick();
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
  }, [fjAnswerEndsAt, fjAnswerSubmitted, fjPhaseEnded]);

  useEffect(() => {
    if (
      fjAnswerEndsAt == null ||
      fjAnswerSubmitted ||
      fjPhaseEnded ||
      fjAutoSubmitDoneRef.current
    ) {
      return;
    }
    const ms = Math.max(0, fjAnswerEndsAt - Date.now());
    const id = window.setTimeout(() => {
      if (fjAutoSubmitDoneRef.current) return;
      const ws = wsRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN) return;
      fjAutoSubmitDoneRef.current = true;
      ws.send(
        JSON.stringify({
          type: "finalJeopardyAnswer",
          text: fjAnswerDraft,
        }),
      );
      setFjAnswerSubmitted(true);
    }, ms);
    return () => window.clearTimeout(id);
  }, [
    fjAnswerDraft,
    fjAnswerEndsAt,
    fjAnswerSubmitted,
    fjPhaseEnded,
  ]);

  const submitFjWager = () => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN || !fjWagerConfirm) return;
    const n = Number.parseInt(fjWagerDraft.trim(), 10);
    const wager = Number.isFinite(n)
      ? Math.min(Math.max(0, n), fjMaxWager)
      : 0;
    ws.send(JSON.stringify({ type: "finalJeopardyWager", wager }));
    setFjWagerSubmitted(true);
  };

  const submitFjAnswer = () => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN || !fjAnswerConfirm) return;
    if (fjAutoSubmitDoneRef.current) return;
    fjAutoSubmitDoneRef.current = true;
    ws.send(
      JSON.stringify({ type: "finalJeopardyAnswer", text: fjAnswerDraft }),
    );
    setFjAnswerSubmitted(true);
  };

  useEffect(() => () => disconnect(), [disconnect]);

  const buzz = () => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({ type: "buzz" }));
    setHighlight(true);
    window.setTimeout(() => setHighlight(false), 180);
  };

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
    const inFinalJeopardy =
      fjCategory !== null ||
      fjQuestionText !== null ||
      fjWagerSubmitted ||
      fjPhaseEnded;

    if (inFinalJeopardy) {
      return (
        <div className="mx-auto flex min-h-0 w-full max-w-md flex-1 flex-col gap-3 px-3 py-2">
          <div className="flex shrink-0 items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2">
            <p className="truncate text-sm font-medium text-[var(--foreground)]">
              {displayName.trim()}
            </p>
            <p className="font-mono text-sm font-semibold text-[var(--foreground)]">
              ${score}
            </p>
          </div>
          <p className="text-center text-xs font-semibold uppercase tracking-wide text-[var(--accent)]">
            Final Jeopardy
          </p>

          {fjQuestionText === null && !fjWagerSubmitted ? (
            <div className="flex min-h-0 flex-1 flex-col gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
              <p className="text-center text-sm font-semibold text-[var(--foreground)]">
                {fjCategory}
              </p>
              <p className="text-center text-xs text-[var(--muted)]">
                Enter your wager (whole dollars, $0–${fjMaxWager}).
              </p>
              <label className="block space-y-1">
                <span className="text-xs text-[var(--muted)]">Wager</span>
                <input
                  type="number"
                  min={0}
                  max={fjMaxWager}
                  inputMode="numeric"
                  value={fjWagerDraft}
                  onChange={(e) => setFjWagerDraft(e.target.value)}
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 font-mono text-[var(--foreground)] outline-none ring-[var(--accent)] focus:ring-2"
                />
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-sm text-[var(--foreground)]">
                <input
                  type="checkbox"
                  checked={fjWagerConfirm}
                  onChange={(e) => setFjWagerConfirm(e.target.checked)}
                  className="h-4 w-4 shrink-0 accent-[var(--accent)]"
                />
                I confirm this wager.
              </label>
              <button
                type="button"
                disabled={!fjWagerConfirm}
                onClick={submitFjWager}
                className="rounded-lg bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-[var(--accent-foreground)] disabled:opacity-40"
              >
                Submit wager
              </button>
            </div>
          ) : null}

          {fjQuestionText === null && fjWagerSubmitted ? (
            <p className="text-center text-sm text-[var(--muted)]">
              Wager locked. Waiting for the host to reveal the clue…
            </p>
          ) : null}

          {fjQuestionText !== null && !fjAnswerSubmitted ? (
            <div className="flex min-h-0 flex-1 flex-col gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
              <p className="text-center text-2xl font-semibold leading-snug text-[var(--foreground)]">
                {fjQuestionText}
              </p>
              <p
                className={`text-center font-mono text-lg font-bold ${
                  fjSecondsLeft !== null && fjSecondsLeft <= 10
                    ? "text-[var(--danger)]"
                    : "text-[var(--foreground)]"
                }`}
              >
                {fjSecondsLeft != null ? `${fjSecondsLeft}s` : "—"}
              </p>
              <label className="block min-h-0 flex-1 space-y-1">
                <span className="text-xs text-[var(--muted)]">Your response</span>
                <textarea
                  value={fjAnswerDraft}
                  onChange={(e) => setFjAnswerDraft(e.target.value)}
                  rows={4}
                  className="w-full resize-y rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-[var(--foreground)] outline-none ring-[var(--accent)] focus:ring-2"
                />
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-sm text-[var(--foreground)]">
                <input
                  type="checkbox"
                  checked={fjAnswerConfirm}
                  onChange={(e) => setFjAnswerConfirm(e.target.checked)}
                  className="h-4 w-4 shrink-0 accent-[var(--accent)]"
                />
                I confirm this is my final response.
              </label>
              <button
                type="button"
                disabled={!fjAnswerConfirm}
                onClick={submitFjAnswer}
                className="rounded-lg bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-[var(--accent-foreground)] disabled:opacity-40"
              >
                Submit response
              </button>
            </div>
          ) : null}

          {fjAnswerSubmitted ? (
            <p className="text-center text-sm text-[var(--muted)]">
              Response submitted. Waiting for the host…
            </p>
          ) : null}

          {fjPhaseEnded && fjAnswerSubmitted ? (
            <p className="text-center text-sm text-[var(--muted)]">
              Answer period ended.
            </p>
          ) : null}
        </div>
      );
    }

    return (
      <div className="mx-auto flex min-h-0 w-full max-w-md flex-1 flex-col gap-2 px-3 py-2">
        <div className="flex shrink-0 items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2">
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
          className={`flex min-h-0 flex-1 items-center justify-center text-center touch-manipulation select-none rounded-2xl border-4 font-black leading-none transition [-webkit-tap-highlight-color:transparent] [touch-action:manipulation] [font-size:clamp(1.5rem,9vmin,3rem)] ${
            highlight
              ? "scale-[0.98] border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-foreground)]"
              : roundOpen
                ? "border-[var(--accent)] bg-[var(--surface)] text-[var(--foreground)] active:scale-[0.99]"
                : "cursor-not-allowed border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] opacity-60"
          }`}
        >
          BUZZ
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-md flex-1 flex-col gap-2 overflow-hidden px-3 py-2">
      <header className="shrink-0 space-y-1 text-center">
        <h1 className="text-lg font-semibold leading-tight text-[var(--foreground)]">
          Buzzer
        </h1>
        <p className="text-[0.7rem] leading-snug text-[var(--muted)] sm:text-xs">
          {fullInvite
            ? "Name, sign below, then Ready."
            : "Same Wi‑Fi as host. Server settings in ▾ if needed. Sign, then Ready."}
        </p>
      </header>

      {fullInvite ? (
        <div className="shrink-0 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-center">
          <p className="text-[0.65rem] text-[var(--muted)]">Room</p>
          <p className="font-mono text-base font-semibold leading-tight text-[var(--foreground)]">
            {room.trim() || "—"}
          </p>
        </div>
      ) : (
        <label className="block shrink-0 space-y-0.5">
          <span className="text-[0.65rem] font-semibold uppercase tracking-wide text-[var(--muted)]">
            Room code
          </span>
          <input
            value={room}
            onChange={(e) => setRoom(normalizeRoomCode(e.target.value))}
            className="w-full select-text rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 font-mono text-sm text-[var(--foreground)] outline-none ring-[var(--accent)] focus:ring-2"
            autoComplete="off"
          />
        </label>
      )}

      <label className="block shrink-0 space-y-0.5">
        <span className="text-[0.65rem] font-semibold uppercase tracking-wide text-[var(--muted)]">
          Your name
        </span>
        <input
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="Name"
          className="w-full select-text rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-sm text-[var(--foreground)] outline-none ring-[var(--accent)] focus:ring-2"
          autoComplete="nickname"
        />
      </label>

      <SignaturePad
        ref={signaturePadRef}
        onInkChange={setHasSignatureInk}
        className="min-h-0 w-full min-w-0"
      />

      {connectError ? (
        <p className="shrink-0 rounded-lg border border-[var(--danger)] bg-[var(--surface)] px-2 py-1.5 text-center text-[0.7rem] text-[var(--danger)] sm:text-xs">
          {connectError}
        </p>
      ) : null}

      {envOverride ? (
        <p className="shrink-0 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-[0.65rem] text-[var(--muted)] sm:text-xs">
          Server address is set by the host app configuration.
        </p>
      ) : null}

      {!fullInvite && !envOverride ? (
        <details className="shrink-0 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5">
          <summary className="cursor-pointer select-none text-[0.65rem] font-medium text-[var(--foreground)] sm:text-xs">
            Buzzer server (no invite link?)
          </summary>
          <div className="mt-2 space-y-2 border-t border-[var(--border)] pt-2">
            <label className="block space-y-0.5">
              <span className="text-[0.6rem] font-semibold uppercase tracking-wide text-[var(--muted)]">
                Server IP / hostname
              </span>
              <input
                value={wsHost}
                onChange={(e) => setWsHost(e.target.value)}
                placeholder="192.168.x.x"
                className="w-full select-text rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 py-1 font-mono text-xs text-[var(--foreground)] outline-none ring-[var(--accent)] focus:ring-2"
                autoComplete="off"
              />
            </label>
            <label className="block space-y-0.5">
              <span className="text-[0.6rem] font-semibold uppercase tracking-wide text-[var(--muted)]">
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
                className="w-full select-text rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 py-1 font-mono text-xs text-[var(--foreground)] outline-none ring-[var(--accent)] focus:ring-2"
              />
            </label>
            {showLocalhostHint ? (
              <p className="text-[0.65rem] leading-snug text-[var(--accent)]">
                Page is on {pageHost}. Use invite with{" "}
                <code className="font-mono">host=…</code> or LAN IP above.
              </p>
            ) : null}
          </div>
        </details>
      ) : null}

      <button
        type="button"
        disabled={!canConnect}
        onClick={connect}
        className="shrink-0 touch-manipulation rounded-lg bg-[var(--accent)] px-3 py-2 text-sm font-semibold text-[var(--accent-foreground)] [-webkit-tap-highlight-color:transparent] disabled:opacity-40"
      >
        Ready
      </button>

    </div>
  );
}
