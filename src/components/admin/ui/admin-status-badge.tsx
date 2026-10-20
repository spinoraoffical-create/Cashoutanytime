import { cn } from "@/lib/utils";

const TONE: Record<string, string> = {
  completed: "bg-emerald-400/15 text-emerald-200",
  paid: "bg-emerald-400/15 text-emerald-200",
  approved: "bg-emerald-400/15 text-emerald-200",
  verified: "bg-emerald-400/15 text-emerald-200",
  ok: "bg-emerald-400/15 text-emerald-200",
  pending: "bg-amber-300/15 text-amber-100",
  requested: "bg-amber-300/15 text-amber-100",
  reserved: "bg-amber-300/15 text-amber-100",
  "manual review": "bg-violet-400/15 text-violet-100",
  submitted: "bg-sky-400/15 text-sky-100",
  processing: "bg-sky-400/15 text-sky-100",
  failed: "bg-rose-400/15 text-rose-100",
  rejected: "bg-rose-400/15 text-rose-100",
  held: "bg-violet-400/15 text-violet-100",
  active: "bg-emerald-400/15 text-emerald-200",
  open: "bg-emerald-400/15 text-emerald-200",
  contacted: "bg-sky-400/15 text-sky-100",
  fulfilled: "bg-emerald-400/15 text-emerald-200",
  suspended: "bg-rose-400/15 text-rose-100",
  blocked: "bg-rose-400/15 text-rose-100",
  "freeplay blocked": "bg-rose-400/15 text-rose-100",
  hidden: "bg-white/10 text-[#d5def2]",
  inactive: "bg-white/10 text-[#d5def2]",
  live: "bg-emerald-400/15 text-emerald-200",
  featured: "bg-violet-400/15 text-violet-100",
  banned: "bg-rose-400/15 text-rose-100",
  resolved: "bg-white/10 text-[#d5def2]",
  closed: "bg-white/10 text-[#d5def2]",
  cancelled: "bg-white/10 text-[#d5def2]",
  draft: "bg-white/10 text-[#d5def2]",
  scheduled: "bg-sky-400/15 text-sky-100",
  sending: "bg-sky-400/15 text-sky-100",
  sent: "bg-emerald-400/15 text-emerald-200",
  skipped: "bg-amber-300/15 text-amber-100",
  "not sent": "bg-rose-400/15 text-rose-100",
  published: "bg-emerald-400/15 text-emerald-200",
  expired: "bg-white/10 text-[#d5def2]",
  archived: "bg-white/10 text-[#d5def2]",
  off: "bg-white/10 text-[#d5def2]",
  "not scheduled": "bg-amber-300/15 text-amber-100",
  unknown: "bg-white/10 text-[#d5def2]",
  stale: "bg-amber-300/15 text-amber-100",
  "in progress": "bg-sky-400/15 text-sky-100",
  "not on file": "bg-white/10 text-[#d5def2]",
};

export function AdminStatusBadge({ status }: { status: string }) {
  const key = status.toLowerCase();
  return (
    <span className={cn("inline-flex rounded-full px-2.5 py-1 text-xs font-semibold capitalize", TONE[key] ?? "bg-white/10 text-[#d5def2]")}>
      {status}
    </span>
  );
}
