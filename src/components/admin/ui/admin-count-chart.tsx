export function AdminCountChart({
  title,
  caption,
  points,
}: {
  title: string;
  caption: string;
  points: { label: string; value: number | null }[];
}) {
  const known = points.filter((point) => point.value != null).map((point) => point.value as number);
  const max = known.length ? Math.max(...known, 1) : 0;
  return (
    <div>
      <p className="text-sm font-semibold text-white">{title}</p>
      <p className="mt-1 text-xs leading-5 text-[#9fb0d0]">{caption}</p>
      <div className="mt-4 grid grid-cols-3 gap-3">
        {points.map((point) => (
          <div key={point.label}>
            <div className="flex h-28 items-end rounded-xl bg-[#0b1224] p-2">
              {point.value == null ? (
                <p className="w-full text-center text-xs text-[#8ea0c3]">Unavailable</p>
              ) : (
                <div
                  className="w-full rounded-lg bg-gradient-to-t from-[#2563eb] to-[#22d3ee] shadow-[0_0_16px_rgba(34,211,238,0.35)]"
                  style={{ height: `${Math.max(8, (point.value / max) * 100)}%` }}
                  title={`${point.label}: ${point.value.toLocaleString()}`}
                />
              )}
            </div>
            <p className="mt-2 text-xs text-[#9fb0d0]">{point.label}</p>
            <p className="text-sm font-semibold tabular-nums text-white">
              {point.value == null ? "Unavailable" : point.value.toLocaleString()}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
