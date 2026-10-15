export default function SecurityLoading() {
  return (
    <div className="mx-auto max-w-6xl animate-pulse space-y-4">
      <div className="h-10 w-64 rounded-lg bg-white/10" />
      <div className="h-4 w-full max-w-xl rounded bg-white/5" />
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="h-24 rounded-2xl bg-white/5" />
        <div className="h-24 rounded-2xl bg-white/5" />
      </div>
    </div>
  );
}
