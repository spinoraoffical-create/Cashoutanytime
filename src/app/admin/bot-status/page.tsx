import type { Metadata } from "next";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminBotStatusCard } from "@/components/admin/admin-bot-status-card";
import { requirePermission } from "@/lib/data/admin";

export const metadata: Metadata = { title: "Game Bot Control Room" };

export default async function AdminBotStatusPage() {
  await requirePermission("cms.manage");

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <AdminPageHeader
        title="24/7 Game Bot Control Room"
        description="Monitor real-time polling, session heartbeats, and Chrome CDP Port 9222 connections for all 8 game bot workers."
      />

      <AdminBotStatusCard />
    </div>
  );
}
