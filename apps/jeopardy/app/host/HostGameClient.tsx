"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { BoardModel } from "@/lib/boardJson";
import { parseBoardJsonText } from "@/lib/boardJson";
import { effectiveBuzzerWsUrl } from "@/lib/buzzerWsUrl";
import {
  boardToImportJson,
  createContestant,
  loadBuzzerConnectionPrefs,
  loadPersistedHostState,
  saveBuzzerConnectionPrefs,
  savePersistedHostState,
  type Contestant,
} from "@/lib/hostStorage";
import { copyTextToClipboard } from "@/lib/copyToClipboard";
import { normalizeRoomCode, randomRoomCode } from "@/lib/roomCode";

type CluePhase = "board" | "question" | "answer";

function emptyPlayed(): boolean[][] {
  return Array.from({ length: 5 }, () => Array.from({ length: 5 }, () => false));
}

function isLocalOrLanHost(hostname: string): boolean {
  if (!hostname) return false;
  if (hostname === "localhost" || hostname === "127.0.0.1") return true;
  return (
    /^10\./.test(hostname) ||
    /^192\.168\./.test(hostname) ||
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(hostname)
  );
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
  const [buzzerConnected, setBuzzerConnected] = useState(false);
  const [buzzerUnlocked, setBuzzerUnlocked] = useState(false);
  const [firstBuzz, setFirstBuzz] = useState<{
    name: string;
    playerId: string;
    at: number;
  } | null>(null);
  const [buzzQueue, setBuzzQueue] = useState<
    Array<{ name: string; playerId: string; at: number }>
  >([]);
  const [connectedBuzzers, setConnectedBuzzers] = useState(0);
  const [connectedRoster, setConnectedRoster] = useState<
    Array<{ id: string; name: string }>
  >([]);
  const [runtimeHostname, setRuntimeHostname] = useState("");
  const [templateCopied, setTemplateCopied] = useState(false);
  const [manualInviteUrl, setManualInviteUrl] = useState<string | null>(null);
  const manualInviteInputRef = useRef<HTMLInputElement | null>(null);

  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setRuntimeHostname(window.location.hostname);
  }, []);

  useEffect(() => {
    if (!manualInviteUrl) return;
    const id = window.setTimeout(() => {
      const el = manualInviteInputRef.current;
      if (el) {
        el.focus();
        el.select();
      }
    }, 0);
    return () => window.clearTimeout(id);
  }, [manualInviteUrl]);

  const showHostedGuidance = useMemo(() => {
    const host = runtimeHostname.trim().toLowerCase();
    if (!host) return false;
    if (host.endsWith(".vercel.app")) return true;
    return !isLocalOrLanHost(host);
  }, [runtimeHostname]);

  const hostWsConnectUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    return effectiveBuzzerWsUrl({
      pageIsSecure: window.location.protocol === "https:",
      lanHost: buzzerLanHost.trim() || window.location.hostname,
      port: buzzerPort,
    });
  }, [buzzerLanHost, buzzerPort]);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(async () => {
      const persisted = loadPersistedHostState();
      const buzz = loadBuzzerConnectionPrefs();
      const hn =
        typeof window !== "undefined" ? window.location.hostname : "";
      const persistedRoom = normalizeRoomCode(buzz?.roomCode ?? "");
      const chosenRoom = persistedRoom || randomRoomCode();
      setRoomCode(
        chosenRoom,
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
      setContestants(Array.isArray(persisted?.contestants) ? persisted.contestants : []);
      if (persisted?.boardJson) {
        const parsed = parseBoardJsonText(persisted.boardJson);
        if (parsed.ok) {
          if (cancelled) return;
          setBoard(parsed.board);
          setImportHint("Restored board from this browser.");
          return;
        }
      }
      try {
        const res = await fetch(templateHref, { cache: "no-store" });
        if (!res.ok) return;
        const templateText = await res.text();
        const parsed = parseBoardJsonText(templateText);
        if (!parsed.ok || cancelled) return;
        setBoard(parsed.board);
        setImportHint("using template jeopardy board");
      } catch {
        /* ignore template fetch errors */
      }
    });
    return () => {
      cancelled = true;
    };
  }, [templateHref]);

  useEffect(() => {
    savePersistedHostState({
      contestants,
      boardJson: board ? boardToImportJson(board) : null,
    });
  }, [contestants, board]);

  useEffect(() => {
    saveBuzzerConnectionPrefs({
      roomCode: normalizeRoomCode(roomCode),
      lanHost: buzzerLanHost.trim(),
      buzzerPort,
    });
  }, [roomCode, buzzerLanHost, buzzerPort]);

  useEffect(() => {
    setManualInviteUrl(null);
  }, [roomCode, buzzerLanHost, buzzerPort]);

  const buildContestantInviteUrl = useCallback((): string | null => {
    if (typeof window === "undefined") return null;
    const room = normalizeRoomCode(roomCode);
    if (!room) return null;
    const hostForPhones = buzzerLanHost.trim() || window.location.hostname;
    const basePath =
      (process.env.NEXT_PUBLIC_BASE_PATH?.trim() || "/jeopardy").replace(
        /\/$/,
        "",
      ) || "";
    const query = new URLSearchParams({
      room,
      host: hostForPhones,
      port: String(buzzerPort),
    });
    return new URL(
      `${basePath}/buzzer?${query.toString()}`,
      window.location.origin,
    ).toString();
  }, [roomCode, buzzerLanHost, buzzerPort]);

  const copyContestantInvite = useCallback(async () => {
    const url = buildContestantInviteUrl();
    if (!url) return;
    setManualInviteUrl(null);
    const ok = await copyTextToClipboard(url);
    if (ok) {
      setInviteCopied(true);
      window.setTimeout(() => setInviteCopied(false), 1800);
    } else {
      setManualInviteUrl(url);
    }
  }, [buildContestantInviteUrl]);

  const copyLocalHostTemplate = useCallback(async () => {
    const template = "http://<host-lan-ip>:3003/jeopardy/host";
    const ok = await copyTextToClipboard(template);
    if (ok) {
      setTemplateCopied(true);
      window.setTimeout(() => setTemplateCopied(false), 1800);
    }
  }, []);

  const sendHostWs = useCallback((payload: Record<string, unknown>) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(payload));
    }
  }, []);

  useEffect(() => {
    const url = hostWsConnectUrl.trim();
    if (
      !roomCode.trim() ||
      (!url.startsWith("ws://") && !url.startsWith("wss://"))
    ) {
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
        setConnectedBuzzers(
          typeof msg.connectedCount === "number" ? msg.connectedCount : 0,
        );
        const rosterRaw = Array.isArray(msg.connectedBuzzers)
          ? msg.connectedBuzzers
          : [];
        const roster = rosterRaw
          .map((r) => {
            const row = r as { id?: unknown; name?: unknown };
            return {
              id: typeof row.id === "string" ? row.id : "",
              name:
                typeof row.name === "string" && row.name.trim()
                  ? row.name.trim()
                  : "Player",
            };
          })
          .filter((r) => r.id);
        setConnectedRoster(roster);
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
          setBuzzQueue([]);
        }
      }
      if (msg.type === "firstBuzz") {
        const name = typeof msg.name === "string" ? msg.name : "Player";
        const playerId =
          typeof msg.playerId === "string" ? msg.playerId : "?";
        const at = typeof msg.at === "number" ? msg.at : Date.now();
        setFirstBuzz({ name, playerId, at });
        setBuzzQueue((prev) => {
          if (prev.some((p) => p.playerId === playerId)) return prev;
          return [...prev, { name, playerId, at }];
        });
      }
      if (msg.type === "buzzQueue") {
        const name = typeof msg.name === "string" ? msg.name : "Player";
        const playerId =
          typeof msg.playerId === "string" ? msg.playerId : "?";
        const at = typeof msg.at === "number" ? msg.at : Date.now();
        setBuzzQueue((prev) => {
          if (prev.some((p) => p.playerId === playerId)) return prev;
          return [...prev, { name, playerId, at }];
        });
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
  }, [hostWsConnectUrl, roomCode]);

  useEffect(() => {
    if (!connectedRoster.length) return;
    setContestants((prev) => {
      const known = new Set(
        prev.map((c) => c.name.trim().toLowerCase()).filter(Boolean),
      );
      const additions = connectedRoster
        .filter((r) => !known.has(r.name.trim().toLowerCase()))
        .map((r) => createContestant(r.name));
      return additions.length ? [...prev, ...additions] : prev;
    });
  }, [connectedRoster]);

  useEffect(() => {
    if (setupPhase) return;
    if (cluePhase === "question") {
      setFirstBuzz(null);
      setBuzzQueue([]);
      sendHostWs({ type: "unlock" });
    } else if (cluePhase === "answer") {
      sendHostWs({ type: "lock" });
    } else {
      setFirstBuzz(null);
      setBuzzQueue([]);
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

  const advanceQueuedBuzzer = () => {
    setBuzzQueue((prev) => {
      if (prev.length <= 1) {
        setFirstBuzz(null);
        return [];
      }
      const rest = prev.slice(1);
      const next = rest[0];
      setFirstBuzz(next ?? null);
      return rest;
    });
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

  const regenerateRoomCode = () => {
    const nextRoom = randomRoomCode();
    setRoomCode(nextRoom);
  };

  if (setupPhase) {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-10">
        <header className="space-y-2">
          <h1 className="text-2xl font-semibold text-[var(--foreground)]">
            Jeopardy host
          </h1>
          <p className="text-sm text-[var(--muted)]">
            Confirm your room code, load a board, and start the game. Project
            this screen for everyone to see.
          </p>
        </header>

        {showHostedGuidance ? (
          <section className="space-y-3 rounded-xl border border-[var(--accent)] bg-[var(--surface)] p-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--foreground)]">
              Run this locally for buzzer mode
            </h2>
            <ol className="list-decimal space-y-1 pl-5 text-sm text-[var(--muted)]">
              <li>
                Run{" "}
                <code className="font-mono text-[var(--foreground)]">
                  npm run dev:jeopardy:party
                </code>
              </li>
              <li>
                Open{" "}
                <code className="font-mono text-[var(--foreground)]">
                  http://&lt;host-lan-ip&gt;:3003/jeopardy/host
                </code>
              </li>
              <li>Share the buzzer link printed in the terminal.</li>
            </ol>
            <button
              type="button"
              onClick={() => void copyLocalHostTemplate()}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-4 py-2 text-sm font-medium text-[var(--foreground)]"
            >
              {templateCopied
                ? "Local host template copied"
                : "Copy local host URL template"}
            </button>
          </section>
        ) : null}

        <section className="space-y-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
            Player access
          </h2>
          <p className="text-xs text-[var(--muted)]">
            From the repo root run{" "}
            <code className="font-mono text-[var(--foreground)]">
              npm run dev:jeopardy:party
            </code>{" "}
            once, then share the player link shown in the terminal.
          </p>
          <div className="space-y-2 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-[var(--muted)]">Room code</span>
              <button
                type="button"
                onClick={regenerateRoomCode}
                className="text-xs font-medium text-[var(--accent)] underline"
              >
                New code
              </button>
            </div>
            <input
              value={roomCode}
              onChange={(e) => setRoomCode(normalizeRoomCode(e.target.value))}
              placeholder="Enter room code"
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 font-mono text-sm text-[var(--foreground)] outline-none ring-[var(--accent)] focus:ring-2"
              autoComplete="off"
            />
          </div>
          <button
            type="button"
            disabled={!normalizeRoomCode(roomCode)}
            onClick={() => void copyContestantInvite()}
            className="w-full cursor-pointer rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-[var(--accent-foreground)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {inviteCopied
              ? "Invite copied"
              : "Copy contestant invite (room included)"}
          </button>
          {manualInviteUrl ? (
            <div className="space-y-2 rounded-lg border border-[var(--accent)] bg-[var(--background)] px-3 py-2">
              <p className="text-xs text-[var(--muted)]">
                This browser blocked automatic copy from this page. The invite
                link is selected below for manual copy.
              </p>
              <input
                ref={manualInviteInputRef}
                readOnly
                value={manualInviteUrl}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 font-mono text-xs text-[var(--foreground)] outline-none"
                aria-label="Contestant invite URL"
              />
            </div>
          ) : null}
          <div className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
              Connected buzzers ({connectedRoster.length})
            </p>
            {connectedRoster.length ? (
              <ul className="mt-2 space-y-1 text-sm text-[var(--foreground)]">
                {connectedRoster.map((r) => (
                  <li key={r.id}>{r.name}</li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-xs text-[var(--muted)]">
                No buzzers connected yet.
              </p>
            )}
          </div>
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
          Start Game
        </button>
        {!board ? (
          <p className="text-center text-xs text-[var(--muted)]">
            Template board could not be loaded. Import a board JSON to enable Start Game.
          </p>
        ) : null}
      </div>
    );
  }

  if (!board) {
    return (
      <p className="p-8 text-[var(--muted)]">
        Missing board. Reload or import a board JSON.
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
          <span
            className={
              buzzerConnected ? "text-[var(--success)]" : "text-[var(--danger)]"
            }
          >
            {buzzerConnected ? `${connectedBuzzers} connected` : "0 connected"}
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
            <div className="pointer-events-none fixed inset-0 z-[5] bg-black/70" />

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
                  ? "Use the buttons below to continue."
                  : "Review answer, then choose an action below."}
              </p>
            </div>

            <section className="fixed left-1/2 top-[62%] z-30 w-[min(44rem,92vw)] -translate-x-1/2 rounded-xl border border-[var(--border)] bg-[var(--surface)]/95 px-4 py-3 shadow-lg backdrop-blur">
              <h3 className="text-center text-sm font-semibold uppercase tracking-wide text-[var(--foreground)]">
                Buzz queue
              </h3>
              {firstBuzz ? (
                <p className="mt-1 text-center text-base font-semibold text-[var(--accent)]">
                  First: {firstBuzz.name}
                </p>
              ) : null}
              {buzzQueue.length ? (
                <ol className="mx-auto mt-2 max-h-24 w-full max-w-md overflow-y-auto text-sm text-[var(--foreground)]">
                  {buzzQueue.map((entry, idx) => (
                    <li key={`${entry.playerId}-${entry.at}-${idx}`}>
                      {idx + 1}. {entry.name}
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="mt-2 text-center text-xs text-[var(--muted)]">
                  No buzzes yet.
                </p>
              )}
            </section>

            <footer className="fixed inset-x-0 bottom-20 z-30 flex justify-center px-3">
              <div className="flex w-full max-w-3xl flex-col gap-3">
                {cluePhase === "question" ? (
                  <>
                    <div className="flex w-full gap-3">
                      <button
                        type="button"
                        onClick={questionLeft}
                        className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm font-semibold text-[var(--foreground)] hover:bg-[var(--background)]"
                      >
                        Back to board
                      </button>
                      <button
                        type="button"
                        onClick={questionRight}
                        className="flex-1 rounded-lg bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-[var(--accent-foreground)]"
                      >
                        Show answer
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={consumeWithoutPoints}
                      className="w-full rounded-lg border-2 border-[var(--accent)] bg-[var(--surface)] px-4 py-3 text-sm font-semibold text-[var(--foreground)] hover:bg-[var(--background)]"
                    >
                      Nobody correct — close clue (no points)
                    </button>
                  </>
                ) : (
                  <div className="flex w-full gap-3">
                    <button
                      type="button"
                      onClick={answerLeft}
                      className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm font-semibold text-[var(--foreground)] hover:bg-[var(--background)]"
                    >
                      Back without consuming
                    </button>
                    <button
                      type="button"
                      onClick={consumeWithoutPoints}
                      className="flex-1 rounded-lg border-2 border-[var(--accent)] bg-[var(--surface)] px-4 py-3 text-sm font-semibold text-[var(--foreground)] hover:bg-[var(--background)]"
                    >
                      Nobody correct — no points
                    </button>
                  </div>
                )}
              </div>
            </footer>

            {cluePhase === "answer" ? (
              <footer className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--border)] bg-[var(--background)] px-3 py-3">
                <p className="mb-2 text-center text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                  Award ${pointForSelected} · tap a contestant
                </p>
                <div className="mx-auto mb-2 flex max-w-5xl justify-center">
                  <button
                    type="button"
                    onClick={advanceQueuedBuzzer}
                    disabled={buzzQueue.length <= 1}
                    className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-semibold text-[var(--foreground)] disabled:opacity-40"
                  >
                    Next queued contestant
                  </button>
                </div>
                <div className="mx-auto flex max-w-5xl flex-wrap justify-center gap-2">
                  {contestants.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => awardContestant(c.id)}
                      className="min-h-[3rem] min-w-[7rem] rounded-lg border-2 border-[var(--accent)] bg-[var(--surface)] px-4 py-2 text-sm font-semibold text-[var(--foreground)] outline-none ring-offset-2 ring-offset-[var(--background)] hover:bg-[var(--accent)] hover:text-[var(--accent-foreground)] focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
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
