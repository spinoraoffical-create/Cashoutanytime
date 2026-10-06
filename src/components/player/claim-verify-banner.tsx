import Link from "next/link";
import { Check } from "lucide-react";

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
      className="hub-card flex items-center gap-3 rounded-[22px] px-4 py-3.5 text-white"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400">
        <Check className="h-4 w-4" strokeWidth={2.6} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-extrabold leading-snug">{title}</p>
        {body ? <p className="mt-0.5 text-xs leading-snug text-zinc-400">{body}</p> : null}
      </div>
      <span className="shrink-0 rounded-full bg-white px-4 py-2 text-xs font-bold text-zinc-950">
        {cta} →
      </span>
    </Link>
  );
}
