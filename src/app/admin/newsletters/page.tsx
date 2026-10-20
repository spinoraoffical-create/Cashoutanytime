import type { Metadata } from "next";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { ConfirmActionButton } from "@/components/admin/confirm-action-button";
import { NewsletterCampaignDialog } from "@/components/admin/newsletter-campaign-dialog";
import { simpleFormToCampaignPayload } from "@/lib/email/newsletter-form";
import { AdminSectionCard } from "@/components/admin/ui/admin-section-card";
import { AdminStatusBadge } from "@/components/admin/ui/admin-status-badge";
import { AdminEmptyState } from "@/components/admin/ui/admin-empty-state";
import { AdminErrorState } from "@/components/admin/ui/admin-error-state";
import { adminDb } from "@/lib/actions/admin/core";
import {
  deleteNewsletterCampaignAction,
  upsertNewsletterCampaignAction,
} from "@/lib/actions/admin/newsletters";
import { NewsletterSendControls } from "@/components/admin/newsletter-send-controls";
import { requirePermission } from "@/lib/data/admin";
import type { NewsletterCampaign } from "@/lib/database.types";
import { newsletterSegmentLabel } from "@/lib/email/newsletter-segments";
import { recipientOutcome } from "@/lib/email/newsletter-consent";
import { newsletterStatusHelp } from "@/lib/admin/marketing-status";
import { formatNepalTime } from "@/lib/admin/nepal-time";

export const metadata: Metadata = { title: "Newsletters" };

export default async function AdminNewslettersPage() {
  await requirePermission("newsletters.manage");
  const db = adminDb();

  const { data, error } = await db
    .from("newsletter_campaigns")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <AdminPageHeader
          title="Email campaigns"
          description="Lifecycle emails for players who still accept promotional mail."
        />
        <AdminErrorState
          title="Email campaigns could not be loaded"
          body="Newsletter tables are not set up yet. Run supabase/admin-essentials/44-newsletters.sql and supabase/migrations/20261007000110_newsletter_segments_phone_consent.sql in the Supabase SQL Editor, then refresh this page."
        />
      </div>
    );
  }

  const campaigns = (data ?? []) as NewsletterCampaign[];
  const ids = campaigns.map((campaign) => campaign.id);
  const recipientRows = ids.length
    ? await db.from("newsletter_campaign_recipients").select("campaign_id, status, error").in("campaign_id", ids)
    : { data: [], error: null };
  const outcomes = new Map<string, { accepted: number; skipped: number; failed: number; pending: number }>();
  if (!recipientRows.error) {
    for (const row of recipientRows.data ?? []) {
      const current = outcomes.get(row.campaign_id) ?? { accepted: 0, skipped: 0, failed: 0, pending: 0 };
      const outcome = recipientOutcome(row.status, row.error);
      if (outcome === "accepted") current.accepted += 1;
      else if (outcome === "skipped") current.skipped += 1;
      else if (outcome === "failed") current.failed += 1;
      else if (outcome === "pending") current.pending += 1;
      outcomes.set(row.campaign_id, current);
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <AdminPageHeader
        title="Email and newsletters"
        description="Emails for players who still accept promotional mail. Accepted by the email service is not the same as delivered. Skipped means the person was left out and was not emailed."
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

      <AdminSectionCard
        title="How to send an email"
        description="Opening this page does not send mail. Nothing is emailed until you confirm on the last step."
      >
        <ol className="list-inside list-decimal space-y-2 text-sm text-[#9fb0d0]">
          <li>Choose who can receive it. Suspended accounts and people who turned email off are left out.</li>
          <li>Write the name, subject, and message, then save the draft.</li>
          <li>Use Test send to preview one copy in your own inbox. Players are not included.</li>
          <li>Keep the draft, or pick a future Nepal time.</li>
          <li>Read the recipient count. People who are left out are counted separately when the send runs.</li>
          <li>Press Send now or Schedule, then confirm. Cancel leaves the draft alone.</li>
          <li>Come back here for results. Accepted is not the same as delivered. Inbox delivery is not tracked.</li>
        </ol>
        <p className="mt-4 border-t border-white/10 pt-4 text-xs leading-5 text-[#8ea0c3]">
          To stop a draft, delete it. A send that has already started cannot be pulled back from this page. Players turn offer email off under Notification settings.
        </p>
      </AdminSectionCard>

      <AdminSectionCard title="Campaigns" description="A draft can still be edited. Other statuses are view only on this screen.">
        {campaigns.length === 0 ? (
          <AdminEmptyState title="No campaigns yet" body="Use New campaign above to save a draft. Saving a draft does not send it." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[52rem] text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 text-xs uppercase tracking-wide text-[#8ea0c3]">
                  <th className="px-2 py-2 font-medium">Campaign</th>
                  <th className="px-2 py-2 font-medium">Audience</th>
                  <th className="px-2 py-2 font-medium">Status</th>
                  <th className="px-2 py-2 font-medium">When</th>
                  <th className="px-2 py-2 text-right font-medium">Delivery</th>
                  <th className="px-2 py-2 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((c) => {
                  const counts = outcomes.get(c.id);
                  const allSkipped = Boolean(counts && c.status === "sent" && counts.accepted === 0 && counts.failed === 0 && counts.skipped > 0);
                  const nothingAccepted = c.status === "sent" && c.sent_count === 0 && c.failed_count > 0;
                  const shownStatus = allSkipped ? "skipped" : nothingAccepted ? "not sent" : c.status;
                  return (
                  <tr key={c.id} className="border-b border-white/5 align-top last:border-0">
                    <td className="px-2 py-3">
                      <p className="font-medium text-white">{c.name}</p>
                      <p className="text-xs text-[#9fb0d0]">{c.subject}</p>
                    </td>
                    <td className="px-2 py-3 text-[#9fb0d0]">{newsletterSegmentLabel(c.segment)}</td>
                    <td className="px-2 py-3">
                      <AdminStatusBadge status={shownStatus} />
                      <p className="mt-1 max-w-[14rem] text-xs leading-5 text-[#9fb0d0]">{newsletterStatusHelp(shownStatus)}</p>
                    </td>
                    <td className="px-2 py-3 text-xs text-[#9fb0d0]">
                      {c.sent_at
                        ? formatNepalTime(c.sent_at)
                        : c.scheduled_at
                          ? `Scheduled ${formatNepalTime(c.scheduled_at)}`
                          : "—"}
                    </td>
                    <td className="px-2 py-3 text-right text-sm tabular-nums text-[#e8eefc]">
                      {c.total_recipients > 0 ? (
                        <span>
                          <span className="block">{counts?.accepted ?? c.sent_count} accepted</span>
                          <span className="block text-xs text-[#9fb0d0]">
                            {counts ? `${counts.skipped} skipped · ${counts.failed} failed` : `${c.failed_count} failed or skipped`}
                            {" · "}
                            {c.total_recipients} total
                          </span>
                          <span className="block text-xs text-[#9fb0d0]">Delivered: not tracked</span>
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-2 py-3 text-right">
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
                          <NewsletterSendControls campaignId={c.id} segment={c.segment} name={c.name} subject={c.subject} />
                        </div>
                      ) : (
                        <span className="text-xs text-[#9fb0d0]">
                          {c.status === "scheduled"
                            ? "Waiting to send"
                            : c.status === "sending"
                              ? "Sending"
                              : "Finished"}
                        </span>
                      )}
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </AdminSectionCard>
    </div>
  );
}
