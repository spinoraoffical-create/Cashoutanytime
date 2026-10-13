import Link from "next/link";

export function AdminQuickAction({ href, label, detail }: { href: string; label: string; detail: string }) {
  return (
    <Link
      href={href}
      title={detail}
      className="rounded-2xl border border-white/10 bg-gradient-to-br from-[#1a2450] to-[#12182c] p-4 transition-colors hover:border-cyan-300/40"
    >
      <p className="text-sm font-semibold text-white">{label}</p>
      <p className="mt-1 text-xs leading-5 text-[#9fb0d0]">{detail}</p>
    </Link>
  );
}
