"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

const TABS = [
  { key: "faq", label: "FAQ" },
  { key: "banners", label: "Banners" },
  { key: "announcements", label: "Announcements" },
  { key: "testimonials", label: "Testimonials" },
  { key: "blog", label: "Blog" },
] as const;

export function CmsTabNav({ active }: { active: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function go(tab: string) {
    if (tab === active) return;
    startTransition(() => {
      router.push(`/admin/cms?tab=${tab}`);
    });
  }

  return (
    <div className="mb-6 flex flex-wrap items-center gap-2">
      <div
        role="tablist"
        aria-label="CMS section"
        className={cn(
          "inline-flex max-w-full flex-wrap gap-1 rounded-full border border-white/10 bg-[#0c1224] p-1 transition-opacity",
          pending && "opacity-70"
        )}
      >
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={t.key === active}
            disabled={pending}
            onClick={() => go(t.key)}
            className={cn(
              "min-h-9 rounded-full px-3 py-1.5 text-sm font-medium transition-colors sm:px-4",
              t.key === active
                ? "bg-gradient-to-r from-[#6d28d9] to-[#2563eb] text-white"
                : "text-[#9fb0d0] hover:text-white"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      {pending ? <Loader2 className="size-4 animate-spin text-muted-foreground" aria-hidden /> : null}
    </div>
  );
}
