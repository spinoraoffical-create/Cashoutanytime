"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, UserCheck } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  assignTicketToMeAction,
  setTicketStatusAction,
} from "@/lib/actions/admin/support";
import type { TicketStatus } from "@/lib/database.types";

const STATUS_OPTIONS: { value: TicketStatus; label: string }[] = [
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In progress" },
  { value: "pending", label: "Pending member" },
  { value: "resolved", label: "Resolved" },
  { value: "closed", label: "Closed" },
];

export function StaffTicketActions({
  ticketId,
  status,
  assigned,
}: {
  ticketId: string;
  status: TicketStatus;
  assigned: boolean;
}) {
  const router = useRouter();
  const [updating, startUpdate] = React.useTransition();

  function changeStatus(next: TicketStatus) {
    startUpdate(async () => {
      const result = await setTicketStatusAction({ ticketId, status: next });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(result.message ?? "Updated");
      router.refresh();
    });
  }

  function assign() {
    startUpdate(async () => {
      const result = await assignTicketToMeAction(ticketId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(result.message ?? "Assigned");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Select
        value={status}
        onValueChange={(v) => changeStatus(v as TicketStatus)}
      >
        <SelectTrigger className="w-44" disabled={updating}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {STATUS_OPTIONS.map((s) => (
            <SelectItem key={s.value} value={s.value}>
              {s.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {!assigned && (
        <Button
          variant="outline"
          size="sm"
          onClick={assign}
          disabled={updating}
        >
          {updating ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <UserCheck className="size-4" aria-hidden />
          )}
          Assign to me
        </Button>
      )}
    </div>
  );
}
