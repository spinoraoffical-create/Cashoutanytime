"use client";

import { useState } from "react";
import { logoutUser } from "@/lib/auth/logout";
import { toast } from "sonner";

export function SignOutButton() {
  const [busy, setBusy] = useState(false);

  async function onClick() {
    setBusy(true);
    const result = await logoutUser("/");
    if (result.error) {
      toast.error(result.error);
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={() => void onClick()}
      disabled={busy}
      className="w-full rounded-2xl border border-white/10 bg-white/5 py-3 text-sm font-semibold text-muted-foreground hover:text-foreground"
    >
      {busy ? "Signing out…" : "Sign out"}
    </button>
  );
}
