"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  generateBoard,
  normalizeSeed,
  type Card,
  type CardType,
} from "@/lib/generateBoard";
import {
  BLUE_AGENT_GOAL,
  readLobbyRole,
  RED_AGENT_GOAL,
  writeLobbyRole,
  type LobbyRole,
} from "@/lib/lobbyRole";
import {
  STORAGE_VERSION,
  clearBoardState,
  clearLastLobbyPointer,
  readBoardState,
  setLastLobbyEncoded,
  writeBoardState,
  type TurnTimerState,
} from "@/lib/boardStorage";
import { GameActionsMenu } from "./GameActionsMenu";
import { nextLobbySeed } from "@/lib/nextLobbySeed";
import { readWordPackSelection } from "@/lib/wordPackPrefs";
import {
  buildWordPoolForEnabledPacks,
  formatPacksQuery,
  parsePacksQuery,
  resolveEnabledPackIds,
} from "@/lib/word-packs/mergeWordPool";
import { readPlayerProfile } from "@minigames/shared";

const TURN_SECONDS = 60;

function decodeSeedParam(encoded: string) {
  try {
    return decodeURIComponent(encoded);
  } catch {
    return encoded;
  }
}

function cellVisualClass(card: CardType, revealedCell: boolean, showIdentity: boolean) {
  if (!showIdentity) {
    return "board-cell--hidden";
  }
  if (revealedCell) {
    switch (card) {
      case "red":
        return "board-cell--revealed-red";
      case "blue":
        return "board-cell--revealed-blue";
      case "neutral":
        return "board-cell--revealed-neutral";
      case "assassin":
        return "board-cell--revealed-assassin";
      default:
        return "board-cell--hidden";
    }
  }
  switch (card) {
    case "red":
      return "board-cell--identity-red";
    case "blue":
      return "board-cell--identity-blue";
    case "neutral":
      return "board-cell--identity-neutral";
    case "assassin":
      return "board-cell--identity-assassin";
    default:
      return "board-cell--hidden";
  }
}

function TurnTimerButton({
  team,
  activeTurn,
  secondsLeft,
  onStart,
  borderClass,
  timersLocked,
}: {
  team: "red" | "blue";
  activeTurn: "red" | "blue" | null;
  secondsLeft: number;
  onStart: (t: "red" | "blue") => void;
  borderClass: string;
  timersLocked: boolean;
}) {
  const active = activeTurn === team && secondsLeft > 0;
  const fillPct = active ? (secondsLeft / TURN_SECONDS) * 100 : 0;
  const fillClass = team === "red" ? "turn-fill-red" : "turn-fill-blue";

  return (
    <button
      type="button"
      disabled={timersLocked}
      aria-disabled={timersLocked}
      onClick={() => {
        if (!timersLocked) onStart(team);
      }}
      className={`relative flex min-h-12 flex-1 overflow-hidden rounded-lg border-2 px-4 py-3 sm:max-w-xs ${borderClass} ${
        timersLocked ? "cursor-not-allowed opacity-50" : ""
      }`}
    >
      <span
        className="absolute inset-0 bg-[var(--surface)]"
        aria-hidden
      />
      <span
        className={`absolute inset-y-0 left-0 ${fillClass}`}
        style={{ width: `${fillPct}%` }}
        aria-hidden
      />
      <span className="relative z-10 mx-auto flex min-h-[2.5rem] flex-col items-center justify-center text-center text-sm font-semibold text-[var(--foreground)] [text-shadow:0_0_6px_var(--surface),0_0_2px_var(--surface)]">
        {active ? (
          <>
            <span className="font-mono text-lg tabular-nums">{secondsLeft}s</span>
            <span className="text-xs font-medium opacity-90">
              {team === "red" ? "Red" : "Blue"} turn
            </span>
          </>
        ) : team === "red" ? (
          "Start Red's Turn"
        ) : (
          "Start Blue's Turn"
        )}
      </span>
    </button>
  );
}

