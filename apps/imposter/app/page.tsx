"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { readPlayerProfile } from "@minigames/shared";
import { buildGamePath, readEntryQuery } from "@/lib/imposterUrlState";

export default function Home() {
  const router = useRouter();
  const [lobbySeed, setLobbySeed] = useState("");
  const [hubDisplayName, setHubDisplayName] = useState("");

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

  const canJoin = lobbySeed.trim().length > 0;

  const joinLobby = () => {
    if (!canJoin) return;
    const destination = buildGamePath(lobbySeed);
    router.push(destination);
  };

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-3 py-6 sm:px-4 sm:py-10">
      <main className="w-full max-w-xl space-y-6 rounded-xl border border-[var(--border,currentColor)] bg-[var(--surface,transparent)] p-4 shadow-sm sm:p-6">
        <div className="text-center">
          <h1 className="text-2xl font-semibold tracking-tight">Imposter</h1>
          <p className="mt-2 text-sm text-[var(--muted,currentColor)]">
            Skeleton lobby entry for the new minigame.
          </p>
          {hubDisplayName ? (
            <p className="mt-1 text-sm text-[var(--muted,currentColor)]">
              Playing as {hubDisplayName}
            </p>
          ) : null}
        </div>

        <div className="space-y-3">
          <label htmlFor="lobby-seed" className="block text-sm font-medium">
            Lobby code
          </label>
          <input
            id="lobby-seed"
            autoComplete="off"
            placeholder="e.g. SHADOW-7"
            value={lobbySeed}
            onChange={(event) => setLobbySeed(event.target.value.toUpperCase())}
            onKeyDown={(event) => {
              if (event.key === "Enter" && canJoin) joinLobby();
            }}
            className="w-full rounded-lg border border-[var(--border,currentColor)] bg-[var(--background,transparent)] px-3 py-2 font-mono uppercase tracking-wide text-[var(--foreground,currentColor)] outline-none ring-[var(--accent,currentColor)] focus:ring-2"
          />
          <button
            type="button"
            disabled={!canJoin}
            onClick={joinLobby}
            className="w-full rounded-lg bg-[var(--accent,currentColor)] px-4 py-2.5 text-sm font-medium text-[var(--accent-foreground,currentColor)] transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
          >
            Join lobby
          </button>
        </div>
      </main>
    </div>
  );
}
