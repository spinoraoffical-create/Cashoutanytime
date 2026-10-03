import type { Metadata } from "next";
import Link from "next/link";
import { format } from "date-fns";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { GlassCard } from "@/components/shared/glass-card";
import { Badge } from "@/components/ui/badge";
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
import { requirePermission } from "@/lib/data/admin";
import { ScrollText } from "lucide-react";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Audit Logs" };

const PAGE_SIZE = 30;

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  await requirePermission("audit.read");
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const db = adminDb();
  const { data, count } = await db
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
        title="Audit Logs"
        description={`${total.toLocaleString()} recorded actions. Append-only and immutable.`}
      />

      {logs.length === 0 ? (
        <EmptyState
          icon={<ScrollText />}
          title="No audit entries yet"
          description="Staff actions across the admin panel will be recorded here."
        />
      ) : (
        <>
          <GlassCard className="overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-foreground/8 hover:bg-transparent">
                    <TableHead>Action</TableHead>
                    <TableHead>Entity</TableHead>
                    <TableHead>Actor</TableHead>
                    <TableHead className="text-right">When</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow key={log.id} className="border-foreground/8">
                      <TableCell>
                        <Badge className="bg-foreground/8 font-mono text-xs text-foreground">
                          {log.action}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {log.entity_type}
                        {log.entity_id && (
                          <span className="ml-1 text-xs text-ws-text-faint">
                            {log.entity_id.slice(0, 8)}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">
                        @
                        {profileDisplayName(
                          (log.actor as { email?: string | null; full_name?: string | null } | null) ?? {}
                        ) || "system"}
                      </TableCell>
                      <TableCell className="tnum text-right text-xs text-muted-foreground">
                        {format(new Date(log.created_at), "MMM d, yyyy HH:mm")}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </GlassCard>

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
              <p className="tnum text-sm text-muted-foreground">
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
