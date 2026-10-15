import { format } from "date-fns";

import { ConfirmActionButton } from "@/components/admin/confirm-action-button";
import {
  EntityEditDialog,
  type FieldValue,
} from "@/components/admin/entity-edit-dialog";
import { AdminEmptyState } from "@/components/admin/ui/admin-empty-state";
import { AdminSectionCard } from "@/components/admin/ui/admin-section-card";
import { AdminStatusBadge } from "@/components/admin/ui/admin-status-badge";
import { adminDb } from "@/lib/actions/admin/core";
import {
  deleteTelegramPromoMessageAction,
  upsertTelegramPromoMessageAction,
} from "@/lib/actions/admin/settings";

type DB = ReturnType<typeof adminDb>;

export async function TelegramPromoMessagesSection({ db }: { db: DB }) {
  const { data } = await db
    .from("telegram_promo_messages")
    .select("id, text, link, image_url, is_active, last_sent_at")
    .order("created_at", { ascending: false });
  const messages = data ?? [];

  const fields = (m?: (typeof messages)[number]) => [
    { name: "text", label: "Message text", type: "textarea" as const, defaultValue: m?.text ?? "" },
    { name: "link", label: "Link (optional)", type: "text" as const, defaultValue: m?.link ?? "" },
    { name: "image_url", label: "Image URL (optional)", type: "text" as const, defaultValue: m?.image_url ?? "" },
    { name: "is_active", label: "Active", type: "switch" as const, defaultValue: m?.is_active ?? true },
  ];

  return (
    <AdminSectionCard
      title="Telegram promo messages"
      description="The existing schedule rotates through this pool. The longest-unsent active message posts first. Add and edit use the existing form. Delete still asks you to confirm."
      action={
        <EntityEditDialog
          title="New promo message"
          triggerLabel="New message"
          fields={fields()}
          action={async (v: Record<string, FieldValue>) => {
            "use server";
            return upsertTelegramPromoMessageAction({
              text: String(v.text),
              link: String(v.link),
              image_url: String(v.image_url),
              is_active: Boolean(v.is_active),
            });
          }}
        />
      }
    >
      <div className="divide-y divide-white/10 rounded-xl border border-white/10">
        {messages.length === 0 ? (
          <AdminEmptyState title="No promo messages yet" body="Add at least one message before the existing schedule can post." />
        ) : (
          messages.map((m) => (
            <div key={m.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="line-clamp-2 font-medium text-white">{m.text}</p>
                  <AdminStatusBadge status={m.is_active ? "active" : "off"} />
                </div>
                <p className="mt-1 text-xs text-[#8ea0c3]">
                  {m.last_sent_at ? `Last sent ${format(new Date(m.last_sent_at), "MMM d, p")}` : "Never sent"}
                </p>
              </div>
              <div className="flex shrink-0 gap-1">
                <EntityEditDialog
                  title="Edit promo message"
                  fields={fields(m)}
                  action={async (v: Record<string, FieldValue>) => {
                    "use server";
                    return upsertTelegramPromoMessageAction({
                      id: m.id,
                      text: String(v.text),
                      link: String(v.link),
                      image_url: String(v.image_url),
                      is_active: Boolean(v.is_active),
                    });
                  }}
                />
                <ConfirmActionButton
                  action={deleteTelegramPromoMessageAction.bind(null, m.id)}
                  title="Delete promo message?"
                  description="This message will be removed from the rotation pool."
                  confirmLabel="Delete"
                />
              </div>
            </div>
          ))
        )}
      </div>
    </AdminSectionCard>
  );
}
