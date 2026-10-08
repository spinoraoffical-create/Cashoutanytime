"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { updateDepositStatus } from "@/lib/actions/deposits";
import type { RequestStatus } from "@/types/database";
import { toast } from "sonner";

interface DepositActionsProps {
  depositId: string;
  currentStatus: RequestStatus;
  amount: number | null;
}

export function DepositActions({ depositId, currentStatus }: DepositActionsProps) {
  const [adminNotes, setAdminNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleStatus(status: RequestStatus) {
    setLoading(true);
    const result = await updateDepositStatus(depositId, status, adminNotes || undefined);
    setLoading(false);
    if (result.error) toast.error(result.error);
    else toast.success(`Deposit ${status}`);
    router.refresh();
  }

  if (currentStatus === "completed" || currentStatus === "rejected") {
    return null;
  }

  return (
    <div className="flex flex-col gap-2 min-w-[200px]">
      <Input
        placeholder="Admin notes (optional)"
        value={adminNotes}
        onChange={(e) => setAdminNotes(e.target.value)}
      />
      <div className="flex flex-wrap gap-2">
        {currentStatus === "pending" && (
          <Button size="sm" variant="outline" onClick={() => handleStatus("processing")} disabled={loading}>
            Processing
          </Button>
        )}
        <Button size="sm" variant="destructive" onClick={() => handleStatus("rejected")} disabled={loading}>
          Reject
        </Button>
      </div>
    </div>
  );
}
