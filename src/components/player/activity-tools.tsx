"use client";

import { useRouter } from "next/navigation";
import { Download } from "lucide-react";

export function ActivityCsvButton({
  rows,
}: {
  rows: { created_at: string; source: string; transaction_type: string; amount: number; description: string | null }[];
}) {
  function download() {
    const header = "date,type,source,amount,description\n";
    const body = rows
      .map((row) =>
        [
          row.created_at,
          row.transaction_type,
          row.source,
          row.amount,
          `"${(row.description ?? "").replace(/"/g, '""')}"`,
        ].join(",")
      )
      .join("\n");
    const blob = new Blob([header + body], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "activity.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <button
      type="button"
      onClick={download}
      className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/8 px-3 py-1.5 text-sm font-semibold"
    >
      <Download className="h-3.5 w-3.5" /> CSV
    </button>
  );
}

export function ActivityRangeSelect({ range, filter }: { range: string; filter: string }) {
  const router = useRouter();

  return (
    <select
      aria-label="Activity date range"
      value={range}
      onChange={(event) => {
        const params = new URLSearchParams();
        if (filter !== "all") params.set("filter", filter);
        if (event.target.value !== "all") params.set("range", event.target.value);
        const query = params.toString();
        router.push(query ? `/dashboard/activity?${query}` : "/dashboard/activity");
      }}
      className="rounded-full border border-white/10 bg-[#1a1730] px-3 py-1.5 text-sm font-semibold"
    >
      <option value="all">All time</option>
      <option value="7">Last 7 days</option>
      <option value="30">Last 30 days</option>
      <option value="90">Last 90 days</option>
    </select>
  );
}
