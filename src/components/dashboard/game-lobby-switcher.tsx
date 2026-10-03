"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { Zap, Gamepad2, Loader2 } from "lucide-react";

import { QuickLoadModal } from "@/components/games/quick-load-modal";
import type { ActiveJob } from "@/lib/data/dashboard";

export type LobbyPlatform = {
  slug: string;
  name: string;
  image: string;
  tagline: string;
  linked: boolean;
  username?: string;
  pending?: boolean;
};

type Props = {
  platforms: LobbyPlatform[];
  activeJobs: Record<string, ActiveJob>;
};

function statusForPlatform(
  platform: LobbyPlatform,
  job?: ActiveJob
): { label: string; tone: "live" | "busy" | "offline" | "setup" } {
  if (job && (job.status === "pending" || job.status === "processing")) {
    const verb =
      job.loadType === "redeem"
        ? "Redeeming"
        : job.loadType === "create_account" || job.loadType === "new_account"
          ? "Creating"
          : "Loading";
    return { label: `${verb}…`, tone: "busy" };
  }
  if (platform.pending) return { label: "Setting up", tone: "setup" };
  if (platform.linked) return { label: "Live", tone: "live" };
  return { label: "Ready", tone: "offline" };
}

const TONE_CLASSES = {
  live: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/35 shadow-[0_0_12px_rgba(16,185,129,0.2)]",
  busy: "bg-amber-500/15 text-amber-300 ring-amber-500/35 animate-pulse",
  setup: "bg-sky-500/15 text-sky-300 ring-sky-500/35",
  offline: "bg-white/5 text-muted-foreground ring-white/10",
};

export function GameLobbySwitcher({ platforms, activeJobs }: Props) {
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-emerald-400/90">Game platforms</p>
          <h2 className="text-xl font-bold text-foreground">Instant load hub</h2>
        </div>
        <Link
          href="/dashboard/games"
          className="text-xs font-semibold text-emerald-400 underline-offset-4 hover:underline"
        >
          Manage all games →
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {platforms.map((platform, i) => {
          const job = activeJobs[platform.slug];
          const status = statusForPlatform(platform, job);
          const href = `/games/${platform.slug}`;

          return (
            <motion.article
              key={platform.slug}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05, duration: 0.3 }}
              className="hub-card group relative overflow-hidden rounded-2xl p-4 transition-all hover:border-emerald-500/30 hover:shadow-[0_0_24px_rgba(16,185,129,0.12)]"
            >
              <div className="pointer-events-none absolute -right-6 -top-6 size-24 rounded-full bg-emerald-500/5 blur-2xl transition-opacity group-hover:opacity-100 opacity-0" />

              <div className="flex gap-3">
                <div className="relative size-14 shrink-0 overflow-hidden rounded-xl ring-1 ring-white/10">
                  <Image
                    src={platform.image}
                    alt={platform.name}
                    fill
                    className="object-cover"
                    sizes="56px"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="truncate font-bold text-foreground">{platform.name}</h3>
                    <span
                      className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ${TONE_CLASSES[status.tone]}`}
                    >
                      {status.tone === "busy" && <Loader2 className="size-2.5 animate-spin" />}
                      {status.tone === "live" && (
                        <span className="size-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_#10B981]" />
                      )}
                      {status.label}
                    </span>
                  </div>
                  <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{platform.tagline}</p>
                  {platform.username && (
                    <p className="mt-1 truncate font-mono text-[10px] text-emerald-400/80">
                      @{platform.username}
                    </p>
                  )}
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {platform.linked && platform.username ? (
                  <QuickLoadModal
                    gameSlug={platform.slug}
                    gameName={platform.name}
                    gameUsername={platform.username}
                    trigger={
                      <button
                        type="button"
                        className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 px-3 py-2 text-xs font-bold text-white shadow-lg shadow-emerald-500/20 transition hover:brightness-110"
                      >
                        <Zap className="size-3.5" /> Quick Load
                      </button>
                    }
                  />
                ) : (
                  <Link
                    href={href}
                    className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-bold text-emerald-300 transition hover:bg-emerald-500/20"
                  >
                    <Gamepad2 className="size-3.5" /> Create account
                  </Link>
                )}
                <Link
                  href={href}
                  className="inline-flex items-center justify-center rounded-xl border border-white/10 px-3 py-2 text-xs font-semibold text-muted-foreground transition hover:border-white/20 hover:text-foreground"
                >
                  Open
                </Link>
              </div>
            </motion.article>
          );
        })}
      </div>
    </section>
  );
}
