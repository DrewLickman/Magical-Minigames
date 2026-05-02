"use client";

import type { BoardModel } from "@/lib/boardJson";
import type { FinalJeopardyClue } from "@/lib/finalJeopardyJson";

type Props = {
  board: BoardModel | null;
  boardError: string | null;
  importHint: string | null;
  roundTwoImportHint: string | null;
  fjImportHint: string | null;
  finalJeopardyClue: FinalJeopardyClue | null;
  templateHref: string;
  roundTwoTemplateHref: string;
  finalJeopardyTemplateHref: string;
  onImportRoundOne: (file: File) => void;
  onImportRoundTwo: (file: File) => void;
  onImportFinalJeopardy: (file: File) => void;
};

function ActionUpload({
  label,
  onPick,
  primary = false,
}: {
  label: string;
  onPick: (file: File) => void;
  primary?: boolean;
}) {
  return (
    <label
      className={`inline-flex h-11 w-full cursor-pointer items-center justify-center rounded-lg px-4 text-center text-sm font-semibold transition ${
        primary
          ? "bg-[var(--accent)] text-[var(--accent-foreground)]"
          : "border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] hover:bg-[var(--surface)]"
      }`}
    >
      {label}
      <input
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) onPick(f);
        }}
      />
    </label>
  );
}

export function BoardJsonActionsPanel({
  board,
  boardError,
  importHint,
  roundTwoImportHint,
  fjImportHint,
  finalJeopardyClue,
  templateHref,
  roundTwoTemplateHref,
  finalJeopardyTemplateHref,
  onImportRoundOne,
  onImportRoundTwo,
  onImportFinalJeopardy,
}: Props) {
  return (
    <section className="flex min-h-0 flex-col space-y-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 xl:h-full">
      <div className="flex min-h-0 flex-1 flex-col space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
          Board JSON
        </h2>

        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
            Round Boards
          </p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <ActionUpload
              label="Import Round 1 JSON"
              onPick={onImportRoundOne}
              primary
            />
            <ActionUpload
              label="Import Round 2 JSON"
              onPick={onImportRoundTwo}
              primary
            />
          </div>
        </div>

        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
            Final Jeopardy
          </p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <ActionUpload
              label="Import Final Jeopardy JSON"
              onPick={onImportFinalJeopardy}
              primary
            />
          </div>
        </div>
      </div>

      <div className="mt-auto space-y-4">
        <div className="space-y-1 border-t border-[var(--border)] pt-3 text-xs text-[var(--muted)]">
          <p className="font-semibold uppercase tracking-wide text-[var(--muted)]">
            Templates
          </p>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            <a
              href={templateHref}
              download
              className="text-[var(--accent)] underline"
            >
              Download Round 1 Template
            </a>
            <a
              href={roundTwoTemplateHref}
              download
              className="text-[var(--accent)] underline"
            >
              Download Round 2 Template
            </a>
            <a
              href={finalJeopardyTemplateHref}
              download
              className="text-[var(--accent)] underline"
            >
              Download Final Jeopardy Template
            </a>
          </div>
        </div>

        <div className="min-h-24 space-y-1">
          {boardError ? (
            <p className="text-sm text-[var(--danger)]">{boardError}</p>
          ) : null}
          {importHint ? <p className="text-sm text-[var(--muted)]">{importHint}</p> : null}
          {roundTwoImportHint ? (
            <p className="text-sm text-[var(--muted)]">{roundTwoImportHint}</p>
          ) : null}
          {fjImportHint ? <p className="text-sm text-[var(--muted)]">{fjImportHint}</p> : null}
          {finalJeopardyClue ? (
            <p className="text-xs text-[var(--muted)]">
              Final Jeopardy category: {finalJeopardyClue.category}
            </p>
          ) : null}
          {board ? (
            <p className="text-xs text-[var(--muted)]">
              Loaded categories: {board.categories.join(" · ")}
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
