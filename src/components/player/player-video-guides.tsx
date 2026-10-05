"use client";

import { Play } from "lucide-react";
import { PLAYER_VIDEO_GUIDES } from "@/lib/player-video-guides";

export function PlayerVideoGuides() {
  return (
    <div className="space-y-2">
      <p className="px-1 text-xs font-semibold uppercase tracking-wider text-zinc-400">Video help</p>
      {PLAYER_VIDEO_GUIDES.map((guide) => (
        <a
          key={guide.id}
          href={guide.url}
          target="_blank"
          rel="noopener noreferrer"
          className="hub-card flex items-center justify-between rounded-2xl px-4 py-3"
        >
          <span className="flex items-center gap-2 font-medium">
            <Play className="h-4 w-4 text-primary" /> {guide.title}
          </span>
          <span className="text-xs text-zinc-500">Watch</span>
        </a>
      ))}
    </div>
  );
}
