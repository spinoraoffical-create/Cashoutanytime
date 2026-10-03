"use server";

import { redirect } from "next/navigation";
import {
  INVALID_PHONE_MESSAGE,
  parseInternationalPhone,
  parseValidInternationalPhone,
  phoneLookupVariants,
} from "@/lib/auth/phone";
import { isEmailIdentifier, normalizeEmail, formatAuthErrorMessage } from "@/lib/auth/identifier";
import { buildAuthCallbackUrl } from "@/lib/auth/callback-url";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

async function findProfileByPhone(phone: string) {
  const admin = createAdminClient();
  if (!admin) return { profile: null, error: "missing_admin" as const };

  const variants = phoneLookupVariants(phone);
  if (!variants.length) return { profile: null, error: "invalid_phone" as const };

  const { data, error } = await admin
    .from("profiles")
    .select("id, email, phone")
    .in("phone", variants)
    .limit(1);

  if (error) {
    console.error("findProfileByPhone:", error.message);
    return { profile: null, error: "query_failed" as const };
  }

  return { profile: data?.[0] ?? null, error: null };
}

/** Resolve phone number to the account email (OTP is always sent to email) */
export async function resolveLoginEmail(
  identifier: string
): Promise<{ email: string | null; error?: string }> {
  const trimmed = identifier.trim();
  if (!trimmed) return { email: null, error: "Enter your email or phone number" };

  if (isEmailIdentifier(trimmed)) {
    return { email: normalizeEmail(trimmed) };
  }

  const phone = parseInternationalPhone(trimmed);
  if (!phone) {
    return {
      email: null,
      error: "Enter a valid email or phone with country code (e.g. +977 9862953426)",
    };
  }

  const { profile, error } = await findProfileByPhone(phone);

  if (error === "missing_admin") {
    return {
      email: null,
      error: "Phone login is temporarily unavailable. Sign in with your email instead.",
    };
  }

  if (error === "query_failed") {
    return {
      email: null,
      error: "Could not look up account. Try signing in with your email.",
    };
  }

  if (!profile?.email || profile.email.endsWith("@phone.spinora.local")) {
    return {
      email: null,
      error: "No account found for this phone. Register with your email and phone number.",
    };
  }

  return { email: normalizeEmail(profile.email) };
}

/** Check phone is not already linked to another account (register) */
export async function isPhoneAvailable(
  phone: string
): Promise<{ available: boolean; error?: string }> {
  const e164 = parseValidInternationalPhone(phone);
  if (!e164) return { available: false, error: INVALID_PHONE_MESSAGE };

  const { profile, error } = await findProfileByPhone(phone);

  // If lookup unavailable, allow signup — profile trigger will enforce uniqueness
  if (error === "missing_admin" || error === "query_failed") {
    return { available: true };
  }

  if (profile) {
    return {
      available: false,
      error: "This phone number is already registered. Go to Sign In and use your email or phone.",
    };
  }

  return { available: true };
}

/** Check email is not already registered (register) */
export async function isEmailAvailable(
  email: string
): Promise<{ available: boolean; error?: string }> {
  const normalized = normalizeEmail(email);
  if (!isEmailIdentifier(normalized)) {
    return { available: false, error: "Invalid email address" };
  }

  const admin = createAdminClient();
  if (!admin) return { available: true };

  const { data, error } = await admin
    .from("profiles")
    .select("id")
    .ilike("email", normalized)
    .limit(1);

  if (error) {
    console.error("isEmailAvailable:", error.message);
    return { available: true };
  }

  if (data?.length) {
    return {
      available: false,
      error: "This email is already registered. Go to Sign In and enter your email or phone.",
    };
  }

  return { available: true };
}

