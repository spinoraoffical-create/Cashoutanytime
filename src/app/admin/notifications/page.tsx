import type { Metadata } from "next";
import { format } from "date-fns";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { BroadcastComposer } from "@/components/admin/broadcast-composer";
import { AdminSectionCard } from "@/components/admin/ui/admin-section-card";
import { AdminEmptyState } from "@/components/admin/ui/admin-empty-state";
import { adminDb } from "@/lib/actions/admin/core";
import { requirePermission } from "@/lib/data/admin";

export const metadata: Metadata = { title: "Broadcasts" };

const SEGMENT_LABEL: Record<string, string> = {
  all: "All members",
  vip_silver_up: "Silver+",
  vip_gold_up: "Gold+",
  vip_platinum_up: "Platinum+",
  vip_diamond_up: "Diamond+",
  vip_elite: "Elite",
};

export default async function AdminBroadcastsPage() {
  await requirePermission("notifications.broadcast");
  const db = adminDb();

  const { data: history } = await db
    .from("broadcasts")
    .select("id, title, body, segment, recipient_count, sent_at")
    .order("sent_at", { ascending: false })
    .limit(20);

  const broadcasts = history ?? [];

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <AdminPageHeader
        title="In-app notices"
        description="This channel posts a notice inside the site. It does not send email, SMS, or Telegram. The composer still respects each member's notification preferences. The list below is history. Opening it does not send."
      />

      <BroadcastComposer />

      <AdminSectionCard title="Recent notices" description="These rows were already sent. The count is the stored recipient count.">
        {broadcasts.length === 0 ? (
          <AdminEmptyState title="No notices sent yet" body="A notice appears here after the existing send button is used." />
        ) : (
          <div className="space-y-3">
            {broadcasts.map((b) => (
              <article key={b.id} className="rounded-xl border border-white/10 bg-[#0c1224] p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="font-semibold text-white">{b.title}</p>
                    <p className="mt-0.5 text-sm text-[#9fb0d0]">{b.body}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-xs font-medium text-emerald-200">{SEGMENT_LABEL[b.segment] ?? b.segment}</p>
                    <p className="text-xs tabular-nums text-[#9fb0d0]">{b.recipient_count.toLocaleString()} sent</p>
                  </div>
                </div>
                <p className="mt-2 text-xs tabular-nums text-[#8ea0c3]">{format(new Date(b.sent_at), "MMM d, yyyy · HH:mm")}</p>
              </article>
            ))}
          </div>
        )}
      </AdminSectionCard>
    </div>
  );
}
