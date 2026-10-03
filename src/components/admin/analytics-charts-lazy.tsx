import dynamic from "next/dynamic";

const ChartSkeleton = () => (
  <div className="h-64 animate-pulse rounded-xl bg-white/[0.04]" aria-hidden />
);

export const CoinsBarChart = dynamic(
  () => import("@/components/admin/analytics-charts").then((m) => m.CoinsBarChart),
  { loading: () => <ChartSkeleton /> }
);

export const SignupsAreaChart = dynamic(
  () => import("@/components/admin/analytics-charts").then((m) => m.SignupsAreaChart),
  { loading: () => <ChartSkeleton /> }
);

export const TierPieChart = dynamic(
  () => import("@/components/admin/analytics-charts").then((m) => m.TierPieChart),
  { loading: () => <ChartSkeleton /> }
);
