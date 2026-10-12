import type { Metadata } from "next";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminRevenueAnalytics } from "@/components/admin/admin-revenue-analytics";
import { adminDb } from "@/lib/actions/admin/core";
import { requirePermission } from "@/lib/data/admin";

export const metadata: Metadata = { title: "Send reports" };

async function loadSendCounts() {
  try {
    const db = adminDb();
    const [campaigns, offers] = await Promise.all([
      db.from("newsletter_campaigns").select("status"),
      db.from("offer_sends").select("id", { count: "exact", head: true }),
    ]);

    const counts = new Map<string, number>();
    if (!campaigns.error) {
      for (const row of campaigns.data ?? []) {
        const status = typeof row.status === "string" && row.status ? row.status : "unknown";
        counts.set(status, (counts.get(status) ?? 0) + 1);
      }
    }

    const messages = [
      campaigns.error ? "Email campaign counts could not be loaded." : null,
      offers.error ? "Offer send counts could not be loaded." : null,
    ].filter((item): item is string => Boolean(item));
    return {
      campaigns: campaigns.error ? [] : [...counts.entries()].map(([status, count]) => ({ status, count })),
      campaignsLoaded: !campaigns.error,
      offerSends: offers.error ? null : (offers.count ?? 0),
      loadError: messages.length ? `${messages.join(" ")} Nothing on this page is a revenue figure.` : null,
    };
  } catch {
    return {
      campaigns: [],
      campaignsLoaded: false,
      offerSends: null,
      loadError: "Send counts could not be loaded. Revenue reports are not connected.",
    };
  }
}

export default async function AdminAnalyticsPage() {
  await requirePermission("analytics.read");
  const counts = await loadSendCounts();

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <AdminPageHeader
        title="Send reports"
        description="Saved email campaigns and offer sends. Revenue reports are not connected yet."
      />
      <AdminRevenueAnalytics {...counts} />
    </div>
  );
}
