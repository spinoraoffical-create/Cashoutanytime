import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { StaffTicketActions } from "@/components/admin/staff-ticket-actions";
import { ChatContainer } from "@/components/dashboard/chat-container";
import {
  TicketPriorityBadge,
  TicketStatusBadge,
} from "@/components/dashboard/ticket-status-badge";
import { GlassCard } from "@/components/shared/glass-card";
import { profileDisplayName, profileHandle } from "@/lib/admin/spinora-profile";
import { adminDb } from "@/lib/actions/admin/core";
import { staffReplyAction } from "@/lib/actions/admin/support";
import { requirePermission } from "@/lib/data/admin";

export const metadata: Metadata = { title: "Chat" };

const CATEGORY_LABEL: Record<string, string> = {
  account: "Account",
  rewards: "Rewards",
  vip: "VIP",
  referrals: "Referrals",
  technical: "Technical",
  other: "Other",
};

export default async function AdminTicketDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePermission("support.manage");
  const { id } = await params;
  const db = adminDb();

  const { data: ticket } = await db
    .from("support_tickets")
    .select(
      "id, ticket_no, subject, category, status, priority, assigned_to, created_at, profiles(email, full_name)"
    )
    .eq("id", id)
    .maybeSingle();

  if (!ticket) notFound();

  const { data: messages } = await db
    .from("ticket_messages")
    .select("id, is_staff, body, attachment_url, created_at")
    .eq("ticket_id", id)
    .order("created_at", { ascending: true });

  const thread = messages ?? [];
  const member = ticket.profiles as { email?: string | null; full_name?: string | null } | null;

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href="/admin/support"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Chat inbox
      </Link>

      <AdminPageHeader
        title={ticket.subject}
        description={`#${ticket.ticket_no} · ${CATEGORY_LABEL[ticket.category]} · from ${profileDisplayName(member ?? {})}`}
        action={
          <div className="flex items-center gap-2">
            <TicketPriorityBadge priority={ticket.priority} />
            <TicketStatusBadge status={ticket.status} />
          </div>
        }
      />

      {/* Conversation + reply (realtime, optimistic) */}
      <GlassCard className="p-4">
        <ChatContainer
          ticketId={ticket.id}
          initialMessages={thread}
          closed={false}
          perspective="staff"
          onSend={staffReplyAction}
        />
      </GlassCard>

      {/* Status + assign controls */}
      <GlassCard className="mt-4 p-4">
        <StaffTicketActions
          ticketId={ticket.id}
          status={ticket.status}
          assigned={Boolean(ticket.assigned_to)}
        />
      </GlassCard>
    </div>
  );
}
