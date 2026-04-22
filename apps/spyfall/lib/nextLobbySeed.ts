/**
 * Next lobby phrase from the current normalized seed: append "1", or if the
 * seed ends with digits, increment that trailing integer.
 */
export function nextLobbySeed(normalizedCurrent: string): string {
  const m = normalizedCurrent.match(/^(.*?)(\d+)$/);
  if (m) {
    const prefix = m[1] ?? "";
    const n = Number.parseInt(m[2]!, 10);
    if (Number.isFinite(n)) {
      return `${prefix}${n + 1}`;
    }
  }
  return `${normalizedCurrent}1`;
}
