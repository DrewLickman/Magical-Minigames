"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { readPlayerProfile } from "@minigames/shared";
import { isValidRoundSettings, type RoundSettings } from "@/lib/spyfallGameParams";
import { buildGamePath, readEntryQuery } from "@/lib/spyfallUrlState";
import { SpyfallLobbyMenu } from "./SpyfallLobbyMenu";

const PLAYER_COUNTS = [3, 4, 5, 6] as const;
const SPY_COUNTS = [1, 2] as const;

function countButtonClass(selected: boolean): string {
  const base =
    "min-w-[2.75rem] rounded-lg border px-3 py-2 text-sm font-semibold transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]";
  if (selected) {
    return `${base} border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_22%,var(--surface))] text-[var(--foreground)]`;
  }
  return `${base} border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] hover:border-[var(--muted)]`;
}

export default function Home() {
  const router = useRouter();
  const [lobbySeed, setLobbySeed] = useState("");
  const [hubDisplayName, setHubDisplayName] = useState("");
  const [playerSeat, setPlayerSeat] = useState(1);
  const [players, setPlayers] = useState(6);
  const [spies, setSpies] = useState(1);

  useEffect(() => {
    queueMicrotask(() => {
      if (typeof window === "undefined") return;
      const queryState = readEntryQuery(window.location.search);
      if (queryState.lobby) setLobbySeed(queryState.lobby);
      if (queryState.name) {
        setHubDisplayName(queryState.name);
      } else {
        const fromProfile = readPlayerProfile()?.displayName?.trim();
        if (fromProfile) setHubDisplayName(fromProfile);
      }
      if (queryState.hadQuery) {
        window.history.replaceState(
          {},
          "",
          `${window.location.pathname}${window.location.hash}`,
        );
      }
    });
  }, []);

  const settings: RoundSettings = useMemo(
    () => ({ playerSeat, players, spies }),
    [playerSeat, players, spies],
  );

  const trimmedLobby = lobbySeed.trim();
  const canJoin =
    trimmedLobby.length > 0 && isValidRoundSettings(settings);

  const joinLobby = () => {
    if (!canJoin) return;
    const destination = buildGamePath(trimmedLobby, {
      player: playerSeat,
      players,
      spies,
    });
    router.push(destination);
  };

  return (
    <div className="relative flex flex-1 flex-col items-center justify-center px-3 py-6 sm:px-4 sm:py-10">
      <div className="absolute right-3 top-4 z-30 sm:right-4 sm:top-6">
        <SpyfallLobbyMenu />
      </div>
      <main className="w-full max-w-xl space-y-6 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm sm:p-6">
        <div className="text-center">
          <h1 className="text-2xl font-semibold tracking-tight">Spyfall</h1>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Enter the lobby code and your seat. Everyone sees the same category;
            crew and spies get different secret words from that category.
          </p>
          {hubDisplayName ? (
            <p className="mt-1 text-sm text-[var(--muted)]">
              Playing as {hubDisplayName}
            </p>
          ) : null}
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="lobby-seed" className="block text-sm font-medium">
              Lobby code
            </label>
            <div className="relative">
              <input
                id="lobby-seed"
                autoComplete="off"
                placeholder="e.g. SHADOW-7"
                value={lobbySeed}
                onChange={(event) =>
                  setLobbySeed(event.target.value.toUpperCase())
                }
                onKeyDown={(event) => {
                  if (event.key === "Enter" && canJoin) joinLobby();
                }}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] py-2 pl-3 pr-10 font-mono uppercase tracking-wide text-[var(--foreground)] outline-none ring-[var(--accent)] focus:ring-2"
              />
              {lobbySeed.length > 0 ? (
                <button
                  type="button"
                  aria-label="Clear lobby code"
                  onClick={() => setLobbySeed("")}
                  className="absolute right-1 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-lg leading-none text-[var(--muted)] hover:bg-[color-mix(in_srgb,var(--foreground)_08%,transparent)] hover:text-[var(--foreground)]"
                >
                  ×
                </button>
              ) : null}
            </div>
          </div>

          <div className="space-y-2">
            <span className="block text-sm font-medium">Total Player Count</span>
            <div className="flex flex-wrap gap-2">
              {PLAYER_COUNTS.map((n) => (
                <button
                  key={n}
                  type="button"
                  className={countButtonClass(players === n)}
                  onClick={() => {
                    setPlayers(n);
                    setPlayerSeat((s) => (s > n ? n : s));
                  }}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <span className="block text-sm font-medium">Spy Count</span>
            <div className="flex flex-wrap gap-2">
              {SPY_COUNTS.map((n) => (
                <button
                  key={n}
                  type="button"
                  className={countButtonClass(spies === n)}
                  onClick={() => setSpies(n)}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <span className="block text-sm font-medium">Seat Number</span>
            <div className="flex flex-wrap gap-2">
              {Array.from({ length: players }, (_, i) => i + 1).map((n) => (
                <button
                  key={n}
                  type="button"
                  className={countButtonClass(playerSeat === n)}
                  onClick={() => setPlayerSeat(n)}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          {!isValidRoundSettings(settings) && trimmedLobby.length > 0 ? (
            <p className="text-sm text-[var(--muted)]">
              Seat must be between 1 and the number of players, and there must
              be at least one crew member (players greater than spies).
            </p>
          ) : null}

          <button
            type="button"
            disabled={!canJoin}
            onClick={joinLobby}
            className="w-full rounded-lg bg-[var(--accent)] px-4 py-2.5 text-sm font-medium text-[var(--accent-foreground)] transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
          >
            Enter game
          </button>
        </div>
      </main>
    </div>
  );
}
