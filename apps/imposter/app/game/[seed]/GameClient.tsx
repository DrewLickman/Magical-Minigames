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
  buildHomePathWithLobby,
  normalizeLobbySeed,
  safeDecodeParam,
} from "@/lib/imposterUrlState";

function imposterCountLine(count: number): string {
  if (count === 1) return "There is 1 imposter!";
  return `There are ${count} imposters!`;
}

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

  const homeWithLobby =
    lobbySeed.length > 0 ? buildHomePathWithLobby(lobbySeed) : "/";

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
        <p className="text-[var(--muted)]">
          This lobby seed is empty after trimming.
        </p>
        <Link
          href="/"
          className="mt-4 inline-block underline underline-offset-2 text-[var(--accent)]"
        >
          Back home
        </Link>
      </div>
    );
  }

  if (!roundSettings) {
    return (
      <div className="mx-auto max-w-lg px-4 py-10">
        <p className="text-[var(--foreground)]">
          Missing or invalid game link. Open the lobby from the home screen with
          seat, player count, and imposter count set.
        </p>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Lobby code:{" "}
          <span className="font-mono text-[var(--foreground)]">{lobbySeed}</span>
        </p>
        <Link
          href={homeWithLobby}
          className="mt-4 inline-block underline underline-offset-2 text-[var(--accent)]"
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
      <header className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <h1 className="text-xl font-semibold text-[var(--foreground)]">
          Imposter Game
        </h1>
        <p className="mt-3 text-sm text-[var(--foreground)]">
          Lobby code:{" "}
          <span className="font-mono">{lobbySeed}</span>
        </p>
        <p className="mt-1 text-sm text-[var(--foreground)]">
          Seat: {roundSettings.playerSeat}
        </p>
        <p className="mt-1 text-sm text-[var(--foreground)]">
          {imposterCountLine(roundSettings.imposters)}
        </p>
        {playerName ? (
          <p className="mt-2 text-sm text-[var(--muted)]">
            Playing as {playerName}
          </p>
        ) : null}
      </header>

      <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <h2 className="text-sm font-medium text-[var(--muted)]">
          Confirmation word / Secret word
        </h2>
        <div className="mt-2 flex flex-wrap items-baseline gap-x-4 gap-y-1 font-mono text-xl font-semibold capitalize text-[var(--foreground)] sm:text-2xl">
          <span>{roundView.confirmationWord}</span>
          <span className="text-[var(--muted)]" aria-hidden>
            /
          </span>
          <span>{roundView.secretWord}</span>
        </div>
        <p className="mt-3 text-sm font-bold text-[var(--foreground)] underline">
          Imposters see a different secret word than the crew.
        </p>
      </section>

      <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <h2 className="text-base font-semibold text-[var(--foreground)]">
          Notes
        </h2>
        <p className="mt-2 text-sm text-[var(--muted)]">
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
          className="mt-3 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] outline-none ring-[var(--accent)] focus:ring-2"
        />
      </section>

      <div>
        <Link
          href={homeWithLobby}
          className="inline-block rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--foreground)]"
        >
          Leave lobby
        </Link>
      </div>
    </div>
  );
}
