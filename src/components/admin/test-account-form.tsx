"use client";

import { useState } from "react";
import { toast } from "sonner";

import { createTestAccountAction } from "@/lib/actions/admin/test-accounts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function TestAccountForm() {
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);

  async function submit() {
    if (!window.confirm("Create a test login? It cannot deposit, cash out, or receive signup Coins. Phone verification is not used.")) return;
    setPending(true);
    const result = await createTestAccountAction(email);
    setPending(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(result.message ?? "Test login created.");
    setEmail("");
  }

  return (
    <form
      className="mb-4 rounded-2xl border border-white/10 bg-[#0c1224] p-4"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <h2 className="text-sm font-semibold text-white">Owner test login</h2>
      <p className="mt-1 text-xs text-[#9fb0d0]">
        Creates a signed-in test player without a phone number. It does not approve identity checks, and it cannot move money or collect Coins.
      </p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <Input
          type="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="Email for this test only"
          className="border-white/10 bg-[#0b1224] text-white"
          aria-label="Test account email"
        />
        <Button type="submit" disabled={pending} className="bg-[#6d28d9] text-white">
          {pending ? "Creating..." : "Create test login"}
        </Button>
      </div>
    </form>
  );
}
