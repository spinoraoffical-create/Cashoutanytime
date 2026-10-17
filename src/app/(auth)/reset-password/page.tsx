"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { getAuthCallbackUrl } from "@/lib/auth/callback-url";
import { guardAuthEmailSend } from "@/lib/actions/auth";
import { isValidOtpCode } from "@/lib/auth/phone";
import { formatAuthErrorMessage, normalizeEmail } from "@/lib/auth/identifier";
import { OTP_REJECTED_MESSAGE, RECOVERY_SENT_MESSAGE, shouldHideAccountExistence } from "@/lib/auth/recovery";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const RESEND_COOLDOWN_SECONDS = 60;

export default function ResetPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [formError, setFormError] = useState("");

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(() => setCooldown((current) => current - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  async function sendCode() {
    const supabase = createClient();
    if (!supabase) {
      setFormError("Sign-in is temporarily unavailable. Please try again later or contact support.");
      return false;
    }
    const normalized = normalizeEmail(email);
    const guard = await guardAuthEmailSend(normalized, "recovery");
    if (!guard.ok) {
      setFormError(guard.error);
      return false;
    }
    const { error } = await supabase.auth.resetPasswordForEmail(normalized, {
      redirectTo: getAuthCallbackUrl("/reset-password/update"),
    });
    if (error && !shouldHideAccountExistence(error)) {
      setFormError(formatAuthErrorMessage(error));
      return false;
    }
    setFormError("");
    setCooldown(RESEND_COOLDOWN_SECONDS);
    return true;
  }

  async function handleEmail(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const sent = await sendCode();
    setLoading(false);
    if (sent) setStep("code");
  }

  async function handleResend() {
    if (cooldown > 0 || sending) return;
    setSending(true);
    await sendCode();
    setSending(false);
  }

  async function handleCode(e: React.FormEvent) {
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
    setLoading(true);
    const { error } = await supabase.auth.verifyOtp({
      email: normalizeEmail(email),
      token: code.trim(),
      type: "recovery",
    });
    setLoading(false);
    if (error) {
      setFormError(OTP_REJECTED_MESSAGE);
      return;
    }
    router.push("/reset-password/update");
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-extrabold text-zinc-950">Reset password</h2>
        <p className="mt-1 text-sm text-zinc-500">
          {step === "email" ? "Enter the email on your account." : RECOVERY_SENT_MESSAGE}
        </p>
      </div>
      {step === "email" ? (
        <form onSubmit={handleEmail} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              autoComplete="email"
              placeholder="you@example.com"
            />
          </div>
          {formError && <p className="text-sm text-red-600">{formError}</p>}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Sending..." : "Send code"}
          </Button>
        </form>
      ) : (
        <form onSubmit={handleCode} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="recovery-code">6-digit code</Label>
            <Input
              id="recovery-code"
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
            {loading ? "Checking code..." : "Continue"}
          </Button>
          <button
            type="button"
            onClick={() => void handleResend()}
            disabled={sending || cooldown > 0}
            className="w-full text-sm font-semibold text-primary hover:underline disabled:opacity-60"
          >
            {sending ? "Sending..." : cooldown > 0 ? `Send a new code in ${cooldown}s` : "Send a new code"}
          </button>
          <p className="text-center text-xs text-zinc-500">
            If the email has a link instead of a code, open that link in this browser.
          </p>
        </form>
      )}
      <p className="text-center text-sm text-zinc-500">
        <Link href="/login" className="font-semibold text-rose-600 hover:underline">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
