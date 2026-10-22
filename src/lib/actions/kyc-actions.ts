"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { authorize, writeAudit } from "@/lib/actions/admin/core";
import { identityDecisionLogCode, identityDecisionMessage } from "@/lib/kyc/decision";
import { checkKycDataUrl } from "@/lib/kyc/upload-rules";
import { logIncident } from "@/lib/observability/incident";
import { tryGrantLoyaltyCoins } from "@/lib/rewards/try-grant-loyalty";

export interface KYCSubmissionRecord {
  id: string;
  user_id: string;
  user_email: string;
  user_name: string;
  document_name: string;
  document_url: string;
  status: "pending" | "approved" | "rejected";
  created_at: string;
}

function mapRow(row: Record<string, unknown>): KYCSubmissionRecord {
  const status = String(row.status ?? "pending");
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    user_email: String(row.user_email ?? "player@spinora.local"),
    user_name: String(row.user_name ?? "Player"),
    document_name: String(row.document_name ?? "government_id.jpg"),
    document_url: String(row.document_url ?? ""),
    status:
      status === "verified" || status === "approved"
        ? "approved"
        : status === "rejected"
          ? "rejected"
          : "pending",
    created_at: String(row.created_at ?? new Date().toISOString()),
  };
}

/** Submit KYC Document (Player) — stored in Supabase kyc_submissions */
export async function submitKYCDocument(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "Please log in before submitting KYC." };
  }

  const file = formData.get("document") as File | null;
  const docDataUrl = (formData.get("document_data_url") as string) || "";
  const docName = file?.name || "government_id_photo.jpg";

  if (!docDataUrl) {
    return { ok: false, error: "Please upload a photo of your ID." };
  }
  const checked = checkKycDataUrl(docDataUrl);
  if (!checked.ok) return { ok: false, error: checked.error };

  const admin = createAdminClient();
  if (!admin) {
    return { ok: false, error: "Server configuration error. Contact support." };
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("full_name, email")
    .eq("id", user.id)
    .maybeSingle();

  const userEmail = profile?.email || user.email || "player@spinora.local";
  const userName = profile?.full_name || userEmail.split("@")[0] || "VIP Player";

  const ext =
    checked.mime === "application/pdf" ? "pdf" : checked.mime === "image/png" ? "png" : checked.mime === "image/webp" ? "webp" : "jpg";
  const storagePath = `${user.id}/${crypto.randomUUID()}.${ext}`;
  const bytes = Buffer.from(docDataUrl.split(",")[1]?.replace(/\s/g, "") ?? "", "base64");
  const uploaded = await admin.storage.from("kyc-documents").upload(storagePath, bytes, {
    contentType: checked.mime,
    upsert: false,
  });
  if (uploaded.error) {
    logIncident("kyc", uploaded.error.message);
    return { ok: false, error: "ID storage is not ready. A private document bucket has to be created before new IDs can be saved." };
  }

  const payload = {
    user_id: user.id,
    user_email: userEmail,
    user_name: userName,
    document_name: docName,
    document_url: storagePath,
    status: "pending" as const,
    updated_at: new Date().toISOString(),
  };

  const { error: upsertError } = await admin
    .from("kyc_submissions")
    .upsert(payload, { onConflict: "user_id" });

  if (upsertError) {
    logIncident("kyc", upsertError.message);
    return { ok: false, error: "Could not submit that ID. Try again or contact support." };
  }

  const submitted = await writeAudit({
    actorId: user.id,
    action: "kyc.submit",
    entityType: "kyc_submission",
    entityId: user.id,
    after: { document_name: docName, bytes: checked.bytes },
  });

  const { error: profileError } = await admin
    .from("profiles")
    .update({
      kyc_status: "pending",
      kyc_document_url: docName,
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  if (profileError && !/kyc_status|column/i.test(profileError.message)) {
    console.warn("[KYC] profile update:", profileError.message);
    return { ok: false, error: "The ID was saved, but the profile status could not be updated." };
  }
  if (!submitted) {
    return { ok: false, error: "The ID was saved, but it was not written to the audit log." };
  }

  revalidatePath("/dashboard/kyc");
  revalidatePath("/admin/kyc");

  return { ok: true };
}

/** Check whether KYC tables exist in Supabase */
export async function getKYCSystemStatus(): Promise<{ ready: boolean; error?: string }> {
  const gate = await authorize("kyc.manage");
  if ("error" in gate) return { ready: false, error: "You cannot review identity checks." };

  const admin = createAdminClient();
  if (!admin) {
    return { ready: false, error: "KYC review is not configured on the server." };
  }

  const { error } = await admin.from("kyc_submissions").select("id").limit(1);
  if (error) {
    if (/kyc_submissions|schema cache|does not exist/i.test(error.message)) {
      return {
        ready: false,
        error: "Identity checks are not ready on the server.",
      };
    }
    return { ready: false, error: "Identity checks could not be loaded." };
  }
  return { ready: true };
}

export async function getAdminKYCSubmissions(): Promise<KYCSubmissionRecord[]> {
  const gate = await authorize("kyc.manage");
  if ("error" in gate) {
    throw new Error(gate.error);
  }

  const admin = createAdminClient();
  if (!admin) return [];

  const { data, error } = await admin
    .from("kyc_submissions")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    if (/kyc_submissions|schema cache|does not exist/i.test(error.message)) {
      console.warn("[KYC Admin] Table missing — run kyc_and_ai_system migration");
      return [];
    }
    console.error("[KYC Admin Fetch]", error.message);
    return [];
  }

  const rows = (data ?? []).map((row) => mapRow(row as Record<string, unknown>));
  for (const row of rows) {
    if (row.status !== "pending") {
      row.document_url = "";
      continue;
    }
    if (!row.document_url) continue;
    if (row.document_url.startsWith("data:") || row.document_url.startsWith("http")) {
      row.document_url = "";
      continue;
    }
    const signed = await admin.storage.from("kyc-documents").createSignedUrl(row.document_url, 120);
    if (signed.data?.signedUrl) row.document_url = signed.data.signedUrl;
  }
  return rows;
}

/** Approve or Reject KYC (Admin) — submissionIdOrUserId can be row id or user_id */
export async function updateKYCStatus(
  submissionIdOrUserId: string,
  newStatus: "approved" | "rejected"
): Promise<{ ok: boolean; error?: string }> {
  const gate = await authorize("kyc.manage");
  if ("error" in gate) return { ok: false, error: gate.error };

  const admin = createAdminClient();
  if (!admin) return { ok: false, error: "Server configuration error." };

  let submission = (
    await admin.from("kyc_submissions").select("id, user_id").eq("id", submissionIdOrUserId).maybeSingle()
  ).data;

  if (!submission) {
    submission = (
      await admin.from("kyc_submissions").select("id, user_id").eq("user_id", submissionIdOrUserId).maybeSingle()
    ).data;
  }

  if (!submission) {
    return { ok: false, error: "KYC submission not found." };
  }

  const requestHeaders = await headers();
  const { error } = await admin.rpc("admin_decide_kyc", {
    p_submission_id: submission.id,
    p_status: newStatus,
    p_actor: gate.staff.userId,
    p_ip: requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ?? requestHeaders.get("x-real-ip") ?? null,
    p_user_agent: requestHeaders.get("user-agent") ?? null,
  });

  if (error) {
    console.error("[KYC decision]", identityDecisionLogCode(error));
    return { ok: false, error: identityDecisionMessage(error) };
  }

  if (newStatus === "approved") {
    const playerId = (submission as { user_id?: string }).user_id;
    if (playerId) await tryGrantLoyaltyCoins(playerId, "kyc_approved", `kyc:${playerId}`);
  }

  revalidatePath("/dashboard/kyc");
  revalidatePath("/admin/kyc");
  revalidatePath("/dashboard/withdraw");
  revalidatePath("/games", "layout");
  revalidatePath("/dashboard/wallet");

  return { ok: true };
}

/** Player dashboard — current KYC status from profile */
export async function getPlayerKYCStatus(): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return "unverified";

  const { data } = await supabase.from("profiles").select("kyc_status").eq("id", user.id).maybeSingle();
  const status = data?.kyc_status ?? "unverified";
  if (status === "verified") return "approved";
  return status;
}
