"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { readPlayerProfile } from "@minigames/shared";
import {
  normalizeLobbySeed,
  safeDecodeParam,
} from "@/lib/imposterUrlState";
import {
  readImposterState,
  writeImposterState,
} from "@/lib/imposterStorage";

export function GameClient({
  encodedSeed,
}: {
  encodedSeed: string;
}) {
  const lobbySeed = useMemo(
    () => normalizeLobbySeed(safeDecodeParam(encodedSeed)),
    [encodedSeed],
  );
  const [playerName, setPlayerName] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    queueMicrotask(() => {
      setPlayerName(readPlayerProfile()?.displayName?.trim() ?? "");
      if (!lobbySeed) return;
      const stored = readImposterState(lobbySeed);
      if (stored) setNotes(stored.notes);
    });
  }, [lobbySeed]);

  useEffect(() => {
    if (!lobbySeed) return;
    writeImposterState(lobbySeed, notes);
  }, [lobbySeed, notes]);

  if (!lobbySeed) {
    return (
      <div className="mx-auto max-w-lg px-4 py-10">
        <p className="text-[var(--muted,currentColor)]">
          This lobby seed is empty after trimming.
        </p>
        <Link
          href="/"
          className="mt-4 inline-block underline underline-offset-2 text-[var(--accent,currentColor)]"
        >
          Back home
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-5 px-3 py-6 sm:px-4">
      <header className="rounded-xl border border-[var(--border,currentColor)] bg-[var(--surface,transparent)] p-4">
        <h1 className="text-xl font-semibold text-[var(--foreground,currentColor)]">
          Imposter game skeleton
        </h1>
        <p className="mt-2 text-sm text-[var(--muted,currentColor)]">
          Lobby code: <span className="font-mono">{lobbySeed}</span>
        </p>
        {playerName ? (
          <p className="mt-1 text-sm text-[var(--muted,currentColor)]">
            Playing as {playerName}
          </p>
        ) : null}
      </header>

      <section className="rounded-xl border border-[var(--border,currentColor)] bg-[var(--surface,transparent)] p-4">
        <h2 className="text-base font-semibold text-[var(--foreground,currentColor)]">
          Placeholder round state
        </h2>
        <p className="mt-2 text-sm text-[var(--muted,currentColor)]">
          This textarea is persisted per lobby in local storage to provide a basic
          skeleton for future game-state wiring.
        </p>
        <label htmlFor="imposter-notes" className="sr-only">
          Round notes
        </label>
        <textarea
          id="imposter-notes"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          rows={6}
          placeholder="Write temporary game notes..."
          className="mt-3 w-full rounded-lg border border-[var(--border,currentColor)] bg-[var(--background,transparent)] px-3 py-2 text-sm text-[var(--foreground,currentColor)] outline-none ring-[var(--accent,currentColor)] focus:ring-2"
        />
      </section>

      <div>
        <Link
          href="/"
          className="inline-block rounded-lg border border-[var(--border,currentColor)] px-4 py-2 text-sm font-medium text-[var(--foreground,currentColor)]"
        >
          Leave lobby
        </Link>
      </div>
    </div>
  );
}
