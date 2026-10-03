import type { Metadata } from "next";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import {
  EntityEditDialog,
  type FieldValue,
} from "@/components/admin/entity-edit-dialog";
import { ViewProofButton } from "@/components/admin/view-proof-button";
import { GlassCard } from "@/components/shared/glass-card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { adminDb, authorize, writeAudit } from "@/lib/actions/admin/core";
import { requirePermission } from "@/lib/data/admin";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata: Metadata = { title: "Deposit Requests" };

const STATUS_COLORS: Record<string, string> = {
  pending:   "bg-ws-green/15 text-ws-green-deep dark:text-ws-green",
  contacted: "bg-blue-500/15 text-blue-400",
  fulfilled: "bg-ws-emerald/15 text-ws-emerald",
  rejected:  "bg-red-500/15 text-red-400",
};

const CONTACT_LABEL: Record<string, string> = {
  whatsapp:  "WhatsApp",
  telegram:  "Telegram",
  messenger: "Messenger",
  phone:     "Phone",
};

const PAYMENT_LABEL: Record<string, string> = {
  cashapp: "CashApp",
  zelle:   "Zelle",
  crypto:  "Crypto",
  other:   "Other",
  chime:   "Chime",
  paypal:  "PayPal",
  venmo:   "Venmo",
  bitcoin: "Bitcoin",
  usdt:    "USDT",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

async function getSignedUrl(path: string): Promise<{ url: string } | { error: string }> {
  "use server";
  const auth = await authorize("requests.manage");
  if ("error" in auth) return { error: auth.error };

  const admin = createAdminClient();
  if (!admin) return { error: "Admin storage is not configured." };
  const { data, error } = await admin.storage
    .from("payment-proofs")
    .createSignedUrl(path, 300); // 5-minute URL

  if (error || !data?.signedUrl) return { error: "Could not generate image URL." };
  return { url: data.signedUrl };
}

async function updateRequestStatus(
  id: string,
  before: {
    status: string;
    handled_by: string | null;
    user_id: string | null;
    deposit_amount: number;
    reference_code: string;
  },
  values: Record<string, FieldValue>
): Promise<{ ok: true } | { ok: false; error: string }> {
  "use server";
  const auth = await authorize("requests.manage");
  if ("error" in auth) return { ok: false, error: auth.error };

  const status = String(values.status) as "pending" | "contacted" | "fulfilled" | "rejected";
  const notes  = values.notes ? String(values.notes) : null;

  const db = adminDb();

  const { error } = await db
    .from("requests")
    .update({
      status,
      handled_by:  auth.staff.userId,
      resolved_at: ["fulfilled", "rejected"].includes(status) ? new Date().toISOString() : null,
      notes:       notes ?? undefined,
    })
    .eq("id", id);

  if (error) return { ok: false, error: error.message };

  // Approving a deposit credits the player's WALLET (real money on the site).
  // They then spend wallet balance to load games themselves. Idempotent against
  // the ledger (not just status): credit only if no 'deposit' ledger row exists
  // for this request yet — so a re-save safely credits a deposit that was marked
  // fulfilled but never credited, and never double-credits.
  let credited = false;
  if (status === "fulfilled" && before.user_id) {
    const { data: alreadyCredited } = await db
      .from("wallet_ledger")
      .select("id")
      .eq("ref_id", id)
      .eq("kind", "deposit")
      .maybeSingle();

    if (!alreadyCredited) {
      const { error: cwErr } = await db.rpc("credit_wallet", {
        p_user:   before.user_id,
        p_amount: before.deposit_amount,
        p_kind:   "deposit",
        p_desc:   `Deposit ${before.reference_code}`,
        p_ref:    id,
      });
      if (cwErr) {
        console.error("[wallet] credit_wallet failed:", cwErr);
        return { ok: false, error: "Status saved, but crediting the wallet failed. Check logs." };
      }
      credited = true;
      await db.from("notifications").insert({
        user_id: before.user_id,
        type:    "system",
        icon:    "wallet",
        title:   "Funds added to your wallet",
        body:    `$${before.deposit_amount.toLocaleString()} was added to your wallet. Use it to create or load any game from your dashboard.`,
      });
    }
  }

  await writeAudit({
    actorId:    auth.staff.userId,
    action:     "requests.update_status",
    entityType: "requests",
    entityId:   id,
    before,
    after: { status, handled_by: auth.staff.userId, wallet_credited: credited },
  });

  return { ok: true };
}

export default async function AdminRequestsPage() {
  await requirePermission("requests.manage");
  const db = adminDb();

  const { data } = await db
    .from("requests")
    .select(`
      id, reference_code, name, contact_method, contact_value,
      game_id, request_type, existing_username,
      deposit_amount, payment_method, payment_proof_path,
      notes, status, handled_by, user_id,
      game_username, credits_added, created_at, resolved_at,
      games ( name, slug )
    `)
    .order("created_at", { ascending: false })
    .limit(200);

  const rows = (data ?? []) as unknown as Array<{
    id: string;
    reference_code: string;
    name: string;
    contact_method: string;
    contact_value: string;
    game_id: string | null;
    request_type: string;
    existing_username: string | null;
    deposit_amount: number;
    payment_method: string;
    payment_proof_path: string;
    notes: string | null;
    status: string;
    handled_by: string | null;
    user_id: string | null;
    game_username: string | null;
    credits_added: number | null;
    created_at: string;
    resolved_at: string | null;
    games: { name: string; slug: string } | null;
  }>;

  const pending   = rows.filter((r) => r.status === "pending").length;
  const contacted = rows.filter((r) => r.status === "contacted").length;

  return (
    <div className="mx-auto max-w-7xl">
      <AdminPageHeader
        title="Deposit Requests"
        description={`${rows.length} total · ${pending} pending · ${contacted} contacted`}
      />

      {rows.length === 0 ? (
        <GlassCard className="py-16 text-center text-muted-foreground">
          No requests yet. New requests appear here when players submit the Get Started form.
        </GlassCard>
      ) : (
        <GlassCard className="overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-foreground/8 hover:bg-transparent">
                  <TableHead>Ref</TableHead>
                  <TableHead>Player</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Game</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead className="text-right">Proof / Edit</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id} className="border-foreground/8">
                    <TableCell className="font-mono text-xs text-ws-green-deep dark:text-ws-green">
                      {r.reference_code}
                    </TableCell>
                    <TableCell>
                      <p className="font-medium">{r.name}</p>
                      {r.existing_username && (
                        <p className="text-xs text-muted-foreground">
                          @{r.existing_username}
                        </p>
                      )}
                    </TableCell>
                    <TableCell>
                      <p className="text-xs text-muted-foreground">
                        {CONTACT_LABEL[r.contact_method] ?? r.contact_method}
                      </p>
                      <p className="text-sm">{r.contact_value}</p>
                    </TableCell>
                    <TableCell className="text-sm">
                      {r.games?.name ?? "—"}
                    </TableCell>
                    <TableCell>
                      <Badge className="bg-foreground/8 text-muted-foreground text-xs">
                        {r.request_type === "new_account"
                          ? "New acct"
                          : r.request_type === "deposit"
                            ? "Deposit"
                            : "Reload"}
                      </Badge>
                    </TableCell>
                    <TableCell className="tnum text-right text-ws-green-deep dark:text-ws-green">
                      ${r.deposit_amount.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {PAYMENT_LABEL[r.payment_method] ?? r.payment_method}
                    </TableCell>
                    <TableCell>
                      <Badge className={STATUS_COLORS[r.status] ?? "bg-foreground/8"}>
                        {r.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatDate(r.created_at)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <ViewProofButton
                          path={r.payment_proof_path}
                          getUrl={getSignedUrl}
                        />
                        <EntityEditDialog
                          title={`Update ${r.reference_code}`}
                          fields={[
                            {
                              name: "status",
                              label: "Status",
                              type: "select",
                              defaultValue: r.status,
                              options: [
                                { value: "pending",   label: "Pending" },
                                { value: "contacted", label: "Contacted" },
                                { value: "fulfilled", label: `Fulfilled — credit $${r.deposit_amount.toLocaleString()} to wallet` },
                                { value: "rejected",  label: "Rejected" },
                              ],
                            },
                            {
                              name: "notes",
                              label: "Internal notes",
                              type: "textarea",
                              defaultValue: r.notes ?? "",
                            },
                          ]}
                          action={async (values: Record<string, FieldValue>) => {
                            "use server";
                            return updateRequestStatus(
                              r.id,
                              {
                                status:         r.status,
                                handled_by:     r.handled_by,
                                user_id:        r.user_id,
                                deposit_amount: r.deposit_amount,
                                reference_code: r.reference_code,
                              },
                              values
                            );
                          }}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </GlassCard>
      )}
    </div>
  );
}
