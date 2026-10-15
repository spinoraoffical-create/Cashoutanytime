/** Whether a confirmed admin action is allowed to run. */
export function confirmActionDecision(input: { pending: boolean; confirmed: boolean }): "pending" | "cancelled" | "run" {
  if (input.pending) return "pending";
  if (!input.confirmed) return "cancelled";
  return "run";
}
