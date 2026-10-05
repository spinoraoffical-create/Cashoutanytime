import Link from "next/link";
import { ChevronRight } from "lucide-react";

export function ClaimVerifyBanner({
  href,
  title,
  body,
  cta = "Claim now",
}: {
  href: string;
  title: string;
  body?: string;
  cta?: string;
}) {
  return (
    <Link
      href={href}
      className="hub-glass flex items-center gap-3 rounded-2xl border border-emerald-400/30 px-4 py-3 text-white shadow-[0_0_20px_rgba(52,211,153,0.18)]"
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm font-extrabold leading-tight">{title}</p>
        {body ? <p className="mt-0.5 text-xs text-zinc-300">{body}</p> : null}
      </div>
      <span className="shrink-0 rounded-full bg-white px-3 py-1.5 text-xs font-bold text-zinc-900">
        {cta}
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 opacity-80" />
    </Link>
  );
}
