export default function RootLoading() {
  return (
    <div className="min-h-screen bg-[#121212] flex flex-col">
      <div className="h-14 border-b border-white/5 bg-[#121212]/95" />
      <div className="flex-1 max-w-[1600px] w-full mx-auto px-4 sm:px-6 py-6 flex gap-6">
        <div className="hidden lg:block w-64 shrink-0 space-y-3">
          <div className="h-10 rounded-lg bg-white/[0.04] animate-pulse" />
          <div className="h-32 rounded-xl bg-white/[0.04] animate-pulse" />
          <div className="h-8 rounded-lg bg-white/[0.03] animate-pulse" />
          <div className="h-8 rounded-lg bg-white/[0.03] animate-pulse" />
        </div>
        <div className="flex-1 space-y-6">
          <div className="h-[280px] rounded-2xl bg-white/[0.04] animate-pulse" />
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-4">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="aspect-[3/4] rounded-2xl bg-white/[0.04] animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
