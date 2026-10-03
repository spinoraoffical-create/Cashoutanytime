import { format } from "date-fns";

import { ConfirmActionButton } from "@/components/admin/confirm-action-button";
import {
  EntityEditDialog,
  type FieldValue,
} from "@/components/admin/entity-edit-dialog";
import { GlassCard } from "@/components/shared/glass-card";
import { Badge } from "@/components/ui/badge";
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
    <GlassCard className="mb-6 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-bold">Telegram promo messages</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Pool the hourly cron rotates through — the longest-unsent active message posts first.
          </p>
        </div>
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
      </div>
      <div className="mt-4 divide-y divide-foreground/8 rounded-lg border border-border">
        {messages.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">
            No promo messages yet — add at least one.
          </p>
        ) : (
          messages.map((m) => (
            <div key={m.id} className="flex items-start justify-between gap-4 p-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="line-clamp-1 font-medium">{m.text}</p>
                  <Badge
                    className={
                      m.is_active
                        ? "bg-ws-emerald/15 text-ws-emerald"
                        : "bg-foreground/8 text-muted-foreground"
                    }
                  >
                    {m.is_active ? "Active" : "Off"}
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-ws-text-faint">
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
    </GlassCard>
  );
}
