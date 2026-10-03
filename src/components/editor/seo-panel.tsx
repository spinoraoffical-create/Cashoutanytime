"use client";

import { useMemo } from "react";
import { CheckCircle2, AlertTriangle, XCircle } from "lucide-react";

import { cn } from "@/lib/utils";
import { extractHeadings } from "@/lib/editor/toc";

export interface SeoPanelProps {
  content: string;
  title: string;
  slug: string;
  seoTitle: string;
  seoDescription: string;
  excerpt: string;
}

type GaugeStatus = "good" | "warn" | "bad";

function gaugeStatus(length: number, min: number, max: number): GaugeStatus {
  if (length === 0) return "bad";
  if (length < min || length > max) return "warn";
  return "good";
}

const STATUS_ICON: Record<GaugeStatus, typeof CheckCircle2> = {
  good: CheckCircle2,
  warn: AlertTriangle,
  bad: XCircle,
};

const STATUS_CLASS: Record<GaugeStatus, string> = {
  good: "text-ws-green-deep dark:text-ws-green",
  warn: "text-amber-600 dark:text-amber-400",
  bad: "text-destructive",
};

function GaugeRow({ label, length, min, max }: { label: string; length: number; min: number; max: number }) {
  const status = gaugeStatus(length, min, max);
  const Icon = STATUS_ICON[status];
  return (
    <div className="flex items-center justify-between gap-2 text-xs">
      <span className="flex items-center gap-1.5 text-muted-foreground">
        <Icon className={cn("size-3.5", STATUS_CLASS[status])} aria-hidden />
        {label}
      </span>
      <span className={cn("font-mono tabular-nums", STATUS_CLASS[status])}>
        {length}/{min}–{max}
      </span>
    </div>
  );
}

function stripMarkdown(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[#>*_`~-]/g, " ");
}

export function SeoPanel({ content, title, slug, seoTitle, seoDescription, excerpt }: SeoPanelProps) {
  const stats = useMemo(() => {
    const stripped = stripMarkdown(content);
    const words = stripped.split(/\s+/).filter(Boolean);
    const wordCount = words.length;
    const readingMinutes = Math.max(1, Math.round(wordCount / 200));
    const headings = extractHeadings(content);
    const h1Count = headings.filter((h) => h.level === 1).length;
    const imagesMissingAlt = (content.match(/!\[\]\(/g) ?? []).length;
    const totalImages = (content.match(/!\[[^\]]*\]\(/g) ?? []).length;
    const slugValid = /^[a-z0-9-]+$/.test(slug);

    const effectiveTitle = seoTitle || title;
    const effectiveDescription = seoDescription || excerpt;

    return {
      wordCount,
      readingMinutes,
      headings,
      h1Count,
      imagesMissingAlt,
      totalImages,
      slugValid,
      effectiveTitle,
      effectiveDescription,
    };
  }, [content, title, slug, seoTitle, seoDescription, excerpt]);

  return (
    <div className="space-y-4 rounded-lg border border-border bg-card p-4">
      <div>
        <h3 className="text-sm font-semibold text-foreground">SEO &amp; readability</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          {stats.wordCount} words · ~{stats.readingMinutes} min read
        </p>
      </div>

      <div className="space-y-1.5">
        <GaugeRow label="Meta title" length={stats.effectiveTitle.length} min={30} max={60} />
        <GaugeRow label="Meta description" length={stats.effectiveDescription.length} min={120} max={160} />
      </div>

      <div className="space-y-1 text-xs text-muted-foreground">
        <div className="flex items-center justify-between">
          <span>Slug</span>
          <span className={cn("font-mono", !stats.slugValid && "text-destructive")}>/blog/{slug || "—"}</span>
        </div>
        <div className="flex items-center justify-between">
          <span>Images ({stats.totalImages})</span>
          {stats.imagesMissingAlt > 0 ? (
            <span className="text-amber-600 dark:text-amber-400">{stats.imagesMissingAlt} missing alt text</span>
          ) : (
            <span className="text-ws-green-deep dark:text-ws-green">alt text OK</span>
          )}
        </div>
        {stats.h1Count > 0 && (
          <div className="flex items-center justify-between">
            <span>Headings</span>
            <span className="text-amber-600 dark:text-amber-400">
              {stats.h1Count} H1 in body (title is already the page H1)
            </span>
          </div>
        )}
      </div>

      {stats.headings.length > 0 && (
        <div>
          <p className="mb-1 text-xs font-medium text-foreground">Outline</p>
          <ul className="space-y-0.5 text-xs text-muted-foreground">
            {stats.headings.map((h) => (
              <li key={h.slug} style={{ paddingLeft: `${(h.level - 1) * 0.75}rem` }} className="truncate">
                {h.text}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
