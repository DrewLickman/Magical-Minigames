"use client";

import { useEffect, useRef, useState } from "react";

export function HostHeaderMenu({
  undoDisabled,
  redoDisabled,
  onUndo,
  onRedo,
}: {
  undoDisabled: boolean;
  redoDisabled: boolean;
  onUndo: () => void;
  onRedo: () => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const el = rootRef.current;
      if (!el || el.contains(e.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Menu"
        onClick={() => setOpen((v) => !v)}
        className="flex h-9 w-9 shrink-0 flex-col items-center justify-center gap-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] hover:bg-[var(--background)]"
      >
        <span className="block h-px w-4 bg-[var(--foreground)]" />
        <span className="block h-px w-4 bg-[var(--foreground)]" />
        <span className="block h-px w-4 bg-[var(--foreground)]" />
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-1 min-w-[10rem] rounded-lg border border-[var(--border)] bg-[var(--surface)] py-1 shadow-lg"
        >
          <button
            type="button"
            role="menuitem"
            disabled={undoDisabled}
            onClick={() => {
              setOpen(false);
              onUndo();
            }}
            className="block w-full px-3 py-2 text-left text-sm font-medium text-[var(--foreground)] hover:bg-[var(--background)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            Undo score change
          </button>
          <button
            type="button"
            role="menuitem"
            disabled={redoDisabled}
            onClick={() => {
              setOpen(false);
              onRedo();
            }}
            className="block w-full px-3 py-2 text-left text-sm font-medium text-[var(--foreground)] hover:bg-[var(--background)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            Redo score change
          </button>
        </div>
      ) : null}
    </div>
  );
}
