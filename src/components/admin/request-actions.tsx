"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { updateRequestStatus } from "@/lib/actions/game-requests";
import { toast } from "sonner";
import type { RequestStatus } from "@/types/database";

interface RequestActionsProps {
  requestId: string;
  currentStatus: RequestStatus;
}

export function RequestActions({ requestId, currentStatus }: RequestActionsProps) {
  const [credentials, setCredentials] = useState("");
  const [adminNotes, setAdminNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [showComplete, setShowComplete] = useState(false);
  const router = useRouter();

  async function handleStatus(status: RequestStatus) {
    if (status === "completed" && !showComplete) {
      setShowComplete(true);
      return;
    }

    setLoading(true);
    const result = await updateRequestStatus(
      requestId,
      status,
      adminNotes || undefined,
      status === "completed" ? credentials : undefined
    );

    if (result.error) toast.error(result.error);
    else toast.success(`Request ${status}`);
    setShowComplete(false);
    router.refresh();
    setLoading(false);
  }

  if (currentStatus === "completed" || currentStatus === "rejected") {
    return <Badge status={currentStatus} />;
  }

  return (
    <div className="flex flex-col gap-2 min-w-[200px]">
      {showComplete && (
        <>
          <Input
            placeholder="Credentials (username:pass)"
            value={credentials}
            onChange={(e) => setCredentials(e.target.value)}
          />
          <Input
            placeholder="Admin notes (optional)"
            value={adminNotes}
            onChange={(e) => setAdminNotes(e.target.value)}
          />
        </>
      )}
      <div className="flex flex-wrap gap-2">
        {currentStatus === "pending" && (
          <Button size="sm" variant="outline" onClick={() => handleStatus("processing")} disabled={loading}>
            Process
          </Button>
        )}
        <Button size="sm" onClick={() => handleStatus("completed")} disabled={loading}>
          Complete
        </Button>
        <Button size="sm" variant="destructive" onClick={() => handleStatus("rejected")} disabled={loading}>
          Reject
        </Button>
      </div>
    </div>
  );
}

function Badge({ status }: { status: string }) {
  return (
    <span className="text-sm text-muted-foreground capitalize">Status: {status}</span>
  );
}
