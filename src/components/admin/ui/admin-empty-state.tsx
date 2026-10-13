export function AdminEmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-xl border border-dashed border-white/15 px-4 py-8 text-center">
      <p className="text-sm font-semibold text-white">{title}</p>
      <p className="mt-1 text-sm text-[#9fb0d0]">{body}</p>
    </div>
  );
}
