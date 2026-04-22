"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef } from "react";

export function GameActionsMenu({
  onNextGame,
  returnToLobbyHref,
}: {
  onNextGame: () => void;
  returnToLobbyHref: string;
}) {
  const detailsRef = useRef<HTMLDetailsElement>(null);

  const closeMenu = useCallback(() => {
    const el = detailsRef.current;
    if (el) el.open = false;
  }, []);

  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      const el = detailsRef.current;
      if (!el?.open) return;
      if (el.contains(e.target as Node)) return;
      el.open = false;
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  const itemClass =
    "flex w-full items-center rounded-md px-3 py-2.5 text-left text-sm font-medium text-[var(--foreground)] hover:bg-[var(--background)]";

  return (
    <details ref={detailsRef} className="relative z-30">
      <summary
        className="cursor-pointer list-none rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm font-medium text-[var(--foreground)] shadow-sm marker:hidden [&::-webkit-details-marker]:hidden"
        aria-label="Game menu"
      >
        <span className="flex items-center gap-2">
          Menu
          <span className="text-[var(--muted)]" aria-hidden>
            ▾
          </span>
        </span>
      </summary>
      <div className="absolute right-0 top-full z-30 mt-1 min-w-[12rem] rounded-lg border border-[var(--border)] bg-[var(--surface)] p-1 shadow-sm">
        <button
          type="button"
          className={`${itemClass} font-semibold text-[var(--foreground)]`}
          onClick={() => {
            closeMenu();
            onNextGame();
          }}
        >
          Next Game ▶
        </button>
        <Link
          href={returnToLobbyHref}
          className={itemClass}
          onClick={() => closeMenu()}
        >
          Return to Lobby ↩
        </Link>
      </div>
    </details>
  );
}
