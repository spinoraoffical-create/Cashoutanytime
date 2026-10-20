import type { Metadata } from "next";
import Link from "next/link";
import { formatNepalTime } from "@/lib/admin/nepal-time";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminEmptyState } from "@/components/admin/ui/admin-empty-state";
import { AdminErrorState } from "@/components/admin/ui/admin-error-state";
import { AdminSectionCard } from "@/components/admin/ui/admin-section-card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { profileDisplayName } from "@/lib/admin/spinora-profile";
import { adminDb } from "@/lib/actions/admin/core";
import { requireSuperAdmin } from "@/lib/data/admin";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Audit Logs" };

const PAGE_SIZE = 30;

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  await requireSuperAdmin();
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const db = adminDb();
  const { data, count, error } = await db
    .from("audit_logs")
    .select(
      "id, action, entity_type, entity_id, created_at, actor:profiles!audit_logs_actor_id_fkey(email, full_name)",
      { count: "exact" }
    )
    .order("created_at", { ascending: false })
    .range(from, to);

  const logs = data ?? [];
  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="mx-auto max-w-5xl">
      <AdminPageHeader
        title="Audit log"
        description={`${total.toLocaleString()} stored actions. This list is read only. It does not add or delete a row.`}
      />

      {error ? (
        <AdminErrorState title="The audit log could not be loaded" body="The stored actions are still unchanged. Try this page again in a moment." />
      ) : logs.length === 0 ? (
        <AdminEmptyState
          title="No audit entries yet"
          body="Staff actions that are already written to the audit log will show here."
        />
      ) : (
        <>
          <AdminSectionCard title="Recorded actions" description="Newest first. Each row is an action already stored.">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-white/10 hover:bg-transparent">
                    <TableHead className="text-[#8ea0c3]">Action</TableHead>
                    <TableHead className="text-[#8ea0c3]">Entity</TableHead>
                    <TableHead className="text-[#8ea0c3]">Actor</TableHead>
                    <TableHead className="text-right text-[#8ea0c3]">When</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow key={log.id} className="border-white/5 hover:bg-white/[0.03]">
                      <TableCell>
                        <span className="inline-flex rounded-full bg-white/10 px-2.5 py-1 font-mono text-xs text-[#d5def2]">
                          {log.action}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm text-[#9fb0d0]">
                        {log.entity_type}
                        {log.entity_id ? (
                          <span className="ml-1 text-xs text-[#8ea0c3]">{log.entity_id.slice(0, 8)}</span>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-sm text-white">
                        {profileDisplayName(
                          (log.actor as { email?: string | null; full_name?: string | null } | null) ?? {}
                        ) || "system"}
                      </TableCell>
                      <TableCell className="text-right text-xs tabular-nums text-[#9fb0d0]">
                        {formatNepalTime(log.created_at)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </AdminSectionCard>

          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between">
              <Button
                asChild
                variant="outline"
                size="sm"
                className={cn(page <= 1 && "pointer-events-none opacity-50")}
              >
                <Link href={`/admin/audit?page=${page - 1}`}>Previous</Link>
              </Button>
              <p className="text-sm tabular-nums text-[#9fb0d0]">
                Page {page} of {totalPages}
              </p>
              <Button
                asChild
                variant="outline"
                size="sm"
                className={cn(page >= totalPages && "pointer-events-none opacity-50")}
              >
                <Link href={`/admin/audit?page=${page + 1}`}>Next</Link>
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