/** Wait for signup trigger to create the profiles row */
async function waitForProfileRow(
  admin: NonNullable<ReturnType<typeof createAdminClient>>,
  userId: string,
  attempts = 8
): Promise<boolean> {
  for (let i = 0; i < attempts; i++) {
    const { data } = await admin.from("profiles").select("id").eq("id", userId).maybeSingle();
    if (data) return true;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  return false;
}

async function waitForProfileRowSession(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  attempts = 8
): Promise<boolean> {
  for (let i = 0; i < attempts; i++) {
    const { data } = await supabase.from("profiles").select("id").eq("id", userId).maybeSingle();
    if (data) return true;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  return false;
}

async function persistContactOnProfile(
  userId: string,
  contact: { phone: string; fullName: string; email: string }
): Promise<{ ok: boolean; error?: string }> {
  const admin = createAdminClient();

  if (admin) {
    const adminResult = await persistContactViaAdmin(admin, userId, contact);
    if (adminResult.ok) return adminResult;
    console.error("persistContactOnProfile admin:", adminResult.error);
  }

  return persistContactViaSession(userId, contact);
}

async function persistContactViaAdmin(
  admin: NonNullable<ReturnType<typeof createAdminClient>>,
  userId: string,
  contact: { phone: string; fullName: string; email: string }
): Promise<{ ok: boolean; error?: string }> {
  const profileReady = await waitForProfileRow(admin, userId);
  if (!profileReady) {
    return { ok: false, error: "Profile was not ready yet" };
  }

  const { data: updated, error } = await admin
    .from("profiles")
    .update({
      phone: contact.phone,
      full_name: contact.fullName,
      email: contact.email,
    })
    .eq("id", userId)
    .select("id, phone")
    .maybeSingle();

  if (error) {
    if (error.message.includes("phone") && error.message.includes("column")) {
      return {
        ok: false,
        error: "Phone column missing in database. Run supabase/signup-email-phone.sql in Supabase.",
      };
    }
    return { ok: false, error: error.message };
  }

  if (!updated?.phone) {
    return { ok: false, error: "Profile update did not save phone" };
  }

  const { data: authUser } = await admin.auth.admin.getUserById(userId);
  const existingMeta = authUser?.user?.user_metadata ?? {};
  await admin.auth.admin.updateUserById(userId, {
    phone: contact.phone,
    user_metadata: {
      ...existingMeta,
      phone: contact.phone,
      full_name: contact.fullName,
      auth_method: "email",
    },
  });

  return { ok: true };
}

async function persistContactViaSession(
  userId: string,
  contact: { phone: string; fullName: string; email: string }
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || user.id !== userId) {
    return {
      ok: false,
      error: "Phone could not be saved — server configuration is incomplete. Contact support.",
    };
  }

  await supabase.auth.updateUser({
    data: {
      phone: contact.phone,
      full_name: contact.fullName,
      auth_method: "email",
    },
  });

  const profileReady = await waitForProfileRowSession(supabase, userId);
  if (!profileReady) {
    return { ok: false, error: "Account created but profile was not ready. Try adding phone from dashboard." };
  }

  const { data: updated, error } = await supabase
    .from("profiles")
    .update({
      phone: contact.phone,
      full_name: contact.fullName,
      email: contact.email,
    })
    .eq("id", userId)
    .select("id, phone")
    .maybeSingle();

  if (error) {
    if (error.message.includes("phone") && error.message.includes("column")) {
      return {
        ok: false,
        error: "Phone column missing in database. Run supabase/signup-email-phone.sql in Supabase.",
      };
    }
    return { ok: false, error: "Could not save phone number to profile" };
  }

  if (!updated?.phone) {
    return { ok: false, error: "Phone number was not saved to profile" };
  }

  return { ok: true };
}

export type RegisterWithEmailResult = { ok: true; email: string } | { ok: false; error: string };

export type SignInWithEmailResult =
  | { ok: true; loggedIn: true }
  | { ok: true; loggedIn: false; email: string; confirmationSent: true }
  | { ok: false; error: string };

function isEmailNotConfirmedError(message: string, code?: string): boolean {
  const lower = message.toLowerCase();
  return (
    code === "email_not_confirmed" ||
    lower.includes("email not confirmed") ||
    lower.includes("email not verified") ||
    lower.includes("not confirmed")
  );
}

/** Sign in with email + password; resends confirmation email if account is unverified */
export async function signInWithEmailPassword(input: {
  email: string;
  password: string;
  redirect?: string;
  callbackOrigin: string;
}): Promise<SignInWithEmailResult> {
  const normalizedEmail = normalizeEmail(input.email);
  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({
    email: normalizedEmail,
    password: input.password,
  });

  if (error) {
    const code = (error as { code?: string }).code;
    if (isEmailNotConfirmedError(error.message, code)) {
      const emailRedirectTo = buildAuthCallbackUrl(
        input.callbackOrigin,
        input.redirect ?? "/"
      );
      const { error: resendError } = await supabase.auth.resend({
        type: "signup",
        email: normalizedEmail,
        options: { emailRedirectTo },
      });

      if (resendError) {
        return { ok: false, error: formatAuthErrorMessage(resendError) };
      }

      // Do not signOut — it clears the PKCE verifier needed for the confirmation link
      return {
        ok: true,
        loggedIn: false,
        email: normalizedEmail,
        confirmationSent: true,
      };
    }

    return { ok: false, error: formatAuthErrorMessage(error) };
  }

  return { ok: true, loggedIn: true };
}

/** Register with email + password; phone saved immediately via service role */
export async function registerWithEmail(input: {
  fullName: string;
  email: string;
  password: string;
  phone: string;
  referralCode?: string;
  redirect?: string;
  callbackOrigin: string;
}): Promise<RegisterWithEmailResult> {
  const e164 = parseValidInternationalPhone(input.phone);
  if (!e164) return { ok: false, error: INVALID_PHONE_MESSAGE };

  const phoneCheck = await isPhoneAvailable(e164);
  if (!phoneCheck.available) {
    return { ok: false, error: phoneCheck.error ?? "This phone number is already registered" };
  }

  const normalizedEmail = normalizeEmail(input.email);
  const emailCheck = await isEmailAvailable(normalizedEmail);
  if (!emailCheck.available) {
    return { ok: false, error: emailCheck.error ?? "This email is already registered" };
  }

  const emailRedirectTo = buildAuthCallbackUrl(
    input.callbackOrigin,
    input.redirect ?? "/",
    input.referralCode
  );

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: normalizedEmail,
    password: input.password,
    options: {
      emailRedirectTo,
      data: {
        full_name: input.fullName.trim(),
        phone: e164,
        referral_code: input.referralCode?.trim() || undefined,
        auth_method: "email",
      },
    },
  });

  if (error) {
    return { ok: false, error: formatAuthErrorMessage(error) };
  }
  if (!data.user) return { ok: false, error: "Could not create account" };

  // Supabase returns success but sends no email when the address already exists
  if (data.user.identities?.length === 0) {
    return {
      ok: false,
      error:
        "This email is already registered. Check your inbox for an earlier confirmation link, or go to Sign In.",
    };
  }

  // Confirm email is OFF in Supabase — no confirmation email will ever be sent
  if (data.session && data.user.email_confirmed_at) {
    await supabase.auth.signOut();
    return {
      ok: false,
      error:
        'Confirmation emails are turned off in Supabase. Enable "Confirm email" under Authentication → Providers → Email.',
    };
  }

  const saved = await persistContactOnProfile(data.user.id, {
    phone: e164,
    fullName: input.fullName.trim(),
    email: normalizedEmail,
  });

  if (!saved.ok) {
    return { ok: false, error: saved.error ?? "Account created but phone was not saved" };
  }

  // Do not signOut here — it clears PKCE state and breaks the confirmation email link
  return { ok: true, email: normalizedEmail };
}

