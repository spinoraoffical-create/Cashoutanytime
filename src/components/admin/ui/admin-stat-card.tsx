import Link from "next/link";

export function AdminStatCard({
  label,
  value,
  hint,
  href,
}: {
  label: string;
  value: string;
  hint?: string;
  href?: string;
}) {
  const body = (
    <div className="h-full rounded-2xl border border-cyan-400/15 bg-[#10182e]/90 p-4 shadow-[0_0_24px_rgba(34,211,238,0.06)]">
      <p className="text-xs font-medium uppercase tracking-wide text-[#9fb0d0]">{label}</p>
      <p className="mt-2 text-3xl font-semibold tabular-nums text-white">{value}</p>
      {hint ? <p className="mt-2 text-xs leading-5 text-[#8ea0c3]">{hint}</p> : null}
    </div>
  );
  if (!href) return body;
  return (
    <Link href={href} className="block transition-transform hover:-translate-y-0.5" title={hint}>
      {body}
    </Link>
  );
}
