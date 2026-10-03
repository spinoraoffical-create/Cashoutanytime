import type { ReactNode } from "react";

/** Responsive row for admin CMS/geo-style lists — stacks on mobile. */
export function AdminListRow({
  children,
  actions,
}: {
  children: ReactNode;
  actions: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
      <div className="min-w-0 flex-1">{children}</div>
      <div className="flex shrink-0 flex-wrap items-center gap-1">{actions}</div>
    </div>
  );
}
