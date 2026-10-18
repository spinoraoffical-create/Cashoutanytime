/** Pure pause decision. A failed read or a missing row stays closed. Only an explicit resumed row is open. */

export const PROVIDER_PAUSED = "This game is paused.";

export function providerFulfillmentBlocked(
  row: { paused?: boolean | null } | null | undefined,
  readFailed: boolean
): boolean {
  if (readFailed) return true;
  return row?.paused !== false;
}
