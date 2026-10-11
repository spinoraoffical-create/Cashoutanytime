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
import { platformTicketAccess } from "@/lib/support/ticket-access";
import { addTicketMessage, assignStoredTicket, setStoredTicketStatus } from "@/lib/support/ticket-store";

async function refuseStoreOrSub(): Promise<string | null> {
  const access = await platformTicketAccess();
  if (!access.allowed) return "Tickets stay with Super Admin.";
  return null;
}

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
  const blocked = await refuseStoreOrSub();
  if (blocked) return { ok: false, error: blocked };

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
  const ticket = await addTicketMessage({
    ticketId: parsed.data.ticketId,
    senderId: auth.staff.userId,
    isStaff: true,
    body: parsed.data.body,
    attachmentUrl: parsed.data.attachmentUrl ?? null,
  });
  if (!ticket) return { ok: false, error: "Could not send the reply." };

  if (ticket) {
    await db.from("notifications").insert({
      user_id: ticket.userId,
      type: "support",
      title: `Reply on ticket #${ticket.ticketNo}`,
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
        ticketNo: ticket.ticketNo,
        subject: ticket.subject,
        siteUrl,
        ticketId: parsed.data.ticketId,
      });
      await sendMemberEmail({
        userId: ticket.userId,
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
  const blocked = await refuseStoreOrSub();
  if (blocked) return { ok: false, error: blocked };

  if (!STATUSES.includes(input.status)) {
    return { ok: false, error: "Invalid status." };
  }

  const saved = await setStoredTicketStatus(input.ticketId, input.status);
  if (!saved) return { ok: false, error: "Could not update status." };

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
  const blocked = await refuseStoreOrSub();
  if (blocked) return { ok: false, error: blocked };

  const saved = await assignStoredTicket(ticketId, auth.staff.userId);
  if (!saved) return { ok: false, error: "Could not assign the ticket." };

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
