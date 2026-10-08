"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Mail } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { parseTenDigitMobile } from "@/lib/auth/phone";
import { signupReady } from "@/lib/offers/audience";
import { buildAuthCallbackUrl, getEmailAuthOrigin } from "@/lib/auth/callback-url";
import { normalizeEmail, formatAuthErrorMessage } from "@/lib/auth/identifier";
import {
  finalizeRegistrationAfterSignUp,
  isPhoneAvailable,
  signInWithEmailPassword,
} from "@/lib/actions/auth";
import { checkSignupAllowed, linkSignupSecurity } from "@/lib/actions/security";
import { getDeviceId } from "@/lib/security/device-fingerprint";

interface EmailAuthFormProps {
  mode: "login" | "register";
  redirect?: string;
  referralCodeFromUrl?: string | null;
  agentCode?: string | null;
}

function EmailConfirmationNotice({
  email,
  variant,
}: {
  email: string;
  variant: "register" | "login";
}) {
  return (
    <div className="space-y-4 text-center py-2">
      <div className="mx-auto w-14 h-14 rounded-full bg-primary/15 flex items-center justify-center">
        <Mail className="h-7 w-7 text-primary" />
      </div>
      <div>
        <p className="text-lg font-semibold text-foreground">Check your email</p>
        <p className="text-sm text-muted-foreground mt-2">
          We sent a confirmation link to{" "}
          <strong className="text-foreground">{email}</strong>
        </p>
      </div>
      <p className="text-sm text-muted-foreground rounded-lg bg-white/5 border border-white/10 p-3 text-left">
        {variant === "register" ? (
          <>
            Your account was created but is <strong className="text-foreground">not active yet</strong>.
            Open the email and click the confirmation link. You&apos;ll be redirected to Sweepstakes Hub and
            signed in automatically once verified.
          </>
        ) : (
          <>
            Your email is not verified yet. We sent a new confirmation link — click it to verify
            your account and you&apos;ll be signed in automatically.
          </>
        )}
      </p>
      <p className="text-xs text-muted-foreground">
        Open the link in any browser on your phone or computer. Each link works once —
        use Sign In to request a new one if it expired.
      </p>
      <p className="text-xs text-muted-foreground">Check spam if you don&apos;t see it in 1–2 minutes.</p>
      <Link href="/login" className="inline-block text-sm text-primary hover:underline">
        Go to sign in
      </Link>
    </div>
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
  const [smsLoginCodes, setSmsLoginCodes] = useState(false);
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
        toast.success("Confirmation email sent! Verify your email to continue.");
        return;
      }

      toast.success("Welcome back!");
      router.push(redirect);
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

    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth) || dateOfBirth >= new Date().toISOString().slice(0, 10)) {
      toast.error("Enter your date of birth.");
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

    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      setLoading(false);
      return;
    }

    const emailRedirectTo = buildAuthCallbackUrl(
      getEmailAuthOrigin(window.location.origin),
      redirect,
      referralCode.trim() || referralCodeFromUrl || undefined,
      agentCode
    );

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
          sms_login_codes: smsLoginCodes,
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
      setLoading(false);
      setPendingEmail(normalizedEmail);
      setAwaitingConfirmation(true);
      toast.success("Account created! Check your email and click the link to verify.");
      void finalizeRegistrationAfterSignUp({
        userId: data.user.id,
        fullName,
        email: normalizedEmail,
        phone,
        dateOfBirth,
        agentCode,
        offersConsent: true,
        smsLoginCodes,
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
      smsLoginCodes,
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

    await linkSignupSecurity(deviceId);

    setLoading(false);
    toast.success("Account created! Welcome to Sweepstakes Hub.");
    router.push(redirect);
    router.refresh();
  }

  if (awaitingConfirmation && pendingEmail) {
    return <EmailConfirmationNotice email={pendingEmail} variant={mode} />;
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
        <div className="flex justify-between">
          <Label htmlFor="password">Password</Label>
          {mode === "login" && (
            <Link
              href="/reset-password"
              className="text-sm text-primary hover:underline font-medium"
            >
              Forgot password?
            </Link>
          )}
        </div>
        <Input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={mode === "register" ? 6 : undefined}
          placeholder={mode === "register" ? "At least 6 characters" : undefined}
        />
      </div>
      {mode === "register" && (
        <div className="space-y-2">
          <Label htmlFor="confirmPassword">Confirm Password</Label>
          <Input
            id="confirmPassword"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            minLength={6}
            placeholder="Re-enter your password"
          />
        </div>
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
              checked={smsLoginCodes}
              onChange={(e) => setSmsLoginCodes(e.target.checked)}
            />
            <span>Send a one-time SMS code when I sign in. This is not marketing consent.</span>
          </label>
          <label className="flex items-start gap-2">
            <input
              type="checkbox"
              className="mt-1"
              checked={acceptedOffers}
              onChange={(e) => setAcceptedOffers(e.target.checked)}
            />
            <span>I agree to receive bonus offers and promotions by email and SMS. I can unsubscribe or reply STOP later.</span>
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
          After Sign Up, check your inbox and click the confirmation link to sign in.
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
