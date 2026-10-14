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
    <div className="relative h-full overflow-hidden rounded-2xl border border-[#7c3aed]/35 bg-gradient-to-br from-[#1b1644] via-[#141b38] to-[#0c1228] p-5 shadow-[0_18px_40px_rgba(76,29,149,0.22)]">
      <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-[#7c3aed] via-[#2563eb] to-[#22d3ee]" />
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#b7c3e4]">{label}</p>
      <p className="mt-3 text-3xl font-semibold tabular-nums tracking-tight text-white">{value}</p>
      {hint ? <p className="mt-2 text-xs leading-5 text-[#8ea0c3]">{hint}</p> : null}
    </div>
  );
  if (!href) return body;
  return (
    <Link href={href} className="block rounded-2xl motion-safe:transition-transform motion-safe:hover:-translate-y-0.5" title={hint}>
      {body}
    </Link>
  );
}