export function GameClient({
  encodedSeed,
}: {
  encodedSeed: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rulesDialogRef = useRef<HTMLDialogElement>(null);
  const rawFromUrl = decodeSeedParam(encodedSeed);
  const normalizedLobby = useMemo(() => normalizeSeed(rawFromUrl), [rawFromUrl]);

  const enabledPackIds = useMemo(() => {
    const fromUrl = parsePacksQuery(searchParams.get("packs"));
    const fromStorage = readWordPackSelection();
    return resolveEnabledPackIds(fromUrl, fromStorage);
  }, [searchParams]);

  const board = useMemo((): Card[] | null => {
    if (!normalizedLobby) return null;
    try {
      const pool = buildWordPoolForEnabledPacks(enabledPackIds);
      return generateBoard(rawFromUrl, pool);
    } catch {
      return null;
    }
  }, [rawFromUrl, normalizedLobby, enabledPackIds]);

  const [lobbyRole, setLobbyRole] = useState<LobbyRole | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [revealed, setRevealed] = useState<boolean[]>(() => Array(25).fill(false));
  const [stagedIndex, setStagedIndex] = useState<number | null>(null);
  const [storageReady, setStorageReady] = useState(false);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">("idle");
  const [hubDisplayName, setHubDisplayName] = useState("");

  const [activeTurn, setActiveTurn] = useState<"red" | "blue" | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [turnTimer, setTurnTimer] = useState<TurnTimerState | null>(null);
  const turnEndsAtRef = useRef<number | null>(null);
  const turnIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTurnTimer = useCallback(() => {
    if (turnIntervalRef.current) {
      clearInterval(turnIntervalRef.current);
      turnIntervalRef.current = null;
    }
  }, []);

  const beginTurnCountdown = useCallback(
    (team: "red" | "blue", endsAt: number) => {
      clearTurnTimer();
      turnEndsAtRef.current = endsAt;
      setTurnTimer({ team, endsAt });
      setActiveTurn(team);
      setSecondsLeft(
        Math.min(
          TURN_SECONDS,
          Math.max(0, Math.ceil((endsAt - Date.now()) / 1000)),
        ),
      );
      turnIntervalRef.current = setInterval(() => {
        const end = turnEndsAtRef.current;
        if (end == null) return;
        const left = Math.min(
          TURN_SECONDS,
          Math.max(0, Math.ceil((end - Date.now()) / 1000)),
        );
        setSecondsLeft(left);
        if (left <= 0) {
          clearTurnTimer();
          turnEndsAtRef.current = null;
          setTurnTimer(null);
          setActiveTurn(null);
        }
      }, 1000);
    },
    [clearTurnTimer],
  );

  const startTurn = useCallback(
    (team: "red" | "blue") => {
      if (!board) return;
      const assassinHit = board.some(
        (c, i) => c.role === "assassin" && revealed[i],
      );
      if (assassinHit) return;

      let redGuessed = 0;
      let blueGuessed = 0;
      board.forEach((card, i) => {
        if (!revealed[i]) return;
        if (card.role === "red") redGuessed += 1;
        if (card.role === "blue") blueGuessed += 1;
      });
      if (redGuessed >= RED_AGENT_GOAL || blueGuessed >= BLUE_AGENT_GOAL) return;

      const endsAt = Date.now() + TURN_SECONDS * 1000;
      beginTurnCountdown(team, endsAt);
    },
    [board, beginTurnCountdown, revealed],
  );

  useEffect(() => () => clearTurnTimer(), [clearTurnTimer]);

  useEffect(() => {
    queueMicrotask(() => {
      setHubDisplayName(readPlayerProfile()?.displayName?.trim() ?? "");
    });
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      if (!normalizedLobby) {
        setHydrated(true);
        setStorageReady(true);
        return;
      }
      const role = readLobbyRole(normalizedLobby);
      setLobbyRole(role);
      if (!board) {
        setHydrated(true);
        setStorageReady(true);
        return;
      }
      if (!role) {
        const lobbyForQuery = decodeSeedParam(encodedSeed).trim();
        router.replace(`/?lobby=${encodeURIComponent(lobbyForQuery)}`);
        return;
      }
      try {
        const parsed = readBoardState(normalizedLobby);
        if (parsed) {
          setRevealed(parsed.revealed);
          setStagedIndex(parsed.stagedIndex);
          if (role === "host" && parsed.turnTimer) {
            beginTurnCountdown(parsed.turnTimer.team, parsed.turnTimer.endsAt);
          }
        }
      } catch {
        /* ignore corrupt storage */
      }
      setHydrated(true);
      setStorageReady(true);
    });
  }, [beginTurnCountdown, board, encodedSeed, normalizedLobby, router]);

  useEffect(() => {
    if (!storageReady || !board || !normalizedLobby || !lobbyRole) return;
    let timerForWrite: TurnTimerState | null = turnTimer;
    if (lobbyRole !== "host") {
      const fromDisk = readBoardState(normalizedLobby);
      timerForWrite = fromDisk?.turnTimer ?? null;
    }
    writeBoardState(normalizedLobby, {
      v: STORAGE_VERSION,
      revealed,
      stagedIndex,
      turnTimer: timerForWrite,
    });
  }, [
    board,
    lobbyRole,
    normalizedLobby,
    revealed,
    stagedIndex,
    storageReady,
    turnTimer,
  ]);

  useEffect(() => {
    if (!board || !normalizedLobby) return;
    setLastLobbyEncoded(encodedSeed);
  }, [board, encodedSeed, normalizedLobby]);

  const hostCellClick = useCallback((index: number) => {
    setStagedIndex((staged) => {
      if (staged === index) {
        setRevealed((prev) => {
          if (prev[index]) return prev;
          const next = [...prev];
          next[index] = true;
          return next;
        });
        return null;
      }
      return index;
    });
  }, []);

  const copyLobbyLink = useCallback(async () => {
    const url = typeof window !== "undefined" ? window.location.href : "";
    try {
      await navigator.clipboard.writeText(url);
      setCopyState("copied");
      window.setTimeout(() => setCopyState("idle"), 2000);
    } catch {
      try {
        window.prompt("Copy this link:", url);
        setCopyState("idle");
      } catch {
        setCopyState("error");
        window.setTimeout(() => setCopyState("idle"), 2500);
      }
    }
  }, []);

  const scores = useMemo(() => {
    if (!board) return { redGuessed: 0, blueGuessed: 0 };
    let redGuessed = 0;
    let blueGuessed = 0;
    board.forEach((card, i) => {
      if (!revealed[i]) return;
      if (card.role === "red") redGuessed += 1;
      if (card.role === "blue") blueGuessed += 1;
    });
    return { redGuessed, blueGuessed };
  }, [board, revealed]);

  const gameOver = useMemo(() => {
    if (!board) return false;
    const assassinHit = board.some(
      (c, i) => c.role === "assassin" && revealed[i],
    );
    const redWins = scores.redGuessed >= RED_AGENT_GOAL;
    const blueWins = scores.blueGuessed >= BLUE_AGENT_GOAL;
    return assassinHit || redWins || blueWins;
  }, [board, revealed, scores.redGuessed, scores.blueGuessed]);

  const goToNextGame = useCallback(() => {
    if (!lobbyRole) return;
    const next = nextLobbySeed(normalizedLobby);
    clearBoardState(normalizedLobby);
    writeLobbyRole(next, lobbyRole);
    setLastLobbyEncoded(encodeURIComponent(next));
    const packs = formatPacksQuery(enabledPackIds);
    router.push(
      `/game/${encodeURIComponent(next)}?packs=${encodeURIComponent(packs)}`,
    );
  }, [enabledPackIds, lobbyRole, normalizedLobby, router]);

  const requestNextGame = useCallback(() => {
    if (
      !globalThis.confirm(
        "Start the next lobby on this device? You will get a new lobby code and a fresh board.",
      )
    ) {
      return;
    }
    goToNextGame();
  }, [goToNextGame]);

  useEffect(() => {
    if (!gameOver) return;
    queueMicrotask(() => {
      clearTurnTimer();
      turnEndsAtRef.current = null;
      setTurnTimer(null);
      setActiveTurn(null);
      setSecondsLeft(0);
    });
  }, [gameOver, clearTurnTimer]);

  const timersLocked = gameOver;

  if (!normalizedLobby) {
    return (
      <div className="mx-auto max-w-lg px-4 py-10">
        <p className="text-[var(--muted)]">
          This lobby seed is empty after trimming.
        </p>
        <Link
          href="/"
          className="mt-4 inline-block text-[var(--accent)] underline underline-offset-2"
        >
          Back home
        </Link>
      </div>
    );
  }

  if (!board) {
    return (
      <div className="mx-auto max-w-lg px-4 py-10">
        <p className="text-[var(--muted)]">
          Could not build a board for this lobby.
        </p>
        <Link
          href="/"
          className="mt-4 inline-block text-[var(--accent)] underline underline-offset-2"
        >
          Back home
        </Link>
      </div>
    );
  }

  if (!hydrated) {
    return (
      <div className="mx-auto max-w-lg px-4 py-10 text-[var(--muted)]">
        Loading…
      </div>
    );
  }

  const isHost = lobbyRole === "host";
  const isSpymaster = lobbyRole === "red_spymaster" || lobbyRole === "blue_spymaster";

  return (
    <div className="relative mx-auto w-full max-w-5xl px-3 py-4 sm:px-4 sm:py-6 md:pr-52">
      <div className="mb-4 flex flex-wrap justify-end gap-2 md:absolute md:right-4 md:top-6 md:mb-0 md:z-20 md:max-w-none">
        <GameActionsMenu
          showHostAndSpymasterActions={isHost || isSpymaster}
          onRules={() => rulesDialogRef.current?.showModal()}
          onNextGame={requestNextGame}
          onCopyLink={copyLobbyLink}
          copyState={copyState}
          newLobbyHref="/"
          onNewLobbyClick={() => {
            clearBoardState(normalizedLobby);
            clearLastLobbyPointer();
          }}
        />
      </div>

      <div className="flex flex-col gap-6 pt-0 md:pt-2">
        {isHost ? (
          <p className="text-center text-base font-medium text-[var(--foreground)] sm:text-lg md:text-2xl">
            <span className="text-[var(--muted)]">Lobby code: </span>
            <span className="font-mono tracking-tight text-[var(--foreground)]">
              {normalizedLobby}
            </span>
          </p>
        ) : (
          <>
            <p className="text-center text-base font-medium text-[var(--foreground)] sm:text-lg md:text-2xl">
              <span className="text-[var(--muted)]">Lobby code: </span>
              <span className="font-mono tracking-tight text-[var(--foreground)]">
                {normalizedLobby}
              </span>
            </p>
            <div className="flex justify-center">
              <span
                className={`inline-flex items-center rounded-full border-2 px-4 py-1.5 text-xs font-bold uppercase tracking-widest shadow-sm sm:text-sm ${
                  lobbyRole === "red_spymaster"
                    ? "border-[var(--lobby-red-border)] bg-[var(--lobby-red-bg)] text-[var(--lobby-red-fg)]"
                    : "border-[var(--lobby-blue-border)] bg-[var(--lobby-blue-bg)] text-[var(--lobby-blue-fg)]"
                }`}
              >
                {lobbyRole === "red_spymaster"
                  ? "Red Spymaster"
                  : "Blue Spymaster"}
              </span>
            </div>
          </>
        )}

        {hubDisplayName ? (
          <p className="text-center text-sm text-[var(--muted)]">
            Playing as {hubDisplayName}
          </p>
        ) : null}

        {isHost && (
          <>
            <div className="flex flex-wrap items-center justify-center gap-6 text-[var(--foreground)] sm:gap-10">
              <p className="text-lg font-semibold sm:text-xl">
                Red{" "}
                <span className="font-mono tabular-nums">
                  {scores.redGuessed}/{RED_AGENT_GOAL}
                </span>
              </p>
              <p className="text-lg font-semibold sm:text-xl">
                Blue{" "}
                <span className="font-mono tabular-nums">
                  {scores.blueGuessed}/{BLUE_AGENT_GOAL}
                </span>
              </p>
            </div>

            <div className="flex min-h-[7rem] flex-col items-stretch justify-center gap-3 sm:min-h-[3.5rem] sm:flex-row sm:items-center sm:justify-center">
              <div
                className={gameOver ? "invisible pointer-events-none" : ""}
                aria-hidden={gameOver}
              >
                <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-center">
                  <TurnTimerButton
                    team="red"
                    activeTurn={activeTurn}
                    secondsLeft={secondsLeft}
                    onStart={startTurn}
                    borderClass="border-[var(--lobby-red-border)]"
                    timersLocked={timersLocked}
                  />
                  <TurnTimerButton
                    team="blue"
                    activeTurn={activeTurn}
                    secondsLeft={secondsLeft}
                    onStart={startTurn}
                    borderClass="border-[var(--lobby-blue-border)]"
                    timersLocked={timersLocked}
                  />
                </div>
              </div>
            </div>
          </>
        )}

        {isSpymaster && !gameOver && (
          <p className="text-sm text-[var(--muted)]">
            Spymaster view: all card colors are visible. Guesses are marked on the
            host display.
          </p>
        )}

        <div
          className="grid grid-cols-5 gap-1.5 sm:gap-2 md:gap-3"
          role="grid"
          aria-label="Codenames board"
          data-board-view={isSpymaster ? "spymaster" : "default"}
        >
          {board.map((card, i) => {
            const showIdentity =
              isSpymaster || (isHost && revealed[i]);
            const revealedCell = revealed[i];
            const visual = cellVisualClass(card.role, revealedCell, showIdentity);
            const isStaged = isHost && stagedIndex === i && !revealedCell;
            const stagedClass = isStaged ? "board-cell--staged" : "";
            const canInteractHost = isHost && !revealedCell;
            const cellDisabled = isHost && revealedCell;

            let ariaLabel: string;
            if (showIdentity && revealedCell) {
              ariaLabel = `${card.word}, ${card.role}, revealed`;
            } else if (showIdentity) {
              ariaLabel = `${card.word}, ${card.role}`;
            } else if (isStaged) {
              ariaLabel = `${card.word}, staged. Press again to confirm showing the color.`;
            } else if (isHost) {
              ariaLabel = `${card.word}. Press once to stage, then again to confirm reveal.`;
            } else {
              ariaLabel = `Hidden card: ${card.word}`;
            }

            const assassinRevealed =
              revealedCell && card.role === "assassin";
            const wordCaseClass = assassinRevealed
              ? "font-semibold normal-case tracking-normal"
              : "font-semibold uppercase tracking-wide";

            return (
              <button
                key={`${i}-${card.word}`}
                type="button"
                role="gridcell"
                disabled={cellDisabled}
                aria-label={ariaLabel}
                onClick={() => {
                  if (canInteractHost) hostCellClick(i);
                }}
                className={`min-h-[3.5rem] rounded-lg px-0.5 py-1.5 text-center text-[length:clamp(0.625rem,2.4vw,0.875rem)] sm:min-h-[4.5rem] sm:px-1 sm:py-2 md:min-h-[5.5rem] md:text-sm ${revealedCell ? "border-2" : "border"} ${wordCaseClass} ${visual} ${stagedClass} ${
                  canInteractHost
                    ? "cursor-pointer hover:brightness-[1.02] active:brightness-[0.98]"
                    : "cursor-default"
                }`}
              >
                {assassinRevealed ? (
                  <span className="flex flex-col items-center justify-center gap-0.5 leading-tight">
                    <span aria-hidden>💥</span>
                    <span>
                      💥 {card.word} 💥
                    </span>
                    <span aria-hidden>💥</span>
                  </span>
                ) : (
                  card.word
                )}
              </button>
            );
          })}
        </div>
      </div>

      <dialog ref={rulesDialogRef} className="rules-dialog">
        <h2 className="mb-3 text-lg font-semibold text-[var(--foreground)]">
          Quick rules
        </h2>
        <div className="space-y-3 text-sm leading-relaxed text-[var(--muted)]">
          <p>
            Each turn the spymaster gives their field team a clue as{" "}
            <strong className="text-[var(--foreground)]">one word</strong> and a{" "}
            <strong className="text-[var(--foreground)]">number</strong>, for example{" "}
            <span className="font-mono text-[var(--foreground)]">cold 2</span>.
          </p>
          <p>
            The field team must guess{" "}
            <strong className="text-[var(--foreground)]">at least once</strong>, and
            may guess up to{" "}
            <strong className="text-[var(--foreground)]">the number plus one</strong>{" "}
            time in that turn (the extra guess can help catch up on words missed in
            earlier rounds).
          </p>
        </div>
        <form method="dialog" className="mt-5 flex justify-end">
          <button
            type="submit"
            className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-[var(--accent-foreground)]"
          >
            Close
          </button>
        </form>
      </dialog>
    </div>
  );
}
