export type ReviewStatus = "pending" | "approved" | "rejected";

export type IdentityRpcError = {
  message?: string;
  code?: string;
};

/** Safe message for an identity decision failure. Raw database text stays on the server. */
export function identityDecisionMessage(error: IdentityRpcError): string {
  const message = error.message ?? "";
  if (error.code === "PGRST202" || (/could not find the function|schema cache/i.test(message) && /admin_decide_kyc/i.test(message))) {
    return "Identity review is not ready on this server.";
  }
  if (/player profile not found/i.test(message)) {
    return "The identity status could not be saved. The check was left as it was.";
  }
  if (error.code === "42501" || /column protected/i.test(message)) {
    return "The identity status could not be saved. The profile guard blocked the status change.";
  }
  return "The identity status could not be saved.";
}

/** Fixed labels only. Never include the database message. */
export function identityDecisionLogCode(error: IdentityRpcError): string {
  const message = error.message ?? "";
  if (error.code === "PGRST202" || /admin_decide_kyc/i.test(message)) return "function_unavailable";
  if (/player profile not found/i.test(message)) return "profile_missing";
  if (error.code === "42501" || /column protected/i.test(message)) return "column_protected";
  if (/service role required/i.test(message)) return "service_role_required";
  if (/actor not found/i.test(message)) return "actor_not_found";
  if (/identity check not found/i.test(message)) return "check_not_found";
  if (/invalid identity status/i.test(message)) return "invalid_status";
  return "unclassified";
}

export function applyReviewDecision<T extends { user_id: string; status: ReviewStatus }>(
  rows: T[],
  userId: string,
  status: Exclude<ReviewStatus, "pending">
): T[] {
  return rows.map((row) => (row.user_id === userId ? { ...row, status } : row));
}

export function reviewCounts(rows: { status: ReviewStatus }[]): Record<"all" | ReviewStatus, number> {
  return {
    all: rows.length,
    pending: rows.filter((row) => row.status === "pending").length,
    approved: rows.filter((row) => row.status === "approved").length,
    rejected: rows.filter((row) => row.status === "rejected").length,
  };
}
