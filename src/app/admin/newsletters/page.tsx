import type { Metadata } from "next";
import { format } from "date-fns";

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
import { newsletterStatusHelp } from "@/lib/admin/marketing-status";

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

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <AdminPageHeader
        title="Email campaigns"
        description="Lifecycle emails for players who still accept promotional mail. Draft means not sent. Scheduled means queued. Sending means a send is in progress. Sent means finished. Failed means the campaign is marked failed. Phone follow-ups live under Text one player and only include people who opted in."
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
        title="How a send works"
        description="Opening this list does not send mail. Test send, Send now, and Schedule keep their existing confirmations."
      >
        <ol className="list-inside list-decimal space-y-2 text-sm text-[#9fb0d0]">
          <li>
            <span className="text-white">New campaign</span> picks a lifecycle template. The audience is filled in for you.
          </li>
          <li>
            <span className="text-white">Test send</span> goes only to your staff email and leaves the campaign as a draft.
          </li>
          <li>
            <span className="text-white">Send now</span> or <span className="text-white">Schedule</span> uses the existing audience count. Suspended players and anyone with promotional email off stay out.
          </li>
        </ol>
        <p className="mt-4 border-t border-white/10 pt-4 text-xs leading-5 text-[#8ea0c3]">
          Delivery shows sent and failed only. Opens and clicks are not tracked. A failed mark is not a new send. Players turn offer email off under Notification settings.
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
                {campaigns.map((c) => (
                  <tr key={c.id} className="border-b border-white/5 align-top last:border-0">
                    <td className="px-2 py-3">
                      <p className="font-medium text-white">{c.name}</p>
                      <p className="text-xs text-[#9fb0d0]">{c.subject}</p>
                    </td>
                    <td className="px-2 py-3 text-[#9fb0d0]">{newsletterSegmentLabel(c.segment)}</td>
                    <td className="px-2 py-3">
                      <AdminStatusBadge status={c.status} />
                      <p className="mt-1 max-w-[14rem] text-xs leading-5 text-[#9fb0d0]">{newsletterStatusHelp(c.status)}</p>
                    </td>
                    <td className="px-2 py-3 text-xs text-[#9fb0d0]">
                      {c.sent_at
                        ? format(new Date(c.sent_at), "MMM d, p")
                        : c.scheduled_at
                          ? `Queued ${format(new Date(c.scheduled_at), "MMM d, p")}`
                          : "—"}
                    </td>
                    <td className="px-2 py-3 text-right text-sm tabular-nums text-[#e8eefc]">
                      {c.total_recipients > 0 ? (
                        <span>
                          <span className="block">{c.sent_count} sent</span>
                          <span className="block text-xs text-[#9fb0d0]">
                            {c.failed_count} failed · {c.total_recipients} total
                          </span>
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
                          <NewsletterSendControls campaignId={c.id} segment={c.segment} />
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
                ))}
              </tbody>
            </table>
          </div>
        )}
      </AdminSectionCard>
    </div>
  );
}
