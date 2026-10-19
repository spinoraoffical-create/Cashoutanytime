/** An active break or self-exclusion cannot be shortened or cleared early. A later end date is allowed. */
export function lockedRestrictionUntil(current: unknown, submitted: unknown, now = Date.now()): unknown {
  const currentText = typeof current === "string" ? current.trim() : "";
  const currentMs = currentText ? new Date(currentText).getTime() : Number.NaN;
  if (!Number.isFinite(currentMs) || currentMs <= now) return submitted;
  const nextText = typeof submitted === "string" ? submitted.trim() : "";
  const nextMs = nextText ? new Date(nextText).getTime() : Number.NaN;
  if (!Number.isFinite(nextMs) || nextMs < currentMs) return currentText;
  return submitted;
}
