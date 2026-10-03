"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { getAuthCallbackUrl } from "@/lib/auth/callback-url";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";

export default function ResetPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const supabase = createClient();
    if (!supabase) {
      toast.error("Authentication is not configured");
      setLoading(false);
      return;
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: getAuthCallbackUrl("/reset-password/update"),
    });

    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }

    setSent(true);
    setLoading(false);
    toast.success("Password reset email sent!");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Reset Password</CardTitle>
        <CardDescription>
          {sent
            ? "Check your email for a reset link"
            : "Enter your email and we will send you a link to reset your password"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground mb-4 rounded-lg bg-white/5 border border-white/10 p-3">
          Enter the email you used to register.
        </p>
        {!sent ? (
          <form onSubmit={handleReset} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Sending..." : "Send Reset Link"}
            </Button>
          </form>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-4">
            We&apos;ve sent a password reset link to <strong>{email}</strong>
          </p>
        )}
        <p className="text-sm text-muted-foreground text-center mt-4">
          <Link href="/login" className="text-primary hover:underline">Back to Login</Link>
        </p>
      </CardContent>
    </Card>
  );
}
