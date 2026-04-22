/**
 * Build the Imposter app entry URL with a pre-filled lobby query.
 */
export function getImposterEntryUrl(options: {
  lobbyCode: string;
  displayName?: string;
}): string {
  const lobby = encodeURIComponent(options.lobbyCode.trim());
  const namePart = options.displayName?.trim()
    ? `&name=${encodeURIComponent(options.displayName.trim())}`
    : "";
  return `/imposter?lobby=${lobby}${namePart}`;
}
