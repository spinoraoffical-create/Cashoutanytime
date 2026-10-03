"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { AdminActionResult, adminDb, authorize, writeAudit } from "@/lib/actions/admin/core";

const PERMISSION = "cms.manage";

const methodSchema = z.object({
  key: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Lowercase letters, numbers and hyphens only")
    .min(2)
    .max(40),
  label: z.string().trim().min(2).max(60),
  kind: z.enum(["handle", "crypto", "link"]).default("handle"),
  handle: z.string().trim().max(200).optional().default(""),
  handle_label: z.string().trim().max(60).optional().default(""),
  pay_link: z.string().trim().max(300).optional().default(""),
  qr_image_url: z.string().trim().max(500).optional().default(""),
  instructions: z.string().trim().max(300).optional().default(""),
  sort_order: z.coerce.number().int().min(0).max(999).optional().default(0),
  is_active: z.boolean().default(true),
});

export async function upsertPaymentMethodAction(
  input: z.infer<typeof methodSchema> & { id?: string },
): Promise<AdminActionResult> {
  const auth = await authorize(PERMISSION);
  if ("error" in auth) return { ok: false, error: auth.error };

  const parsed = methodSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const row = {
    key: parsed.data.key,
    label: parsed.data.label,
    kind: parsed.data.kind,
    handle: parsed.data.handle || null,
    handle_label: parsed.data.handle_label || null,
    pay_link: parsed.data.pay_link || null,
    qr_image_url: parsed.data.qr_image_url || null,
    instructions: parsed.data.instructions || null,
    sort_order: parsed.data.sort_order,
    is_active: parsed.data.is_active,
    updated_by: auth.staff.userId,
  };

  const db = adminDb();
  const { error } = input.id
    ? await db.from("payment_methods").update(row).eq("id", input.id)
    : await db.from("payment_methods").insert(row);

  if (error) {
    return {
      ok: false,
      error: /duplicate|unique/i.test(error.message)
        ? "A method with that key already exists."
        : "Could not save the payment method.",
    };
  }

  await writeAudit({
    actorId: auth.staff.userId,
    action: input.id ? "payment_method.update" : "payment_method.create",
    entityType: "payment_method",
    entityId: input.id ?? parsed.data.key,
    after: row,
  });

  revalidatePath("/admin/payments");
  revalidatePath("/deposit");
  return { ok: true, message: "Payment method saved." };
}

export async function deletePaymentMethodAction(id: string): Promise<AdminActionResult> {
  const auth = await authorize(PERMISSION);
  if ("error" in auth) return { ok: false, error: auth.error };

  const db = adminDb();
  const { error } = await db.from("payment_methods").delete().eq("id", id);
  if (error) return { ok: false, error: "Could not delete the payment method." };

  await writeAudit({
    actorId: auth.staff.userId,
    action: "payment_method.delete",
    entityType: "payment_method",
    entityId: id,
  });

  revalidatePath("/admin/payments");
  revalidatePath("/deposit");
  return { ok: true, message: "Payment method deleted." };
}
