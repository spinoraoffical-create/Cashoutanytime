import type { Metadata } from "next";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminNowpaymentsConfigCard } from "@/components/admin/admin-nowpayments-config-card";
import { SettingsEditor } from "@/components/admin/settings-editor";
import { RewardsToggle } from "@/components/admin/rewards-toggle";
import { TelegramPromoMessagesSection } from "@/components/admin/telegram-promo-messages";
import { GlassCard } from "@/components/shared/glass-card";
import { LinkTelegramButton } from "@/components/shared/link-telegram-button";
import { adminDb } from "@/lib/actions/admin/core";
import { requirePermission } from "@/lib/data/admin";
import type { Json } from "@/lib/database.types";

export const metadata: Metadata = { title: "Settings & Payments Config" };

export default async function AdminSettingsPage() {
  await requirePermission("settings.manage");
  const db = adminDb();

  const { data } = await db.from("site_settings").select("key, value");
  const settings: Record<string, Json> = Object.fromEntries(
    (data ?? []).map((s) => [s.key, s.value])
  );

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <AdminPageHeader
        title="Settings & NOWPayments Config"
        description="Platform-wide configuration and 1-click payment credentials management."
      />

      {/* 1-Click NOWPayments Config Card */}
      <AdminNowpaymentsConfigCard />

      <RewardsToggle initialEnabled={settings.rewards_enabled !== false} />
      <GlassCard className="flex items-center justify-between gap-4 p-6">
        <div>
          <h3 className="font-bold">Admin Telegram bot</h3>
          <p className="mt-1 max-w-md text-xs text-muted-foreground">
            Link your Telegram account to run admin commands like /dashboard and
            /users from chat.
          </p>
        </div>
        <LinkTelegramButton purpose="admin" />
      </GlassCard>
      <SettingsEditor initial={settings} />
      <TelegramPromoMessagesSection db={db} />
    </div>
  );
}
