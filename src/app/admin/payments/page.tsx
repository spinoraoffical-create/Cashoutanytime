import type { Metadata } from "next";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import {
  EntityEditDialog,
  type FieldValue,
} from "@/components/admin/entity-edit-dialog";
import { ConfirmActionButton } from "@/components/admin/confirm-action-button";
import { GlassCard } from "@/components/shared/glass-card";
import { adminDb } from "@/lib/actions/admin/core";
import {
  deletePaymentMethodAction,
  upsertPaymentMethodAction,
} from "@/lib/actions/admin/payments";
import { requirePermission } from "@/lib/data/admin";
import type { PaymentMethod } from "@/lib/database.types";

export const metadata: Metadata = { title: "Payment Methods" };

const KIND_OPTIONS = [
  { value: "handle", label: "Handle (CashApp / PayPal / Venmo / Chime)" },
  { value: "crypto", label: "Crypto address (BTC / USDT)" },
  { value: "link", label: "Link only" },
];

function fieldsFor(m?: PaymentMethod) {
  return [
    { name: "key", label: "Key (unique id, e.g. cashapp)", type: "text" as const, defaultValue: m?.key ?? "", hint: "Lowercase, hyphens. Used internally; don't reuse." },
    { name: "label", label: "Label (shown on the tab)", type: "text" as const, defaultValue: m?.label ?? "" },
    { name: "kind", label: "Type", type: "select" as const, defaultValue: m?.kind ?? "handle", options: KIND_OPTIONS },
    { name: "handle_label", label: "Handle label (e.g. Cashtag, USDT address (ERC-20))", type: "text" as const, defaultValue: m?.handle_label ?? "" },
    { name: "handle", label: "Handle / address / email", type: "text" as const, defaultValue: m?.handle ?? "" },
    { name: "pay_link", label: "Pay link (optional)", type: "text" as const, defaultValue: m?.pay_link ?? "", hint: "e.g. https://cash.app/$tag — shows a 'Pay with link' button" },
    { name: "qr_image_url", label: "QR image URL (optional)", type: "text" as const, defaultValue: m?.qr_image_url ?? "", hint: "Upload the QR to Storage → cms-media, paste the public URL" },
    { name: "instructions", label: "Instructions (optional)", type: "textarea" as const, defaultValue: m?.instructions ?? "" },
    { name: "sort_order", label: "Sort order", type: "number" as const, defaultValue: m?.sort_order ?? 0, min: 0 },
    { name: "is_active", label: "Active (shown to players)", type: "switch" as const, defaultValue: m?.is_active ?? true },
  ];
}

export default async function AdminPaymentsPage() {
  await requirePermission("cms.manage");
  const db = adminDb();
  const { data } = await db
    .from("payment_methods")
    .select("*")
    .order("sort_order");
  const methods = (data ?? []) as PaymentMethod[];

  return (
    <div className="mx-auto max-w-3xl">
      <AdminPageHeader
        title="Payment Methods"
        description="Manage deposit options on the wallet page — handle/address, pay link and QR per method. Changes go live immediately."
      />

      <div className="mb-6">
        <EntityEditDialog
          title="Add payment method"
          triggerLabel="Add payment method"
          fields={fieldsFor()}
          action={async (v: Record<string, FieldValue>) => {
            "use server";
            return upsertPaymentMethodAction({
              key: String(v.key),
              label: String(v.label),
              kind: String(v.kind) as "handle" | "crypto" | "link",
              handle: String(v.handle),
              handle_label: String(v.handle_label),
              pay_link: String(v.pay_link),
              qr_image_url: String(v.qr_image_url),
              instructions: String(v.instructions),
              sort_order: Number(v.sort_order),
              is_active: Boolean(v.is_active),
            });
          }}
        />
      </div>

      <div className="space-y-3">
        {methods.length === 0 && (
          <p className="text-sm text-muted-foreground">No payment methods yet — add one above.</p>
        )}
        {methods.map((m) => (
          <GlassCard key={m.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div className="min-w-0">
              <p className="flex items-center gap-2 font-semibold">
                {m.label}
                {!m.is_active && (
                  <span className="rounded-full bg-foreground/10 px-2 py-0.5 text-[10px] uppercase text-muted-foreground">
                    Hidden
                  </span>
                )}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {m.handle_label ? `${m.handle_label}: ` : ""}
                {m.handle ?? "—"}
                {m.pay_link ? " · link ✓" : ""}
                {m.qr_image_url ? " · QR ✓" : ""}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <EntityEditDialog
                title={`Edit — ${m.label}`}
                triggerLabel="Edit"
                fields={fieldsFor(m)}
                action={async (v: Record<string, FieldValue>) => {
                  "use server";
                  return upsertPaymentMethodAction({
                    id: m.id,
                    key: String(v.key),
                    label: String(v.label),
                    kind: String(v.kind) as "handle" | "crypto" | "link",
                    handle: String(v.handle),
                    handle_label: String(v.handle_label),
                    pay_link: String(v.pay_link),
                    qr_image_url: String(v.qr_image_url),
                    instructions: String(v.instructions),
                    sort_order: Number(v.sort_order),
                    is_active: Boolean(v.is_active),
                  });
                }}
              />
              <ConfirmActionButton
                title={`Delete ${m.label}?`}
                description="This removes the payment method from the deposit page. This cannot be undone."
                confirmLabel="Delete"
                triggerLabel="Delete"
                action={async () => {
                  "use server";
                  return deletePaymentMethodAction(m.id);
                }}
              />
            </div>
          </GlassCard>
        ))}
      </div>
    </div>
  );
}
