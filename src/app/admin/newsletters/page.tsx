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
  scheduleNewsletterCampaignAction,
  upsertNewsletterCampaignAction,
} from "@/lib/actions/admin/newsletters";
import { requirePermission } from "@/lib/data/admin";
import type { NewsletterCampaign, NewsletterCampaignStatus } from "@/lib/database.types";

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
          title="Email promos"
          description="Send promo emails to players who signed up on Spinora."
        />
        <GlassCard className="p-6 text-sm text-muted-foreground">
          Newsletter tables are not set up yet. Run{" "}
          <code className="text-foreground">supabase/admin-essentials/44-newsletters.sql</code>{" "}
          in the Supabase SQL Editor, then refresh this page.
        </GlassCard>
      </div>
    );
  }

  const campaigns = (data ?? []) as NewsletterCampaign[];

  return (
    <div className="mx-auto max-w-5xl">
      <AdminPageHeader
        title="Email promos"
        description="Send promo emails to players who signed up on Spinora."
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
        <h2 className="font-semibold">Quick guide</h2>
        <ol className="mt-3 space-y-2 text-sm text-muted-foreground list-decimal list-inside">
          <li>
            <strong className="text-foreground">New campaign</strong> → pick a{" "}
            <strong className="text-foreground">template</strong> → tweak subject/message if needed →
            choose <strong className="text-foreground">Test — my email only</strong> → Save
          </li>
          <li>
            Click <strong className="text-foreground">Send test</strong> → check your inbox (and spam
            once — mark “Not spam” so future emails land in inbox)
          </li>
          <li>
            Happy with it? Edit → audience <strong className="text-foreground">All players</strong> →
            Save → <strong className="text-foreground">Send to everyone</strong>
          </li>
        </ol>
        <p className="mt-4 text-xs text-muted-foreground border-t border-border pt-4">
          <strong className="text-foreground">Inbox tip:</strong> In Resend, verify{" "}
          <code className="text-foreground">spinoracasinos.com</code> (SPF + DKIM + DMARC). Send from{" "}
          <code className="text-foreground">noreply@spinoracasinos.com</code> only after the domain
          shows “Verified”. Ask new players to mark the first email as Not spam.
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
                <TableHead>Sent</TableHead>
                <TableHead className="text-right">Progress</TableHead>
                <TableHead className="w-40 text-right">Actions</TableHead>
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
                      {c.segment === "test" ? "Test (you)" : "All players"}
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
                      {c.total_recipients > 0
                        ? `${c.sent_count} / ${c.total_recipients}`
                        : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      {c.status === "draft" ? (
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
                            action={async () => {
                              "use server";
                              return scheduleNewsletterCampaignAction(c.id, null);
                            }}
                            title="Send this email now?"
                            description={
                              c.segment === "test"
                                ? "Sends to your email address only."
                                : "Sends to every signed-up player who opted in. This cannot be undone."
                            }
                            confirmLabel="Send"
                            triggerLabel={c.segment === "test" ? "Send test" : "Send to everyone"}
                            variant="outline"
                          />
                          <ConfirmActionButton
                            action={deleteNewsletterCampaignAction.bind(null, c.id)}
                            title="Delete campaign?"
                            description="This draft will be permanently removed."
                            confirmLabel="Delete"
                          />
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          {c.failed_count > 0 ? `${c.failed_count} failed` : "Done"}
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
