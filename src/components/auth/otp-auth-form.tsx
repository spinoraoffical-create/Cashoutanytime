"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  INVALID_PHONE_MESSAGE,
  parseValidInternationalPhone,
  isValidOtpCode,
  PHONE_EXAMPLES,
} from "@/lib/auth/phone";
import { isEmailIdentifier, normalizeEmail, maskEmail, formatAuthErrorMessage } from "@/lib/auth/identifier";
import { resolveLoginEmail, isPhoneAvailable, isEmailAvailable, saveUserContactInfo } from "@/lib/actions/auth";
import { checkSignupAllowed, linkSignupSecurity } from "@/lib/actions/security";
import { getDeviceId } from "@/lib/security/device-fingerprint";

interface OtpAuthFormProps {
  mode: "login" | "register";
  redirect?: string;
  referralCodeFromUrl?: string | null;
}

export function OtpAuthForm({ mode, redirect = "/", referralCodeFromUrl }: OtpAuthFormProps) {
  const router = useRouter();
  const [step, setStep] = useState<"details" | "otp">("details");
  const [fullName, setFullName] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [phoneInput, setPhoneInput] = useState("");
  const [emailInput, setEmailInput] = useState("");
  const [referralCode, setReferralCode] = useState(referralCodeFromUrl || "");
  const [otp, setOtp] = useState("");
  const [targetEmail, setTargetEmail] = useState("");
  const [pendingPhone, setPendingPhone] = useState("");
  const [pendingFullName, setPendingFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const otpInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (step === "otp") {
      otpInputRef.current?.focus();
      otpInputRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [step]);

  async function handleSendCode(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    let email = "";
    let phone: string | null = null;

    if (mode === "register") {
      if (!fullName.trim()) {
        toast.error("Please enter your full name");
        setLoading(false);
        return;
      }
      if (!isEmailIdentifier(emailInput)) {
        toast.error("Enter a valid Gmail or email address");
        setLoading(false);
        return;
      }
      phone = parseValidInternationalPhone(phoneInput);
      if (!phone) {
        toast.error(INVALID_PHONE_MESSAGE);
        setLoading(false);
        return;
      }
      email = normalizeEmail(emailInput);

      const [phoneCheck, emailCheck] = await Promise.all([
        isPhoneAvailable(phone),
        isEmailAvailable(email),
      ]);
      if (!phoneCheck.available) {
        toast.error(phoneCheck.error ?? "This phone number is already registered");
        setLoading(false);
        return;
      }
      if (!emailCheck.available) {
        toast.error(emailCheck.error ?? "This email is already registered");
        setLoading(false);
        return;
      }

      const deviceId = await getDeviceId();
      const signupCheck = await checkSignupAllowed(deviceId, email);
      if (!signupCheck.allowed) {
        toast.error(signupCheck.error);
        setLoading(false);
        return;
      }
    } else {
      // Email typed directly on login — use it; phone goes through lookup
      if (isEmailIdentifier(identifier)) {
        email = normalizeEmail(identifier);
      } else {
        const resolved = await resolveLoginEmail(identifier);
        if (!resolved.email) {
          toast.error(resolved.error ?? "Account not found");
          setLoading(false);
          return;
        }
        email = resolved.email;
      }
    }

    const supabase = createClient();
    if (!supabase) {
      toast.error("Authentication is not configured");
      setLoading(false);
      return;
    }

    const metadata: Record<string, string> = { auth_method: "email_otp" };
    if (mode === "register") {
      metadata.full_name = fullName.trim();
      metadata.phone = phone!;
      const ref = referralCode.trim() || referralCodeFromUrl || "";
      if (ref) metadata.referral_code = ref;
    }

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: mode === "register",
        data: Object.keys(metadata).length > 0 ? metadata : undefined,
      },
    });

    setLoading(false);

    if (error) {
      toast.error(formatAuthErrorMessage(error.message));
      return;
    }

    setTargetEmail(email);
    if (mode === "register" && phone) {
      setPendingPhone(phone);
      setPendingFullName(fullName.trim());
    }
    setStep("otp");
    toast.success(`Verification code sent to ${maskEmail(email)}`);
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    if (!isValidOtpCode(otp)) {
      toast.error("Please enter a valid 6-digit code");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    if (!supabase) {
      toast.error("Authentication is not configured");
      setLoading(false);
      return;
    }

    const { error } = await supabase.auth.verifyOtp({
      email: targetEmail,
      token: otp.trim(),
      type: "email",
    });

    if (error) {
      setLoading(false);
      toast.error(formatAuthErrorMessage(error.message));
      return;
    }

    if (mode === "register" && pendingPhone) {
      const saved = await saveUserContactInfo(
        pendingPhone,
        pendingFullName,
        targetEmail
      );
      if (!saved.ok) {
        setLoading(false);
        toast.error(saved.error ?? "Account created but phone was not saved");
        return;
      }
      await linkSignupSecurity();
    }

    setLoading(false);

    toast.success(mode === "register" ? "Account created! Welcome to Spinora." : "Welcome back!");
    router.push(redirect);
    router.refresh();
  }

  if (step === "otp") {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-orange-500/40 bg-orange-500/10 p-4 text-center">
          <p className="text-base font-semibold text-orange-400">Enter your 6-digit code</p>
          <p className="text-sm text-muted-foreground mt-1">
            Sent to <strong className="text-foreground">{maskEmail(targetEmail)}</strong>
          </p>
        </div>
        <form onSubmit={handleVerifyOtp} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="otp">Verification Code</Label>
            <Input
              ref={otpInputRef}
              id="otp"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
              required
              placeholder="123456"
              maxLength={6}
              className="text-center text-2xl tracking-[0.4em] h-14 font-mono"
            />
            <p className="text-xs text-muted-foreground text-center">
              Paste the code from your email — do not click the link
            </p>
          </div>
          <Button type="submit" className="w-full" disabled={loading || otp.length < 6}>
            {loading ? "Verifying..." : mode === "register" ? "Create Account" : "Sign In"}
          </Button>
          <button
            type="button"
            onClick={() => {
              setStep("details");
              setOtp("");
            }}
            className="w-full text-sm text-muted-foreground hover:text-primary"
          >
            Back — send a new code
          </button>
        </form>
      </div>
    );
  }

  if (mode === "login") {
    return (
      <form onSubmit={handleSendCode} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="identifier">Email or Phone Number</Label>
          <Input
            id="identifier"
            type="text"
            inputMode="email"
            autoComplete="username"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            required
            placeholder="you@gmail.com or +91 98765 43210"
            className="font-mono text-base"
          />
          <p className="text-xs text-muted-foreground">
            We&apos;ll send a 6-digit code to the Gmail/email linked to your account
          </p>
        </div>
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Sending code..." : "Send Code to Email"}
        </Button>
      </form>
    );
  }

  return (
    <form onSubmit={handleSendCode} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Full Name</Label>
        <Input
          id="name"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          required
          placeholder="John Doe"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="phone">Phone Number</Label>
        <Input
          id="phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          value={phoneInput}
          onChange={(e) => setPhoneInput(e.target.value)}
          required
          placeholder={PHONE_EXAMPLES[2]}
          className="font-mono text-base"
        />
        <p className="text-xs text-muted-foreground">
          Include country code — any country works (e.g. {PHONE_EXAMPLES[1]})
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">Gmail / Email</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          value={emailInput}
          onChange={(e) => setEmailInput(e.target.value)}
          required
          placeholder="you@gmail.com"
        />
        <p className="text-xs text-muted-foreground">
          Your login code will be sent to this email — not by SMS
        </p>
      </div>

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

      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Sending code..." : "Send Code to Email"}
      </Button>
    </form>
  );
}
