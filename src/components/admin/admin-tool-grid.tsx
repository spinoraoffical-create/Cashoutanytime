import Link from "next/link";

import { GlassCard } from "@/components/shared/glass-card";

export function AdminToolGrid({
  tools,
}: {
  tools: { href: string; title: string; body: string }[];
}) {
  if (tools.length === 0) {
    return <p className="text-sm text-muted-foreground">Nothing in this section is assigned to your role.</p>;
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {tools.map((tool) => (
        <Link key={tool.href + tool.title} href={tool.href} className="block h-full">
          <GlassCard className="h-full p-4 transition-colors hover:border-ws-green/40">
            <p className="font-semibold">{tool.title}</p>
            <p className="mt-1 text-sm text-muted-foreground">{tool.body}</p>
          </GlassCard>
        </Link>
      ))}
    </div>
  );
}
