import type { Metadata } from "next";
import Link from "next/link";

import { createMarketingCampaign } from "@/app/admin/marketing-center/actions";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { adminDb } from "@/lib/actions/admin/core";
import { NEWSLETTER_PRESETS } from "@/lib/email/newsletter-presets";
import { NEWSLETTER_SEGMENT_META } from "@/lib/email/newsletter-segments";
import { previewNewsletterAudiences } from "@/lib/email/newsletter-audience";
import { requirePermission } from "@/lib/data/admin";

export const metadata: Metadata = { title: "Create campaign" };
export const dynamic = "force-dynamic";

export default async function CreateCampaignPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requirePermission("newsletters.manage");
  const params = await searchParams;
  let counts: Awaited<ReturnType<typeof previewNewsletterAudiences>> | null = null;
  let countError: string | null = null;
  try {
    counts = await previewNewsletterAudiences(adminDb());
  } catch {
    countError = "Unavailable";
  }

  return (
    <div className="mx-auto max-w-3xl">
      <AdminPageHeader
        title="Create campaign"
        description="This saves an email through the existing campaign system. It does not text anyone and it does not change a wallet. The schedule box is Nepal time. A future time is saved once, as the matching universal time, and is sent on the daily check at 2:45 PM Nepal time after that time has passed. Leave the time blank, or leave the box unchecked, to save a draft. Opening this page does not send."
      />
      {params.error ? <p className="mb-4 rounded-xl border border-amber-300/40 bg-amber-300/10 p-3 text-sm text-amber-100">{params.error}</p> : null}
      {countError ? <p className="mb-4 text-sm text-amber-100">Eligible counts: Unavailable</p> : null}
      {counts?.warnings.map((warning) => <p key={warning} className="mb-2 text-sm text-amber-100">{warning}</p>)}
      <form action={createMarketingCampaign} className="space-y-4">
        <label className="block text-sm text-[#9fb0d0]">Campaign name
          <input name="name" required className="mt-1 w-full min-h-11 rounded-xl border border-white/10 bg-[#0d1428] px-3 text-white" />
        </label>
        <label className="block text-sm text-[#9fb0d0]">Objective
          <select name="template" className="mt-1 w-full min-h-11 rounded-xl border border-white/10 bg-[#0d1428] px-3 text-white">
            {NEWSLETTER_PRESETS.map((preset) => <option key={preset.id} value={preset.id}>{preset.label}</option>)}
          </select>
        </label>
        <label className="block text-sm text-[#9fb0d0]">Audience
          <select name="segment" className="mt-1 w-full min-h-11 rounded-xl border border-white/10 bg-[#0d1428] px-3 text-white">
            {Object.entries(NEWSLETTER_SEGMENT_META).map(([id, meta]) => (
              <option key={id} value={id}>
                {meta.label}{counts ? ` · eligible ${counts.counts[id as keyof typeof counts.counts]?.eligible ?? "Unavailable"}` : ""}
              </option>
            ))}
          </select>
        </label>
        <p className="text-sm text-[#9fb0d0]">Channel: email. SMS and Telegram stay on their own screens because this form must not pretend to send them.</p>
        <label className="block text-sm text-[#9fb0d0]">Subject
          <input name="subject" className="mt-1 w-full min-h-11 rounded-xl border border-white/10 bg-[#0d1428] px-3 text-white" placeholder="Leave blank to use the objective template" />
        </label>
        <label className="block text-sm text-[#9fb0d0]">Message
          <textarea name="message" rows={6} className="mt-1 w-full rounded-xl border border-white/10 bg-[#0d1428] px-3 py-2 text-white" placeholder="Leave blank to use the objective template" />
        </label>
        <p className="text-sm text-[#9fb0d0]">Preview: the email uses the existing template, an unsubscribe link, and the subject above. Cost: Not tracked. Delivery confirmation: Not tracked.</p>
        <label className="block text-sm text-[#9fb0d0]">Schedule time (Nepal time, UTC+05:45)
          <input name="scheduled_at" type="datetime-local" aria-label="Schedule time in Nepal time" className="mt-1 w-full min-h-11 rounded-xl border border-white/10 bg-[#0d1428] px-3 text-white" />
        </label>
        <label className="flex min-h-11 items-start gap-2 text-sm text-white">
          <input name="confirm" type="checkbox" value="yes" className="mt-1" />
          I confirm this schedule. Leave this unchecked to save a draft only. A draft does not email anyone.
        </label>
        <button className="min-h-11 rounded-xl bg-cyan-300 px-4 text-sm font-semibold text-[#07111f]" type="submit">Save campaign</button>
      </form>
      <p className="mt-4 text-sm"><Link className="text-cyan-200 underline" href="/admin/marketing-center">Back to Marketing Center</Link></p>
    </div>
  );
}
