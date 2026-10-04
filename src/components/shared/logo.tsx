import Image from "next/image";
import Link from "next/link";

import { cn } from "@/lib/utils";

const sizes = {
  sm: { mark: 28, text: "text-sm" },
  md: { mark: 36, text: "text-base" },
  lg: { mark: 48, text: "text-xl" },
} as const;

export function Logo({
  size = "md",
  withWordmark = true,
  href = "/",
  className,
}: {
  size?: keyof typeof sizes;
  withWordmark?: boolean;
  href?: string | null;
  className?: string;
}) {
  const s = sizes[size];

  const content = (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <Image
        src="/logo.webp"
        alt={withWordmark ? "" : "Sweepstakes Hub"}
        width={s.mark}
        height={s.mark}
        priority
      />
      {withWordmark && (
        <span className={cn("gradient-text font-extrabold tracking-tight", s.text)}>
          Sweepstakes Hub
        </span>
      )}
    </span>
  );

  if (!href) return content;

  return (
    <Link
      href={href}
      aria-label="Sweepstakes Hub home"
      className="rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {content}
    </Link>
  );
}
