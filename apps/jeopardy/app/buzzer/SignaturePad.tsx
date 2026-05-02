"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";

const EXPORT_MAX_W = 320;
const EXPORT_MAX_H = 160;

export type SignaturePadHandle = {
  clear: () => void;
  /** PNG base64 without `data:image/png;base64,` prefix, or null if empty */
  getPngBase64: () => string | null;
};

type Props = {
  onInkChange?: (hasInk: boolean) => void;
  className?: string;
};

function readCssColor(varName: string): string {
  if (typeof window === "undefined") return "";
  return getComputedStyle(document.documentElement)
    .getPropertyValue(varName)
    .trim();
}

function exportScaledPngBase64(source: HTMLCanvasElement): string | null {
  const w = source.width;
  const h = source.height;
  if (w === 0 || h === 0) return null;

  const scale = Math.min(EXPORT_MAX_W / w, EXPORT_MAX_H / h, 1);
  const tw = Math.max(1, Math.round(w * scale));
  const th = Math.max(1, Math.round(h * scale));
  const out = document.createElement("canvas");
  out.width = tw;
  out.height = th;
  const octx = out.getContext("2d");
  if (!octx) return null;
  octx.drawImage(source, 0, 0, tw, th);
  const dataUrl = out.toDataURL("image/png");
  const prefix = "data:image/png;base64,";
  if (!dataUrl.startsWith(prefix)) return null;
  return dataUrl.slice(prefix.length);
}

export const SignaturePad = forwardRef<SignaturePadHandle, Props>(
  function SignaturePad({ onInkChange, className }, ref) {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const wrapRef = useRef<HTMLDivElement | null>(null);
    const drawing = useRef(false);
    const [hasInk, setHasInk] = useState(false);
    const hasInkRef = useRef(false);
    const last = useRef<{ x: number; y: number } | null>(null);

    const syncInk = useCallback(
      (next: boolean) => {
        hasInkRef.current = next;
        setHasInk(next);
        onInkChange?.(next);
      },
      [onInkChange],
    );

    const clear = useCallback(() => {
      const c = canvasRef.current;
      if (!c) return;
      const ctx = c.getContext("2d");
      if (!ctx) return;
      const bg = readCssColor("--background");
      if (bg) {
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, c.width, c.height);
      } else {
        ctx.clearRect(0, 0, c.width, c.height);
      }
      syncInk(false);
      last.current = null;
    }, [syncInk]);

    const getPngBase64 = useCallback((): string | null => {
      const c = canvasRef.current;
      if (!c || !hasInk) return null;
      return exportScaledPngBase64(c);
    }, [hasInk]);

    useImperativeHandle(ref, () => ({ clear, getPngBase64 }), [clear, getPngBase64]);

    useEffect(() => {
      const wrap = wrapRef.current;
      const c = canvasRef.current;
      if (!wrap || !c) return;

      const layoutCanvas = () => {
        const prevHadInk = hasInkRef.current;
        let snapshot: string | null = null;
        if (prevHadInk && c.width > 0 && c.height > 0) {
          try {
            snapshot = c.toDataURL("image/png");
          } catch {
            snapshot = null;
          }
        }

        const rect = wrap.getBoundingClientRect();
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const cw = Math.max(1, Math.round(rect.width * dpr));
        const ch = Math.max(1, Math.round(rect.height * dpr));
        c.width = cw;
        c.height = ch;
        const ctx = c.getContext("2d");
        if (!ctx) return;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        const lw = rect.width;
        const lh = rect.height;
        const fillBg = (context: CanvasRenderingContext2D) => {
          const bg = readCssColor("--background");
          if (bg) {
            context.fillStyle = bg;
            context.fillRect(0, 0, lw, lh);
          } else {
            context.clearRect(0, 0, lw, lh);
          }
        };

        fillBg(ctx);

        if (snapshot) {
          const img = new Image();
          img.onload = () => {
            const ctx2 = c.getContext("2d");
            if (!ctx2) return;
            ctx2.setTransform(dpr, 0, 0, dpr, 0, 0);
            fillBg(ctx2);
            ctx2.drawImage(img, 0, 0, lw, lh);
            syncInk(true);
          };
          img.onerror = () => {
            last.current = null;
            syncInk(false);
          };
          img.src = snapshot;
        } else {
          last.current = null;
          syncInk(false);
        }
      };

      layoutCanvas();
      const ro = new ResizeObserver(() => queueMicrotask(layoutCanvas));
      ro.observe(wrap);
      return () => ro.disconnect();
    }, [syncInk]);

    const lineTo = useCallback(
      (x: number, y: number) => {
        const c = canvasRef.current;
        if (!c) return;
        const ctx = c.getContext("2d");
        if (!ctx) return;
        ctx.strokeStyle = readCssColor("--foreground") || "CanvasText";
        ctx.lineWidth = 2.5;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        const prev = last.current;
        if (prev) {
          ctx.beginPath();
          ctx.moveTo(prev.x, prev.y);
          ctx.lineTo(x, y);
          ctx.stroke();
        }
        last.current = { x, y };
        syncInk(true);
      },
      [syncInk],
    );

    const posFromEvent = (ev: React.PointerEvent<HTMLCanvasElement>) => {
      const c = canvasRef.current;
      if (!c) return { x: 0, y: 0 };
      const r = c.getBoundingClientRect();
      return { x: ev.clientX - r.left, y: ev.clientY - r.top };
    };

    const onPointerDown = (ev: React.PointerEvent<HTMLCanvasElement>) => {
      ev.currentTarget.setPointerCapture(ev.pointerId);
      drawing.current = true;
      const { x, y } = posFromEvent(ev);
      const c = canvasRef.current;
      if (c) {
        const ctx = c.getContext("2d");
        if (ctx) {
          ctx.fillStyle = readCssColor("--foreground") || "CanvasText";
          ctx.beginPath();
          ctx.arc(x, y, 1.25, 0, Math.PI * 2);
          ctx.fill();
          syncInk(true);
        }
      }
      last.current = { x, y };
    };

    const onPointerMove = (ev: React.PointerEvent<HTMLCanvasElement>) => {
      if (!drawing.current) return;
      const { x, y } = posFromEvent(ev);
      lineTo(x, y);
    };

    const onPointerUp = (ev: React.PointerEvent<HTMLCanvasElement>) => {
      drawing.current = false;
      last.current = null;
      try {
        ev.currentTarget.releasePointerCapture(ev.pointerId);
      } catch {
        /* ignore */
      }
    };

    return (
      <div
        className={`flex min-h-0 flex-1 flex-col gap-1 ${className ?? ""}`}
      >
        <div className="flex shrink-0 items-center justify-between gap-2">
          <span className="text-[0.65rem] font-semibold uppercase tracking-wide text-[var(--muted)] sm:text-xs">
            Your signature
          </span>
          <button
            type="button"
            onClick={clear}
            className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-[0.65rem] font-medium text-[var(--foreground)] hover:bg-[var(--background)] sm:text-xs"
          >
            Clear
          </button>
        </div>
        <div
          ref={wrapRef}
          className="relative min-h-[5.5rem] min-w-0 flex-1 touch-none rounded-lg border border-[var(--border)] bg-[var(--background)]"
        >
          <canvas
            ref={canvasRef}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            className="absolute inset-0 h-full w-full touch-none"
            aria-label="Draw your signature"
          />
        </div>
        <p className="shrink-0 text-[0.65rem] leading-snug text-[var(--muted)] sm:text-xs">
          Shown on the host screen.
        </p>
      </div>
    );
  },
);
