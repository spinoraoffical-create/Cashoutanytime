export default function AdminTransactionsLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-10 w-64 rounded-lg bg-white/[0.06]" />
      <div className="h-4 w-full max-w-2xl rounded bg-white/[0.04]" />
      <div className="h-10 max-w-md rounded-lg bg-white/[0.05]" />
      <div className="flex gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-8 w-28 rounded-md bg-white/[0.05]" />
        ))}
      </div>
      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-28 rounded-xl bg-white/[0.04]" />
        ))}
      </div>
    </div>
  );
}
