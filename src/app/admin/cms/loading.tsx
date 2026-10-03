export default function CmsLoading() {
  return (
    <div className="mx-auto max-w-5xl animate-pulse space-y-6">
      <div className="h-10 w-64 rounded-lg bg-white/[0.06]" />
      <div className="h-4 w-full max-w-md rounded bg-white/[0.04]" />
      <div className="h-10 w-full max-w-xl rounded-full bg-white/[0.04]" />
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-20 rounded-xl bg-white/[0.04]" />
        ))}
      </div>
    </div>
  );
}
