"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { EmailAuthForm } from "@/components/auth/email-auth-form";
import { GoogleAuthButton } from "@/components/auth/google-auth-button";

function RegisterForm() {
  const searchParams = useSearchParams();
  const refFromUrl = searchParams.get("ref");

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-extrabold text-zinc-950">Create account</h2>
        <p className="mt-1 text-sm text-zinc-500">
          We&apos;ll email a confirmation link before you can play.
        </p>
      </div>
      <GoogleAuthButton redirect="/" referralCode={refFromUrl} label="Continue with Google" />
      <div className="flex items-center gap-3 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
        <span className="h-px flex-1 bg-zinc-200" />
        or
        <span className="h-px flex-1 bg-zinc-200" />
      </div>
      <EmailAuthForm mode="register" redirect="/" referralCodeFromUrl={refFromUrl} />
      <p className="text-center text-sm text-zinc-500">
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-rose-600 hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="text-center text-muted-foreground">Loading...</div>}>
      <RegisterForm />
    </Suspense>
  );
}
