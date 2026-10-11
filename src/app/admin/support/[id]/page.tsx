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
import { profileDisplayName } from "@/lib/admin/spinora-profile";
import { staffReplyAction } from "@/lib/actions/admin/support";
import { platformTicketAccess } from "@/lib/support/ticket-access";
import { getAdminTicket } from "@/lib/support/ticket-store";
import { redirect } from "next/navigation";

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
  const { tickets: canOpenTickets, isSub, isStore } = await platformTicketAccess();
  if (isStore || isSub) redirect("/admin/agent-inbox");
  if (!canOpenTickets) redirect("/admin");
  const { id } = await params;
  const ticket = await getAdminTicket(id);
  if (!ticket) notFound();

  const thread = ticket.messages;
  const member = ticket.profiles;

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
