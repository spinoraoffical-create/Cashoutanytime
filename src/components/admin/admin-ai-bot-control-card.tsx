"use client";

import { useCallback, useEffect, useState } from "react";
import { GlassCard } from "@/components/shared/glass-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Bot, Power, Send, Sliders } from "lucide-react";
import {
  fetchChatbotSettingsAction,
  updateChatbotSettingsAction,
} from "@/lib/actions/admin/ai-settings-actions";
import type { ChatbotAiSettings } from "@/lib/ai/settings";

const FAQ_PRESETS: Array<{ q: string; append: string }> = [
  {
    q: "Cashout speed",
    append: " Cashouts are processed within 5-15 minutes via Cash App, Zelle, or USDT.",
  },
  {
    q: "Payment methods",
    append: " We accept Cash App, Zelle, USDT, BTC, PayPal, and Venmo.",
  },
  {
    q: "Juwa login",
    append: " Request your Juwa 777 login from Dashboard → Game Requests.",
  },
];

export function AdminAiBotControlCard() {
  const [settings, setSettings] = useState<ChatbotAiSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const res = await fetchChatbotSettingsAction();
    if (res.ok) setSettings(res.chatbot);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function patch(partial: Partial<ChatbotAiSettings>) {
    if (!settings) return;
    setSaving(true);
    const next = { ...settings, ...partial };
    setSettings(next);
    const res = await updateChatbotSettingsAction(partial);
    setSaving(false);
    if (res.ok) toast.success("Chatbot settings saved.");
    else {
      toast.error(res.error || "Could not save settings.");
      void load();
    }
  }

  if (loading || !settings) {
    return (
      <GlassCard className="p-6">
        <p className="text-sm text-muted-foreground">Loading chatbot settings...</p>
      </GlassCard>
    );
  }

  return (
    <GlassCard className="p-6 border-amber-500/40 bg-gradient-to-r from-amber-950/30 via-zinc-900 to-black space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-border/50 pb-4 gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
            <Bot className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-foreground">AI Bot Master Control</h2>
              <Badge
                className={
                  settings.is_enabled
                    ? "bg-emerald-500/20 text-emerald-400 font-mono text-[10px]"
                    : "bg-rose-500/20 text-rose-400 font-mono text-[10px]"
                }
              >
                {settings.is_enabled ? "ONLINE" : "PAUSED"}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">Settings saved to database — live immediately.</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={() => void patch({ is_enabled: !settings.is_enabled })}
            disabled={saving}
            variant="outline"
            className="gap-2"
          >
            <Power className="h-4 w-4" />
            {settings.is_enabled ? "Pause Bot" : "Turn ON Bot"}
          </Button>
          <Button
            onClick={() => void patch({ telegram_escalation_enabled: !settings.telegram_escalation_enabled })}
            disabled={saving}
            variant="outline"
            className="gap-2"
          >
            <Send className="h-4 w-4" />
            {settings.telegram_escalation_enabled ? "Telegram ON" : "Telegram OFF"}
          </Button>
        </div>
      </div>

      <div>
        <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Sliders className="h-4 w-4 text-amber-400" /> Bot personality
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {(["standard", "vip", "energetic"] as const).map((p) => (
            <Button
              key={p}
              type="button"
              variant="outline"
              disabled={saving}
              onClick={() => void patch({ personality: p })}
              className={
                settings.personality === p
                  ? "border-amber-500 bg-amber-500/20 text-amber-300"
                  : "border-border/60"
              }
            >
              {p === "standard" ? "Friendly Host" : p === "vip" ? "VIP Concierge" : "High Energy"}
            </Button>
          ))}
        </div>
      </div>

      <div className="pt-2 border-t border-border/50">
        <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 block">
          Quick FAQ injectors (appends to system prompt)
        </label>
        <div className="flex flex-wrap gap-2">
          {FAQ_PRESETS.map((preset) => (
            <Button
              key={preset.q}
              size="sm"
              variant="outline"
              disabled={saving}
              onClick={() =>
                void patch({
                  system_prompt: settings.system_prompt.includes(preset.append.trim())
                    ? settings.system_prompt
                    : `${settings.system_prompt}${preset.append}`,
                })
              }
              className="text-xs"
            >
              + {preset.q}
            </Button>
          ))}
        </div>
      </div>
    </GlassCard>
  );
}
