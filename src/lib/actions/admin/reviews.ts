"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { AdminActionResult, adminDb, authorize, writeAudit } from "@/lib/actions/admin/core";

const PERMISSION = "cms.manage";

const reviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  body: z.string().trim().min(10).max(1000),
  is_published: z.boolean(),
});

export async function updateReviewAction(
  input: z.infer<typeof reviewSchema> & { id: string }
): Promise<AdminActionResult> {
  const auth = await authorize(PERMISSION);
  if ("error" in auth) return { ok: false, error: auth.error };

  const parsed = reviewSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid" };

  const db = adminDb();
  const { error } = await db
    .from("player_reviews")
    .update(parsed.data)
    .eq("id", input.id);
  if (error) return { ok: false, error: "Could not save the review." };

  await writeAudit({
    actorId: auth.staff.userId,
    action: "player_review.update",
    entityType: "player_review",
    entityId: input.id,
    after: parsed.data,
  });

  revalidatePath("/admin/reviews");
  revalidatePath("/");
  return { ok: true, message: "Review saved." };
}
