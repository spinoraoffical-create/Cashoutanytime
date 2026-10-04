"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { EmailAuthForm } from "@/components/auth/email-auth-form";
import { GoogleAuthButton } from "@/components/auth/google-auth-button";

function RegisterForm() {
  const searchParams = useSearchParams();
  const refFromUrl = searchParams.get("ref");

  return (
    <Card className="border-0 bg-transparent shadow-none text-zinc-900">
      <CardHeader className="px-0">
        <CardTitle className="text-zinc-900">Create account</CardTitle>
        <CardDescription className="text-zinc-500">
          We&apos;ll email a confirmation link before you can play
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6 px-0">
        <GoogleAuthButton redirect="/" referralCode={refFromUrl} label="Continue with Google" />
        <EmailAuthForm mode="register" redirect="/" referralCodeFromUrl={refFromUrl} />

        <p className="text-sm text-muted-foreground text-center">
          Already have an account?{" "}
          <Link href="/login" className="text-primary hover:underline">
            Sign In
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="text-center text-muted-foreground">Loading...</div>}>
      <RegisterForm />
    </Suspense>
  );
}
