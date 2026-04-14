"use client";

import { useEffect, useState } from "react";
import {
  defaultPlayerProfile,
  getCodenamesEntryUrl,
  getImposterEntryUrl,
  readPlayerProfile,
  writePlayerProfile,
  type PlayerProfile,
} from "@minigames/shared";

type GameId = "codenames" | "imposter";

export default function Home() {
  const [profile, setProfile] = useState<PlayerProfile>(defaultPlayerProfile);
  const [lobbyCode, setLobbyCode] = useState("");
  const [gameId, setGameId] = useState<GameId>("codenames");

  useEffect(() => {
    const stored = readPlayerProfile();
    if (stored) setProfile(stored);
  }, []);

  const persist = (next: PlayerProfile) => {
    setProfile(next);
    writePlayerProfile(next);
  };

  const trimmedLobby = lobbyCode.trim();
  const canJoin = trimmedLobby.length > 0;

  const join = () => {
    if (!canJoin) return;
    writePlayerProfile(profile);
    const displayName = profile.displayName.trim() || undefined;
    const url =
      gameId === "codenames"
        ? getCodenamesEntryUrl({
            lobbyCode: trimmedLobby,
            displayName,
          })
        : getImposterEntryUrl({
            lobbyCode: trimmedLobby,
            displayName,
          });
    window.location.assign(url);
  };

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-3 py-8 sm:px-4 sm:py-12">
      <main className="w-full max-w-md space-y-6 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm sm:p-6 md:max-w-lg md:p-8">
        <div className="text-center">
          <h1 className="text-xl font-semibold tracking-tight text-[var(--foreground)] sm:text-2xl">
            Minigames
          </h1>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Set your name, pick a game, enter a lobby code, and join.
          </p>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <label
              htmlFor="display-name"
              className="block text-xs font-semibold uppercase tracking-wide text-[var(--muted)]"
            >
              Display name
            </label>
            <input
              id="display-name"
              autoComplete="nickname"
              value={profile.displayName}
              onChange={(e) =>
                persist({ ...profile, displayName: e.target.value })
              }
              placeholder="How others see you"
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-[var(--foreground)] outline-none ring-[var(--accent)] focus:ring-2"
            />
          </div>

          <div className="space-y-2">
            <label
              htmlFor="player-number"
              className="block text-xs font-semibold uppercase tracking-wide text-[var(--muted)]"
            >
              Player number
            </label>
            <input
              id="player-number"
              inputMode="numeric"
              autoComplete="off"
              value={profile.playerNumber}
              onChange={(e) =>
                persist({ ...profile, playerNumber: e.target.value })
              }
              placeholder="e.g. 1"
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 font-mono text-[var(--foreground)] outline-none ring-[var(--accent)] focus:ring-2"
            />
          </div>

          <div className="space-y-2">
            <label
              htmlFor="game"
              className="block text-xs font-semibold uppercase tracking-wide text-[var(--muted)]"
            >
              Game
            </label>
            <select
              id="game"
              value={gameId}
              onChange={(e) => setGameId(e.target.value as GameId)}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-[var(--foreground)] outline-none ring-[var(--accent)] focus:ring-2"
            >
              <option value="codenames">Codenames</option>
              <option value="imposter">Imposter</option>
            </select>
          </div>

          <div className="space-y-2">
            <label
              htmlFor="lobby"
              className="block text-xs font-semibold uppercase tracking-wide text-[var(--muted)]"
            >
              Lobby code
            </label>
            <input
              id="lobby"
              autoComplete="off"
              value={lobbyCode}
              onChange={(e) => setLobbyCode(e.target.value.toUpperCase())}
              onKeyDown={(e) => {
                if (e.key === "Enter" && canJoin) {
                  join();
                }
              }}
              placeholder="e.g. LIVING-ROOM-7"
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 font-mono uppercase tracking-wide text-[var(--foreground)] outline-none ring-[var(--accent)] focus:ring-2"
            />
          </div>

          <button
            type="button"
            disabled={!canJoin}
            onClick={join}
            className="w-full rounded-lg bg-[var(--accent)] px-4 py-2.5 text-sm font-medium text-[var(--accent-foreground)] transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
          >
            Join game
          </button>
        </div>
      </main>
    </div>
  );
}
