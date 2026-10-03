import type { Metadata } from "next";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { ChevronRight, LifeBuoy } from "lucide-react";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import {
  TicketPriorityBadge,
  TicketStatusBadge,
} from "@/components/dashboard/ticket-status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { GlassCard } from "@/components/shared/glass-card";
import { profileDisplayName } from "@/lib/admin/spinora-profile";
import { adminDb } from "@/lib/actions/admin/core";
import { requirePermission } from "@/lib/data/admin";
import type { TicketStatus } from "@/lib/database.types";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Chat" };

const FILTERS: { key: string; label: string; statuses: TicketStatus[] }[] = [
  { key: "active", label: "Active", statuses: ["open", "pending", "in_progress"] },
  { key: "resolved", label: "Resolved", statuses: ["resolved"] },
  { key: "closed", label: "Closed", statuses: ["closed"] },
];

export default async function AdminSupportPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  await requirePermission("support.manage");
  const params = await searchParams;
  const filterKey = params.filter ?? "active";
  const filter = FILTERS.find((f) => f.key === filterKey) ?? FILTERS[0];

  const db = adminDb();
  const { data } = await db
    .from("support_tickets")
    .select(
      "id, ticket_no, subject, category, status, priority, last_message_at, profiles(email, full_name)"
    )
    .in("status", filter.statuses)
    .order("last_message_at", { ascending: false })
    .limit(100);

  const tickets = data ?? [];

  return (
    <div className="mx-auto max-w-5xl">
      <AdminPageHeader
        title="Chat"
        description="Member chat inbox. Reply, triage and resolve conversations."
      />

      <div
        role="tablist"
        aria-label="Ticket filter"
        className="glass mb-4 inline-flex gap-1 rounded-full p-1"
      >
        {FILTERS.map((f) => {
          const active = f.key === filterKey;
          return (
            <Link
              key={f.key}
              href={`/admin/support?filter=${f.key}`}
              role="tab"
              aria-selected={active}
              className={cn(
                "min-h-9 rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
                active
                  ? "bg-emerald-500 text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {f.label}
            </Link>
          );
        })}
      </div>

      {tickets.length === 0 ? (
        <EmptyState
          icon={<LifeBuoy />}
          title={`No ${filter.label.toLowerCase()} chats`}
          description="When members start chats, they'll show up here."
        />
      ) : (
        <GlassCard className="overflow-hidden">
          <ul className="divide-y divide-foreground/8">
            {tickets.map((t) => (
              <li key={t.id}>
                <Link
                  href={`/admin/support/${t.id}`}
                  className="flex items-center gap-4 px-4 py-4 transition-colors hover:bg-foreground/[0.03] sm:px-6"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="tnum text-xs text-muted-foreground">
                        #{t.ticket_no}
                      </span>
                      <span className="text-xs text-ws-text-faint">
                        @
                        {profileDisplayName(
                          (t.profiles as { email?: string | null; full_name?: string | null } | null) ?? {}
                        )}
                      </span>
                    </div>
                    <p className="mt-0.5 truncate text-sm font-semibold">
                      {t.subject}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Updated{" "}
                      {formatDistanceToNow(new Date(t.last_message_at), {
                        addSuffix: true,
                      })}
                    </p>
                  </div>
                  <TicketPriorityBadge priority={t.priority} />
                  <TicketStatusBadge status={t.status} />
                  <ChevronRight
                    className="size-4 shrink-0 text-muted-foreground"
                    aria-hidden
                  />
                </Link>
              </li>
            ))}
          </ul>
        </GlassCard>
      )}
    </div>
  );
}
