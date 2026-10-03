"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts";

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

const TIER_COLORS: Record<string, string> = {
  Silver: "#C7CCD6",
  Gold: "#F5C542",
  Platinum: "#9AE6E0",
  Diamond: "#22D3EE",
  Elite: "#8B5CF6",
};

export function SignupsAreaChart({
  data,
}: {
  data: { date: string; signups: number }[];
}) {
  const config = {
    signups: { label: "New members", color: "var(--ws-cyan)" },
  } satisfies ChartConfig;

  return (
    <ChartContainer config={config} className="h-64 w-full">
      <AreaChart data={data} margin={{ left: 4, right: 4, top: 8 }}>
        <defs>
          <linearGradient id="fillSignups" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--ws-cyan)" stopOpacity={0.4} />
            <stop offset="100%" stopColor="var(--ws-cyan)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.06)" />
        <XAxis
          dataKey="date"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          minTickGap={24}
          stroke="var(--ws-text-faint)"
          fontSize={11}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={32}
          stroke="var(--ws-text-faint)"
          fontSize={11}
          allowDecimals={false}
        />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Area
          dataKey="signups"
          type="monotone"
          stroke="var(--ws-cyan)"
          strokeWidth={2}
          fill="url(#fillSignups)"
        />
      </AreaChart>
    </ChartContainer>
  );
}

export function CoinsBarChart({
  data,
}: {
  data: { date: string; coins: number }[];
}) {
  const config = {
    coins: { label: "Coins issued", color: "var(--ws-gold)" },
  } satisfies ChartConfig;

  return (
    <ChartContainer config={config} className="h-64 w-full">
      <BarChart data={data} margin={{ left: 4, right: 4, top: 8 }}>
        <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.06)" />
        <XAxis
          dataKey="date"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          minTickGap={24}
          stroke="var(--ws-text-faint)"
          fontSize={11}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={44}
          stroke="var(--ws-text-faint)"
          fontSize={11}
        />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Bar dataKey="coins" fill="var(--ws-gold)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ChartContainer>
  );
}

export function TierPieChart({
  data,
}: {
  data: { tier: string; members: number }[];
}) {
  const config = Object.fromEntries(
    data.map((d) => [d.tier, { label: d.tier, color: TIER_COLORS[d.tier] ?? "#888" }])
  ) satisfies ChartConfig;

  return (
    <ChartContainer config={config} className="mx-auto aspect-square h-64">
      <PieChart>
        <ChartTooltip content={<ChartTooltipContent nameKey="tier" />} />
        <Pie data={data} dataKey="members" nameKey="tier" innerRadius={56} strokeWidth={2}>
          {data.map((d) => (
            <Cell
              key={d.tier}
              fill={TIER_COLORS[d.tier] ?? "#888"}
              stroke="var(--ws-surface)"
            />
          ))}
        </Pie>
      </PieChart>
    </ChartContainer>
  );
}
