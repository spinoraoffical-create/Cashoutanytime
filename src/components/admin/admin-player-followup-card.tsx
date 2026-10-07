"use client";

import { useMemo, useState } from "react";
import { MessageCircle, Smartphone } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/shared/glass-card";
import type { PhoneOutreachSnapshot } from "@/lib/data/admin-phone-outreach";
import { SITE_URL } from "@/lib/constants";

const TEMPLATES = [
  {
    id: "check-in",
    label: "Short check-in",
    body: "Hi {name}, this is Sweepstakes Hub. Your account is ready whenever you want to play. Reply stop if you do not want offer messages.",
  },
  {
    id: "deposit-help",
    label: "Deposit help",
    body: `Hi {name}, if you want help with a deposit, reply here and a person will answer. ${SITE_URL}/dashboard/deposit`,
  },
  {
    id: "vip-note",
    label: "VIP note",
    body: "Hi {name}, a short note from Sweepstakes Hub. We only send this because you asked for messages. Reply stop to opt out.",
  },
] as const;

function firstName(name: string) {
  const part = name.trim().split(/\s+/)[0];
  return part || "there";
}

function fillTemplate(body: string, name: string) {
  return body.replaceAll("{name}", firstName(name));
}

function whatsAppHref(raw: string, text: string) {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

export function AdminPlayerFollowupCard({
  canView,
  outreach,
}: {
  canView: boolean;
  outreach: PhoneOutreachSnapshot | null;
}) {
  const [templateId, setTemplateId] = useState<(typeof TEMPLATES)[number]["id"]>("check-in");
  const template = TEMPLATES.find((item) => item.id === templateId) ?? TEMPLATES[0];
  const players = outreach?.players ?? [];
  const previewName = players[0]?.name ?? "there";
  const preview = useMemo(() => fillTemplate(template.body, previewName), [template.body, previewName]);

  async function copySms(name: string, phone: string) {
    const text = fillTemplate(template.body, name);
    try {
      await navigator.clipboard.writeText(`${text}\n\nTo: ${phone}`);
      toast.success(`Copied a message for ${firstName(name)}. Send it from your phone to that number only.`);
    } catch {
      toast.error("Could not copy the message.");
    }
  }

  return (
    <GlassCard className="p-6">
      <div className="mb-6 flex flex-col gap-2 border-b border-border/50 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
            <Smartphone className="h-5 w-5 text-emerald-400" />
            Phone follow-up
          </h2>
          <p className="text-sm text-muted-foreground">
            One player at a time. Email campaigns stay on the Newsletters page. This list is only
            people who turned on SMS or WhatsApp offers.
          </p>
        </div>
        <Badge variant="outline" className="shrink-0">
          No bulk SMS
        </Badge>
      </div>

      {!canView ? (
        <p className="text-sm text-muted-foreground">
          Phone numbers are limited to staff with user management access.
        </p>
      ) : outreach?.setupError ? (
        <p className="text-sm text-muted-foreground">{outreach.setupError}</p>
      ) : (
        <div className="space-y-5">
          <p className="text-sm text-muted-foreground">
            SMS marketing on: {outreach?.smsCount ?? 0}. WhatsApp marketing on:{" "}
            {outreach?.whatsappCount ?? 0}.
            {outreach?.hiddenSuspended
              ? ` ${outreach.hiddenSuspended} suspended account${outreach.hiddenSuspended === 1 ? "" : "s"} with consent hidden.`
              : ""}
          </p>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Message
            </p>
            <div className="flex flex-wrap gap-2">
              {TEMPLATES.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTemplateId(item.id)}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-medium ${
                    templateId === item.id
                      ? "border-emerald-400 bg-emerald-500 text-black"
                      : "border-border/60 bg-background/80 text-foreground"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <p className="mt-3 rounded-lg border border-border/60 bg-background/60 p-3 text-sm text-muted-foreground">
              {preview}
            </p>
          </div>

          {players.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nobody has turned on SMS or WhatsApp offers yet. Players opt in from Notification
              settings. Deposit confirmations, load-ready notes, and security messages stay in the
              product — they are not sent from this page.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="py-2 pr-3 font-medium">Player</th>
                    <th className="py-2 pr-3 font-medium">SMS</th>
                    <th className="py-2 pr-3 font-medium">WhatsApp</th>
                    <th className="py-2 text-right font-medium">One person</th>
                  </tr>
                </thead>
                <tbody>
                  {players.map((player) => {
                    const text = fillTemplate(template.body, player.name);
                    const wa = player.whatsappOn && player.whatsapp ? whatsAppHref(player.whatsapp, text) : null;
                    return (
                      <tr key={player.id} className="border-t border-border/50">
                        <td className="py-3 pr-3">
                          <p className="font-medium">{player.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {player.phone ?? player.whatsapp ?? "No number on file"}
                          </p>
                        </td>
                        <td className="py-3 pr-3 text-xs">
                          {player.sms ? "On" : "Off"}
                        </td>
                        <td className="py-3 pr-3 text-xs">
                          {player.whatsappOn ? "On" : "Off"}
                        </td>
                        <td className="py-3 text-right">
                          <div className="flex flex-wrap justify-end gap-1">
                            {player.sms && player.phone ? (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => void copySms(player.name, player.phone!)}
                              >
                                Copy SMS
                              </Button>
                            ) : null}
                            {wa ? (
                              <Button type="button" size="sm" variant="outline" asChild>
                                <a href={wa} target="_blank" rel="noreferrer">
                                  <MessageCircle className="size-4" />
                                  WhatsApp
                                </a>
                              </Button>
                            ) : null}
                            {!player.phone && !(player.whatsappOn && player.whatsapp) ? (
                              <span className="text-xs text-muted-foreground">No number</span>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </GlassCard>
  );
}
