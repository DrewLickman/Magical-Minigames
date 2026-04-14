/**
 * Build the Imposter app entry URL with a pre-filled lobby query.
 *
 * @param imposterBase - Full origin for local dev (e.g. http://localhost:3002), or empty for same-origin `/imposter`.
 */
export function getImposterEntryUrl(options: {
  imposterBase: string;
  lobbyCode: string;
  displayName?: string;
}): string {
  const lobby = encodeURIComponent(options.lobbyCode.trim());
  const namePart = options.displayName?.trim()
    ? `&name=${encodeURIComponent(options.displayName.trim())}`
    : "";
  const base = options.imposterBase.replace(/\/$/, "");
  if (!base) {
    return `/imposter?lobby=${lobby}${namePart}`;
  }
  return `${base}/?lobby=${lobby}${namePart}`;
}
