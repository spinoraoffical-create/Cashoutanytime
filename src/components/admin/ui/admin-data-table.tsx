import type { ReactNode } from "react";

import { AdminEmptyState } from "@/components/admin/ui/admin-empty-state";

export function AdminDataTable({
  columns,
  rows,
  emptyTitle,
  emptyBody,
}: {
  columns: { key: string; label: string; align?: "left" | "right" }[];
  rows: Record<string, ReactNode>[];
  emptyTitle: string;
  emptyBody: string;
}) {
  if (rows.length === 0) return <AdminEmptyState title={emptyTitle} body={emptyBody} />;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[32rem] text-left text-sm">
        <thead>
          <tr className="border-b border-white/10 text-xs uppercase tracking-wide text-[#8ea0c3]">
            {columns.map((column) => (
              <th key={column.key} className={column.align === "right" ? "px-2 py-2 text-right font-medium" : "px-2 py-2 font-medium"}>
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index} className="border-b border-white/5 last:border-0">
              {columns.map((column) => (
                <td key={column.key} className={column.align === "right" ? "px-2 py-3 text-right text-[#e8eefc]" : "px-2 py-3 text-[#e8eefc]"}>
                  {row[column.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
