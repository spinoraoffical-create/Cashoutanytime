"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/data/dashboard";
import { buildAuthCallbackUrl } from "@/lib/auth/callback-url";
import { INVALID_PHONE_MESSAGE, parseValidInternationalPhone } from "@/lib/auth/phone";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseServiceRoleKey, getSupabaseUrl } from "@/lib/supabase/env";

const MAX_PHOTO_BYTES = 2 * 1024 * 1024;

export type ProfileEditorState = {
  displayName: string;
  email: string;
  emailVerified: boolean;
  phone: string;
  avatarUrl: string | null;
  kycStatus: string;
};

export async function getProfileEditorState(): Promise<ProfileEditorState> {
  const { supabase, user } = await requireUser();
  const { data } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
  const row = (data ?? {}) as Record<string, unknown>;
  const email = user.email ?? String(row.email ?? "");
  const meta = user.user_metadata ?? {};
  const displayName =
    text(meta.full_name) ||
    text(meta.display_name) ||
    text(row.display_name) ||
    text(row.full_name) ||
    text(row.username) ||
    email.split("@")[0] ||
    "Player";

  return {
    displayName,
    email,
    emailVerified: Boolean(user.email_confirmed_at),
    phone: text(row.phone) || text(user.phone) || text(meta.phone),
    avatarUrl: text(meta.avatar_url) || text(row.avatar_url) || null,
    kycStatus: text(row.kyc_status) || "unverified",
  };
}

export async function savePlayerProfile(formData: FormData): Promise<{
  ok: boolean;
  error?: string;
  displayName?: string;
  avatarUrl?: string | null;
  phone?: string;
}> {
  const { user } = await requireUser();
  const displayName = String(formData.get("displayName") ?? "").trim().replace(/\s+/g, " ");
  const phoneRaw = String(formData.get("phone") ?? "").trim();
  const photo = formData.get("photo");

  if (displayName.length < 2 || displayName.length > 40) {
    return { ok: false, error: "Display name must be 2–40 characters." };
  }
  if (/[\u0000-\u001F]/.test(displayName)) {
    return { ok: false, error: "Display name has characters we can’t save." };
  }

  let phone: string | null = null;
  if (phoneRaw) {
    phone = parseValidInternationalPhone(phoneRaw);
    if (!phone) return { ok: false, error: INVALID_PHONE_MESSAGE };
    const taken = await phoneUsedBySomeoneElse(user.id, phone);
    if (taken) {
      return { ok: false, error: "This phone number is already on another account." };
    }
  }

  let avatarUrl: string | undefined;
  const submittedUrl = ownAvatarUrl(user.id, String(formData.get("avatarUrl") ?? ""));
  const inlinePhoto = smallJpegDataUrl(String(formData.get("avatarData") ?? ""));
  if (submittedUrl) {
    avatarUrl = submittedUrl;
  } else if (photo instanceof File && photo.size > 0) {
    const uploaded = await uploadAvatar(user.id, photo);
    if (uploaded.ok) avatarUrl = uploaded.url;
    else if (inlinePhoto) avatarUrl = inlinePhoto;
    else return { ok: false, error: uploaded.error };
  } else if (inlinePhoto) {
    avatarUrl = inlinePhoto;
  }

  const fields: Record<string, string | null> = {
    display_name: displayName,
    full_name: displayName,
    phone,
  };
  if (avatarUrl) fields.avatar_url = avatarUrl;

  await rememberProfileOnAuth(user.id, displayName, phone, avatarUrl);

  const saved = await writeProfile(user.id, fields);
  if (!saved.ok) {
    console.error("[profile] profile row was not updated; name and phone were saved on the account");
  }

  revalidatePath("/dashboard");
  revalidatePath("/");
  revalidatePath("/leaderboard");

  return {
    ok: true,
    displayName,
    avatarUrl: avatarUrl ?? null,
    phone: phone ?? "",
  };
}

export async function resendProfileVerification(origin: string): Promise<{ ok: boolean; error?: string }> {
  const { supabase, user } = await requireUser();
  if (!user.email) return { ok: false, error: "This account has no email to verify." };
  if (user.email_confirmed_at) return { ok: true };

  const { error } = await supabase.auth.resend({
    type: "signup",
    email: user.email,
    options: { emailRedirectTo: buildAuthCallbackUrl(origin, "/dashboard") },
  });

  if (error) {
    console.error("[profile] resend verification:", error.message);
    const lower = error.message.toLowerCase();
    if (lower.includes("rate") || lower.includes("once")) {
      return { ok: false, error: "Wait a minute, then try resending the email." };
    }
    return { ok: false, error: "Could not send the verification email. Try again in a moment." };
  }

  return { ok: true };
}

function missingColumn(message: string): string | null {
  const patterns = [
    /could not find the '([a-z_]+)' column/i,
    /'([a-z_]+)' column/i,
    /column "([a-z_]+)"/i,
    /column [\w.]+\.([a-z_]+) does not exist/i,
  ];
  for (const pattern of patterns) {
    const match = pattern.exec(message);
    if (match?.[1]) return match[1];
  }
  return null;
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

async function rememberProfileOnAuth(
  userId: string,
  displayName: string,
  phone: string | null,
  avatarUrl?: string
) {
  const admin = createAdminClient();
  if (!admin || !getSupabaseServiceRoleKey()) return;
  const { data: authUser } = await admin.auth.admin.getUserById(userId);
  const existing = authUser?.user?.user_metadata ?? {};
  await admin.auth.admin.updateUserById(userId, {
    ...(phone ? { phone } : {}),
    user_metadata: {
      ...existing,
      full_name: displayName,
      display_name: displayName,
      ...(phone ? { phone } : {}),
      ...(avatarUrl ? { avatar_url: avatarUrl } : {}),
    },
  });
}

function ownAvatarUrl(userId: string, value: string): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    const base = new URL(getSupabaseUrl());
    if (url.origin !== base.origin) return null;
    const prefix = `/storage/v1/object/public/avatars/${userId}/`;
    if (!url.pathname.startsWith(prefix)) return null;
    return url.toString();
  } catch {
    return null;
  }
}

