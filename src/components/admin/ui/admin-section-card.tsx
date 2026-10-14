import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function AdminSectionCard({
  title,
  description,
  children,
  action,
  className,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-2xl border border-[#7c3aed]/25 bg-gradient-to-br from-[#141432] to-[#0d1428] p-4 shadow-[0_16px_40px_rgba(49,46,129,0.2)] sm:p-5", className)}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-white">{title}</h2>
          {description ? <p className="mt-1 text-sm leading-5 text-[#9fb0d0]">{description}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
