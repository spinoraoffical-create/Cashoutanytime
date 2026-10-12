import Link from "next/link";

import { GlassCard } from "@/components/shared/glass-card";

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  scheduled: "Scheduled",
  sending: "Sending",
  sent: "Sent",
  failed: "Failed",
};

export function AdminRevenueAnalytics({
  campaigns,
  campaignsLoaded,
  offerSends,
  loadError,
}: {
  campaigns: { status: string; count: number }[];
  campaignsLoaded: boolean;
  offerSends: number | null;
  loadError: string | null;
}) {
  const campaignTotal = campaigns.reduce((sum, row) => sum + row.count, 0);

  return (
    <div className="space-y-4">
      <GlassCard className="p-5">
        <h2 className="text-base font-semibold">Campaign and revenue reports are not connected yet</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          This page does not show deposit totals, player counts, fulfillment rates, or payout times.
          The counts below are saved send records only.
        </p>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <Link href="/admin/newsletters" className="text-sm font-semibold text-primary hover:underline">
            Email campaigns
          </Link>
          <Link href="/admin/offers" className="text-sm font-semibold text-primary hover:underline">
            Email and SMS offers
          </Link>
        </div>
      </GlassCard>

      {loadError ? (
        <p className="text-sm text-destructive" role="alert">
          {loadError}
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <GlassCard className="p-5">
          <h2 className="text-sm font-semibold">Email campaigns by status</h2>
          <p className="mt-1 text-xs text-muted-foreground">Send records, not revenue.</p>
          {!campaignsLoaded ? (
            <p className="mt-4 text-sm text-muted-foreground">Email campaign counts could not be loaded.</p>
          ) : campaignTotal === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">No email campaigns are saved yet.</p>
          ) : (
            <ul className="mt-4 space-y-2">
              {campaigns.map((row) => (
                <li key={row.status} className="flex items-center justify-between text-sm">
                  <span>{STATUS_LABELS[row.status] ?? row.status}</span>
                  <span className="font-semibold tabular-nums">{row.count}</span>
                </li>
              ))}
            </ul>
          )}
        </GlassCard>
        <GlassCard className="p-5">
          <h2 className="text-sm font-semibold">Offer sends</h2>
          <p className="mt-1 text-xs text-muted-foreground">How many offer sends are saved, not money collected.</p>
          {offerSends == null ? (
            <p className="mt-4 text-sm text-muted-foreground">Offer send counts could not be loaded.</p>
          ) : (
            <p className="mt-4 text-3xl font-semibold tabular-nums">{offerSends}</p>
          )}
        </GlassCard>
      </div>
    </div>
  );
}
