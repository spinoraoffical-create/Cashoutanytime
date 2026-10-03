import "server-only";

import { headers } from "next/headers";

import { getStaffContext, can } from "@/lib/data/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/database.types";

export type AdminActionResult =
  | { ok: true; message?: string; id?: string }
  | { ok: false; error: string };

export type AuthorizedStaff = {
  userId: string;
  email: string | null;
};

/**
 * Authorize an admin mutation by permission. Returns the acting staff context
 * or an error result the action can return directly.
 */
export async function authorize(
  permission: string
): Promise<{ staff: AuthorizedStaff } | { error: string }> {
  const ctx = await getStaffContext();
  if (!ctx) return { error: "You don't have access to this area." };
  if (!can(ctx, permission)) {
    return { error: "You don't have permission to do that." };
  }
  return { staff: { userId: ctx.userId, email: ctx.email } };
}

/**
 * Append an immutable audit-log entry. Uses the service-role client so the
 * write always succeeds (the audit table is append-only for everyone else).
 */
export async function writeAudit(params: {
  actorId: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  before?: Json | null;
  after?: Json | null;
}): Promise<void> {
  try {
    const h = await headers();
    const admin = createAdminClient();
    if (!admin) return;
    await admin.from("audit_logs").insert({
      actor_id: params.actorId,
      action: params.action,
      entity_type: params.entityType,
      entity_id: params.entityId ?? null,
      before_data: params.before ?? null,
      after_data: params.after ?? null,
      ip_address:
        h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
        h.get("x-real-ip") ??
        null,
      user_agent: h.get("user-agent") ?? null,
    });
  } catch {
    // never let an audit write failure abort the underlying mutation
  }
}

/** Service-role client for admin mutations (bypasses RLS; authorize() first!). */
export function adminDb() {
  const client = createAdminClient();
  if (!client) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is required for admin operations.");
  }
  return client;
}