/** Save phone/profile after client-side signUp (keeps PKCE cookies in the browser) */
export async function finalizeRegistrationAfterSignUp(input: {
  userId: string;
  fullName: string;
  email: string;
  phone: string;
}): Promise<{ ok: boolean; error?: string }> {
  const e164 = parseValidInternationalPhone(input.phone);
  if (!e164) return { ok: false, error: INVALID_PHONE_MESSAGE };

  return persistContactOnProfile(input.userId, {
    phone: e164,
    fullName: input.fullName.trim(),
    email: normalizeEmail(input.email),
  });
}

/** Save phone, name, and email on profiles after signup */
export async function saveUserContactInfo(
  phone: string,
  fullName: string,
  email: string
): Promise<{ ok: boolean; error?: string }> {
  const e164 = parseValidInternationalPhone(phone);
  if (!e164) return { ok: false, error: INVALID_PHONE_MESSAGE };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { ok: false, error: "Not signed in" };

  return persistContactOnProfile(user.id, {
    phone: e164,
    fullName: fullName.trim(),
    email: normalizeEmail(email),
  });
}

/** After email confirm / OAuth callback — ensure phone + email saved on profile */
export async function syncProfileFromAuthMetadata(): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return;

  const meta = user.user_metadata ?? {};
  const phoneRaw = meta.phone as string | undefined;
  const phone = phoneRaw ? parseValidInternationalPhone(phoneRaw) : null;
  const fullName = (meta.full_name as string | undefined)?.trim();
  const email = user.email ? normalizeEmail(user.email) : null;

  if (!phone && !fullName && !email) return;

  if (phone && email) {
    await persistContactOnProfile(user.id, {
      phone,
      fullName: fullName ?? "",
      email,
    });
    return;
  }

  const updates: Record<string, string> = {};
  if (phone) updates.phone = phone;
  if (fullName) updates.full_name = fullName;
  if (email) updates.email = email;

  const admin = createAdminClient();
  const db = admin ?? supabase;
  const { error } = await db.from("profiles").update(updates).eq("id", user.id);

  if (error) {
    console.error("syncProfileFromAuthMetadata:", error.message);
  }
}

export async function logoutAction(): Promise<never> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
