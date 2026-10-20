"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, Loader2, Mail, Send } from "lucide-react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  scheduleNewsletterCampaignAction,
  sendNewsletterTestAction,
} from "@/lib/actions/admin/newsletters";
import {
  newsletterSegmentLabel,
  NEWSLETTER_SEGMENT_META,
  isNewsletterSegment,
} from "@/lib/email/newsletter-segments";
import { formatNepalTime, parseNepalLocalToUtc } from "@/lib/admin/nepal-time";

export function NewsletterSendControls({
  campaignId,
  segment,
  name,
  subject,
}: {
  campaignId: string;
  segment: string;
  name: string;
  subject: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [when, setWhen] = React.useState("");

  const label = newsletterSegmentLabel(segment);
  const cadence = isNewsletterSegment(segment) ? NEWSLETTER_SEGMENT_META[segment].cadence : "";
  const sendNowCopy =
    segment === "test"
      ? "Sends to your email only and marks this campaign sent. Prefer Test send if you still want to edit the draft."
      : `Sends now to “${label}”. Suspended players and anyone who turned off promotional email are left out. ${cadence} This cannot be undone.`;

  function run(action: () => Promise<{ ok: boolean; error?: string; message?: string }>) {
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        toast.error(result.error ?? "Could not send.");
        return;
      }
      toast.success(result.message ?? "Done");
      router.refresh();
    });
  }

  const scheduledAt = when ? parseNepalLocalToUtc(when) : null;

  function schedule() {
    if (!when) {
      toast.error("Pick a Nepal date and time first.");
      return;
    }
    if (!scheduledAt) {
      toast.error("That date is not valid.");
      return;
    }
    if (scheduledAt.getTime() <= Date.now()) {
      toast.error("That Nepal time has already passed. Pick a future time, or use Send now.");
      return;
    }
    run(() => scheduleNewsletterCampaignAction(campaignId, scheduledAt.toISOString()));
  }

  const scheduleIsPast = Boolean(scheduledAt && scheduledAt.getTime() <= Date.now());

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap justify-end gap-1">
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button type="button" variant="outline" size="sm" disabled={pending}>
              {pending ? <Loader2 className="size-4 animate-spin" /> : <Mail className="size-4" />}
              Test send
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Send a test to you?</AlertDialogTitle>
              <AlertDialogDescription>
                One copy goes to your staff email. Players are not included, and the campaign stays a
                draft so you can still edit it.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => run(() => sendNewsletterTestAction(campaignId))}>
                Send test
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button type="button" variant="outline" size="sm" disabled={pending}>
              <Send className="size-4" />
              Send now
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Send this email now?</AlertDialogTitle>
              <AlertDialogDescription>
                {sendNowCopy} Name: {name}. Subject: {subject}. Time: now, shown in Nepal time after it is saved. People who are left out are counted when the send runs. Delivered is not tracked.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => run(() => scheduleNewsletterCampaignAction(campaignId, null))}
              >
                Send now
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-1">
        <Input
          type="datetime-local"
          value={when}
          onChange={(event) => setWhen(event.target.value)}
          aria-label="Schedule time in Nepal time"
          className="h-8 w-[190px] text-xs"
        />
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button type="button" variant="outline" size="sm" disabled={pending}>
              <CalendarClock className="size-4" />
              Schedule
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Schedule this email?</AlertDialogTitle>
              <AlertDialogDescription>
                {scheduledAt
                  ? `Name: ${name}. Subject: ${subject}. Sends at ${formatNepalTime(scheduledAt)}. The time you entered is Nepal time. ${cadence} Suspended players and people who turned email off are left out. Cancel keeps this as a draft.`
                  : "Pick a future Nepal date and time first."}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={schedule}>Schedule</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
      {scheduleIsPast ? (
        <p className="text-[11px] text-amber-200">That Nepal time has already passed. Pick a future time, or use Send now.</p>
      ) : (
        <p className="max-w-[240px] text-right text-[11px] text-muted-foreground">
          The time box is Nepal time. Test send stays a draft. Nothing sends until you confirm.
        </p>
      )}
    </div>
  );
}
