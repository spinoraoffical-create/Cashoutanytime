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
    <section className={cn("rounded-2xl border border-white/10 bg-[#10182e]/80 p-4 shadow-[0_0_30px_rgba(99,102,241,0.08)] sm:p-5", className)}>
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
