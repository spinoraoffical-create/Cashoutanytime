"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { EmailAuthForm } from "@/components/auth/email-auth-form";

function RegisterForm() {
  const searchParams = useSearchParams();
  const refFromUrl = searchParams.get("ref");

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create Account</CardTitle>
        <CardDescription>
          Create your account — we&apos;ll email you a confirmation link to verify before sign-in
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
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
