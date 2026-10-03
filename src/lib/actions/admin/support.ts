"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  AdminActionResult,
  adminDb,
  authorize,
  writeAudit,
} from "@/lib/actions/admin/core";
import type { TicketStatus } from "@/lib/database.types";

const STATUSES: TicketStatus[] = [
  "open",
  "pending",
  "in_progress",
  "resolved",
  "closed",
];

export async function staffReplyAction(input: {
  ticketId: string;
  body: string;
  attachmentUrl?: string;
}): Promise<AdminActionResult> {
  const auth = await authorize("support.manage");
  if ("error" in auth) return { ok: false, error: auth.error };

  const parsed = z
    .object({
      ticketId: z.uuid(),
      body: z.string().trim().max(5000),
      attachmentUrl: z.string().url().optional(),
    })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: "Write a reply first." };
  if (!parsed.data.body && !parsed.data.attachmentUrl) {
    return { ok: false, error: "Write a reply or attach an image." };
  }

  const db = adminDb();
  const { error } = await db.from("ticket_messages").insert({
    ticket_id: parsed.data.ticketId,
    sender_id: auth.staff.userId,
    is_staff: true,
    body: parsed.data.body,
    attachment_url: parsed.data.attachmentUrl ?? null,
  });
  if (error) return { ok: false, error: "Could not send the reply." };

  // notify the ticket owner
  const { data: ticket } = await db
    .from("support_tickets")
    .select("user_id, ticket_no, subject")
    .eq("id", parsed.data.ticketId)
    .single();

  if (ticket) {
    await db.from("notifications").insert({
      user_id: ticket.user_id,
      type: "support",
      title: `Reply on ticket #${ticket.ticket_no}`,
      body: `Our team replied to "${ticket.subject}".`,
      link_url: `/dashboard/support/${parsed.data.ticketId}`,
      icon: "headset",
    });

    // email the member (preference-gated, best-effort)
    try {
      const { sendMemberEmail } = await import("@/lib/email/send");
      const { ticketReplyEmail } = await import("@/lib/email/templates");
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
      const mail = ticketReplyEmail({
        displayName: "there",
        ticketNo: ticket.ticket_no,
        subject: ticket.subject,
        siteUrl,
        ticketId: parsed.data.ticketId,
      });
      await sendMemberEmail({
        userId: ticket.user_id,
        channel: "support",
        subject: mail.subject,
        html: mail.html,
      });
    } catch {
      /* email is non-critical */
    }
  }

  await writeAudit({
    actorId: auth.staff.userId,
    action: "ticket.reply",
    entityType: "support_ticket",
    entityId: parsed.data.ticketId,
  });

  revalidatePath(`/admin/support/${parsed.data.ticketId}`);
  return { ok: true };
}

export async function setTicketStatusAction(input: {
  ticketId: string;
  status: TicketStatus;
}): Promise<AdminActionResult> {
  const auth = await authorize("support.manage");
  if ("error" in auth) return { ok: false, error: auth.error };

  if (!STATUSES.includes(input.status)) {
    return { ok: false, error: "Invalid status." };
  }

  const db = adminDb();
  const { error } = await db
    .from("support_tickets")
    .update({
      status: input.status,
      closed_at:
        input.status === "closed" ? new Date().toISOString() : null,
    })
    .eq("id", input.ticketId);
  if (error) return { ok: false, error: "Could not update status." };

  await writeAudit({
    actorId: auth.staff.userId,
    action: "ticket.status",
    entityType: "support_ticket",
    entityId: input.ticketId,
    after: { status: input.status },
  });

  revalidatePath(`/admin/support/${input.ticketId}`);
  revalidatePath("/admin/support");
  return { ok: true, message: `Ticket marked ${input.status.replace("_", " ")}.` };
}

export async function assignTicketToMeAction(
  ticketId: string
): Promise<AdminActionResult> {
  const auth = await authorize("support.manage");
  if ("error" in auth) return { ok: false, error: auth.error };

  const db = adminDb();
  const { error } = await db
    .from("support_tickets")
    .update({ assigned_to: auth.staff.userId })
    .eq("id", ticketId);
  if (error) return { ok: false, error: "Could not assign the ticket." };

  await writeAudit({
    actorId: auth.staff.userId,
    action: "ticket.assign",
    entityType: "support_ticket",
    entityId: ticketId,
    after: { assigned_to: auth.staff.userId },
  });

  revalidatePath(`/admin/support/${ticketId}`);
  return { ok: true, message: "Assigned to you." };
}
