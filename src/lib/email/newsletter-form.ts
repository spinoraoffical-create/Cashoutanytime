import type { NewsletterCampaign } from "@/lib/database.types";
import type { NewsletterVibe } from "@/lib/email/newsletter-templates";
import { presetToSimpleForm } from "@/lib/email/newsletter-presets";

const DEFAULT_CTA_HREF = "https://spinoracasinos.com/promotions";

export type SimpleNewsletterInput = {
  template_id: string;
  vibe: NewsletterVibe;
  name: string;
  subject: string;
  eyebrow: string;
  heading: string;
  subhead: string;
  message: string;
  cta_label: string;
  cta_href: string;
  stat1_value: string;
  stat1_label: string;
  stat2_value: string;
  stat2_label: string;
  stat3_value: string;
  stat3_label: string;
  segment: "all" | "test";
};

export function campaignToSimpleForm(c?: NewsletterCampaign): SimpleNewsletterInput {
  if (!c) return presetToSimpleForm("welcome-50", "test");

  return {
    template_id: "custom",
    vibe: "gold",
    name: c.name ?? "",
    subject: c.subject ?? "",
    eyebrow: c.eyebrow ?? "Spinora",
    heading: c.heading ?? "",
    subhead: c.subhead ?? "",
    message: (c.body ?? "").replace(/<br\s*\/?>/gi, "\n"),
    cta_label: c.cta_label ?? "Play Now",
    cta_href: c.cta_href ?? DEFAULT_CTA_HREF,
    stat1_value: c.stat1_value ?? "",
    stat1_label: c.stat1_label ?? "",
    stat2_value: c.stat2_value ?? "",
    stat2_label: c.stat2_label ?? "",
    stat3_value: c.stat3_value ?? "",
    stat3_label: c.stat3_label ?? "",
    segment: c.segment === "test" ? "test" : "all",
  };
}

export function simpleFormToCampaignPayload(v: SimpleNewsletterInput) {
  const subject = v.subject.trim();
  const heading = (v.heading.trim() || subject).trim();
  const message = v.message.trim();

  return {
    name: v.name.trim() || subject,
    subject,
    eyebrow: v.eyebrow.trim() || "Spinora",
    heading,
    subhead: v.subhead.trim(),
    body: message.replace(/\n/g, "<br>"),
    cta_label: v.cta_label.trim() || "Play Now",
    cta_href: v.cta_href.trim() || DEFAULT_CTA_HREF,
    stat1_value: v.stat1_value.trim(),
    stat1_label: v.stat1_label.trim(),
    stat2_value: v.stat2_value.trim(),
    stat2_label: v.stat2_label.trim(),
    stat3_value: v.stat3_value.trim(),
    stat3_label: v.stat3_label.trim(),
    segment: v.segment,
  };
}
