"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  AdminActionResult,
  authorize,
  writeAudit,
} from "@/lib/actions/admin/core";
import { rateLimit } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";
import type { BroadcastSegment } from "@/lib/database.types";

const SEGMENTS: BroadcastSegment[] = [
  "all",
  "vip_silver_up",
  "vip_gold_up",
  "vip_platinum_up",
  "vip_diamond_up",
  "vip_elite",
];

const schema = z.object({
  title: z.string().trim().min(3, "Title is too short").max(120),
  body: z.string().trim().min(5, "Message is too short").max(1000),
  link_url: z
    .string()
    .trim()
    .regex(/^\/[\w\-/?=&%.]*$/, "Use an internal path like /promotions")
    .optional()
    .or(z.literal("")),
  segment: z.enum(SEGMENTS as [BroadcastSegment, ...BroadcastSegment[]]),
});

export async function sendBroadcastAction(input: {
  title: string;
  body: string;
  link_url?: string;
  segment: BroadcastSegment;
}): Promise<AdminActionResult> {
  const auth = await authorize("notifications.broadcast");
  if ("error" in auth) return { ok: false, error: auth.error };

  if (!(await rateLimit("broadcast", auth.staff.userId))) {
    return { ok: false, error: "Too many broadcasts in a short window. Pause a moment." };
  }

  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  // send_broadcast runs as the caller (SECURITY DEFINER, internally permission-checked)
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("send_broadcast", {
    p_title: parsed.data.title,
    p_body: parsed.data.body,
    p_link_url: parsed.data.link_url || null,
    p_segment: parsed.data.segment,
  });

  if (error) {
    return { ok: false, error: "Could not send the broadcast." };
  }

  await writeAudit({
    actorId: auth.staff.userId,
    action: "broadcast.send",
    entityType: "broadcast",
    entityId: typeof data === "string" ? data : null,
    after: { segment: parsed.data.segment, title: parsed.data.title },
  });

  revalidatePath("/admin/notifications");
  return { ok: true, message: "Broadcast sent." };
}
