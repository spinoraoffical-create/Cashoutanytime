import type { Metadata } from "next";
import Link from "next/link";

import { EmailAuthForm } from "@/components/auth/email-auth-form";

export const metadata: Metadata = { title: "Create account" };

export default async function SubCreatorSignupPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const stored = decodeURIComponent(code).trim().slice(0, 32);
  const agentCode = /^[A-Za-z0-9_-]+$/.test(stored) ? stored : "";

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-extrabold text-zinc-950">Create account</h2>
        <p className="mt-1 text-sm text-zinc-500">
          {agentCode ? `Signup code ${agentCode} is stored.` : "Create your player account."}
        </p>
      </div>
      <EmailAuthForm mode="register" redirect="/" agentCode={agentCode || null} />
      <p className="text-center text-sm text-zinc-500">
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-rose-600 hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
