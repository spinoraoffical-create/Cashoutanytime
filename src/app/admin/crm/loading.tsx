export default function CrmLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 rounded-xl bg-white/[0.04]" />
        ))}
      </div>
      <div className="h-10 w-full max-w-xl rounded-full bg-white/[0.04]" />
      <div className="h-96 rounded-xl bg-white/[0.04]" />
    </div>
  );
}
