import { cn } from "@/lib/utils";

const TONE: Record<string, string> = {
  completed: "bg-emerald-400/15 text-emerald-200",
  paid: "bg-emerald-400/15 text-emerald-200",
  approved: "bg-emerald-400/15 text-emerald-200",
  verified: "bg-emerald-400/15 text-emerald-200",
  ok: "bg-emerald-400/15 text-emerald-200",
  pending: "bg-amber-300/15 text-amber-100",
  reserved: "bg-amber-300/15 text-amber-100",
  submitted: "bg-sky-400/15 text-sky-100",
  processing: "bg-sky-400/15 text-sky-100",
  failed: "bg-rose-400/15 text-rose-100",
  rejected: "bg-rose-400/15 text-rose-100",
  held: "bg-violet-400/15 text-violet-100",
};

export function AdminStatusBadge({ status }: { status: string }) {
  const key = status.toLowerCase();
  return (
    <span className={cn("inline-flex rounded-full px-2.5 py-1 text-xs font-semibold capitalize", TONE[key] ?? "bg-white/10 text-[#d5def2]")}>
      {status}
    </span>
  );
}
