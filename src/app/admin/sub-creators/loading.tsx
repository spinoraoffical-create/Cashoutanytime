export default function StoreDirectoryLoading() {
  return (
    <div className="mx-auto max-w-7xl animate-pulse space-y-4">
      <div className="h-10 w-72 rounded-lg bg-white/10" />
      <div className="h-4 w-full max-w-2xl rounded bg-white/5" />
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="h-24 rounded-2xl bg-white/5" />
        <div className="h-24 rounded-2xl bg-white/5" />
        <div className="h-24 rounded-2xl bg-white/5" />
      </div>
      <div className="h-80 rounded-2xl bg-white/5" />
    </div>
  );
}
