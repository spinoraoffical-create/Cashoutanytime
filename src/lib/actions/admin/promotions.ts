"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  AdminActionResult,
  adminDb,
  authorize,
  writeAudit,
} from "@/lib/actions/admin/core";
import { parseNepalLocalToUtc } from "@/lib/admin/nepal-time";

const promoSchema = z.object({
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9-]+$/, "Lowercase letters, numbers and hyphens only")
    .min(3)
    .max(60),
  title: z.string().trim().min(3).max(120),
  summary: z.string().trim().max(280).optional().default(""),
  description: z.string().trim().max(2000).optional().default(""),
  badge_text: z.string().trim().max(20).optional().nullable(),
  coins_bonus: z.number().int().min(0).max(1_000_000),
  xp_bonus: z.number().int().min(0).max(1_000_000),
  code: z.string().trim().max(40).optional().nullable(),
  status: z.enum(["draft", "scheduled", "active", "expired", "archived"]),
  is_featured: z.boolean(),
  priority: z.number().int().min(0).max(9999),
  starts_at: z.string().optional().nullable(),
  ends_at: z.string().optional().nullable(),
  max_claims: z.number().int().positive().optional().nullable(),
  max_claims_per_user: z.number().int().positive().max(100),
});

export type PromoFormInput = z.infer<typeof promoSchema>;

function ownerSchedule(raw: string | null | undefined): { ok: true; value: string | null } | { ok: false } {
  if (!raw) return { ok: true, value: null };
  const parsed = parseNepalLocalToUtc(raw);
  if (!parsed) return { ok: false };
  return { ok: true, value: parsed.toISOString() };
}

export async function upsertPromotionAction(
  input: PromoFormInput & { id?: string }
): Promise<AdminActionResult> {
  const auth = await authorize("promotions.manage");
  if ("error" in auth) return { ok: false, error: auth.error };

  const parsed = promoSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const startsAt = ownerSchedule(parsed.data.starts_at);
  const endsAt = ownerSchedule(parsed.data.ends_at);
  if (!startsAt.ok || !endsAt.ok) {
    return { ok: false, error: "Enter a valid Nepal date and time, or leave the time blank." };
  }

  const db = adminDb();
  const payload = {
    ...parsed.data,
    badge_text: parsed.data.badge_text || null,
    code: parsed.data.code ? parsed.data.code.toUpperCase() : null,
    starts_at: startsAt.value,
    ends_at: endsAt.value,
    max_claims: parsed.data.max_claims ?? null,
  };

  if (input.id) {
    const { error } = await db.from("promotions").update(payload).eq("id", input.id);
    if (error) {
      return {
        ok: false,
        error: /duplicate|unique/.test(error.message)
          ? "That slug or code is already in use."
          : "Could not save the promotion.",
      };
    }
    await writeAudit({
      actorId: auth.staff.userId,
      action: "promotion.update",
      entityType: "promotion",
      entityId: input.id,
      after: payload,
    });
    revalidatePath("/admin/promotions");
    revalidatePath("/promotions");
    return { ok: true, message: "Promotion updated.", id: input.id };
  }

  const { data, error } = await db
    .from("promotions")
    .insert({ ...payload, created_by: auth.staff.userId })
    .select("id")
    .single();

  if (error || !data) {
    return {
      ok: false,
      error: /duplicate|unique/.test(error?.message ?? "")
        ? "That slug or code is already in use."
        : "Could not create the promotion.",
    };
  }

  await writeAudit({
    actorId: auth.staff.userId,
    action: "promotion.create",
    entityType: "promotion",
    entityId: data.id,
    after: payload,
  });
  revalidatePath("/admin/promotions");
  revalidatePath("/promotions");
  return { ok: true, message: "Promotion created.", id: data.id };
}

export async function setPromotionStatusAction(input: {
  id: string;
  status: "draft" | "scheduled" | "active" | "expired" | "archived";
}): Promise<AdminActionResult> {
  const auth = await authorize("promotions.manage");
  if ("error" in auth) return { ok: false, error: auth.error };

  const db = adminDb();
  const { error } = await db
    .from("promotions")
    .update({ status: input.status })
    .eq("id", input.id);
  if (error) return { ok: false, error: "Could not update status." };

  await writeAudit({
    actorId: auth.staff.userId,
    action: "promotion.status",
    entityType: "promotion",
    entityId: input.id,
    after: { status: input.status },
  });
  revalidatePath("/admin/promotions");
  revalidatePath("/promotions");
  return { ok: true, message: `Promotion ${input.status}.` };
}

export async function deletePromotionAction(id: string): Promise<AdminActionResult> {
  const auth = await authorize("promotions.manage");
  if ("error" in auth) return { ok: false, error: auth.error };

  const db = adminDb();
  const { error } = await db.from("promotions").delete().eq("id", id);
  if (error) {
    return {
      ok: false,
      error: "Could not delete — members may have already claimed it. Archive it instead.",
    };
  }

  await writeAudit({
    actorId: auth.staff.userId,
    action: "promotion.delete",
    entityType: "promotion",
    entityId: id,
  });
  revalidatePath("/admin/promotions");
  revalidatePath("/promotions");
  return { ok: true, message: "Promotion deleted." };
}
