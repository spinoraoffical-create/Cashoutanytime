"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Eye, Loader2, Mail, Pencil } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { AdminActionResult } from "@/lib/actions/admin/core";
import type { NewsletterCampaign } from "@/lib/database.types";
import {
  campaignToSimpleForm,
  simpleFormToCampaignPayload,
  type SimpleNewsletterInput,
} from "@/lib/email/newsletter-form";
import { previewNewsletterAudiencesAction } from "@/lib/actions/admin/newsletters";
import { NEWSLETTER_PRESETS, presetToSimpleForm } from "@/lib/email/newsletter-presets";
import {
  isNewsletterSegment,
  NEWSLETTER_SEGMENT_META,
  NEWSLETTER_SEGMENTS,
  segmentNeedsDeposits,
  segmentNeedsProfileActivity,
  type AudienceCounts,
} from "@/lib/email/newsletter-segments";
import { customCampaignEmail } from "@/lib/email/newsletter-templates";

function statsFromForm(v: SimpleNewsletterInput) {
  return (
    [
      v.stat1_value && v.stat1_label ? { value: v.stat1_value, label: v.stat1_label } : null,
      v.stat2_value && v.stat2_label ? { value: v.stat2_value, label: v.stat2_label } : null,
      v.stat3_value && v.stat3_label ? { value: v.stat3_value, label: v.stat3_label } : null,
    ] as ({ value: string; label: string } | null)[]
  ).filter((s): s is { value: string; label: string } => s !== null);
}

