"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Mail } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { trackPublicEvent } from "@/lib/analytics/public-events";
import { isValidOtpCode, parseTenDigitMobile } from "@/lib/auth/phone";
import { signupReady } from "@/lib/offers/audience";
import { buildAuthCallbackUrl, getEmailAuthOrigin } from "@/lib/auth/callback-url";
import { normalizeEmail, formatAuthErrorMessage } from "@/lib/auth/identifier";
import {
  attachAuthPhoneAfterVerification,
  finalizeRegistrationAfterSignUp,
  guardAuthEmailSend,
  isPhoneAvailable,
  signInWithEmailPassword,
} from "@/lib/actions/auth";
import { otpFailureMessage } from "@/lib/auth/otp-safety";
import { PasswordField } from "@/components/auth/password-field";
import { passwordIsAcceptable } from "@/lib/auth/password-rules";
import { checkSignupAllowed, linkSignupSecurity } from "@/lib/actions/security";
import { getDeviceId } from "@/lib/security/device-fingerprint";

interface EmailAuthFormProps {
  mode: "login" | "register";
  redirect?: string;
  referralCodeFromUrl?: string | null;
  agentCode?: string | null;
}

const RESEND_COOLDOWN_SECONDS = 60;

function EmailCodeForm({ email, redirect }: { email: string; redirect: string }) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_SECONDS);
  const [formError, setFormError] = useState("");
  const verifying = useRef(false);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(() => setCooldown((current) => current - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    if (!isValidOtpCode(code)) {
      setFormError("Enter the 6-digit code from the email.");
      return;
    }

    const supabase = createClient();
    if (!supabase) {
      setFormError("Sign-in is temporarily unavailable. Please try again later or contact support.");
      return;
    }

    if (verifying.current) return;
    verifying.current = true;
    setLoading(true);
    let error: { message?: string; code?: string; status?: number; name?: string } | null = null;
    try {
      const result = await supabase.auth.verifyOtp({
        email,
        token: code.trim(),
        type: "signup",
      });
      error = result.error;
    } catch {
      error = { name: "AuthRetryableFetchError", message: "fetch failed" };
    } finally {
      verifying.current = false;
      setLoading(false);
    }

    if (error) {
      setFormError(otpFailureMessage(error));
      return;
    }

    try {
      await attachAuthPhoneAfterVerification();
    } catch {
      /* The email is already confirmed. The phone remains on the profile. */
    }

    try {
      const { recordEmailVerifiedCoins } = await import("@/lib/actions/loyalty");
      await recordEmailVerifiedCoins();
    } catch {
      /* The email is confirmed. Coins stay off when that reward is disabled. */
    }

    toast.success("Email verified.");
    trackPublicEvent("signup_completed");
    router.push(redirect);
    router.refresh();
  }

  async function resend() {
    if (cooldown > 0 || sending) return;
    const supabase = createClient();
    if (!supabase) return;
    setSending(true);
    setFormError("");
    const guard = await guardAuthEmailSend(email, "signup");
    if (!guard.ok) {
      setSending(false);
      setFormError(guard.error);
      return;
    }
    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
      options: { emailRedirectTo: buildAuthCallbackUrl(window.location.origin, redirect) },
    });
    setSending(false);
    if (error) {
      setFormError(formatAuthErrorMessage(error));
      return;
    }
    setCooldown(RESEND_COOLDOWN_SECONDS);
    toast.success("We sent a new 6-digit code.");
  }

  return (
    <form onSubmit={verify} className="space-y-4 py-2">
      <div className="text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/15">
          <Mail className="h-7 w-7 text-primary" />
        </div>
        <p className="mt-3 text-lg font-semibold text-foreground">Enter your code</p>
        <p className="mt-2 text-sm text-muted-foreground">
          We sent a 6-digit code to <strong className="text-foreground">{email}</strong>. Type it here to finish.
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="signup-code">6-digit code</Label>
        <Input
          id="signup-code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          value={code}
          onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
          placeholder="000000"
          className="text-center text-2xl tracking-[0.3em]"
          required
        />
      </div>
      {formError && <p className="text-sm text-red-600">{formError}</p>}
      <Button type="submit" className="w-full" disabled={loading || code.length !== 6}>
        {loading ? "Checking code..." : "Verify email"}
      </Button>
      <button
        type="button"
        onClick={() => void resend()}
        disabled={sending || cooldown > 0}
        className="w-full text-sm font-semibold text-primary hover:underline disabled:opacity-60"
      >
        {sending ? "Sending..." : cooldown > 0 ? `Send a new code in ${cooldown}s` : "Send a new code"}
      </button>
      <p className="text-center text-xs text-muted-foreground">
        Check spam if it is not there in a minute. If the email also has a link, you can open that link in this browser.
      </p>
    </form>
  );
}

