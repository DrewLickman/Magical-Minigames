"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { BoardModel } from "@/lib/boardJson";
import { parseBoardJsonText } from "@/lib/boardJson";
import type { FinalJeopardyClue } from "@/lib/finalJeopardyJson";
import { parseFinalJeopardyJsonText } from "@/lib/finalJeopardyJson";
import { effectiveBuzzerWsUrl } from "@/lib/buzzerWsUrl";
import {
  boardToImportJson,
  loadBuzzerConnectionPrefs,
  loadPersistedHostState,
  saveBuzzerConnectionPrefs,
  savePersistedHostState,
  type Contestant,
} from "@/lib/hostStorage";
import { copyTextToClipboard } from "@/lib/copyToClipboard";
import { ContestantSignatureStrip } from "./ContestantSignatureStrip";
import {
  FinalJeopardyHostPanel,
  FinalJeopardyWinnerOverlay,
  type FinalJeopardyHostUiPhase,
} from "./FinalJeopardyHostPanel";
import { BoardJsonActionsPanel } from "./BoardJsonActionsPanel";
import { normalizeRoomCode, randomRoomCode } from "@/lib/roomCode";

type CluePhase = "board" | "question" | "answer";

type AwardPendingState =
  | null
  | { kind: "player"; id: string }
  | { kind: "nobody" };

type BuzzerRosterEntry = {
  id: string;
  name: string;
  signatureImage?: string;
};

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

function buzzerScoreKey(c: Contestant): string {
  return typeof c.buzzerId === "string" && c.buzzerId.trim()
    ? c.buzzerId.trim()
    : c.id;
}

