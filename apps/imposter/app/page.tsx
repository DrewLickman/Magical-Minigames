"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { readPlayerProfile } from "@minigames/shared";
import {
  IMPOSTERS_MAX,
  IMPOSTERS_MIN,
  isValidRoundSettings,
  PLAYER_SEAT_MAX,
  PLAYER_SEAT_MIN,
  PLAYERS_MAX,
  PLAYERS_MIN,
  type RoundSettings,
} from "@/lib/imposterGameParams";
import { buildGamePath, readEntryQuery } from "@/lib/imposterUrlState";

export default function Home() {
  const router = useRouter();
  const [lobbySeed, setLobbySeed] = useState("");
  const [hubDisplayName, setHubDisplayName] = useState("");
  const [playerSeat, setPlayerSeat] = useState(1);
  const [players, setPlayers] = useState(6);
  const [imposters, setImposters] = useState(1);

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
    () => ({ playerSeat, players, imposters }),
    [playerSeat, players, imposters],
  );

  const trimmedLobby = lobbySeed.trim();
  const canJoin =
    trimmedLobby.length > 0 && isValidRoundSettings(settings);

  const joinLobby = () => {
    if (!canJoin) return;
    const destination = buildGamePath(trimmedLobby, {
      player: playerSeat,
      players,
      imposters,
    });
    router.push(destination);
  };

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-3 py-6 sm:px-4 sm:py-10">
      <main className="w-full max-w-xl space-y-6 rounded-xl border border-[var(--border,currentColor)] bg-[var(--surface,transparent)] p-4 shadow-sm sm:p-6">
        <div className="text-center">
          <h1 className="text-2xl font-semibold tracking-tight">Imposter</h1>
          <p className="mt-2 text-sm text-[var(--muted,currentColor)]">
            Enter the lobby code and your seat. Each device shows the same
            confirmation word and a secret word that differs for imposters.
          </p>
          {hubDisplayName ? (
            <p className="mt-1 text-sm text-[var(--muted,currentColor)]">
              Playing as {hubDisplayName}
            </p>
          ) : null}
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="lobby-seed" className="block text-sm font-medium">
              Lobby code
            </label>
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
              className="w-full rounded-lg border border-[var(--border,currentColor)] bg-[var(--background,transparent)] px-3 py-2 font-mono uppercase tracking-wide text-[var(--foreground,currentColor)] outline-none ring-[var(--accent,currentColor)] focus:ring-2"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <label
                htmlFor="player-seat"
                className="block text-sm font-medium"
              >
                Your seat (1–6)
              </label>
              <select
                id="player-seat"
                value={playerSeat}
                onChange={(e) =>
                  setPlayerSeat(Number.parseInt(e.target.value, 10))
                }
                className="w-full rounded-lg border border-[var(--border,currentColor)] bg-[var(--background,transparent)] px-3 py-2 text-sm text-[var(--foreground,currentColor)] outline-none ring-[var(--accent,currentColor)] focus:ring-2"
              >
                {Array.from(
                  { length: PLAYER_SEAT_MAX - PLAYER_SEAT_MIN + 1 },
                  (_, i) => PLAYER_SEAT_MIN + i,
                ).map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label
                htmlFor="total-players"
                className="block text-sm font-medium"
              >
                Players at table
              </label>
              <select
                id="total-players"
                value={players}
                onChange={(e) =>
                  setPlayers(Number.parseInt(e.target.value, 10))
                }
                className="w-full rounded-lg border border-[var(--border,currentColor)] bg-[var(--background,transparent)] px-3 py-2 text-sm text-[var(--foreground,currentColor)] outline-none ring-[var(--accent,currentColor)] focus:ring-2"
              >
                {Array.from(
                  { length: PLAYERS_MAX - PLAYERS_MIN + 1 },
                  (_, i) => PLAYERS_MIN + i,
                ).map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label
                htmlFor="imposter-count"
                className="block text-sm font-medium"
              >
                Imposters
              </label>
              <select
                id="imposter-count"
                value={imposters}
                onChange={(e) =>
                  setImposters(Number.parseInt(e.target.value, 10))
                }
                className="w-full rounded-lg border border-[var(--border,currentColor)] bg-[var(--background,transparent)] px-3 py-2 text-sm text-[var(--foreground,currentColor)] outline-none ring-[var(--accent,currentColor)] focus:ring-2"
              >
                {Array.from(
                  { length: IMPOSTERS_MAX - IMPOSTERS_MIN + 1 },
                  (_, i) => IMPOSTERS_MIN + i,
                ).map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {!isValidRoundSettings(settings) && trimmedLobby.length > 0 ? (
            <p className="text-sm text-[var(--muted,currentColor)]">
              Seat must be between 1 and the number of players, and there must
              be at least one non-imposter (players greater than imposters).
            </p>
          ) : null}

          <button
            type="button"
            disabled={!canJoin}
            onClick={joinLobby}
            className="w-full rounded-lg bg-[var(--accent,currentColor)] px-4 py-2.5 text-sm font-medium text-[var(--accent-foreground,currentColor)] transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
          >
            Enter game
          </button>
        </div>
      </main>
    </div>
  );
}