export function EmailAuthForm({ mode, redirect = "/", referralCodeFromUrl, agentCode }: EmailAuthFormProps) {
  const router = useRouter();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [mobile, setMobile] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [referralCode, setReferralCode] = useState(referralCodeFromUrl || "");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [acceptedOffers, setAcceptedOffers] = useState(false);
  const [loading, setLoading] = useState(false);
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);
  const [pendingEmail, setPendingEmail] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const supabase = createClient();
    if (!supabase) {
      toast.error("Sign-in is temporarily unavailable. Please try again later or contact support.");
      setLoading(false);
      return;
    }

    if (mode === "login") {
      const normalizedEmail = normalizeEmail(email);
      const result = await signInWithEmailPassword({
        email: normalizedEmail,
        password,
        redirect,
        callbackOrigin: window.location.origin,
      });

      setLoading(false);

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      if (!result.loggedIn) {
        setPendingEmail(result.email);
        setAwaitingConfirmation(true);
        toast.success("We sent a 6-digit code. Enter it to finish.");
        return;
      }

      toast.success("Welcome back!");
      router.push(result.home);
      router.refresh();
      return;
    }

    if (!signupReady(acceptedTerms, acceptedOffers)) {
      toast.error("Tick Terms and Privacy and the offers box before signing up.");
      setLoading(false);
      return;
    }

    const phone = parseTenDigitMobile(mobile);
    if (!phone) {
      toast.error("Enter a valid 10-digit mobile number.");
      setLoading(false);
      return;
    }

    const fullName = `${firstName.trim()} ${lastName.trim()}`.trim();
    if (!firstName.trim() || !lastName.trim()) {
      toast.error("Enter your first and last name.");
      setLoading(false);
      return;
    }

    const { ageDenial } = await import("@/lib/compliance/age");
    const tooYoung = ageDenial(dateOfBirth);
    if (tooYoung) {
      toast.error(tooYoung);
      setLoading(false);
      return;
    }

    const phoneCheck = await isPhoneAvailable(phone);
    if (!phoneCheck.available) {
      toast.error(phoneCheck.error ?? "This phone number is already registered");
      setLoading(false);
      return;
    }

    const normalizedEmail = normalizeEmail(email);
    const deviceId = await getDeviceId();
    const signupCheck = await checkSignupAllowed(deviceId, normalizedEmail);
    if (!signupCheck.allowed) {
      toast.error(signupCheck.error);
      setLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      setLoading(false);
      return;
    }

    if (!passwordIsAcceptable(password)) {
      toast.error("Use at least 8 characters, with a letter and a number.");
      setLoading(false);
      return;
    }

    const emailRedirectTo = buildAuthCallbackUrl(
      getEmailAuthOrigin(window.location.origin),
      redirect,
      referralCode.trim() || referralCodeFromUrl || undefined,
      agentCode
    );

    trackPublicEvent("signup_started");
    const { data, error } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
      options: {
        emailRedirectTo,
        data: {
          full_name: fullName,
          phone,
          date_of_birth: dateOfBirth,
          referral_code: referralCode.trim() || referralCodeFromUrl || undefined,
          agent_code: agentCode || undefined,
          offers_consent: true,
          auth_method: "email",
        },
      },
    });

    if (error) {
      setLoading(false);
      console.error("[auth] signUp failed:", error);
      toast.error(formatAuthErrorMessage(error));
      return;
    }

    if (!data.user) {
      setLoading(false);
      toast.error("Could not create account");
      return;
    }

    if (data.user.identities?.length === 0) {
      setLoading(false);
      toast.error("This email is already registered. Go to Sign In instead.");
      return;
    }

    const needsConfirmation = !data.user.email_confirmed_at;

    if (needsConfirmation) {
      // Do not signOut — it clears PKCE cookies and breaks the confirmation link
      const linked = await linkSignupSecurity(deviceId, data.user.id);
      setLoading(false);
      if (!linked.ok) {
        toast.error(linked.error);
        return;
      }
      setPendingEmail(normalizedEmail);
      setAwaitingConfirmation(true);
      trackPublicEvent("signup_code_requested");
      toast.success("Account created. Enter the 6-digit code from your email.");
      void finalizeRegistrationAfterSignUp({
        userId: data.user.id,
        fullName,
        email: normalizedEmail,
        phone,
        dateOfBirth,
        agentCode,
        offersConsent: true,
      });
      return;
    }

    let saved = await finalizeRegistrationAfterSignUp({
      userId: data.user.id,
      fullName,
      email: normalizedEmail,
      phone,
      dateOfBirth,
      agentCode,
      offersConsent: true,
    });

    // Browser session fallback if server-side save failed
    if (!saved.ok && data.session && /phone/i.test(saved.error ?? "")) {
      const { data: updated, error: profileError } = await supabase
        .from("profiles")
        .update({
          phone,
          full_name: fullName.trim(),
          email: normalizedEmail,
        })
        .eq("id", data.user.id)
        .select("phone")
        .maybeSingle();

      if (!profileError && updated?.phone) {
        saved = { ok: true };
      }
    }

    if (!saved.ok) {
      setLoading(false);
      toast.error(saved.error ?? "Account created but phone was not saved");
      return;
    }

    const linked = await linkSignupSecurity(deviceId, data.user.id);
    if (!linked.ok) {
      setLoading(false);
      toast.error(linked.error);
      return;
    }

    setLoading(false);
    toast.success("Account created! Welcome to Sweepstakes Hub.");
    router.push(redirect);
    router.refresh();
  }

  if (awaitingConfirmation && pendingEmail) {
    return <EmailCodeForm email={pendingEmail} redirect={redirect} />;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {mode === "register" && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="firstName">First name</Label>
            <Input id="firstName" value={firstName} onChange={(e) => setFirstName(e.target.value)} required placeholder="First name" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="lastName">Last name</Label>
            <Input id="lastName" value={lastName} onChange={(e) => setLastName(e.target.value)} required placeholder="Last name" />
          </div>
        </div>
      )}
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          placeholder="you@example.com"
        />
      </div>
      {mode === "register" && (
        <div className="space-y-2">
          <Label htmlFor="mobile">Mobile</Label>
          <Input
            id="mobile"
            inputMode="numeric"
            autoComplete="tel"
            maxLength={10}
            pattern="[0-9]{10}"
            value={mobile}
            onChange={(e) => setMobile(e.target.value.replace(/\D/g, "").slice(0, 10))}
            required
            placeholder="10-digit mobile"
          />
        </div>
      )}
      {mode === "register" && (
        <div className="space-y-2">
          <Label htmlFor="dob">Date of birth</Label>
          <Input id="dob" type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} required />
        </div>
      )}
      <div className="space-y-2">
        {mode === "login" && (
          <div className="flex justify-end">
            <Link href="/reset-password" className="text-sm font-medium text-primary hover:underline">
              Forgot password?
            </Link>
          </div>
        )}
        <PasswordField
          id="password"
          label="Password"
          value={password}
          onChange={setPassword}
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          placeholder={mode === "register" ? "At least 8 characters" : undefined}
          showRules={mode === "register"}
        />
      </div>
      {mode === "register" && (
        <PasswordField
          id="confirmPassword"
          label="Confirm password"
          value={confirmPassword}
          onChange={setConfirmPassword}
          autoComplete="new-password"
          placeholder="Re-enter your password"
        />
      )}
      {mode === "register" && !agentCode && (
        <div className="space-y-2">
          <Label htmlFor="referral">Referral Code (optional)</Label>
          <Input
            id="referral"
            value={referralCode}
            onChange={(e) => setReferralCode(e.target.value)}
            placeholder="Enter referral code"
            readOnly={!!referralCodeFromUrl}
          />
        </div>
      )}
      {mode === "register" && (
        <div className="space-y-3 text-sm text-muted-foreground">
          <label className="flex items-start gap-2">
            <input
              type="checkbox"
              className="mt-1"
              checked={acceptedTerms}
              onChange={(e) => setAcceptedTerms(e.target.checked)}
            />
            <span>
              I agree to the <Link href="/terms" className="text-primary hover:underline">Terms</Link> and{" "}
              <Link href="/privacy" className="text-primary hover:underline">Privacy</Link>.
            </span>
          </label>
          <label className="flex items-start gap-2">
            <input
              type="checkbox"
              className="mt-1"
              checked={acceptedOffers}
              onChange={(e) => setAcceptedOffers(e.target.checked)}
            />
            <span>Email me bonus offers and account notices. I can unsubscribe any time.</span>
          </label>
        </div>
      )}
      <Button
        type="submit"
        className="w-full"
        disabled={mode === "register" ? !signupReady(acceptedTerms, acceptedOffers) || loading : loading}
      >
        {loading
          ? mode === "login"
            ? "Signing in..."
            : "Creating account..."
          : mode === "login"
            ? "Sign In"
            : "Sign Up"}
      </Button>
      {mode === "register" && (
        <p className="text-xs text-muted-foreground text-center">
          After Sign Up, enter the 6-digit code from your email.
        </p>
      )}
      {mode === "login" && (
        <p className="text-xs text-muted-foreground text-center">
          Sign in with the email and password you registered with.
        </p>
      )}
    </form>
  );
}
