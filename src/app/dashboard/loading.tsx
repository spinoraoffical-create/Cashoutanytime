export default function DashboardLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-10 w-48 rounded-lg bg-white/[0.06]" />
      <div className="h-4 w-72 max-w-full rounded bg-white/[0.04]" />
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 rounded-xl bg-white/[0.05]" />
        ))}
      </div>
      <div className="h-64 rounded-xl bg-white/[0.04]" />
    </div>
  );
}
