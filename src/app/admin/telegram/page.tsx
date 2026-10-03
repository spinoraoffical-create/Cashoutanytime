import type { Metadata } from "next";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { TelegramBroadcastCard } from "@/components/admin/telegram-broadcast-card";
import { AdminAutopilotCard } from "@/components/admin/admin-autopilot-card";
import { AdminImageGeneratorCard } from "@/components/admin/admin-image-generator-card";
import { GlassCard } from "@/components/shared/glass-card";
import { Badge } from "@/components/ui/badge";
import { requirePermission } from "@/lib/data/admin";
import { isTelegramConfigured } from "@/lib/telegram/client";
import { SITE_URL } from "@/lib/constants";

export const metadata: Metadata = { title: "Telegram Bot & 100% Hands-Free Autopilot" };

import { AdminTelegramTester } from "@/components/admin/admin-telegram-tester";

export default async function AdminTelegramPage() {
  await requirePermission("cms.manage");

  const isConfigured = isTelegramConfigured();
  const botTokenPresent = Boolean(process.env.TELEGRAM_BOT_TOKEN);
  const adminChatIdPresent = Boolean(process.env.TELEGRAM_ADMIN_CHAT_ID);
  const promoChatIdPresent = Boolean(process.env.TELEGRAM_PROMO_CHAT_ID);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <AdminPageHeader
        title="Telegram Bot & 100% Hands-Free Autopilot"
        description="Zero work required! The AI Autopilot automatically rotates poster photos and posts daily date offers every day."
      />

      {/* 🟢 100% Hands-Free Autopilot Master Control Card */}
      <AdminAutopilotCard />

      {/* 1-Click Telegram Bot Connection Tester */}
      <AdminTelegramTester />

      {/* 1-Click Interactive Broadcast Panel with Templates */}
      <TelegramBroadcastCard siteUrl={SITE_URL} promoChatIdPresent={promoChatIdPresent} />

      {/* In-Browser AI Image Poster Creator */}
      <AdminImageGeneratorCard />

      {/* Integration Status Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <GlassCard className="p-5">
          <p className="hud-label text-xs text-muted-foreground">Bot Status</p>
          <div className="mt-2 flex items-baseline justify-between">
            <span className={`text-2xl font-bold ${isConfigured ? "text-emerald-400" : "text-amber-400"}`}>
              {isConfigured ? "Connected" : "Action Required"}
            </span>
            <Badge className={isConfigured ? "bg-emerald-500/15 text-emerald-400" : "bg-amber-500/15 text-amber-400"}>
              {isConfigured ? "Active" : "Incomplete"}
            </Badge>
          </div>
        </GlassCard>

        <GlassCard className="p-5">
          <p className="hud-label text-xs text-muted-foreground">Bot Token</p>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-md font-mono text-foreground">
              {botTokenPresent ? "••••••••••••" : "Not Set"}
            </span>
            <Badge variant="outline">{botTokenPresent ? "Configured" : "Missing"}</Badge>
          </div>
        </GlassCard>

        <GlassCard className="p-5">
          <p className="hud-label text-xs text-muted-foreground">Admin Chat ID</p>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-md font-mono text-foreground">
              {adminChatIdPresent ? process.env.TELEGRAM_ADMIN_CHAT_ID : "Not Set"}
            </span>
            <Badge variant="outline">{adminChatIdPresent ? "Ready" : "Missing"}</Badge>
          </div>
        </GlassCard>
      </div>

      {/* Setup Instructions */}
      <GlassCard className="p-6">
        <h3 className="text-md font-bold text-foreground mb-3">Telegram Setup & Webhook Guide</h3>
        <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
          <li>Create a Telegram bot via <strong>@BotFather</strong> on Telegram and copy your API Token.</li>
          <li>Create a Telegram Group/Channel for your team or players, add the bot as an administrator.</li>
          <li>Get your Chat ID by forwarding a message to <strong>@userinfobot</strong> or <strong>@getidsbot</strong>.</li>
          <li>Set <code className="bg-background px-1.5 py-0.5 rounded text-foreground font-mono">TELEGRAM_BOT_TOKEN</code> and <code className="bg-background px-1.5 py-0.5 rounded text-foreground font-mono">TELEGRAM_ADMIN_CHAT_ID</code> in your <code className="bg-background px-1.5 py-0.5 rounded text-foreground font-mono">.env.local</code> or Vercel Environment Variables.</li>
        </ol>
      </GlassCard>
    </div>
  );
}