export function HostGameClient({
  templateHref,
  roundTwoTemplateHref,
  finalJeopardyTemplateHref,
}: {
  templateHref: string;
  roundTwoTemplateHref: string;
  finalJeopardyTemplateHref: string;
}) {
  const [setupPhase, setSetupPhase] = useState(true);
  const [contestants, setContestants] = useState<Contestant[]>([]);
  const [board, setBoard] = useState<BoardModel | null>(null);
  const [roundTwoBoard, setRoundTwoBoard] = useState<BoardModel | null>(null);
  const [gameRound, setGameRound] = useState<1 | 2>(1);
  const [boardError, setBoardError] = useState<string | null>(null);
  const [importHint, setImportHint] = useState<string | null>(null);
  const [roundTwoImportHint, setRoundTwoImportHint] = useState<string | null>(
    null,
  );

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
  const [firstBuzz, setFirstBuzz] = useState<{
    name: string;
    playerId: string;
    at: number;
  } | null>(null);
  const [buzzQueue, setBuzzQueue] = useState<
    Array<{ name: string; playerId: string; at: number }>
  >([]);
  const [connectedBuzzers, setConnectedBuzzers] = useState(0);
  const [connectedRoster, setConnectedRoster] = useState<BuzzerRosterEntry[]>(
    [],
  );
  const [runtimeHostname, setRuntimeHostname] = useState("");
  const [templateCopied, setTemplateCopied] = useState(false);
  const [manualInviteUrl, setManualInviteUrl] = useState<string | null>(null);
  const manualInviteInputRef = useRef<HTMLInputElement | null>(null);
  const [awardPending, setAwardPending] = useState<AwardPendingState>(null);
  const [buzzQueuePriorityIndex, setBuzzQueuePriorityIndex] = useState(0);

  const wsRef = useRef<WebSocket | null>(null);
  /** Prevents applying tile points twice for the same cell (e.g. Strict Mode / double updater runs). */
  const lastScoredCellRef = useRef<string | null>(null);
  /** Source of truth for signature two-tap confirm (avoids stale React state on second tap). */
  const pendingAwardPlayerIdRef = useRef<string | null>(null);
  const pendingNobodyConfirmRef = useRef(false);
  /** When true, staged Round 2 JSON came from file import; do not overwrite from template fetch. */
  const roundTwoFromUserImportRef = useRef(false);
  const fjCloseAnswersSentRef = useRef(false);

  const [gamePhase, setGamePhase] = useState<"boards" | "finalJeopardy">(
    "boards",
  );
  const [fjUiPhase, setFjUiPhase] = useState<FinalJeopardyHostUiPhase>("wager");
  const [finalJeopardyClue, setFinalJeopardyClue] =
    useState<FinalJeopardyClue | null>(null);
  const [fjImportHint, setFjImportHint] = useState<string | null>(null);
  const [fjWagersPlacedIds, setFjWagersPlacedIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [fjGradingBundle, setFjGradingBundle] = useState<{
    wagers: Record<string, number>;
    answers: Record<string, string>;
  } | null>(null);
  const [fjGradedContestantIds, setFjGradedContestantIds] = useState<
    Set<string>
  >(() => new Set());
  const [fjActiveContestantId, setFjActiveContestantId] = useState<
    string | null
  >(null);
  const [fjAnswerEndsAt, setFjAnswerEndsAt] = useState<number | null>(null);
  const [fjHostSecondsLeft, setFjHostSecondsLeft] = useState<number | null>(
    null,
  );

  const clearAwardPendingRefs = () => {
    pendingAwardPlayerIdRef.current = null;
    pendingNobodyConfirmRef.current = false;
  };

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

  const allCellsPlayed = useMemo(
    () => played.every((col) => col.every((cell) => cell)),
    [played],
  );

  const fjGradingOrder = useMemo(() => {
    if (!fjGradingBundle) return [];
    return contestants.filter(
      (c) => buzzerScoreKey(c) in fjGradingBundle.wagers,
    );
  }, [contestants, fjGradingBundle]);

  const fjWagerStatusLines = useMemo(() => {
    const lines: string[] = [];
    for (const c of contestants) {
      const bid = c.buzzerId?.trim();
      if (bid && fjWagersPlacedIds.has(bid)) {
        lines.push(`${c.name.trim() || "Player"} has placed their wager.`);
      }
    }
    return lines;
  }, [contestants, fjWagersPlacedIds]);

  const fjEligibleStripIds = useMemo(
    () => new Set(fjGradingOrder.map((c) => c.id)),
    [fjGradingOrder],
  );

  const fjWinners = useMemo(() => {
    if (!contestants.length) return [];
    const max = Math.max(...contestants.map((c) => c.score));
    return contestants.filter((c) => c.score === max);
  }, [contestants]);

  const fjActiveContestant = useMemo(
    () => contestants.find((c) => c.id === fjActiveContestantId) ?? null,
    [contestants, fjActiveContestantId],
  );

  const fjGradingKey = fjActiveContestant
    ? buzzerScoreKey(fjActiveContestant)
    : null;

  const fjRevealQuestionDisabled =
    gamePhase !== "finalJeopardy" || fjUiPhase !== "wager" || !finalJeopardyClue;

  const fjShowGradingActions = Boolean(
    fjUiPhase === "grading" &&
      fjActiveContestant &&
      fjGradingKey &&
      fjGradingBundle &&
      fjGradingKey in fjGradingBundle.wagers &&
      !fjGradedContestantIds.has(fjActiveContestant.id),
  );

  const fjShowNextContestant = Boolean(
    fjUiPhase === "grading" &&
      fjGradingOrder.some((c) => !fjGradedContestantIds.has(c.id)) &&
      (!fjActiveContestantId ||
        (fjActiveContestant !== null &&
          fjGradedContestantIds.has(fjActiveContestant.id))),
  );

  const fjShowRevealWinnerButton = Boolean(
    fjUiPhase === "grading" &&
      fjGradingOrder.length > 0 &&
      fjGradingOrder.every((c) => fjGradedContestantIds.has(c.id)),
  );

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
    if (!setupPhase) return;
    let cancelled = false;
    queueMicrotask(async () => {
      try {
        const res = await fetch(roundTwoTemplateHref, { cache: "no-store" });
        if (!res.ok) return;
        const templateText = await res.text();
        const parsed = parseBoardJsonText(templateText);
        if (!parsed.ok || cancelled) return;
        if (roundTwoFromUserImportRef.current) return;
        setRoundTwoBoard(parsed.board);
      } catch {
        /* ignore */
      }
    });
    return () => {
      cancelled = true;
    };
  }, [setupPhase, roundTwoTemplateHref]);

  useEffect(() => {
    if (!setupPhase) return;
    let cancelled = false;
    queueMicrotask(async () => {
      try {
        const res = await fetch(finalJeopardyTemplateHref, {
          cache: "no-store",
        });
        if (!res.ok) return;
        const text = await res.text();
        const parsed = parseFinalJeopardyJsonText(text);
        if (!parsed.ok || cancelled) return;
        setFinalJeopardyClue(parsed.clue);
        setFjImportHint("Loaded default Final Jeopardy clue.");
      } catch {
        /* ignore */
      }
    });
    return () => {
      cancelled = true;
    };
  }, [setupPhase, finalJeopardyTemplateHref]);

  useEffect(() => {
    savePersistedHostState({
      contestants: contestants.map(({ id, name, score, buzzerId }) => ({
        id,
        name,
        score,
        ...(buzzerId ? { buzzerId } : {}),
      })),
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
        setConnectedBuzzers(
          typeof msg.connectedCount === "number" ? msg.connectedCount : 0,
        );
        const rosterRaw = Array.isArray(msg.connectedBuzzers)
          ? msg.connectedBuzzers
          : [];
        const roster = rosterRaw
          .map((r) => {
            const row = r as {
              id?: unknown;
              name?: unknown;
              signatureImage?: unknown;
            };
            const sig =
              typeof row.signatureImage === "string" &&
              row.signatureImage.trim()
                ? row.signatureImage.trim()
                : undefined;
            return {
              id: typeof row.id === "string" ? row.id : "",
              name:
                typeof row.name === "string" && row.name.trim()
                  ? row.name.trim()
                  : "Player",
              signatureImage: sig,
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
      if (msg.type === "finalJeopardyWagerPlaced") {
        const playerId =
          typeof msg.playerId === "string" ? msg.playerId.trim() : "";
        if (playerId) {
          setFjWagersPlacedIds((prev) => new Set(prev).add(playerId));
        }
      }
      if (msg.type === "finalJeopardyGradingBundle") {
        const w = msg.wagers;
        const a = msg.answers;
        if (w && typeof w === "object" && a && typeof a === "object") {
          setFjGradingBundle({
            wagers: w as Record<string, number>,
            answers: a as Record<string, string>,
          });
          setFjUiPhase("grading");
          setFjAnswerEndsAt(null);
          setFjHostSecondsLeft(null);
          setFjActiveContestantId(null);
        }
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
    if (!buzzerConnected || !contestants.length) return;
    const scores: Record<string, number> = {};
    for (const c of contestants) {
      const key =
        typeof c.buzzerId === "string" && c.buzzerId.trim()
          ? c.buzzerId.trim()
          : c.id;
      scores[key] = c.score;
    }
    sendHostWs({ type: "pushScores", scores });
  }, [buzzerConnected, contestants, sendHostWs]);

  useEffect(() => {
    if (!connectedRoster.length) return;
    setContestants((prev) => {
      const next = [...prev];
      for (const r of connectedRoster) {
        const byBuzzer = next.findIndex(
          (c) => c.id === r.id || c.buzzerId === r.id,
        );
        if (byBuzzer !== -1) {
          next[byBuzzer] = {
            ...next[byBuzzer],
            id: r.id,
            buzzerId: r.id,
            name: r.name,
            signatureImage: r.signatureImage ?? next[byBuzzer].signatureImage,
          };
          continue;
        }
        const byName = next.findIndex(
          (c) =>
            !c.buzzerId &&
            c.name.trim().toLowerCase() === r.name.trim().toLowerCase(),
        );
        if (byName !== -1) {
          const keepScore = next[byName].score;
          next[byName] = {
            id: r.id,
            buzzerId: r.id,
            name: r.name,
            score: keepScore,
            signatureImage: r.signatureImage,
          };
        } else {
          next.push({
            id: r.id,
            buzzerId: r.id,
            name: r.name,
            score: 0,
            signatureImage: r.signatureImage,
          });
        }
      }
      return next;
    });
  }, [connectedRoster]);

  useEffect(() => {
    if (setupPhase) return;
    if (gamePhase === "finalJeopardy") return;
    if (cluePhase === "question") {
      setFirstBuzz(null);
      setBuzzQueue([]);
      setBuzzQueuePriorityIndex(0);
      sendHostWs({ type: "unlock" });
    } else if (cluePhase === "answer") {
      sendHostWs({ type: "lock" });
    } else {
      setFirstBuzz(null);
      setBuzzQueue([]);
      setBuzzQueuePriorityIndex(0);
      sendHostWs({ type: "resetRound" });
    }
  }, [cluePhase, setupPhase, sendHostWs, gamePhase]);

  useEffect(() => {
    if (
      gamePhase !== "finalJeopardy" ||
      fjUiPhase !== "question" ||
      fjAnswerEndsAt == null
    ) {
      setFjHostSecondsLeft(null);
      return;
    }
    const tick = () => {
      const left = Math.max(
        0,
        Math.ceil((fjAnswerEndsAt - Date.now()) / 1000),
      );
      setFjHostSecondsLeft(left);
      if (left <= 0 && !fjCloseAnswersSentRef.current) {
        fjCloseAnswersSentRef.current = true;
        sendHostWs({ type: "finalJeopardyCloseAnswers" });
      }
    };
    tick();
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
  }, [gamePhase, fjUiPhase, fjAnswerEndsAt, sendHostWs]);

  useEffect(() => {
    if (fjUiPhase !== "grading" || !fjGradingBundle) return;
    const hasAny = contestants.some(
      (c) => buzzerScoreKey(c) in fjGradingBundle.wagers,
    );
    if (!hasAny) {
      setFjUiPhase("winner");
    }
  }, [fjUiPhase, fjGradingBundle, contestants]);

  useEffect(() => {
    setBuzzQueuePriorityIndex((i) => {
      if (buzzQueue.length === 0) return 0;
      return Math.min(i, buzzQueue.length - 1);
    });
  }, [buzzQueue]);

  const beginPlay = () => {
    if (!board) return;
    lastScoredCellRef.current = null;
    clearAwardPendingRefs();
    setAwardPending(null);
    setGameRound(1);
    setGamePhase("boards");
    setFjUiPhase("wager");
    setFjWagersPlacedIds(new Set());
    setFjGradingBundle(null);
    setFjGradedContestantIds(new Set());
    setFjActiveContestantId(null);
    setFjAnswerEndsAt(null);
    setFjHostSecondsLeft(null);
    fjCloseAnswersSentRef.current = false;
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

  const importRoundTwoJsonFile = async (file: File) => {
    setBoardError(null);
    const text = await file.text();
    const parsed = parseBoardJsonText(text);
    if (!parsed.ok) {
      setBoardError(parsed.error);
      return;
    }
    roundTwoFromUserImportRef.current = true;
    setRoundTwoBoard(parsed.board);
    setRoundTwoImportHint(`Round 2: loaded “${file.name}”.`);
  };

  const importFinalJeopardyJsonFile = async (file: File) => {
    setBoardError(null);
    const text = await file.text();
    const parsed = parseFinalJeopardyJsonText(text);
    if (!parsed.ok) {
      setBoardError(parsed.error);
      return;
    }
    setFinalJeopardyClue(parsed.clue);
    setFjImportHint(`Final Jeopardy: loaded “${file.name}”.`);
  };

  const startFinalJeopardy = () => {
    if (!finalJeopardyClue) return;
    setGamePhase("finalJeopardy");
    setFjUiPhase("wager");
    setFjWagersPlacedIds(new Set());
    setFjGradingBundle(null);
    setFjGradedContestantIds(new Set());
    setFjActiveContestantId(null);
    setFjAnswerEndsAt(null);
    setFjHostSecondsLeft(null);
    fjCloseAnswersSentRef.current = false;
    const maxWagers: Record<string, number> = {};
    for (const c of contestants) {
      const bid = c.buzzerId?.trim();
      if (bid) maxWagers[bid] = Math.max(0, Math.trunc(c.score));
    }
    sendHostWs({
      type: "finalJeopardyStart",
      category: finalJeopardyClue.category,
      maxWagers,
    });
  };

  const revealFinalJeopardyQuestion = () => {
    if (!finalJeopardyClue) return;
    const ends = Date.now() + 30_000;
    fjCloseAnswersSentRef.current = false;
    setFjAnswerEndsAt(ends);
    setFjUiPhase("question");
    sendHostWs({
      type: "finalJeopardyRevealQuestion",
      question: finalJeopardyClue.question,
      answerEndsAt: ends,
    });
  };

  const gradeFinalJeopardy = (correct: boolean) => {
    if (!fjGradingBundle || !fjActiveContestant) return;
    const k = buzzerScoreKey(fjActiveContestant);
    const wager = fjGradingBundle.wagers[k];
    if (wager === undefined) return;
    const cid = fjActiveContestant.id;
    setContestants((prev) =>
      prev.map((p) => {
        if (p.id !== cid) return p;
        return {
          ...p,
          score: p.score + (correct ? wager : -wager),
        };
      }),
    );
    setFjGradedContestantIds((prev) => new Set(prev).add(cid));
  };

  const advanceFjNextContestant = () => {
    const next = fjGradingOrder.find(
      (c) => !fjGradedContestantIds.has(c.id),
    );
    setFjActiveContestantId(next?.id ?? null);
  };

  const revealFjWinner = () => {
    setFjUiPhase("winner");
  };

  const startRoundTwo = () => {
    if (!roundTwoBoard) return;
    lastScoredCellRef.current = null;
    clearAwardPendingRefs();
    setAwardPending(null);
    setBoard(roundTwoBoard);
    setRoundTwoBoard(null);
    roundTwoFromUserImportRef.current = false;
    setGameRound(2);
    setPlayed(emptyPlayed());
    setCluePhase("board");
    setSelected(null);
  };

  const selectCell = (col: number, row: number) => {
    if (!board || cluePhase !== "board") return;
    if (played[col][row]) return;
    lastScoredCellRef.current = null;
    clearAwardPendingRefs();
    setAwardPending(null);
    setSelected({ col, row });
    setCluePhase("question");
  };

  /** Debug: Ctrl+Shift+click a dollar cell to toggle answered / unanswered. */
  const toggleDebugPlayedCell = (col: number, row: number) => {
    if (!board || cluePhase !== "board") return;
    setPlayed((prev) => {
      const next = prev.map((c) => [...c]);
      next[col][row] = !next[col][row];
      return next;
    });
    lastScoredCellRef.current = null;
    clearAwardPendingRefs();
    setAwardPending(null);
    setSelected(null);
  };

  const questionLeft = () => {
    sendHostWs({ type: "lock" });
    sendHostWs({ type: "resetRound" });
    lastScoredCellRef.current = null;
    clearAwardPendingRefs();
    setAwardPending(null);
    setCluePhase("board");
    setSelected(null);
  };

  const questionRight = () => {
    sendHostWs({ type: "lock" });
    clearAwardPendingRefs();
    setAwardPending(null);
    setCluePhase("answer");
  };

  const answerLeft = () => {
    sendHostWs({ type: "lock" });
    sendHostWs({ type: "resetRound" });
    lastScoredCellRef.current = null;
    clearAwardPendingRefs();
    setAwardPending(null);
    setCluePhase("board");
    setSelected(null);
  };

  const consumeWithoutPoints = () => {
    if (!selected) return;
    lastScoredCellRef.current = null;
    clearAwardPendingRefs();
    setAwardPending(null);
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
    const cellKey = `${col}-${row}`;
    if (lastScoredCellRef.current === cellKey) return;

    const i = contestants.findIndex(
      (c) => c.id === contestantId || c.buzzerId === contestantId,
    );
    if (i === -1) return;

    const pts = board.pointValues[row];
    lastScoredCellRef.current = cellKey;
    clearAwardPendingRefs();
    setAwardPending(null);

    const nextContestants = contestants.slice();
    nextContestants[i] = {
      ...contestants[i],
      score: contestants[i].score + pts,
    };
    setContestants(nextContestants);
    setPlayed((prev) => {
      const next = prev.map((c) => [...c]);
      next[col][row] = true;
      return next;
    });
    sendHostWs({ type: "resetRound" });
    setCluePhase("board");
    setSelected(null);
  };

  const handleContestantStripPress = (id: string) => {
    if (pendingAwardPlayerIdRef.current === id) {
      pendingAwardPlayerIdRef.current = null;
      pendingNobodyConfirmRef.current = false;
      setAwardPending(null);
      awardContestant(id);
      return;
    }
    pendingAwardPlayerIdRef.current = id;
    pendingNobodyConfirmRef.current = false;
    setAwardPending({ kind: "player", id });
  };

  const handleContestantStripPressUnified = (id: string) => {
    if (gamePhase === "finalJeopardy" && fjUiPhase === "grading") {
      setFjActiveContestantId(id);
      return;
    }
    handleContestantStripPress(id);
  };

  const returnToLobby = useCallback(() => {
    lastScoredCellRef.current = null;
    clearAwardPendingRefs();
    setAwardPending(null);
    roundTwoFromUserImportRef.current = false;
    setGameRound(1);
    setGamePhase("boards");
    setFjUiPhase("wager");
    setFjWagersPlacedIds(new Set());
    setFjGradingBundle(null);
    setFjGradedContestantIds(new Set());
    setFjActiveContestantId(null);
    setFjAnswerEndsAt(null);
    setFjHostSecondsLeft(null);
    fjCloseAnswersSentRef.current = false;
    setSetupPhase(true);
    setCluePhase("board");
    setSelected(null);
  }, []);

  const handleNobodyPress = () => {
    if (pendingNobodyConfirmRef.current) {
      pendingNobodyConfirmRef.current = false;
      pendingAwardPlayerIdRef.current = null;
      setAwardPending(null);
      consumeWithoutPoints();
      return;
    }
    pendingNobodyConfirmRef.current = true;
    pendingAwardPlayerIdRef.current = null;
    setAwardPending({ kind: "nobody" });
  };

  const advanceQueuedBuzzer = () => {
    setBuzzQueuePriorityIndex((i) => {
      if (buzzQueue.length <= 1) return 0;
      return Math.min(i + 1, buzzQueue.length - 1);
    });
  };

  if (setupPhase) {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-10 xl:max-w-6xl">
        <header className="space-y-2">
          <h1 className="text-2xl font-semibold text-[var(--foreground)]">
            Jeopardy host
          </h1>
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

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2 xl:items-stretch">
        <section className="flex flex-col space-y-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 xl:h-full">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
            Player access
          </h2>
          <div className="space-y-2 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2">
            <label
              htmlFor="jeopardy-host-room-code"
              className="block text-xs text-[var(--muted)]"
            >
              Room code
            </label>
            <input
              id="jeopardy-host-room-code"
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
              <ul className="mt-2 space-y-2 text-sm text-[var(--foreground)]">
                {connectedRoster.map((r) => (
                  <li key={r.id} className="flex items-center gap-2">
                    {r.signatureImage ? (
                      <img
                        src={`data:image/png;base64,${r.signatureImage}`}
                        alt=""
                        className="h-8 w-12 shrink-0 rounded border border-[var(--border)] bg-[var(--surface)] object-contain"
                      />
                    ) : null}
                    <span className="min-w-0 truncate">{r.name}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-xs text-[var(--muted)]">
                No buzzers connected yet.
              </p>
            )}
          </div>
        </section>

        <BoardJsonActionsPanel
          board={board}
          boardError={boardError}
          importHint={importHint}
          roundTwoImportHint={roundTwoImportHint}
          fjImportHint={fjImportHint}
          finalJeopardyClue={finalJeopardyClue}
          templateHref={templateHref}
          roundTwoTemplateHref={roundTwoTemplateHref}
          finalJeopardyTemplateHref={finalJeopardyTemplateHref}
          onImportRoundOne={(file) => void importJsonFile(file)}
          onImportRoundTwo={(file) => void importRoundTwoJsonFile(file)}
          onImportFinalJeopardy={(file) => void importFinalJeopardyJsonFile(file)}
        />
        </div>

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

  if (gamePhase === "finalJeopardy" && finalJeopardyClue) {
    return (
      <div className="relative flex min-h-screen flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-[var(--border)] bg-[var(--background)] px-4 py-3">
          <div className="flex min-w-0 flex-wrap items-center gap-2 text-xs text-[var(--muted)]">
            <span
              className={
                buzzerConnected
                  ? "text-[var(--success)]"
                  : "text-[var(--danger)]"
              }
            >
              {buzzerConnected
                ? `${connectedBuzzers} connected`
                : "0 connected"}
            </span>
            <span className="font-mono text-[var(--foreground)]">
              Room {roomCode}
            </span>
          </div>
          <button
            type="button"
            onClick={returnToLobby}
            className="shrink-0 rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--foreground)]"
          >
            Lobby
          </button>
        </header>
        <main className="relative flex flex-1 flex-col">
          <FinalJeopardyHostPanel
            clue={finalJeopardyClue}
            uiPhase={fjUiPhase}
            secondsLeft={
              fjUiPhase === "question" ? fjHostSecondsLeft : null
            }
            wagerStatusLines={fjWagerStatusLines}
            revealQuestionDisabled={fjRevealQuestionDisabled}
            onRevealQuestion={revealFinalJeopardyQuestion}
            canonicalAnswer={finalJeopardyClue.answer}
            gradingActiveName={
              fjActiveContestant?.name.trim() || "Select a contestant"
            }
            gradingWager={
              fjActiveContestant && fjGradingKey && fjGradingBundle
                ? (fjGradingBundle.wagers[fjGradingKey] ?? null)
                : null
            }
            gradingAnswer={
              fjActiveContestant && fjGradingKey && fjGradingBundle
                ? (fjGradingBundle.answers[fjGradingKey] ?? "")
                : null
            }
            showGradingActions={fjShowGradingActions}
            onCorrect={() => gradeFinalJeopardy(true)}
            onIncorrect={() => gradeFinalJeopardy(false)}
            showNextContestant={fjShowNextContestant}
            onNextContestant={advanceFjNextContestant}
            showRevealWinnerButton={fjShowRevealWinnerButton}
            onRevealWinner={revealFjWinner}
          />
        </main>
        {fjUiPhase === "winner" ? (
          <FinalJeopardyWinnerOverlay winners={fjWinners} />
        ) : null}
        {contestants.length ? (
          <ContestantSignatureStrip
            contestants={contestants}
            awardEnabled={false}
            pendingContestantId={
              fjUiPhase === "grading" ? fjActiveContestantId : null
            }
            onContestantPress={handleContestantStripPressUnified}
            variant={fjUiPhase === "grading" ? "finalJeopardy" : "play"}
            finalJeopardyGradingEnabled={fjUiPhase === "grading"}
            finalJeopardyEligibleContestantIds={fjEligibleStripIds}
          />
        ) : null}
      </div>
    );
  }

  const clue =
    selected !== null ? board.clues[selected.col][selected.row] : null;

  const buzzQueueColumn = (
    <div className="flex min-h-0 min-w-0 flex-col rounded-lg border border-[var(--border)] bg-[var(--surface)]/95 px-2 py-2 shadow-sm backdrop-blur sm:px-3">
      <h3 className="text-center text-xs font-semibold uppercase tracking-wide text-[var(--foreground)] sm:text-sm">
        Buzz queue
      </h3>
      {buzzQueue.length ? (
        <ol className="mx-auto mt-1 max-h-24 w-full list-inside overflow-y-auto text-xs text-[var(--foreground)] sm:text-sm">
          {buzzQueue.map((entry, idx) => (
            <li
              key={`${entry.playerId}-${entry.at}-${idx}`}
              className={
                idx === buzzQueuePriorityIndex
                  ? "font-semibold text-[var(--accent)]"
                  : ""
              }
            >
              {idx + 1}. {entry.name}
            </li>
          ))}
        </ol>
      ) : (
        <p className="mt-1 text-center text-[0.65rem] text-[var(--muted)] sm:text-xs">
          No buzzes yet.
        </p>
      )}
      {cluePhase === "answer" ? (
        <div className="mt-2 flex justify-center">
          <button
            type="button"
            onClick={advanceQueuedBuzzer}
            disabled={
              buzzQueue.length <= 1 ||
              buzzQueuePriorityIndex >= buzzQueue.length - 1
            }
            className="w-full max-w-[11rem] rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-xs font-semibold text-[var(--foreground)] disabled:opacity-40 sm:text-sm"
          >
            Next queued contestant
          </button>
        </div>
      ) : null}
    </div>
  );

  return (
    <div className="relative flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-[var(--border)] bg-[var(--background)] px-4 py-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2 text-xs text-[var(--muted)]">
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
        </div>
        <button
          type="button"
          onClick={returnToLobby}
          className="shrink-0 rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--foreground)]"
        >
          Lobby
        </button>
      </header>

      <main className="relative flex flex-1 flex-col px-3 pb-52 pt-4 sm:px-6">
        <div
          className={`mx-auto grid w-full max-w-5xl flex-1 gap-2 transition-opacity duration-300 ${cluePhase !== "board" ? "pointer-events-none opacity-35" : ""}`}
          style={{
            gridTemplateColumns: `repeat(5, minmax(0, 1fr))`,
            gridTemplateRows: `auto repeat(5, minmax(3rem, 1fr))`,
          }}
        >
          {board.categories.map((cat, idx) => (
            <div
              key={`${idx}-${cat}`}
              className="flex items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--accent)] px-2 py-3 text-center text-xs font-bold uppercase tracking-wide text-[var(--accent-foreground)] sm:text-sm"
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
                  disabled={cluePhase !== "board"}
                  title="Ctrl+Shift+click: debug toggle answered"
                  onClick={(e) => {
                    if (e.ctrlKey && e.shiftKey) {
                      e.preventDefault();
                      toggleDebugPlayedCell(col, row);
                      return;
                    }
                    selectCell(col, row);
                  }}
                  className={`relative flex items-center justify-center rounded-lg border border-[var(--border)] text-base font-bold transition sm:text-xl ${
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

            <div className="pointer-events-none fixed inset-x-0 top-16 bottom-56 z-10 flex flex-col items-center justify-center px-6">
              <div
                className={`pointer-events-none max-h-[70vh] w-full max-w-4xl overflow-auto rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-8 shadow-lg transition-transform duration-300 sm:p-12 ${
                  cluePhase === "question" ? "scale-100" : "scale-[1.02]"
                }`}
              >
                <p className="mb-2 text-center text-sm font-semibold text-[var(--foreground)]">
                  {board.categories[selected!.col]}
                </p>
                <p className="mb-4 text-center text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
                  {cluePhase === "question" ? "Question" : "Answer"} · $
                  {board.pointValues[selected!.row]}
                </p>
                <p className="text-center text-2xl font-semibold leading-snug text-[var(--foreground)] sm:text-4xl">
                  {cluePhase === "question" ? clue.question : clue.answer}
                </p>
              </div>
            </div>

            <footer className="pointer-events-none fixed inset-x-0 bottom-44 z-[40] flex justify-center px-3 sm:bottom-48">
              <div className="pointer-events-auto grid w-full max-w-4xl grid-cols-3 gap-2 sm:gap-3">
                {cluePhase === "question" ? (
                  <>
                    <div className="flex min-w-0 flex-col gap-2">
                      <button
                        type="button"
                        onClick={questionLeft}
                        className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 py-2.5 text-xs font-semibold text-[var(--foreground)] hover:bg-[var(--background)] sm:px-4 sm:py-3 sm:text-sm"
                      >
                        Back to board
                      </button>
                      <button
                        type="button"
                        onClick={consumeWithoutPoints}
                        className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-1 py-1.5 text-[0.65rem] font-medium leading-tight text-[var(--muted)] hover:bg-[var(--surface)] sm:text-xs"
                      >
                        Nobody correct — close clue (no points)
                      </button>
                    </div>
                    <div className="min-w-0">{buzzQueueColumn}</div>
                    <div className="flex min-w-0 items-start">
                      <button
                        type="button"
                        onClick={questionRight}
                        className="w-full rounded-lg bg-[var(--accent)] px-2 py-2.5 text-xs font-semibold text-[var(--accent-foreground)] sm:px-4 sm:py-3 sm:text-sm"
                      >
                        Show answer
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex min-w-0 items-start">
                      <button
                        type="button"
                        onClick={answerLeft}
                        className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 py-2.5 text-xs font-semibold text-[var(--foreground)] hover:bg-[var(--background)] sm:px-4 sm:py-3 sm:text-sm"
                      >
                        Back without consuming
                      </button>
                    </div>
                    <div className="min-w-0">{buzzQueueColumn}</div>
                    <div className="flex min-w-0 items-start">
                      <button
                        type="button"
                        onClick={handleNobodyPress}
                        className={`w-full rounded-lg border-2 bg-[var(--surface)] px-2 py-2.5 text-xs font-semibold text-[var(--foreground)] hover:bg-[var(--background)] sm:px-4 sm:py-3 sm:text-sm ${
                          awardPending?.kind === "nobody"
                            ? "border-[var(--accent)] ring-2 ring-[var(--accent)] ring-offset-2 ring-offset-[var(--background)]"
                            : "border-[var(--accent)]"
                        }`}
                      >
                        Nobody correct — no points
                      </button>
                    </div>
                  </>
                )}
              </div>
            </footer>
          </>
        ) : null}
      </main>
      {!setupPhase &&
      gameRound === 1 &&
      allCellsPlayed &&
      roundTwoBoard &&
      cluePhase === "board" ? (
        <div className="pointer-events-none fixed inset-x-0 bottom-32 right-0 z-[35] flex justify-end px-4 sm:bottom-36">
          <button
            type="button"
            onClick={startRoundTwo}
            className="pointer-events-auto rounded-lg bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-[var(--accent-foreground)] shadow-md"
          >
            Round Two
          </button>
        </div>
      ) : null}
      {!setupPhase &&
      gameRound === 2 &&
      allCellsPlayed &&
      cluePhase === "board" &&
      gamePhase === "boards" &&
      finalJeopardyClue ? (
        <div className="pointer-events-none fixed inset-x-0 bottom-32 right-0 z-[35] flex justify-end px-4 sm:bottom-36">
          <button
            type="button"
            onClick={startFinalJeopardy}
            className="pointer-events-auto rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 text-sm font-semibold text-[var(--foreground)] shadow-md"
          >
            Final Jeopardy
          </button>
        </div>
      ) : null}
      {contestants.length ? (
        <ContestantSignatureStrip
          contestants={contestants}
          awardEnabled={cluePhase === "answer" && selected !== null}
          pendingContestantId={
            awardPending?.kind === "player" ? awardPending.id : null
          }
          onContestantPress={handleContestantStripPressUnified}
        />
      ) : null}
    </div>
  );
}
