/**
 * Build the Codenames app entry URL with a pre-filled lobby query.
 *
 * @param codenamesBase - Full origin for local dev (e.g. http://localhost:3001), or empty for same-origin `/codenames`.
 */
export function getCodenamesEntryUrl(options: {
  codenamesBase: string;
  lobbyCode: string;
  displayName?: string;
}): string {
  const lobby = encodeURIComponent(options.lobbyCode.trim());
  const namePart = options.displayName?.trim()
    ? `&name=${encodeURIComponent(options.displayName.trim())}`
    : "";
  const base = options.codenamesBase.replace(/\/$/, "");
  if (!base) {
    return `/codenames?lobby=${lobby}${namePart}`;
  }
  return `${base}/?lobby=${lobby}${namePart}`;
}
