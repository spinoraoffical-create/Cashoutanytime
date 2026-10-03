export default function AdminDepositsLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-10 w-64 rounded-lg bg-white/[0.06]" />
      <div className="h-4 w-80 max-w-full rounded bg-white/[0.04]" />
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-32 rounded-xl bg-white/[0.04]" />
        ))}
      </div>
    </div>
  );
}
