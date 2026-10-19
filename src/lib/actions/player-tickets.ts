"use server";

import { revalidatePath } from "next/cache";

import { assignPlayerToAgentByCode } from "@/lib/agents/assign";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { TicketStatus } from "@/lib/database.types";
import { countOpenTicketsFor, createStoredTicket, listPlayerTickets } from "@/lib/support/ticket-store";

const OPEN_STATUSES: TicketStatus[] = ["open", "pending", "in_progress"];

export type PlayerTicketRow = {
  id: string;
  ticketNo: number;
  subject: string;
  status: TicketStatus;
  messages: { is_staff: boolean; body: string }[];
};

export async function loadPlayerTickets(): Promise<{
  total: number;
  pending: number;
  resolved: number;
  openSlotsLeft: number;
  tickets: PlayerTicketRow[];
} | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const rows = await listPlayerTickets(user.id);
  const tickets: PlayerTicketRow[] = rows.map((row) => ({
    id: row.id,
    ticketNo: row.ticket_no,
    subject: row.subject,
    status: row.status,
    messages: [...row.messages]
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .map((message) => ({ is_staff: message.is_staff, body: message.body })),
  }));

  const pending = tickets.filter((ticket) => OPEN_STATUSES.includes(ticket.status)).length;
  const resolved = tickets.filter((ticket) => ticket.status === "resolved").length;
  return {
    total: tickets.length,
    pending,
    resolved,
    openSlotsLeft: Math.max(0, 3 - pending),
    tickets,
  };
}

export async function createPlayerTicket(input: { subject: string; body: string }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in to create a ticket." };

  const subject = input.subject.trim();
  const body = input.body.trim();
  if (subject.length < 3 || subject.length > 140) return { error: "Subject must be 3 to 140 characters." };
  if (body.length < 1 || body.length > 5000) return { error: "Write a message for the ticket." };

  const openCount = await countOpenTicketsFor(user.id);
  if (openCount >= 3) {
    return { error: "You already have 3 open tickets. Resolved and closed tickets do not count." };
  }

  const created = await createStoredTicket({ userId: user.id, subject, body });
  if (!created.ok) return { error: created.error };
  void import("@/lib/telegram/control/safe-emit")
    .then(({ safePaymentAlert }) =>
      safePaymentAlert({
        category: "ticket_opened",
        eventKey: `ticket:${created.id}`,
        source: "ledger",
        reference: created.id,
        detail: "A player opened a support ticket.",
        adminPath: "/admin/support",
      })
    )
    .catch(() => undefined);

  revalidatePath("/help");
  revalidatePath("/support");
  revalidatePath("/admin/support");
  return { ok: true as const, ticketNo: created.ticketNo };
}

export async function loadMyParentAgent(): Promise<{ agentId: string | null }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { agentId: null };
  const db = createAdminClient() ?? supabase;
  const { data } = await db.from("profiles").select("parent_agent_id").eq("id", user.id).maybeSingle();
  let agentId = (data as { parent_agent_id?: string | null } | null)?.parent_agent_id ?? null;
  if (!agentId) {
    const code = typeof user.user_metadata?.agent_code === "string" ? user.user_metadata.agent_code : "";
    if (code.trim()) {
      await assignPlayerToAgentByCode(user.id, code);
      const again = await db.from("profiles").select("parent_agent_id").eq("id", user.id).maybeSingle();
      agentId = (again.data as { parent_agent_id?: string | null } | null)?.parent_agent_id ?? null;
    }
  }
  return { agentId };
}
