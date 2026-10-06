"use client";

import { Suspense, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { EmailAuthForm } from "@/components/auth/email-auth-form";
import { GoogleAuthButton } from "@/components/auth/google-auth-button";

function LoginForm() {
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") || "/";

  useEffect(() => {
    if (searchParams.get("verified") === "1") {
      toast.success("Email verified! You are signed in.");
    }
    if (searchParams.get("error") === "auth_callback_failed") {
      toast.error(
        "Confirmation link expired or already used. Register again or sign in to get a new link."
      );
    }
    if (searchParams.get("error") === "email_not_confirmed") {
      toast.error("Please confirm your email before accessing your account.");
    }
  }, [searchParams]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-extrabold text-zinc-950">Sign in</h2>
        <p className="mt-1 text-sm text-zinc-500">Enter your details to continue.</p>
      </div>
      <GoogleAuthButton redirect={redirect} />
      <div className="flex items-center gap-3 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
        <span className="h-px flex-1 bg-zinc-200" />
        or
        <span className="h-px flex-1 bg-zinc-200" />
      </div>
      <EmailAuthForm mode="login" redirect={redirect} />
      <p className="text-center text-sm text-zinc-500">
        New here?{" "}
        <Link href="/register" className="font-semibold text-rose-600 hover:underline">
          Create an account
        </Link>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="text-center text-muted-foreground">Loading...</div>}>
      <LoginForm />
    </Suspense>
  );
}
