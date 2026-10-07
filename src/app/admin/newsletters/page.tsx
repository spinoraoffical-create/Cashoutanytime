import type { Metadata } from "next";
import { format } from "date-fns";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { ConfirmActionButton } from "@/components/admin/confirm-action-button";
import { NewsletterCampaignDialog } from "@/components/admin/newsletter-campaign-dialog";
import { simpleFormToCampaignPayload } from "@/lib/email/newsletter-form";
import { GlassCard } from "@/components/shared/glass-card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { adminDb } from "@/lib/actions/admin/core";
import {
  deleteNewsletterCampaignAction,
  upsertNewsletterCampaignAction,
} from "@/lib/actions/admin/newsletters";
import { NewsletterSendControls } from "@/components/admin/newsletter-send-controls";
import { requirePermission } from "@/lib/data/admin";
import type { NewsletterCampaign, NewsletterCampaignStatus } from "@/lib/database.types";
import { newsletterSegmentLabel } from "@/lib/email/newsletter-segments";

export const metadata: Metadata = { title: "Newsletters" };

const STATUS_BADGE: Record<NewsletterCampaignStatus, string> = {
  draft: "bg-foreground/8 text-muted-foreground",
  scheduled: "bg-ws-gold/15 text-ws-gold-deep dark:text-ws-gold",
  sending: "bg-ws-gold/15 text-ws-gold-deep dark:text-ws-gold",
  sent: "bg-ws-emerald/15 text-ws-emerald",
  failed: "bg-destructive/15 text-destructive",
};

export default async function AdminNewslettersPage() {
  await requirePermission("newsletters.manage");
  const db = adminDb();

  const { data, error } = await db
    .from("newsletter_campaigns")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return (
      <div className="mx-auto max-w-3xl">
        <AdminPageHeader
          title="Email campaigns"
          description="Lifecycle emails for players who still accept promotional mail."
        />
        <GlassCard className="p-6 text-sm text-muted-foreground">
          Newsletter tables are not set up yet. Run{" "}
          <code className="text-foreground">supabase/admin-essentials/44-newsletters.sql</code> and{" "}
          <code className="text-foreground">
            supabase/migrations/20261007000110_newsletter_segments_phone_consent.sql
          </code>{" "}
          in the Supabase SQL Editor, then refresh this page.
        </GlassCard>
      </div>
    );
  }

  const campaigns = (data ?? []) as NewsletterCampaign[];

  return (
    <div className="mx-auto max-w-6xl">
      <AdminPageHeader
        title="Email campaigns"
        description="Lifecycle emails for players who still accept promotional mail. Phone follow-ups live under Marketing and only include people who opted in."
        action={
          <NewsletterCampaignDialog
            title="New email promo"
            triggerLabel="New campaign"
            action={async (values) => {
              "use server";
              return upsertNewsletterCampaignAction(simpleFormToCampaignPayload(values));
            }}
          />
        }
      />

      <GlassCard className="mb-6 p-5">
        <h2 className="font-semibold">How to send without spamming</h2>
        <ol className="mt-3 space-y-2 text-sm text-muted-foreground list-decimal list-inside">
          <li>
            <strong className="text-foreground">New campaign</strong> → pick a lifecycle template.
            The audience is filled in for you (welcome → new signups, first deposit → never
            deposited, reload → recent depositors, win-back → inactive 7–14 days, VIP → VIP only).
          </li>
          <li>
            Save, then <strong className="text-foreground">Test send</strong>. That goes only to
            your staff email and leaves the campaign as a draft.
          </li>
          <li>
            <strong className="text-foreground">Send now</strong> or pick a time and{" "}
            <strong className="text-foreground">Schedule</strong>. The count on the form already
            leaves out suspended players and anyone with promotional email off.
          </li>
        </ol>
        <p className="mt-4 text-xs text-muted-foreground border-t border-border pt-4">
          Delivery shows sent and failed only. Opens and clicks are not tracked. Players turn offer
          email off under Notification settings. One note per lifecycle moment — not a daily blast.
        </p>
      </GlassCard>

      <GlassCard className="overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-foreground/8 hover:bg-transparent">
                <TableHead>Campaign</TableHead>
                <TableHead>Audience</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>When</TableHead>
                <TableHead className="text-right">Delivery</TableHead>
                <TableHead className="w-64 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {campaigns.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                    No campaigns yet — click <strong>New campaign</strong> above.
                  </TableCell>
                </TableRow>
              ) : (
                campaigns.map((c) => (
                  <TableRow key={c.id} className="border-foreground/8">
                    <TableCell>
                      <p className="font-medium">{c.name}</p>
                      <p className="text-xs text-muted-foreground">{c.subject}</p>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {newsletterSegmentLabel(c.segment)}
                    </TableCell>
                    <TableCell>
                      <Badge className={STATUS_BADGE[c.status]}>{c.status}</Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {c.sent_at
                        ? format(new Date(c.sent_at), "MMM d, p")
                        : c.scheduled_at
                          ? `Queued ${format(new Date(c.scheduled_at), "MMM d, p")}`
                          : "—"}
                    </TableCell>
                    <TableCell className="tnum text-right text-sm">
                      {c.total_recipients > 0 ? (
                        <span>
                          <span className="block">{c.sent_count} sent</span>
                          <span className="block text-xs text-muted-foreground">
                            {c.failed_count} failed · {c.total_recipients} total
                          </span>
                        </span>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {c.status === "draft" ? (
                        <div className="flex flex-col items-end gap-2">
                          <div className="flex flex-wrap justify-end gap-1">
                            <NewsletterCampaignDialog
                              title="Edit campaign"
                              initial={c}
                              triggerLabel="Edit"
                              action={async (values) => {
                                "use server";
                                return upsertNewsletterCampaignAction({
                                  id: c.id,
                                  ...simpleFormToCampaignPayload(values),
                                });
                              }}
                            />
                            <ConfirmActionButton
                              action={deleteNewsletterCampaignAction.bind(null, c.id)}
                              title="Delete campaign?"
                              description="This draft will be permanently removed."
                              confirmLabel="Delete"
                            />
                          </div>
                          <NewsletterSendControls campaignId={c.id} segment={c.segment} />
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          {c.status === "scheduled"
                            ? "Waiting to send"
                            : c.status === "sending"
                              ? "Sending"
                              : "Finished"}
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </GlassCard>
    </div>
  );
}
