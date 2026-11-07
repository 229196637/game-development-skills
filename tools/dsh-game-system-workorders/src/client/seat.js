// Decides whether this session is the one currently drawn in the right-hand seat.
// `undefined` means the host exposes no observable seat, so a dock must not guess.
export function seatOf(sessionId, mounted, sidebar) {
  const current = mounted?.getSnapshot ? mounted.getSnapshot() : sidebar?.getSnapshot ? sidebar.getSnapshot().sessionId : undefined;
  if (current === undefined) return 'unknown';
  return current === sessionId ? 'current' : 'other';
}
