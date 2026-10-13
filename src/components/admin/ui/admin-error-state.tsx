export function AdminErrorState({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-4">
      <p className="text-sm font-semibold text-rose-100">{title}</p>
      <p className="mt-1 text-sm text-rose-100/80">{body}</p>
    </div>
  );
}
