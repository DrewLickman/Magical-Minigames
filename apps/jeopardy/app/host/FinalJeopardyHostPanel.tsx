"use client";

import type { Contestant } from "@/lib/hostStorage";
import type { FinalJeopardyClue } from "@/lib/finalJeopardyJson";

export type FinalJeopardyHostUiPhase = "wager" | "question" | "grading" | "winner";

export function FinalJeopardyHostPanel({
  clue,
  uiPhase,
  secondsLeft,
  wagerStatusLines,
  revealQuestionDisabled,
  onRevealQuestion,
  canonicalAnswer,
  gradingActiveName,
  gradingWager,
  gradingAnswer,
  showGradingActions,
  onCorrect,
  onIncorrect,
  showNextContestant,
  onNextContestant,
  showRevealWinnerButton,
  onRevealWinner,
}: {
  clue: FinalJeopardyClue;
  uiPhase: FinalJeopardyHostUiPhase;
  secondsLeft: number | null;
  wagerStatusLines: string[];
  revealQuestionDisabled: boolean;
  onRevealQuestion: () => void;
  canonicalAnswer: string;
  gradingActiveName: string;
  gradingWager: number | null;
  gradingAnswer: string | null;
  showGradingActions: boolean;
  onCorrect: () => void;
  onIncorrect: () => void;
  showNextContestant: boolean;
  onNextContestant: () => void;
  showRevealWinnerButton: boolean;
  onRevealWinner: () => void;
}) {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center gap-6 px-3 pb-40 pt-6">
      <p className="text-center text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
        Final Jeopardy
      </p>
      <h2 className="text-center text-2xl font-bold text-[var(--foreground)] sm:text-3xl">
        {clue.category}
      </h2>

      {uiPhase === "wager" ? (
        <>
          <p className="text-center text-sm text-[var(--muted)]">
            Players are entering wagers on their devices. Amounts stay hidden
            until you review each response.
          </p>
          <ul className="w-full max-w-md space-y-2 text-sm text-[var(--foreground)]">
            {wagerStatusLines.length ? (
              wagerStatusLines.map((line, i) => (
                <li key={i} className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2">
                  {line}
                </li>
              ))
            ) : (
              <li className="text-center text-[var(--muted)]">No wagers yet.</li>
            )}
          </ul>
          <button
            type="button"
            disabled={revealQuestionDisabled}
            onClick={onRevealQuestion}
            className="rounded-xl bg-[var(--accent)] px-8 py-4 text-base font-semibold text-[var(--accent-foreground)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            Reveal question
          </button>
        </>
      ) : null}

      {uiPhase === "question" ? (
        <div className="w-full max-w-3xl space-y-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-lg">
          <p className="text-center text-2xl font-semibold leading-snug text-[var(--foreground)] sm:text-3xl">
            {clue.question}
          </p>
          <p
            className={`text-center font-mono text-3xl font-bold ${
              secondsLeft !== null && secondsLeft <= 10
                ? "text-[var(--danger)]"
                : "text-[var(--foreground)]"
            }`}
          >
            {secondsLeft != null ? `${secondsLeft}s` : "—"}
          </p>
          <p className="text-center text-xs text-[var(--muted)]">
            Contestants have 30 seconds to submit. Answers lock when time
            expires.
          </p>
        </div>
      ) : null}

      {uiPhase === "grading" ? (
        <div className="w-full max-w-2xl space-y-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
          <p className="text-center text-sm font-semibold text-[var(--foreground)]">
            {gradingActiveName || "Select a contestant below"}
          </p>
          {gradingWager !== null ? (
            <p className="text-center font-mono text-lg text-[var(--foreground)]">
              Wager: ${gradingWager}
            </p>
          ) : null}
          {gradingAnswer !== null ? (
            <p className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-center text-[var(--foreground)]">
              {gradingAnswer || "(No response)"}
            </p>
          ) : null}
          <p className="text-center text-xs text-[var(--muted)]">
            Reference: {canonicalAnswer}
          </p>
          {showGradingActions ? (
            <div className="flex flex-wrap justify-center gap-2">
              <button
                type="button"
                onClick={onCorrect}
                className="rounded-lg bg-[var(--success)] px-4 py-2 text-sm font-semibold text-[var(--accent-foreground)]"
              >
                Correct (+wager)
              </button>
              <button
                type="button"
                onClick={onIncorrect}
                className="rounded-lg border border-[var(--danger)] bg-[var(--background)] px-4 py-2 text-sm font-semibold text-[var(--danger)]"
              >
                Incorrect (−wager)
              </button>
            </div>
          ) : null}
          {showNextContestant ? (
            <div className="flex justify-center">
              <button
                type="button"
                onClick={onNextContestant}
                className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-4 py-2 text-sm font-medium text-[var(--foreground)]"
              >
                Next contestant
              </button>
            </div>
          ) : null}
          {showRevealWinnerButton ? (
            <div className="flex justify-center pt-2">
              <button
                type="button"
                onClick={onRevealWinner}
                className="rounded-xl bg-[var(--accent)] px-6 py-3 text-sm font-semibold text-[var(--accent-foreground)]"
              >
                Reveal winner
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {uiPhase === "winner" ? (
        <p className="text-center text-sm text-[var(--muted)]">
          See the winner on screen above.
        </p>
      ) : null}
    </div>
  );
}

export function FinalJeopardyWinnerOverlay({
  winners,
}: {
  winners: Contestant[];
}) {
  if (!winners.length) return null;
  return (
    <div className="pointer-events-auto fixed inset-0 z-[60] flex flex-col items-center justify-center gap-8 bg-[var(--background)]/95 px-6 backdrop-blur">
      <p className="text-center text-sm font-semibold uppercase tracking-[0.3em] text-[var(--muted)]">
        Winner
      </p>
      <div className="flex max-w-full flex-wrap items-start justify-center gap-10">
        {winners.map((c) => (
          <div
            key={c.id}
            className="flex max-w-sm flex-col items-center gap-4 text-center"
          >
            <div className="flex h-40 w-64 items-center justify-center overflow-hidden rounded-xl border-4 border-[var(--accent)] bg-[var(--surface)] shadow-lg">
              {c.signatureImage ? (
                <img
                  src={`data:image/png;base64,${c.signatureImage}`}
                  alt=""
                  className="max-h-full max-w-full object-contain"
                />
              ) : (
                <span className="text-[var(--muted)]">—</span>
              )}
            </div>
            <p className="text-2xl font-bold text-[var(--foreground)] sm:text-3xl">
              {c.name.trim() || "Player"}
            </p>
            <p className="font-mono text-4xl font-black text-[var(--accent)] sm:text-5xl">
              ${c.score}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
