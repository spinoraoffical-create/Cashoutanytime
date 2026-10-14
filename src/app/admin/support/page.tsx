import type { Metadata } from "next";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { ChevronRight } from "lucide-react";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import {
  TicketPriorityBadge,
  TicketStatusBadge,
} from "@/components/dashboard/ticket-status-badge";
import { AdminEmptyState } from "@/components/admin/ui/admin-empty-state";
import { AdminSectionCard } from "@/components/admin/ui/admin-section-card";
import { profileDisplayName } from "@/lib/admin/spinora-profile";
import { platformTicketAccess } from "@/lib/support/ticket-access";
import { listAdminTickets } from "@/lib/support/ticket-store";
import { redirect } from "next/navigation";
import type { TicketStatus } from "@/lib/database.types";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Tickets" };

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
  const { tickets: canOpenTickets, isSub, isStore } = await platformTicketAccess();
  if (isStore || isSub) redirect("/admin/agent-inbox");
  if (!canOpenTickets) redirect("/admin");
  const params = await searchParams;
  const filterKey = params.filter ?? "active";
  const filter = FILTERS.find((f) => f.key === filterKey) ?? FILTERS[0];

  const tickets = await listAdminTickets(filter.statuses);

  return (
    <div className="mx-auto max-w-5xl">
      <AdminPageHeader
        title="Tickets"
        description="Player tickets sent to Super Admin. Choose Active, Resolved, or Closed. Opening a ticket does not change a balance."
      />

      <div
        role="tablist"
        aria-label="Ticket filter"
        className="mb-4 inline-flex flex-wrap gap-2"
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
                "inline-flex min-h-9 items-center rounded-full border px-4 py-1.5 text-sm font-semibold transition-colors",
                active
                  ? "border-transparent bg-gradient-to-r from-[#6d28d9] to-[#2563eb] text-white"
                  : "border-white/10 text-[#9fb0d0] hover:text-white"
              )}
            >
              {f.label}
            </Link>
          );
        })}
      </div>

      {tickets.length === 0 ? (
        <AdminEmptyState
          title={`No ${filter.label.toLowerCase()} tickets`}
          body="When players open tickets, they show up here."
        />
      ) : (
        <AdminSectionCard title={`${filter.label} tickets`} description="Select a ticket to read the thread and reply.">
          <ul className="divide-y divide-white/10">
            {tickets.map((t) => (
              <li key={t.id}>
                <Link
                  href={`/admin/support/${t.id}`}
                  className="flex items-center gap-4 py-4 transition-colors hover:text-cyan-200"
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
                    <p className="mt-0.5 truncate text-sm font-semibold text-white">
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
        </AdminSectionCard>
      )}
    </div>
  );
}
