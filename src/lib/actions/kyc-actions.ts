"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

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

  if (!docDataUrl && !file) {
    return { ok: false, error: "Please upload a photo of your ID." };
  }

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

  const payload = {
    user_id: user.id,
    user_email: userEmail,
    user_name: userName,
    document_name: docName,
    document_url: docDataUrl,
    status: "pending" as const,
    updated_at: new Date().toISOString(),
  };

  const { error: upsertError } = await admin
    .from("kyc_submissions")
    .upsert(payload, { onConflict: "user_id" });

  if (upsertError) {
    if (/kyc_submissions|schema cache|does not exist/i.test(upsertError.message)) {
      return {
        ok: false,
        error:
          "KYC database not set up. Admin: run supabase/migrations/20260720000300_kyc_and_ai_system.sql in Supabase SQL Editor.",
      };
    }
    return { ok: false, error: upsertError.message };
  }

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
  }

  revalidatePath("/dashboard/kyc");
  revalidatePath("/admin/kyc");

  return { ok: true };
}

/** Check whether KYC tables exist in Supabase */
export async function getKYCSystemStatus(): Promise<{ ready: boolean; error?: string }> {
  const admin = createAdminClient();
  if (!admin) {
    return { ready: false, error: "SUPABASE_SERVICE_ROLE_KEY is missing on the server." };
  }

  const { error } = await admin.from("kyc_submissions").select("id").limit(1);
  if (error) {
    if (/kyc_submissions|schema cache|does not exist/i.test(error.message)) {
      return {
        ready: false,
        error:
          "Run supabase/migrations/20260720000300_kyc_and_ai_system.sql in the Supabase SQL Editor.",
      };
    }
    return { ready: false, error: error.message };
  }
  return { ready: true };
}

export async function getAdminKYCSubmissions(): Promise<KYCSubmissionRecord[]> {
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

  return (data ?? []).map((row) => mapRow(row as Record<string, unknown>));
}

/** Approve or Reject KYC (Admin) — submissionIdOrUserId can be row id or user_id */
export async function updateKYCStatus(
  submissionIdOrUserId: string,
  newStatus: "approved" | "rejected"
): Promise<{ ok: boolean; error?: string }> {
  const admin = createAdminClient();
  if (!admin) return { ok: false, error: "Server configuration error." };

  let submission = (
    await admin.from("kyc_submissions").select("*").eq("id", submissionIdOrUserId).maybeSingle()
  ).data;

  if (!submission) {
    submission = (
      await admin.from("kyc_submissions").select("*").eq("user_id", submissionIdOrUserId).maybeSingle()
    ).data;
  }

  if (!submission) {
    return { ok: false, error: "KYC submission not found." };
  }

  const dbStatus = newStatus === "approved" ? "verified" : "rejected";

  const { error: subError } = await admin
    .from("kyc_submissions")
    .update({ status: newStatus, updated_at: new Date().toISOString() })
    .eq("id", submission.id);

  if (subError) {
    return { ok: false, error: subError.message };
  }

  const { error: profileError } = await admin
    .from("profiles")
    .update({
      kyc_status: dbStatus,
      updated_at: new Date().toISOString(),
    })
    .eq("id", submission.user_id);

  if (profileError) {
    return { ok: false, error: profileError.message };
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
