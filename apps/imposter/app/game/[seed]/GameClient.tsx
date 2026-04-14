"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { readPlayerProfile } from "@minigames/shared";
import { generateImposterRound } from "@/lib/generateImposterRound";
import { parseRoundSettingsFromSearchParams } from "@/lib/imposterGameParams";
import {
  readImposterState,
  writeImposterState,
} from "@/lib/imposterStorage";
import {
  normalizeLobbySeed,
  safeDecodeParam,
} from "@/lib/imposterUrlState";

export function GameClient({
  encodedSeed,
}: {
  encodedSeed: string;
}) {
  const searchParams = useSearchParams();
  const lobbySeed = useMemo(
    () => normalizeLobbySeed(safeDecodeParam(encodedSeed)),
    [encodedSeed],
  );

  const roundSettings = useMemo(
    () => parseRoundSettingsFromSearchParams(searchParams),
    [searchParams],
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

  if (!roundSettings) {
    return (
      <div className="mx-auto max-w-lg px-4 py-10">
        <p className="text-[var(--foreground,currentColor)]">
          Missing or invalid game link. Open the lobby from the home screen with
          seat, player count, and imposter count set.
        </p>
        <p className="mt-2 text-sm text-[var(--muted,currentColor)]">
          Lobby: <span className="font-mono">{lobbySeed}</span>
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

  const roundView = generateImposterRound({
    lobbySeed,
    players: roundSettings.players,
    imposters: roundSettings.imposters,
    playerSeat: roundSettings.playerSeat,
  });

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-5 px-3 py-6 sm:px-4">
      <header className="rounded-xl border border-[var(--border,currentColor)] bg-[var(--surface,transparent)] p-4">
        <h1 className="text-xl font-semibold text-[var(--foreground,currentColor)]">
          Imposter
        </h1>
        <p className="mt-2 text-sm text-[var(--muted,currentColor)]">
          Lobby{" "}
          <span className="font-mono text-[var(--foreground,currentColor)]">
            {lobbySeed}
          </span>
          {" · "}
          Seat {roundSettings.playerSeat} of {roundSettings.players}
          {" · "}
          {roundSettings.imposters} imposter
          {roundSettings.imposters === 1 ? "" : "s"}
        </p>
        {playerName ? (
          <p className="mt-1 text-sm text-[var(--muted,currentColor)]">
            Playing as {playerName}
          </p>
        ) : null}
      </header>

      <section className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-[var(--border,currentColor)] bg-[var(--surface,transparent)] p-4">
          <h2 className="text-sm font-medium uppercase tracking-wide text-[var(--muted,currentColor)]">
            Confirmation word
          </h2>
          <p className="mt-3 font-mono text-2xl font-semibold capitalize text-[var(--foreground,currentColor)]">
            {roundView.confirmationWord}
          </p>
          <p className="mt-2 text-xs text-[var(--muted,currentColor)]">
            Everyone at this table should see the same confirmation word.
          </p>
        </div>
        <div className="rounded-xl border border-[var(--border,currentColor)] bg-[var(--surface,transparent)] p-4">
          <h2 className="text-sm font-medium uppercase tracking-wide text-[var(--muted,currentColor)]">
            Secret word
          </h2>
          <p className="mt-3 font-mono text-2xl font-semibold capitalize text-[var(--foreground,currentColor)]">
            {roundView.secretWord}
          </p>
          <p className="mt-2 text-xs text-[var(--muted,currentColor)]">
            Discuss without revealing your word directly. Imposters see a
            different secret than the crew.
          </p>
        </div>
      </section>

      <section className="rounded-xl border border-[var(--border,currentColor)] bg-[var(--surface,transparent)] p-4">
        <h2 className="text-base font-semibold text-[var(--foreground,currentColor)]">
          Notes
        </h2>
        <p className="mt-2 text-sm text-[var(--muted,currentColor)]">
          Private notes for this lobby on this device (not shared).
        </p>
        <label htmlFor="imposter-notes" className="sr-only">
          Round notes
        </label>
        <textarea
          id="imposter-notes"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          rows={6}
          placeholder="Suspicions, clues, reminders…"
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
