"use server";

import { redirect } from "next/navigation";

import { scheduleNewsletterCampaignAction, upsertNewsletterCampaignAction } from "@/lib/actions/admin/newsletters";
import { simpleFormToCampaignPayload } from "@/lib/email/newsletter-form";
import { presetToSimpleForm } from "@/lib/email/newsletter-presets";
import { isNewsletterSegment } from "@/lib/email/newsletter-segments";

export async function createMarketingCampaign(formData: FormData) {
  const template = String(formData.get("template") ?? "welcome");
  const base = presetToSimpleForm(template);
  const segmentValue = String(formData.get("segment") ?? base.segment);
  const segment = isNewsletterSegment(segmentValue) ? segmentValue : base.segment;
  const name = String(formData.get("name") ?? "").trim();
  const subject = String(formData.get("subject") ?? "").trim();
  const message = String(formData.get("message") ?? "").trim();
  const saved = await upsertNewsletterCampaignAction({
    ...simpleFormToCampaignPayload({
      ...base,
      name: name || base.name || subject,
      subject: subject || base.subject,
      message: message || base.message,
      segment,
    }),
  });
  if (!saved.ok) {
    redirect(`/admin/marketing-center/create?error=${encodeURIComponent(saved.error)}`);
  }

  const confirmed = formData.get("confirm") === "yes";
  const when = String(formData.get("scheduled_at") ?? "").trim();
  if (confirmed && when && saved.id) {
    const scheduled = await scheduleNewsletterCampaignAction(saved.id, new Date(when).toISOString());
    if (!scheduled.ok) {
      redirect(`/admin/newsletters?notice=${encodeURIComponent(scheduled.error)}`);
    }
  }
  redirect("/admin/newsletters");
}
