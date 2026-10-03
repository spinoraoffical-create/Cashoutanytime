import type { Metadata } from "next";
import { format } from "date-fns";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { BroadcastComposer } from "@/components/admin/broadcast-composer";
import { GlassCard } from "@/components/shared/glass-card";
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
    <div className="mx-auto max-w-4xl">
      <AdminPageHeader
        title="Broadcasts"
        description="Send an in-app announcement to a member segment. Respects each member's notification preferences."
      />

      <BroadcastComposer />

      <section className="mt-8">
        <h2 className="hud-label mb-4 text-muted-foreground">Recent broadcasts</h2>
        {broadcasts.length === 0 ? (
          <GlassCard className="p-8 text-center text-sm text-muted-foreground">
            No broadcasts sent yet.
          </GlassCard>
        ) : (
          <div className="space-y-3">
            {broadcasts.map((b) => (
              <GlassCard key={b.id} className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="font-semibold">{b.title}</p>
                    <p className="mt-0.5 text-sm text-muted-foreground">{b.body}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-xs font-medium text-ws-green-deep dark:text-ws-green">
                      {SEGMENT_LABEL[b.segment] ?? b.segment}
                    </p>
                    <p className="tnum text-xs text-muted-foreground">
                      {b.recipient_count.toLocaleString()} sent
                    </p>
                  </div>
                </div>
                <p className="tnum mt-2 text-xs text-ws-text-faint">
                  {format(new Date(b.sent_at), "MMM d, yyyy · HH:mm")}
                </p>
              </GlassCard>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
