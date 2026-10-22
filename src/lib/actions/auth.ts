"use server";

import { redirect } from "next/navigation";
import {
  INVALID_PHONE_MESSAGE,
  parseInternationalPhone,
  parseValidInternationalPhone,
  phoneLookupVariants,
} from "@/lib/auth/phone";
import { isEmailIdentifier, normalizeEmail, formatAuthErrorMessage, maskEmail } from "@/lib/auth/identifier";
import { authUserUpdateForContact } from "@/lib/auth/otp-safety";
import { pickLoginDestination, signedInUsesAdminHome } from "@/lib/auth/account-home";
import { buildAuthCallbackUrl } from "@/lib/auth/callback-url";
import { createClient } from "@/lib/supabase/server";
import { missingProfileColumn } from "@/lib/admin/spinora-profile";
import { registrationWriteDenial } from "@/lib/auth/registration-guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { tryGrantLoyaltyCoins } from "@/lib/rewards/try-grant-loyalty";
import { rateLimit } from "@/lib/rate-limit";
import { headers } from "next/headers";

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

/** Resolve phone/email to account email server-side. Never return this to the client. */
async function resolveAccountEmail(
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

async function otpRateLimitKey(identifier: string) {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
  return `${ip}:${identifier.trim().toLowerCase().slice(0, 48)}`;
}

/** Stops a browser from sending signup or recovery email in a tight loop. */
export async function guardAuthEmailSend(
  email: string,
  kind: "signup" | "recovery"
): Promise<{ ok: true } | { ok: false; error: string }> {
  const normalized = normalizeEmail(email);
  if (!isEmailIdentifier(normalized)) {
    return { ok: false, error: "Enter a valid email address." };
  }
  const allowed = await rateLimit("authOtp", `${kind}:${await otpRateLimitKey(normalized)}`);
  if (!allowed) {
    return { ok: false, error: "Too many emails. Please wait a few minutes." };
  }
  return { ok: true };
}

export async function sendLoginOtp(
  identifier: string
): Promise<{ ok: boolean; emailHint?: string; error?: string }> {
  const allowed = await rateLimit("authOtp", await otpRateLimitKey(identifier));
  if (!allowed) return { ok: false, error: "Too many login codes. Please wait a few minutes." };

  const resolved = await resolveAccountEmail(identifier);
  if (!resolved.email) return { ok: false, error: resolved.error ?? "Account not found" };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: resolved.email,
    options: { shouldCreateUser: false },
  });

  if (error) return { ok: false, error: formatAuthErrorMessage(error) };
  return { ok: true, emailHint: maskEmail(resolved.email) };
}

export async function verifyLoginOtp(
  identifier: string,
  token: string,
  redirectTo?: string
): Promise<{ ok: boolean; error?: string; home?: string }> {
  const allowed = await rateLimit("authOtp", `verify:${await otpRateLimitKey(identifier)}`);
  if (!allowed) return { ok: false, error: "Too many attempts. Please wait a few minutes." };

  const resolved = await resolveAccountEmail(identifier);
  if (!resolved.email) return { ok: false, error: resolved.error ?? "Account not found" };

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({
    email: resolved.email,
    token: token.trim(),
    type: "email",
  });

  if (error) return { ok: false, error: formatAuthErrorMessage(error) };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const home = user
    ? pickLoginDestination(redirectTo, await signedInUsesAdminHome(supabase, user.id))
    : pickLoginDestination(redirectTo, false);
  return { ok: true, home };
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

async function rememberPhoneOnAuthUser(
  admin: NonNullable<ReturnType<typeof createAdminClient>>,
  userId: string,
  contact: { phone: string; fullName: string; email: string }
) {
  const { data: authUser } = await admin.auth.admin.getUserById(userId);
  const existingMeta = authUser?.user?.user_metadata ?? {};
  const attributes = authUserUpdateForContact({
    emailConfirmed: Boolean(authUser?.user?.email_confirmed_at),
    phone: contact.phone,
    metadata: {
      ...existingMeta,
      phone: contact.phone,
      full_name: contact.fullName,
      auth_method: "email",
    },
  });
  const saved = await admin.auth.admin.updateUserById(userId, attributes);
  if (saved.error && attributes.phone) {
    await admin.auth.admin.updateUserById(userId, { user_metadata: attributes.user_metadata });
  }
}

/** Set the auth phone only after the email code has already been accepted. */
export async function attachAuthPhoneAfterVerification(): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email_confirmed_at || user.phone) return;
  const phoneRaw = typeof user.user_metadata?.phone === "string" ? user.user_metadata.phone : "";
  const phone = phoneRaw ? parseValidInternationalPhone(phoneRaw) : null;
  if (!phone) return;
  const admin = createAdminClient();
  if (!admin) return;
  await admin.auth.admin.updateUserById(user.id, {
    phone,
    user_metadata: { ...(user.user_metadata ?? {}), phone },
  });
}

