import { Badge } from "@/components/ui/badge";
import { Logo } from "@/components/shared/logo";

/** Instant admin chrome while staff auth resolves — sidebar shows immediately. */
export function AdminLayoutSkeleton() {
  const groups = ["Insights", "People", "Economy", "Content", "Operations"];

  return (
    <div className="relative flex min-h-dvh text-foreground">
      <aside className="glass sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-y-0 border-l-0 lg:flex">
        <div className="flex items-center gap-2 border-b border-border px-5 py-4">
          <Logo size="sm" href="/admin" />
          <Badge className="bg-ws-green/15 text-ws-green-deep uppercase dark:text-ws-green">
            Admin
          </Badge>
        </div>
        <div className="flex-1 space-y-6 overflow-y-auto px-3 py-4 animate-pulse">
          {groups.map((group) => (
            <div key={group}>
              <div className="mx-3 mb-2 h-3 w-16 rounded bg-white/[0.06]" />
              <ul className="space-y-1">
                {Array.from({ length: group === "Operations" ? 8 : 4 }).map((_, i) => (
                  <li key={i} className="mx-1 h-10 rounded-lg bg-white/[0.04]" />
                ))}
              </ul>
            </div>
          ))}
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="glass sticky top-0 z-10 border-x-0 border-t-0">
          <div className="flex h-16 items-center gap-3 px-4 sm:px-6">
            <div className="h-9 w-9 rounded-lg bg-white/[0.06] animate-pulse lg:hidden" />
            <div className="h-4 w-32 rounded bg-white/[0.06] animate-pulse" />
            <div className="ml-auto h-9 w-9 rounded-full bg-white/[0.06] animate-pulse" />
          </div>
        </header>
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <div className="space-y-6 animate-pulse">
            <div className="h-10 w-56 rounded-lg bg-white/[0.06]" />
            <div className="h-4 w-80 max-w-full rounded bg-white/[0.04]" />
            <div className="h-72 rounded-xl bg-white/[0.04]" />
          </div>
        </main>
      </div>
    </div>
  );
}
