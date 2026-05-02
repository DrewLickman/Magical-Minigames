"use client";

import type { Contestant } from "@/lib/hostStorage";

export function ContestantSignatureStrip({
  contestants,
  awardEnabled,
  pendingContestantId,
  onContestantPress,
  variant = "play",
  finalJeopardyGradingEnabled = false,
  finalJeopardyEligibleContestantIds = null,
}: {
  contestants: Contestant[];
  awardEnabled: boolean;
  pendingContestantId: string | null;
  onContestantPress: (contestantId: string) => void;
  variant?: "play" | "finalJeopardy";
  finalJeopardyGradingEnabled?: boolean;
  /** When set in Final Jeopardy grading, only these contestant ids accept presses. */
  finalJeopardyEligibleContestantIds?: Set<string> | null;
}) {
  if (!contestants.length) return null;

  return (
    <div className="pointer-events-auto fixed inset-x-0 bottom-0 z-[25] border-t border-[var(--border)] bg-[var(--background)]/98 backdrop-blur">
      <div className="flex max-w-full flex-wrap justify-center gap-3 px-3 py-3">
        {contestants.map((c) => {
          const pending = pendingContestantId === c.id;
          const fjOk =
            variant === "finalJeopardy" &&
            finalJeopardyGradingEnabled &&
            (finalJeopardyEligibleContestantIds?.has(c.id) ?? false);
          const enabled = variant === "finalJeopardy" ? fjOk : awardEnabled;
          return (
            <button
              key={c.id}
              type="button"
              disabled={!enabled}
              title={c.name.trim() || "Contestant"}
              onClick={() => onContestantPress(c.id)}
              className={`flex w-[7.5rem] shrink-0 flex-col items-stretch gap-1 rounded-lg border-2 bg-[var(--surface)] p-2 text-left outline-none ring-offset-2 ring-offset-[var(--background)] transition hover:bg-[var(--background)] focus-visible:ring-2 focus-visible:ring-[var(--accent)] disabled:cursor-default disabled:opacity-50 ${
                pending
                  ? "border-[var(--accent)] ring-2 ring-[var(--accent)]"
                  : "border-[var(--accent)]"
              }`}
            >
              <div className="relative flex h-24 w-full items-center justify-center overflow-hidden rounded border border-[var(--border)] bg-[var(--background)]">
                {c.signatureImage ? (
                  <img
                    src={`data:image/png;base64,${c.signatureImage}`}
                    alt=""
                    className="max-h-full max-w-full object-contain"
                  />
                ) : (
                  <span className="text-xs text-[var(--muted)]">—</span>
                )}
              </div>
              <span className="line-clamp-2 text-center text-xs font-medium leading-tight text-[var(--foreground)]">
                {c.name.trim() || "Player"}{" "}
                <span className="font-mono font-semibold text-[var(--muted)]">
                  ${c.score}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
