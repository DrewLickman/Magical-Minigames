"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { BoardModel } from "@/lib/boardJson";
import { parseBoardJsonText } from "@/lib/boardJson";
import { effectiveBuzzerWsUrl, parseBuzzerPort } from "@/lib/buzzerWsUrl";
import {
  boardToImportJson,
  createContestant,
  loadBuzzerConnectionPrefs,
  loadPersistedHostState,
  saveBuzzerConnectionPrefs,
  savePersistedHostState,
  type Contestant,
} from "@/lib/hostStorage";

type CluePhase = "board" | "question" | "answer";

function randomRoomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 6; i++) {
    s += chars[Math.floor(Math.random() * chars.length)];
  }
  return s;
}

function emptyPlayed(): boolean[][] {
  return Array.from({ length: 5 }, () => Array.from({ length: 5 }, () => false));
}

export function HostGameClient({ templateHref }: { templateHref: string }) {
  const [setupPhase, setSetupPhase] = useState(true);
  const [contestants, setContestants] = useState<Contestant[]>([]);
  const [board, setBoard] = useState<BoardModel | null>(null);
  const [boardError, setBoardError] = useState<string | null>(null);
  const [importHint, setImportHint] = useState<string | null>(null);

  const [cluePhase, setCluePhase] = useState<CluePhase>("board");
  const [selected, setSelected] = useState<{ col: number; row: number } | null>(
    null,
  );
  const [played, setPlayed] = useState<boolean[][]>(() => emptyPlayed());

  const [roomCode, setRoomCode] = useState("");
  const [buzzerLanHost, setBuzzerLanHost] = useState("");
  const [buzzerPort, setBuzzerPort] = useState(8787);
  const [inviteCopied, setInviteCopied] = useState(false);
  const [clientHostname, setClientHostname] = useState("");
  const [buzzerConnected, setBuzzerConnected] = useState(false);
  const [buzzerUnlocked, setBuzzerUnlocked] = useState(false);
  const [firstBuzz, setFirstBuzz] = useState<{
    name: string;
    playerId: string;
    at: number;
  } | null>(null);

  const wsRef = useRef<WebSocket | null>(null);

  const hostWsConnectUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    return effectiveBuzzerWsUrl({
      pageIsSecure: window.location.protocol === "https:",
      lanHost: buzzerLanHost.trim() || window.location.hostname,
      port: buzzerPort,
    });
  }, [buzzerLanHost, buzzerPort]);

  const buzzerInviteRelativeHref = useMemo(() => {
    const hostForPhones =
      typeof window !== "undefined"
        ? buzzerLanHost.trim() || window.location.hostname
        : buzzerLanHost.trim();
    const q = new URLSearchParams();
    q.set("room", roomCode.trim());
    q.set("host", hostForPhones);
    q.set("port", String(buzzerPort));
    return `/buzzer?${q.toString()}`;
  }, [roomCode, buzzerLanHost, buzzerPort]);

  useEffect(() => {
    queueMicrotask(() => {
      const persisted = loadPersistedHostState();
      const buzz = loadBuzzerConnectionPrefs();
      const hn =
        typeof window !== "undefined" ? window.location.hostname : "";
      setRoomCode(
        buzz?.roomCode && buzz.roomCode.trim() ? buzz.roomCode : randomRoomCode(),
      );
      if (buzz && typeof buzz.lanHost === "string") {
        setBuzzerLanHost(buzz.lanHost);
      } else if (hn === "localhost" || hn === "127.0.0.1") {
        setBuzzerLanHost("");
      } else {
        setBuzzerLanHost(hn);
      }
      setBuzzerPort(
        typeof buzz?.buzzerPort === "number" && Number.isFinite(buzz.buzzerPort)
          ? buzz.buzzerPort
          : 8787,
      );
      if (persisted?.contestants?.length) {
        setContestants(persisted.contestants);
      } else {
        setContestants([
          createContestant("Player 1"),
          createContestant("Player 2"),
          createContestant("Player 3"),
        ]);
      }
      if (persisted?.boardJson) {
        const parsed = parseBoardJsonText(persisted.boardJson);
        if (parsed.ok) {
          setBoard(parsed.board);
          setImportHint("Restored board from this browser.");
        }
      }
    });
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      setClientHostname(window.location.hostname);
    });
  }, []);

  useEffect(() => {
    savePersistedHostState({
      contestants,
      boardJson: board ? boardToImportJson(board) : null,
    });
  }, [contestants, board]);

  useEffect(() => {
    saveBuzzerConnectionPrefs({
      roomCode: roomCode.trim(),
      lanHost: buzzerLanHost.trim(),
      buzzerPort,
    });
  }, [roomCode, buzzerLanHost, buzzerPort]);

  const sendHostWs = useCallback((payload: Record<string, unknown>) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(payload));
    }
  }, []);

  useEffect(() => {
    if (setupPhase) {
      if (wsRef.current) {
        try {
          wsRef.current.close();
        } catch {
          /* ignore */
        }
        wsRef.current = null;
      }
      queueMicrotask(() => setBuzzerConnected(false));
      return;
    }

    const url = hostWsConnectUrl.trim();
    if (!url.startsWith("ws://") && !url.startsWith("wss://")) {
      queueMicrotask(() => setBuzzerConnected(false));
      return;
    }

    let cancelled = false;
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      if (cancelled) return;
      setBuzzerConnected(true);
      ws.send(
        JSON.stringify({
          type: "hello",
          role: "host",
          room: roomCode,
        }),
      );
    };

    ws.onclose = () => {
      if (cancelled) return;
      setBuzzerConnected(false);
      if (wsRef.current === ws) wsRef.current = null;
    };

    ws.onerror = () => {
      setBuzzerConnected(false);
    };

    ws.onmessage = (ev) => {
      let msg: Record<string, unknown>;
      try {
        msg = JSON.parse(String(ev.data)) as Record<string, unknown>;
      } catch {
        return;
      }
      if (msg.type === "state") {
        setBuzzerUnlocked(Boolean(msg.unlocked));
        const fb = msg.firstBuzz as
          | { id?: string; name?: string; at?: number }
          | null
          | undefined;
        if (
          fb &&
          typeof fb.name === "string" &&
          typeof fb.id === "string" &&
          typeof fb.at === "number"
        ) {
          setFirstBuzz({ name: fb.name, playerId: fb.id, at: fb.at });
        } else {
          setFirstBuzz(null);
        }
      }
      if (msg.type === "firstBuzz") {
        const name = typeof msg.name === "string" ? msg.name : "Player";
        const playerId =
          typeof msg.playerId === "string" ? msg.playerId : "?";
        const at = typeof msg.at === "number" ? msg.at : Date.now();
        setFirstBuzz({ name, playerId, at });
      }
    };

    return () => {
      cancelled = true;
      try {
        ws.close();
      } catch {
        /* ignore */
      }
      if (wsRef.current === ws) wsRef.current = null;
    };
  }, [setupPhase, hostWsConnectUrl, roomCode]);

  useEffect(() => {
    if (setupPhase) return;
    if (cluePhase === "question") {
      sendHostWs({ type: "unlock" });
    } else if (cluePhase === "answer") {
      sendHostWs({ type: "lock" });
    } else {
      sendHostWs({ type: "resetRound" });
    }
  }, [cluePhase, setupPhase, sendHostWs]);

  const pointForSelected = useMemo(() => {
    if (!board || !selected) return 0;
    return board.pointValues[selected.row];
  }, [board, selected]);

  const beginPlay = () => {
    if (!board) return;
    setSetupPhase(false);
    setCluePhase("board");
    setSelected(null);
    setPlayed(emptyPlayed());
  };

  const importJsonFile = async (file: File) => {
    setBoardError(null);
    const text = await file.text();
    const parsed = parseBoardJsonText(text);
    if (!parsed.ok) {
      setBoardError(parsed.error);
      return;
    }
    setBoard(parsed.board);
    setImportHint(`Loaded “${file.name}”.`);
  };

  const updateContestantName = (id: string, name: string) => {
    setContestants((prev) =>
      prev.map((c) => (c.id === id ? { ...c, name } : c)),
    );
  };

  const addContestant = () => {
    setContestants((prev) => [...prev, createContestant(`Player ${prev.length + 1}`)]);
  };

  const removeContestant = (id: string) => {
    setContestants((prev) => prev.filter((c) => c.id !== id));
  };

  const selectCell = (col: number, row: number) => {
    if (!board || cluePhase !== "board") return;
    if (played[col][row]) return;
    setSelected({ col, row });
    setCluePhase("question");
  };

  const questionLeft = () => {
    sendHostWs({ type: "lock" });
    sendHostWs({ type: "resetRound" });
    setCluePhase("board");
    setSelected(null);
  };

  const questionRight = () => {
    sendHostWs({ type: "lock" });
    setCluePhase("answer");
  };

  const answerLeft = () => {
    sendHostWs({ type: "lock" });
    sendHostWs({ type: "resetRound" });
    setCluePhase("board");
    setSelected(null);
  };

  const consumeWithoutPoints = () => {
    if (!selected) return;
    const { col, row } = selected;
    setPlayed((prev) => {
      const next = prev.map((c) => [...c]);
      next[col][row] = true;
      return next;
    });
    sendHostWs({ type: "resetRound" });
    setCluePhase("board");
    setSelected(null);
  };

  const awardContestant = (contestantId: string) => {
    if (!selected || !board) return;
    const { col, row } = selected;
    const pts = board.pointValues[row];
    setContestants((prev) =>
      prev.map((c) =>
        c.id === contestantId ? { ...c, score: c.score + pts } : c,
      ),
    );
    setPlayed((prev) => {
      const next = prev.map((c) => [...c]);
      next[col][row] = true;
      return next;
    });
    sendHostWs({ type: "resetRound" });
    setCluePhase("board");
    setSelected(null);
  };

  const exportBoardJson = () => {
    if (!board) return;
    const blob = new Blob([boardToImportJson(board)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "jeopardy-board.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const copyBuzzerInvite = useCallback(async () => {
    if (typeof window === "undefined") return;
    const needsWifiIp =
      clientHostname === "localhost" || clientHostname === "127.0.0.1";
    if (needsWifiIp && !buzzerLanHost.trim()) return;
    const basePath =
      process.env.NEXT_PUBLIC_BASE_PATH?.replace(/\/$/, "") || "/jeopardy";
    const hostForPhones =
      buzzerLanHost.trim() || window.location.hostname;
    const q = new URLSearchParams();
    q.set("room", roomCode.trim());
    q.set("host", hostForPhones);
    q.set("port", String(buzzerPort));
    const u = new URL(
      `${basePath}/buzzer?${q.toString()}`,
      window.location.origin,
    );
    try {
      await navigator.clipboard.writeText(u.toString());
      setInviteCopied(true);
      window.setTimeout(() => setInviteCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }, [buzzerLanHost, buzzerPort, clientHostname, roomCode]);

  const regenerateRoomCode = () => {
    setRoomCode(randomRoomCode());
  };

  const onLocalhostBrowser =
    clientHostname === "localhost" || clientHostname === "127.0.0.1";
  const showWifiIpHint = onLocalhostBrowser && !buzzerLanHost.trim();

  if (setupPhase) {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-10">
        <header className="space-y-2">
          <h1 className="text-2xl font-semibold text-[var(--foreground)]">
            Jeopardy host
          </h1>
          <p className="text-sm text-[var(--muted)]">
            Add contestants, import a board JSON (see template), then start the
            game. Project this page once you begin play.
          </p>
        </header>

        <section className="space-y-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
            Players (phones)
          </h2>
          <p className="text-xs text-[var(--muted)]">
            From the repo root run{" "}
            <code className="font-mono text-[var(--foreground)]">
              npm run dev:jeopardy:party
            </code>{" "}
            once (starts the game + buzzer). Then use the button below.
          </p>
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2">
            <span className="text-xs text-[var(--muted)]">Room</span>
            <span className="font-mono text-sm font-semibold text-[var(--foreground)]">
              {roomCode.trim() || "—"}
            </span>
            <button
              type="button"
              onClick={regenerateRoomCode}
              className="text-xs font-medium text-[var(--accent)] underline"
            >
              New code
            </button>
          </div>
          {onLocalhostBrowser ? (
            <>
              <label className="block text-xs text-[var(--muted)]" htmlFor="wifiip">
                Your Wi‑Fi IP (so phones can reach this PC)
              </label>
              <input
                id="wifiip"
                value={buzzerLanHost}
                onChange={(e) => setBuzzerLanHost(e.target.value)}
                placeholder="e.g. 192.168.1.50 (ipconfig on Windows)"
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 font-mono text-sm text-[var(--foreground)] outline-none ring-[var(--accent)] focus:ring-2"
                autoComplete="off"
              />
              {showWifiIpHint ? (
                <p className="text-xs text-[var(--accent)]">
                  You&apos;re on {clientHostname}. Enter this laptop&apos;s LAN
                  IP before copying the link, or open the host page using{" "}
                  <code className="font-mono">http://&lt;that-ip&gt;:3003/…</code>{" "}
                  instead.
                </p>
              ) : null}
            </>
          ) : null}
          <button
            type="button"
            onClick={() => void copyBuzzerInvite()}
            disabled={showWifiIpHint}
            title={
              showWifiIpHint
                ? "Enter your Wi-Fi IP above first"
                : "Copy link to send to players"
            }
            className="w-full rounded-lg bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-[var(--accent-foreground)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {inviteCopied ? "Copied!" : "Copy link for players"}
          </button>
          <Link
            href={buzzerInviteRelativeHref}
            className="block text-center text-xs text-[var(--accent)] underline"
          >
            Open buzzer on this device (test)
          </Link>
          <details className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2">
            <summary className="cursor-pointer text-xs font-medium text-[var(--foreground)]">
              Advanced (port / edit room / troubleshooting)
            </summary>
            <div className="mt-3 space-y-3 border-t border-[var(--border)] pt-3">
              <label className="block text-xs text-[var(--muted)]" htmlFor="room-edit">
                Edit room code
              </label>
              <input
                id="room-edit"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 font-mono text-sm text-[var(--foreground)] outline-none ring-[var(--accent)] focus:ring-2"
                autoComplete="off"
              />
              {onLocalhostBrowser ? null : (
                <>
                  <label
                    className="block text-xs text-[var(--muted)]"
                    htmlFor="lanhost-adv"
                  >
                    Override host in invite link (optional)
                  </label>
                  <input
                    id="lanhost-adv"
                    value={buzzerLanHost}
                    onChange={(e) => setBuzzerLanHost(e.target.value)}
                    placeholder="Leave empty to use this page’s hostname"
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 font-mono text-sm text-[var(--foreground)] outline-none ring-[var(--accent)] focus:ring-2"
                    autoComplete="off"
                  />
                </>
              )}
              <label className="block text-xs text-[var(--muted)]" htmlFor="bzport">
                Buzzer server port
              </label>
              <input
                id="bzport"
                type="number"
                min={1}
                max={65535}
                value={buzzerPort}
                onChange={(e) =>
                  setBuzzerPort(parseBuzzerPort(e.target.value || "8787"))
                }
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 font-mono text-sm text-[var(--foreground)] outline-none ring-[var(--accent)] focus:ring-2"
              />
              <p className="font-mono text-xs text-[var(--muted)]">
                WebSocket for this laptop:{" "}
                <span className="break-all text-[var(--foreground)]">
                  {hostWsConnectUrl || "…"}
                </span>
              </p>
              {process.env.NEXT_PUBLIC_JEOPARDY_BUZZER_WS_URL?.trim() ? (
                <p className="text-xs text-[var(--muted)]">
                  <code className="font-mono text-[var(--foreground)]">
                    NEXT_PUBLIC_JEOPARDY_BUZZER_WS_URL
                  </code>{" "}
                  overrides the WebSocket URL for the host and buzzer clients.
                </p>
              ) : null}
            </div>
          </details>
        </section>

        <section className="space-y-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
              Contestants
            </h2>
            <button
              type="button"
              onClick={addContestant}
              className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--foreground)] hover:bg-[var(--background)]"
            >
              Add
            </button>
          </div>
          <ul className="space-y-2">
            {contestants.map((c) => (
              <li key={c.id} className="flex gap-2">
                <input
                  value={c.name}
                  onChange={(e) => updateContestantName(c.id, e.target.value)}
                  className="min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-[var(--foreground)] outline-none ring-[var(--accent)] focus:ring-2"
                />
                <button
                  type="button"
                  onClick={() => removeContestant(c.id)}
                  disabled={contestants.length <= 1}
                  className="shrink-0 rounded-lg border border-[var(--border)] px-3 py-2 text-xs text-[var(--danger)] disabled:opacity-40"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section className="space-y-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
            Board JSON
          </h2>
          <div className="flex flex-wrap gap-2">
            <label className="inline-flex cursor-pointer items-center rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-[var(--accent-foreground)]">
              Import JSON
              <input
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (f) void importJsonFile(f);
                }}
              />
            </label>
            <a
              href={templateHref}
              download
              className="inline-flex items-center rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--background)]"
            >
              Download template
            </a>
            {board ? (
              <button
                type="button"
                onClick={exportBoardJson}
                className="inline-flex items-center rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--background)]"
              >
                Export current board
              </button>
            ) : null}
          </div>
          {boardError ? (
            <p className="text-sm text-[var(--danger)]">{boardError}</p>
          ) : null}
          {importHint ? (
            <p className="text-sm text-[var(--muted)]">{importHint}</p>
          ) : null}
          {board ? (
            <p className="text-xs text-[var(--muted)]">
              Loaded categories: {board.categories.join(" · ")}
            </p>
          ) : null}
        </section>

        <button
          type="button"
          disabled={!board}
          onClick={beginPlay}
          className="rounded-lg bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-[var(--accent-foreground)] disabled:cursor-not-allowed disabled:opacity-40"
        >
          Start game
        </button>
      </div>
    );
  }

  if (!board) {
    return (
      <p className="p-8 text-[var(--muted)]">
        Missing board. Reload and import JSON.
      </p>
    );
  }

  const clue =
    selected !== null ? board.clues[selected.col][selected.row] : null;

  return (
    <div className="relative flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 flex flex-wrap items-center gap-3 border-b border-[var(--border)] bg-[var(--background)] px-4 py-3">
        <button
          type="button"
          onClick={() => {
            setSetupPhase(true);
            setCluePhase("board");
            setSelected(null);
          }}
          className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--foreground)]"
        >
          Lobby
        </button>
        <div className="flex flex-wrap gap-2">
          {contestants.map((c) => (
            <div
              key={c.id}
              className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs"
            >
              <span className="font-medium text-[var(--foreground)]">
                {c.name.trim() || "Unnamed"}
              </span>
              <span className="ml-2 font-mono text-[var(--muted)]">
                ${c.score}
              </span>
            </div>
          ))}
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2 text-xs text-[var(--muted)]">
          <span>
            Buzzers:{" "}
            <span
              className={
                buzzerConnected
                  ? "text-[var(--success)]"
                  : "text-[var(--danger)]"
              }
            >
              {buzzerConnected ? "WS connected" : "WS offline"}
            </span>
          </span>
          <span className="font-mono text-[var(--foreground)]">
            Room {roomCode}
          </span>
          <span>
            {cluePhase === "question" && buzzerUnlocked
              ? "Listening…"
              : cluePhase === "question"
                ? "Buzzers locked"
                : ""}
          </span>
          {firstBuzz ? (
            <span className="rounded-md bg-[var(--surface)] px-2 py-1 font-medium text-[var(--foreground)]">
              First: {firstBuzz.name}
            </span>
          ) : null}
        </div>
      </header>

      <main className="relative flex flex-1 flex-col px-3 pb-28 pt-4 sm:px-6">
        <div
          className={`mx-auto grid w-full max-w-6xl flex-1 gap-2 transition-opacity duration-300 ${cluePhase !== "board" ? "pointer-events-none opacity-35" : ""}`}
          style={{
            gridTemplateColumns: `repeat(5, minmax(0, 1fr))`,
            gridTemplateRows: `auto repeat(5, minmax(4rem, 1fr))`,
          }}
        >
          {board.categories.map((cat, idx) => (
            <div
              key={`${idx}-${cat}`}
              className="flex items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--accent)] px-2 py-4 text-center text-sm font-bold uppercase tracking-wide text-[var(--accent-foreground)] sm:text-base"
            >
              {cat}
            </div>
          ))}
          {[0, 1, 2, 3, 4].map((row) =>
            [0, 1, 2, 3, 4].map((col) => {
              const isPlayed = played[col][row];
              const label = board.pointValues[row];
              return (
                <button
                  key={`${col}-${row}`}
                  type="button"
                  disabled={cluePhase !== "board" || isPlayed}
                  onClick={() => selectCell(col, row)}
                  className={`relative flex items-center justify-center rounded-lg border border-[var(--border)] text-lg font-bold transition sm:text-2xl ${
                    isPlayed
                      ? "cursor-default bg-[var(--surface)] text-[var(--muted)] opacity-40"
                      : "bg-[var(--surface)] text-[var(--accent)] hover:bg-[var(--background)]"
                  }`}
                >
                  ${label}
                </button>
              );
            }),
          )}
        </div>

        {cluePhase !== "board" && clue ? (
          <>
            <button
              type="button"
              aria-label="Left action"
              className="fixed inset-y-0 bottom-28 left-0 z-20 w-1/2 cursor-w-resize bg-transparent"
              onClick={() =>
                cluePhase === "question" ? questionLeft() : answerLeft()
              }
            />
            <button
              type="button"
              aria-label="Right action"
              className="fixed inset-y-0 bottom-28 right-0 z-20 w-1/2 cursor-e-resize bg-transparent"
              onClick={() =>
                cluePhase === "question" ? questionRight() : consumeWithoutPoints()
              }
            />

            <div className="pointer-events-none fixed inset-x-0 top-16 bottom-28 z-10 flex flex-col items-center justify-center px-6">
              <div
                className={`pointer-events-none max-h-[70vh] w-full max-w-4xl overflow-auto rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-8 shadow-lg transition-transform duration-300 sm:p-12 ${
                  cluePhase === "question" ? "scale-100" : "scale-[1.02]"
                }`}
              >
                <p className="mb-4 text-center text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
                  {cluePhase === "question" ? "Question" : "Answer"} · $
                  {board.pointValues[selected!.row]}
                </p>
                <p className="text-center text-2xl font-semibold leading-snug text-[var(--foreground)] sm:text-4xl">
                  {cluePhase === "question" ? clue.question : clue.answer}
                </p>
              </div>
              <p className="pointer-events-none mt-6 max-w-xl text-center text-sm text-[var(--muted)]">
                {cluePhase === "question"
                  ? "Left: back to board · Right: show answer"
                  : "Left: back without consuming · Right: consume clue (no points)"}
              </p>
            </div>

            {cluePhase === "answer" ? (
              <footer className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--border)] bg-[var(--background)] px-3 py-3">
                <p className="mb-2 text-center text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                  Award ${pointForSelected} · tap a contestant
                </p>
                <div className="mx-auto flex max-w-5xl flex-wrap justify-center gap-2">
                  {contestants.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => awardContestant(c.id)}
                      className="min-h-[3rem] min-w-[7rem] rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-semibold text-[var(--foreground)] hover:bg-[var(--accent)] hover:text-[var(--accent-foreground)]"
                    >
                      {c.name.trim() || "Unnamed"}
                    </button>
                  ))}
                </div>
              </footer>
            ) : null}
          </>
        ) : null}
      </main>
    </div>
  );
}
