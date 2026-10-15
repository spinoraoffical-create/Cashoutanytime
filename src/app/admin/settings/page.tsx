import type { Metadata } from "next";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { SettingsEditor } from "@/components/admin/settings-editor";
import { RewardsToggle } from "@/components/admin/rewards-toggle";
import { TelegramPromoMessagesSection } from "@/components/admin/telegram-promo-messages";
import { AdminSectionCard } from "@/components/admin/ui/admin-section-card";
import { LinkTelegramButton } from "@/components/shared/link-telegram-button";
import { adminDb } from "@/lib/actions/admin/core";
import { requirePermission } from "@/lib/data/admin";
import type { Json } from "@/lib/database.types";

export const metadata: Metadata = { title: "Settings" };

export default async function AdminSettingsPage() {
  await requirePermission("settings.manage");
  const db = adminDb();

  const { data } = await db.from("site_settings").select("key, value");
  const settings: Record<string, Json> = Object.fromEntries(
    (data ?? []).map((s) => [s.key, s.value])
  );

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <AdminPageHeader
        title="Settings"
        description="Site options that are already stored. A switch or Save button keeps the action it already had. Secret values are not shown on this page."
      />

      <RewardsToggle initialEnabled={settings.rewards_enabled !== false} />
      <AdminSectionCard
        title="Admin Telegram bot"
        description="Link your Telegram account to run the existing admin commands, such as /dashboard and /users, from chat."
        action={<LinkTelegramButton purpose="admin" />}
      >
        <p className="text-sm text-[#9fb0d0]">The link button uses the existing Telegram connection. It does not show a bot token.</p>
      </AdminSectionCard>
      <SettingsEditor initial={settings} />
      <TelegramPromoMessagesSection db={db} />
    </div>
  );
}
