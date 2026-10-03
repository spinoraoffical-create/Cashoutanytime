"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { updateUserRole, suspendUser } from "@/lib/actions/admin";
import { toast } from "sonner";

interface UserActionsProps {
  userId: string;
  role: string;
  isSuspended: boolean;
}

export function UserActions({ userId, role, isSuspended }: UserActionsProps) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleRoleToggle() {
    setLoading(true);
    const newRole = role === "admin" ? "user" : "admin";
    const result = await updateUserRole(userId, newRole);
    if (result.error) toast.error(result.error);
    else toast.success(`Role updated to ${newRole}`);
    router.refresh();
    setLoading(false);
  }

  async function handleSuspend() {
    setLoading(true);
    const result = await suspendUser(userId, !isSuspended);
    if (result.error) toast.error(result.error);
    else toast.success(isSuspended ? "User unsuspended" : "User suspended");
    router.refresh();
    setLoading(false);
  }

  return (
    <div className="flex gap-2">
      <Button size="sm" variant="outline" onClick={handleRoleToggle} disabled={loading}>
        {role === "admin" ? "Remove Admin" : "Make Admin"}
      </Button>
      <Button size="sm" variant={isSuspended ? "default" : "destructive"} onClick={handleSuspend} disabled={loading}>
        {isSuspended ? "Unsuspend" : "Suspend"}
      </Button>
    </div>
  );
}
