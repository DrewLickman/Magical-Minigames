/**
 * Build the Codenames app entry URL with a pre-filled lobby query.
 */
export function getCodenamesEntryUrl(options: {
  lobbyCode: string;
  displayName?: string;
}): string {
  const lobby = encodeURIComponent(options.lobbyCode.trim());
  const namePart = options.displayName?.trim()
    ? `&name=${encodeURIComponent(options.displayName.trim())}`
    : "";
  return `/codenames?lobby=${lobby}${namePart}`;
}
