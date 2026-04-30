const DEFAULT_PORT = 8787;

export function parseBuzzerPort(raw: string | null): number {
  if (!raw?.trim()) return DEFAULT_PORT;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1 || n > 65535) return DEFAULT_PORT;
  return n;
}

/** Build ws:// or wss:// URL for the buzzer server (no path). */
export function buildBuzzerWsUrl(input: {
  pageIsSecure: boolean;
  lanHost: string;
  port: number;
}): string {
  const host = input.lanHost.trim() || "localhost";
  const proto = input.pageIsSecure ? "wss:" : "ws:";
  return `${proto}//${host}:${input.port}`;
}

export function getEnvBuzzerWsOverride(): string | null {
  if (typeof window === "undefined") return null;
  const v = process.env.NEXT_PUBLIC_JEOPARDY_BUZZER_WS_URL?.trim();
  return v || null;
}

export function effectiveBuzzerWsUrl(input: {
  pageIsSecure: boolean;
  lanHost: string;
  port: number;
}): string {
  const override = getEnvBuzzerWsOverride();
  if (override) return override;
  return buildBuzzerWsUrl(input);
}