async function phoneUsedBySomeoneElse(userId: string, phone: string): Promise<boolean> {
  const admin = createAdminClient();
  const supabase = admin ?? (await createClient());
  const { data, error } = await supabase
    .from("profiles")
    .select("id")
    .eq("phone", phone)
    .neq("id", userId)
    .limit(1);
  if (error) {
    console.error("[profile] phone lookup:", error.message);
    return false;
  }
  return Boolean(data?.length);
}

function smallJpegDataUrl(value: string): string | null {
  if (!value.startsWith("data:image/jpeg;base64,")) return null;
  if (value.length > 80_000) return null;
  return value;
}

async function ensureAvatarsBucket(admin: NonNullable<ReturnType<typeof createAdminClient>>) {
  const existing = await admin.storage.getBucket("avatars");
  const options = {
    public: true,
    fileSizeLimit: 5 * 1024 * 1024,
    allowedMimeTypes: ["image/jpeg", "image/png", "image/webp", "image/avif"],
  };
  if (!existing.data) {
    await admin.storage.createBucket("avatars", options);
    return;
  }
  await admin.storage.updateBucket("avatars", options);
}

function photoFile(file: File): { ext: string; contentType: string } | null {
  const type = file.type.toLowerCase();
  const name = file.name.toLowerCase();
  if (type === "image/png" || name.endsWith(".png")) return { ext: "png", contentType: "image/png" };
  if (type === "image/webp" || name.endsWith(".webp")) return { ext: "webp", contentType: "image/webp" };
  if (type === "image/avif" || name.endsWith(".avif")) return { ext: "avif", contentType: "image/avif" };
  if (
    type === "image/jpeg" ||
    type === "image/jpg" ||
    type === "image/pjpeg" ||
    name.endsWith(".jpg") ||
    name.endsWith(".jpeg") ||
    type === ""
  ) {
    return { ext: "jpg", contentType: "image/jpeg" };
  }
  return null;
}

async function uploadAvatar(
  userId: string,
  file: File
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const kind = photoFile(file);
  if (!kind) {
    return { ok: false, error: "Use a JPG or PNG photo." };
  }
  if (file.size > MAX_PHOTO_BYTES) {
    return { ok: false, error: "That photo is too large. Pick another one and we'll resize it." };
  }

  const path = `${userId}/avatar.jpg`;
  const bytes = new Uint8Array(await file.arrayBuffer());
  const blob = new Blob([bytes], { type: "image/jpeg" });
  const options = { upsert: true, contentType: "image/jpeg", cacheControl: "3600" };
  const supabase = await createClient();
  const admin = getSupabaseServiceRoleKey() ? createAdminClient() : null;
  if (admin) await ensureAvatarsBucket(admin);

  let uploaded = admin
    ? await admin.storage.from("avatars").upload(path, blob, options)
    : await supabase.storage.from("avatars").upload(path, blob, options);

  if (uploaded.error && /exist|duplicate/i.test(uploaded.error.message) && admin) {
    await admin.storage.from("avatars").remove([path]);
    uploaded = await admin.storage.from("avatars").upload(path, blob, options);
  }
  if (uploaded.error && admin) {
    uploaded = await supabase.storage.from("avatars").upload(path, blob, options);
  }

  if (uploaded.error) {
    console.error("[profile] avatar upload:", uploaded.error.message);
    const message = uploaded.error.message.toLowerCase();
    if (message.includes("size") || message.includes("exceed")) {
      return { ok: false, error: "That photo is too large. Pick another one and we'll resize it." };
    }
    if (message.includes("mime") || message.includes("type")) {
      return { ok: false, error: "Use a JPG or PNG photo." };
    }
    return { ok: false, error: "Could not save that photo. Try again." };
  }

  const { data } = supabase.storage.from("avatars").getPublicUrl(path);
  const base = data.publicUrl || `${getSupabaseUrl()}/storage/v1/object/public/avatars/${path}`;
  return { ok: true, url: `${base}?v=${Date.now()}` };
}

async function writeProfile(
  userId: string,
  fields: Record<string, string | null>
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await createClient();
  const admin = createAdminClient();
  const clients = admin ? [session, admin] : [session];
  let payload: Record<string, string | null> = { ...fields };

  for (const client of clients) {
    const working: Record<string, string | null> = { ...payload };
    for (let attempt = 0; attempt < 6; attempt++) {
      if (Object.keys(working).length === 0) break;
      const { data, error } = await client
        .from("profiles")
        .update(working)
        .eq("id", userId)
        .select("id")
        .maybeSingle();
      if (!error && data?.id) return { ok: true };
      if (!error && !data) {
        console.error("[profile] update matched no row");
        break;
      }
      if (!error) break;

      if (
        error.code === "23505" ||
        (/phone/i.test(error.message) && /unique|duplicate/i.test(error.message))
      ) {
        return { ok: false, error: "This phone number is already on another account." };
      }

      const missing = missingColumn(error.message);
      if (missing && missing in working) {
        delete working[missing];
        payload = { ...working };
        continue;
      }

      console.error("[profile] update:", error.message);
      break;
    }
  }

  return { ok: false, error: "Could not save your profile. Please try again." };
}