async function writeProfileContact(
  db: {
    from: (table: string) => {
      update: (fields: Record<string, string>) => {
        eq: (column: string, value: string) => {
          select: (columns: string) => {
            maybeSingle: () => PromiseLike<{ data: unknown; error: { message: string } | null }>;
          };
        };
      };
    };
  },
  userId: string,
  contact: { phone: string; fullName: string; email: string }
): Promise<{ ok: boolean; error?: string; phoneOnProfile: boolean }> {
  const fields: Record<string, string> = {
    phone: contact.phone,
    full_name: contact.fullName,
    email: contact.email,
  };
  let selectFields = ["id", "phone"];

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const { data, error } = await db
      .from("profiles")
      .update(fields)
      .eq("id", userId)
      .select(selectFields.join(", "))
      .maybeSingle();

    if (!error) {
      const savedPhone = (data as { phone?: string | null } | null)?.phone?.trim();
      if (!("phone" in fields)) return { ok: true, phoneOnProfile: false };
      if (savedPhone) return { ok: true, phoneOnProfile: true };
      return { ok: false, error: "Profile update did not save phone", phoneOnProfile: false };
    }

    const missing = missingProfileColumn(error.message);
    if (missing && (missing in fields || selectFields.includes(missing))) {
      delete fields[missing];
      selectFields = selectFields.filter((field) => field !== missing);
      if (!selectFields.length) selectFields = ["id"];
      if (Object.keys(fields).length === 0) return { ok: true, phoneOnProfile: false };
      continue;
    }

    return { ok: false, error: error.message, phoneOnProfile: false };
  }

  return { ok: false, error: "Could not save phone number to profile", phoneOnProfile: false };
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

  await rememberPhoneOnAuthUser(admin, userId, contact);
  const saved = await writeProfileContact(admin, userId, contact);
  if (!saved.ok) return { ok: false, error: saved.error };
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

  const saved = await writeProfileContact(supabase, userId, contact);
  if (!saved.ok) return { ok: false, error: saved.error ?? "Could not save phone number to profile" };
  return { ok: true };
}

export type RegisterWithEmailResult = { ok: true; email: string } | { ok: false; error: string };

export type SignInWithEmailResult =
  | { ok: true; loggedIn: true; home: string }
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

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const home = user
    ? pickLoginDestination(input.redirect, await signedInUsesAdminHome(supabase, user.id))
    : pickLoginDestination(input.redirect, false);
  return { ok: true, loggedIn: true, home };
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
        "This email is already registered. Check your inbox for an earlier code, or go to Sign In.",
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

  await tryGrantLoyaltyCoins(data.user.id, "signup", `signup:${data.user.id}`);

  // Do not signOut here — it clears PKCE state and breaks the confirmation email link
  return { ok: true, email: normalizedEmail };
}

async function registrationOwnershipDenial(userId: string, email: string): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const admin = createAdminClient();
  let authEmail: string | null = null;
  let createdAtMs: number | null = null;
  let emailConfirmed = false;
  let profilePhone: string | null = null;
  let profileDob: string | null = null;
  if (!user && admin) {
    const { data } = await admin.auth.admin.getUserById(userId);
    const authUser = data?.user;
    authEmail = authUser?.email ?? null;
    const created = authUser?.created_at ? new Date(authUser.created_at).getTime() : Number.NaN;
    createdAtMs = Number.isFinite(created) ? created : null;
    emailConfirmed = Boolean(authUser?.email_confirmed_at);
    const { data: profile } = await admin
      .from("profiles")
      .select("phone, date_of_birth")
      .eq("id", userId)
      .maybeSingle();
    const row = profile as { phone?: string | null; date_of_birth?: string | null } | null;
    profilePhone = row?.phone ?? null;
    profileDob = row?.date_of_birth ?? null;
  }
  return registrationWriteDenial({
    sessionUserId: user?.id ?? null,
    sessionEmail: user?.email ?? null,
    claimedUserId: userId,
    claimedEmail: normalizeEmail(email),
    authEmail,
    createdAtMs,
    emailConfirmed,
    profilePhone,
    profileDob,
    now: Date.now(),
  });
}

