/** How an admin deposit row should show its attachment. No database access. */

export function isOnlinePaymentProof(path: string | null | undefined): boolean {
  return Boolean(path?.startsWith("paydora/"));
}

export function depositRecordNote(
  notes: string | null | undefined
): { label: string; text: string } | null {
  const text = notes?.trim();
  if (!text) return null;
  if (text === "Paid online" || text.startsWith("Paid online ·")) {
    return { label: "System record", text };
  }
  return { label: "Note", text };
}
