"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { PasswordField } from "@/components/auth/password-field";
import { passwordIsAcceptable } from "@/lib/auth/password-rules";
import { toast } from "sonner";
import type { SupabaseClient } from "@supabase/supabase-js";

function stripAuthParamsFromUrl() {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  url.searchParams.delete("code");
  url.searchParams.delete("token_hash");
  url.searchParams.delete("type");
  url.hash = "";
  window.history.replaceState({}, "", url.pathname);
}

async function resolveRecoverySession(supabase: SupabaseClient): Promise<boolean> {
  const params = new URLSearchParams(window.location.search);
  const code = params.get("code");
  const tokenHash = params.get("token_hash");
  const type = params.get("type");

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      console.warn("[reset-password]", error.message);
    } else {
      stripAuthParamsFromUrl();
      return true;
    }
  }

  if (tokenHash && type === "recovery") {
    const { error } = await supabase.auth.verifyOtp({
      type: "recovery",
      token_hash: tokenHash,
    });
    if (error) {
      console.warn("[reset-password]", error.message);
    } else {
      stripAuthParamsFromUrl();
      return true;
    }
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return Boolean(user);
}

export default function UpdatePasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [hasSession, setHasSession] = useState(false);

  useEffect(() => {
    const maybeClient = createClient();
    if (!maybeClient) {
      setCheckingSession(false);
      return;
    }
    const supabase: SupabaseClient = maybeClient;

    let cancelled = false;
    const sessionFound = { current: false };

    async function verifySession() {
      const ok = await resolveRecoverySession(supabase);
      if (!cancelled && ok) {
        sessionFound.current = true;
        setHasSession(true);
        setCheckingSession(false);
      }
    }

    void verifySession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (cancelled || !session) return;
      if (event === "INITIAL_SESSION" || event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        sessionFound.current = true;
        setHasSession(true);
        setCheckingSession(false);
        stripAuthParamsFromUrl();
      }
    });

    const timeout = window.setTimeout(() => {
      if (cancelled || sessionFound.current) return;
      void supabase.auth.getUser().then(({ data: { user } }) => {
        if (cancelled) return;
        if (user) {
          sessionFound.current = true;
          setHasSession(true);
        }
        setCheckingSession(false);
      });
    }, 3000);

    return () => {
      cancelled = true;
      subscription.unsubscribe();
      window.clearTimeout(timeout);
    };
  }, []);

  useEffect(() => {
    if (!checkingSession && !hasSession) {
      toast.error("Reset link expired or invalid. Request a new one.");
    }
  }, [checkingSession, hasSession]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!passwordIsAcceptable(password)) {
      toast.error("Use at least 8 characters, with a letter and a number.");
      return;
    }

    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    setLoading(true);

    const supabase = createClient();
    if (!supabase) {
      toast.error("Sign-in is temporarily unavailable. Please try again later or contact support.");
      setLoading(false);
      return;
    }

    const { error } = await supabase.auth.updateUser({ password });

    setLoading(false);

    if (error) {
      toast.error("Could not update that password. Try again.");
      return;
    }

    toast.success("Password updated. You are signed in.");
    router.push("/");
    router.refresh();
  }

  if (checkingSession) {
    return <p className="py-12 text-center text-sm text-zinc-500">Checking your reset…</p>;
  }

  if (!hasSession) {
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-extrabold text-zinc-950">Code expired</h2>
        <p className="text-sm text-zinc-500">
          That reset code or link is no longer valid. Request a new code and enter it in this browser.
        </p>
        <Button asChild className="w-full">
          <Link href="/reset-password">Request a new code</Link>
        </Button>
        <p className="text-center text-sm text-zinc-500">
          <Link href="/login" className="font-semibold text-rose-600 hover:underline">
            Back to sign in
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-extrabold text-zinc-950">Set a new password</h2>
        <p className="mt-1 text-sm text-zinc-500">Choose a password you have not used here before.</p>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <PasswordField
          id="password"
          label="New password"
          value={password}
          onChange={setPassword}
          autoComplete="new-password"
          placeholder="At least 8 characters"
          showRules
        />
        <PasswordField
          id="confirmPassword"
          label="Confirm new password"
          value={confirmPassword}
          onChange={setConfirmPassword}
          autoComplete="new-password"
          placeholder="Re-enter your password"
        />
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Saving…" : "Update password"}
        </Button>
      </form>
    </div>
  );
}
