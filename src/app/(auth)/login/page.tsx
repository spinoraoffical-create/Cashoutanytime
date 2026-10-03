"use client";

import { Suspense, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { EmailAuthForm } from "@/components/auth/email-auth-form";

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
    <Card>
      <CardHeader>
        <CardTitle>Welcome Back</CardTitle>
        <CardDescription>Sign in with your email and password</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <EmailAuthForm mode="login" redirect={redirect} />

        <p className="text-sm text-muted-foreground text-center">
          Don&apos;t have an account?{" "}
          <Link href="/register" className="text-primary hover:underline">
            Register
          </Link>
        </p>
        <p className="text-sm text-center">
          <Link href="/reset-password" className="text-primary hover:underline font-medium">
            Forgot your password?
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="text-center text-muted-foreground">Loading...</div>}>
      <LoginForm />
    </Suspense>
  );
}
