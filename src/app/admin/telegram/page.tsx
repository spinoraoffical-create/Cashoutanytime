import type { Metadata } from "next";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { TelegramBroadcastCard } from "@/components/admin/telegram-broadcast-card";
import { AdminAutopilotCard } from "@/components/admin/admin-autopilot-card";
import { AdminImageGeneratorCard } from "@/components/admin/admin-image-generator-card";
import { AdminTelegramTester } from "@/components/admin/admin-telegram-tester";
import { AdminSectionCard } from "@/components/admin/ui/admin-section-card";
import { AdminStatusBadge } from "@/components/admin/ui/admin-status-badge";
import { requirePermission } from "@/lib/data/admin";
import { isTelegramConfigured } from "@/lib/telegram/client";
import { SITE_URL } from "@/lib/constants";

export const metadata: Metadata = { title: "Telegram channel" };

export default async function AdminTelegramPage() {
  await requirePermission("cms.manage");

  const isConfigured = isTelegramConfigured();
  const botTokenPresent = Boolean(process.env.TELEGRAM_BOT_TOKEN);
  const adminChatIdPresent = Boolean(process.env.TELEGRAM_ADMIN_CHAT_ID);
  const promoChatIdPresent = Boolean(process.env.TELEGRAM_PROMO_CHAT_ID);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <AdminPageHeader
        title="Telegram channel"
        description="This page posts to the Telegram channel when you use the existing buttons. Opening it does not send a message. Player email and SMS are separate tools."
      />

      <AdminAutopilotCard />
      <AdminTelegramTester />
      <TelegramBroadcastCard siteUrl={SITE_URL} promoChatIdPresent={promoChatIdPresent} />
      <AdminImageGeneratorCard />

      <div className="grid gap-4 sm:grid-cols-3">
        <AdminSectionCard title="Bot status" description="Present means the token and admin chat are both set. This check does not call Telegram.">
          <AdminStatusBadge status={isConfigured ? "Connected" : "Incomplete"} />
        </AdminSectionCard>
        <AdminSectionCard title="Bot token" description="The token value stays hidden.">
          <AdminStatusBadge status={botTokenPresent ? "Present" : "Missing"} />
        </AdminSectionCard>
        <AdminSectionCard title="Admin chat" description="The chat id stays hidden. Present means a chat id is set.">
          <AdminStatusBadge status={adminChatIdPresent ? "Present" : "Missing"} />
        </AdminSectionCard>
      </div>

      <AdminSectionCard title="What these controls do" description="The tester, broadcast, and autopilot buttons are the existing send controls. They can post when clicked.">
        <ol className="list-inside list-decimal space-y-2 text-sm text-[#9fb0d0]">
          <li>A bot token and an admin chat must already be set in the server environment.</li>
          <li>The promo chat uses its own setting when one is saved. This page only shows whether that setting is present inside the broadcast card.</li>
          <li>Setup values are changed in the host environment, not typed into this page.</li>
        </ol>
      </AdminSectionCard>
    </div>
  );
}