export function NewsletterCampaignDialog({
  title,
  initial,
  action,
  triggerLabel,
}: {
  title: string;
  initial?: NewsletterCampaign;
  action: (values: SimpleNewsletterInput) => Promise<AdminActionResult>;
  triggerLabel?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const [advancedOpen, setAdvancedOpen] = React.useState(false);
  const [values, setValues] = React.useState<SimpleNewsletterInput>(() =>
    campaignToSimpleForm(initial)
  );
  const [audience, setAudience] = React.useState<Record<string, AudienceCounts> | null>(null);
  const [audienceWarnings, setAudienceWarnings] = React.useState<string[]>([]);
  const [audiencePending, setAudiencePending] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setValues(campaignToSimpleForm(initial));
      setAdvancedOpen(Boolean(initial?.name && initial.name !== initial.subject));
    }
  }, [open, initial]);

  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setAudiencePending(true);
    void previewNewsletterAudiencesAction().then((result) => {
      if (cancelled) return;
      setAudiencePending(false);
      if (!result.ok) {
        setAudience(null);
        setAudienceWarnings([result.error]);
        return;
      }
      setAudience(result.counts);
      setAudienceWarnings(result.warnings);
    });
    return () => {
      cancelled = true;
    };
  }, [open]);

  function applyTemplate(templateId: string) {
    setValues(presetToSimpleForm(templateId));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!values.subject.trim() || !values.message.trim()) {
      toast.error("Subject and message are required.");
      return;
    }
    startTransition(async () => {
      const result = await action(values);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(result.message ?? "Saved");
      setOpen(false);
      router.refresh();
    });
  }

  const payload = simpleFormToCampaignPayload(values);
  const stats = statsFromForm(values);
  const preview = customCampaignEmail({
    subject: payload.subject,
    eyebrow: payload.eyebrow,
    heading: payload.heading,
    subhead: payload.subhead,
    body: payload.body,
    stats: stats.length ? stats : undefined,
    cta: { label: payload.cta_label, href: payload.cta_href },
    vibe: values.vibe,
    template_id: values.template_id,
  });

  const selectedPreset = NEWSLETTER_PRESETS.find((p) => p.id === values.template_id);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {triggerLabel ? (
          <Button variant="outline" size="sm">
            {triggerLabel === "New campaign" ? (
              <Mail className="size-4" aria-hidden />
            ) : (
              <Pencil className="size-4" aria-hidden />
            )}
            {triggerLabel}
          </Button>
        ) : (
          <Button variant="ghost" size="icon-sm" aria-label={title}>
            <Pencil className="size-4" aria-hidden />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="glass-strong sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Pick a short template and a specific audience. Save the draft, then use Test send
            before Schedule or Send now. Suspended players and anyone who turned off promotional
            email are always left out.
          </p>
        </DialogHeader>
        <div className="grid gap-6 lg:grid-cols-[minmax(300px,1fr)_340px]">
          <form onSubmit={submit} className="min-w-0 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nl-template">Template</Label>
              <Select value={values.template_id} onValueChange={applyTemplate}>
                <SelectTrigger id="nl-template" className="w-full">
                  <SelectValue placeholder="Choose a template" />
                </SelectTrigger>
                <SelectContent>
                  {NEWSLETTER_PRESETS.map((preset) => (
                    <SelectItem key={preset.id} value={preset.id}>
                      {preset.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedPreset ? (
                <p className="text-xs text-muted-foreground">{selectedPreset.description}</p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="nl-subject">Email subject *</Label>
              <Input
                id="nl-subject"
                placeholder="Your 50% welcome bonus is ready at Sweepstakes Hub"
                value={values.subject}
                onChange={(e) => setValues((v) => ({ ...v, subject: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="nl-message">Promo message *</Label>
              <Textarea
                id="nl-message"
                rows={5}
                placeholder="Edit the template message here if needed."
                value={values.message}
                onChange={(e) => setValues((v) => ({ ...v, message: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">
                Headline, stats and button come from the template. Edit below only if needed.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="nl-segment">Audience</Label>
              <Select
                value={values.segment}
                onValueChange={(v) => {
                  if (!isNewsletterSegment(v)) return;
                  setValues((prev) => ({ ...prev, segment: v }));
                }}
              >
                <SelectTrigger id="nl-segment" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {NEWSLETTER_SEGMENTS.map((segment) => (
                    <SelectItem key={segment} value={segment}>
                      {NEWSLETTER_SEGMENT_META[segment].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {NEWSLETTER_SEGMENT_META[values.segment].hint}{" "}
                {NEWSLETTER_SEGMENT_META[values.segment].cadence}
              </p>
              {audiencePending ? (
                <p className="text-xs text-muted-foreground">Counting this audience…</p>
              ) : audience?.[values.segment] ? (
                <p className="text-xs text-muted-foreground">
                  Will receive this: {audience[values.segment].eligible.toLocaleString()}. Opted out
                  of promo email: {audience[values.segment].optedOut.toLocaleString()}. Suspended,
                  excluded: {audience[values.segment].suspended.toLocaleString()}.
                  {audience[values.segment].noEmail > 0
                    ? ` No email on file: ${audience[values.segment].noEmail.toLocaleString()}.`
                    : ""}
                </p>
              ) : null}
              {audienceWarnings
                .filter((warning) => {
                  if (segmentNeedsDeposits(values.segment)) return warning.toLowerCase().includes("deposit");
                  if (segmentNeedsProfileActivity(values.segment)) return warning.toLowerCase().includes("activity");
                  return false;
                })
                .map((warning) => (
                  <p key={warning} className="text-xs text-destructive">
                    {warning}
                  </p>
                ))}
            </div>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="gap-1 px-0"
              onClick={() => setAdvancedOpen((o) => !o)}
            >
              <ChevronDown
                className={`size-4 transition-transform ${advancedOpen ? "rotate-180" : ""}`}
                aria-hidden
              />
              Advanced (optional)
            </Button>
            {advancedOpen && (
              <div className="space-y-4 pt-2">
                <div className="space-y-2">
                  <Label htmlFor="nl-heading">Headline</Label>
                  <Input
                    id="nl-heading"
                    value={values.heading}
                    onChange={(e) => setValues((v) => ({ ...v, heading: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="nl-subhead">Subheadline</Label>
                  <Input
                    id="nl-subhead"
                    value={values.subhead}
                    onChange={(e) => setValues((v) => ({ ...v, subhead: e.target.value }))}
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="nl-cta-label">Button text</Label>
                    <Input
                      id="nl-cta-label"
                      value={values.cta_label}
                      onChange={(e) => setValues((v) => ({ ...v, cta_label: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="nl-cta-href">Button link</Label>
                    <Input
                      id="nl-cta-href"
                      type="url"
                      value={values.cta_href}
                      onChange={(e) => setValues((v) => ({ ...v, cta_href: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="nl-name">Internal name (for your list only)</Label>
                  <Input
                    id="nl-name"
                    placeholder="Defaults to subject line"
                    value={values.name}
                    onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))}
                  />
                </div>
              </div>
            )}

            <DialogFooter className="pt-2">
              <Button type="submit" disabled={pending}>
                {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
                Save campaign
              </Button>
            </DialogFooter>
          </form>

          <div className="min-w-0 hidden sm:block">
            <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <Eye className="size-3.5" aria-hidden />
              Preview
            </h3>
            <iframe
              title="Email preview"
              srcDoc={preview.html}
              sandbox=""
              className="h-[min(70vh,520px)] w-full rounded-lg border border-border bg-white"
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
