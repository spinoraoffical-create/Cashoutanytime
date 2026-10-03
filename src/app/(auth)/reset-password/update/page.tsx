"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
    } = supabase.auth.onAuthStateChange((event) => {
      if (cancelled) return;
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

    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    setLoading(true);

    const supabase = createClient();
    if (!supabase) {
      toast.error("Authentication is not configured");
      setLoading(false);
      return;
    }

    const { error } = await supabase.auth.updateUser({ password });

    setLoading(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Password updated! You are now signed in.");
    router.push("/");
    router.refresh();
  }

  if (checkingSession) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground text-sm">
          Verifying reset link…
        </CardContent>
      </Card>
    );
  }

  if (!hasSession) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Link expired</CardTitle>
          <CardDescription>This password reset link is no longer valid</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Request a new reset link and open it in the same browser within a few minutes.
          </p>
          <Button asChild className="w-full">
            <Link href="/reset-password">Request new reset link</Link>
          </Button>
          <p className="text-sm text-muted-foreground text-center">
            <Link href="/login" className="text-primary hover:underline">
              Back to sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Set new password</CardTitle>
        <CardDescription>Choose a new password for your Spinora account</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="password">New password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              placeholder="At least 6 characters"
              autoComplete="new-password"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm new password</Label>
            <Input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={6}
              placeholder="Re-enter your password"
              autoComplete="new-password"
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Saving…" : "Update password"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
