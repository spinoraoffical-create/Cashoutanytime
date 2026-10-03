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

export function DepositActions({ depositId, currentStatus, amount }: DepositActionsProps) {
  const [adminNotes, setAdminNotes] = useState("");
  const [creditAmount, setCreditAmount] = useState(
    amount != null && amount > 0 ? String(amount) : ""
  );
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleStatus(status: RequestStatus) {
    if (status === "completed") {
      const parsed = parseFloat(creditAmount);
      if (!parsed || parsed <= 0 || Number.isNaN(parsed)) {
        toast.error("Enter the deposit amount to credit their Total Deposit wallet.");
        return;
      }
    }

    setLoading(true);
    const parsedAmount =
      status === "completed" ? Math.round(parseFloat(creditAmount) * 100) / 100 : undefined;
    const result = await updateDepositStatus(
      depositId,
      status,
      adminNotes || undefined,
      parsedAmount
    );
    setLoading(false);
    if (result.error) toast.error(result.error);
    else if (status === "completed") toast.success(`Credited $${parsedAmount!.toFixed(2)} to Total Deposit`);
    else toast.success(`Deposit ${status}`);
    router.refresh();
  }

  if (currentStatus === "completed" || currentStatus === "rejected") {
    return null;
  }

  return (
    <div className="flex flex-col gap-2 min-w-[200px]">
      <Input
        type="number"
        min="0.01"
        step="0.01"
        placeholder="Amount to credit ($)"
        value={creditAmount}
        onChange={(e) => setCreditAmount(e.target.value)}
      />
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
        <Button size="sm" onClick={() => handleStatus("completed")} disabled={loading}>
          Confirm & credit
        </Button>
        <Button size="sm" variant="destructive" onClick={() => handleStatus("rejected")} disabled={loading}>
          Reject
        </Button>
      </div>
    </div>
  );
}
