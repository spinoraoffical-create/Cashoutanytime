"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { adminDb, writeAudit, type AdminActionResult } from "@/lib/actions/admin/core";
import { getStaffContext } from "@/lib/data/admin";

const schema = z.object({
  email: z.string().trim().email("Enter an email for this test login").max(160),
});

function password() {
  return `Test${randomBytes(9).toString("base64url")}`;
}

export async function createTestAccountAction(email: string): Promise<AdminActionResult> {
  const ctx = await getStaffContext();
  if (!ctx?.isSuperAdmin) return { ok: false, error: "Only the owner can create a test login." };

  const parsed = schema.safeParse({ email });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Enter an email." };

  const db = adminDb();
  const { data: existing } = await db.from("profiles").select("id").eq("email", parsed.data.email).maybeSingle();
  if (existing?.id) return { ok: false, error: "That email already has an account." };

  const loginPassword = password();
  const { data: created, error: authError } = await db.auth.admin.createUser({
    email: parsed.data.email,
    password: loginPassword,
    email_confirm: true,
    user_metadata: { full_name: "Test player", is_test: true },
  });
  if (authError || !created.user) {
    return { ok: false, error: authError?.message ?? "Could not create the test login." };
  }

  const userId = created.user.id;
  const { error: markError } = await db
    .from("profiles")
    .update({ is_test: true, phone: null, full_name: "Test player" })
    .eq("id", userId);
  if (markError) {
    const removed = await db.auth.admin.deleteUser(userId);
    if (removed.error) {
      await db.from("profiles").update({ is_suspended: true }).eq("id", userId);
      return { ok: false, error: "The test marker could not be saved. The new login was suspended." };
    }
    return { ok: false, error: "The test-account column is not installed yet, so the login was removed." };
  }

  await writeAudit({
    actorId: ctx.userId,
    action: "user.test_create",
    entityType: "profile",
    entityId: userId,
    after: { is_test: true },
  });
  revalidatePath("/admin/users");
  return {
    ok: true,
    message: `Test login created for ${parsed.data.email}. Password: ${loginPassword}. It is shown once. This account cannot deposit, cash out, or receive Coins.`,
  };
}