/** Save phone/profile after client-side signUp (keeps PKCE cookies in the browser). */
export async function finalizeRegistrationAfterSignUp(input: {
  userId: string;
  fullName: string;
  email: string;
  phone: string;
  dateOfBirth?: string;
  agentCode?: string | null;
  offersConsent?: boolean;
}): Promise<{ ok: boolean; error?: string }> {
  const { ageDenial } = await import("@/lib/compliance/age");
  const tooYoung = ageDenial(input.dateOfBirth);
  if (tooYoung) return { ok: false, error: tooYoung };

  const denied = await registrationOwnershipDenial(input.userId, input.email);
  if (denied) return { ok: false, error: denied };

  if (input.offersConsent !== true) {
    return { ok: false, error: "Agree to email notices before creating an account." };
  }
  const e164 = parseValidInternationalPhone(input.phone);
  if (!e164) return { ok: false, error: INVALID_PHONE_MESSAGE };

  if (input.agentCode?.trim()) {
    const { assignPlayerToAgentByCode } = await import("@/lib/agents/assign");
    await assignPlayerToAgentByCode(input.userId, input.agentCode);
  }

  const saved = await persistContactOnProfile(input.userId, {
    phone: e164,
    fullName: input.fullName.trim(),
    email: normalizeEmail(input.email),
  });
  if (!saved.ok) return saved;

  const admin = createAdminClient();
  if (!admin) return { ok: false, error: "Account created but preferences were not saved." };

  if (input.dateOfBirth) {
    const { error: dobError } = await admin
      .from("profiles")
      .update({ date_of_birth: input.dateOfBirth })
      .eq("id", input.userId);
    if (dobError && !/date_of_birth|schema cache|column/i.test(dobError.message)) {
      return { ok: false, error: dobError.message };
    }
  }

  const prefs = await admin.from("notification_preferences").upsert(
    {
      user_id: input.userId,
      email_promotions: true,
      sms_marketing: false,
    },
    { onConflict: "user_id" }
  );
  if (prefs.error) {
    const emailOnly = await admin.from("notification_preferences").upsert(
      { user_id: input.userId, email_promotions: true },
      { onConflict: "user_id" }
    );
    if (emailOnly.error) return { ok: false, error: "Account created but offer preferences were not saved." };
    return { ok: false, error: "Apply supabase/migrations/20261008000170_signup_offers.sql before signup can save email notices." };
  }

  const { data: authUser } = await admin.auth.admin.getUserById(input.userId);
  const existingMeta = authUser?.user?.user_metadata ?? {};
  await admin.auth.admin.updateUserById(input.userId, {
    user_metadata: {
      ...existingMeta,
      full_name: input.fullName.trim(),
      phone: e164,
      date_of_birth: input.dateOfBirth ?? null,
      agent_code: input.agentCode?.trim() || null,
      offers_consent: true,
    },
  });

  if (input.agentCode?.trim()) {
    const { assignPlayerToAgentByCode } = await import("@/lib/agents/assign");
    await assignPlayerToAgentByCode(input.userId, input.agentCode);
  }

  try {
    const { safePaymentAlert } = await import("@/lib/telegram/control/safe-emit");
    await safePaymentAlert({
      category: "signup",
      eventKey: `signup:${input.userId}`,
      source: "ledger",
      reference: input.userId,
      detail: "A player finished registration.",
      adminPath: "/admin/users",
    });
  } catch {
    /* The account is already saved. A queued alert stays for the daily cron. */
  }

  try {
    const { tryGrantLoyaltyCoins } = await import("@/lib/rewards/try-grant-loyalty");
    await tryGrantLoyaltyCoins(input.userId, "signup", `signup:${input.userId}`);
  } catch {
    /* Registration stays saved when Coins are off or the ledger is unavailable. */
  }

  return { ok: true };
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
