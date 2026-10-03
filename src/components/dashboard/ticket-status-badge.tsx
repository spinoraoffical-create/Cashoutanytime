import { Badge } from "@/components/ui/badge";
import type { TicketPriority, TicketStatus } from "@/lib/database.types";
import { cn } from "@/lib/utils";

const STATUS: Record<TicketStatus, { label: string; className: string }> = {
  open: { label: "Open", className: "bg-ws-cyan/15 text-ws-cyan" },
  pending: { label: "Pending", className: "bg-ws-gold/15 text-ws-gold" },
  in_progress: { label: "In progress", className: "bg-ws-purple/15 text-ws-purple" },
  resolved: { label: "Resolved", className: "bg-ws-emerald/15 text-ws-emerald" },
  closed: { label: "Closed", className: "bg-foreground/8 text-muted-foreground" },
};

const PRIORITY: Record<TicketPriority, { label: string; className: string }> = {
  low: { label: "Low", className: "bg-foreground/8 text-muted-foreground" },
  normal: { label: "Normal", className: "bg-foreground/8 text-muted-foreground" },
  high: { label: "High", className: "bg-ws-gold/15 text-ws-gold" },
  urgent: { label: "Urgent", className: "bg-ws-danger/15 text-ws-danger" },
};

export function TicketStatusBadge({ status }: { status: TicketStatus }) {
  const s = STATUS[status];
  return (
    <Badge className={cn("uppercase tracking-wide", s.className)}>{s.label}</Badge>
  );
}

export function TicketPriorityBadge({ priority }: { priority: TicketPriority }) {
  const p = PRIORITY[priority];
  return (
    <Badge className={cn("uppercase tracking-wide", p.className)}>{p.label}</Badge>
  );
}
