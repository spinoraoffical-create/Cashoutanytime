import * as React from "react";

import { cn } from "@/lib/utils";

/** Empty state — icon + explanation + action per MASTER.md §6. */
export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "glass flex flex-col items-center gap-3 rounded-2xl px-8 py-12 text-center",
        className
      )}
    >
      <span className="text-muted-foreground [&_svg]:size-10 [&_svg]:stroke-[1.5]">
        {icon}
      </span>
      <p className="font-[family-name:var(--font-display)] text-lg font-bold">
        {title}
      </p>
      {description && (
        <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
