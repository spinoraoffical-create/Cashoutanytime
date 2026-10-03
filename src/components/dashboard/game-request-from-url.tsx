"use client";

import { useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createGameRequestBySlug } from "@/lib/actions/game-requests";
import { toast } from "sonner";

/** Auto-creates a game request when user lands from login after clicking a game card */
export function GameRequestFromUrl() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const gameSlug = searchParams.get("game");
  const started = useRef(false);

  useEffect(() => {
    if (!gameSlug || started.current) return;
    started.current = true;

    createGameRequestBySlug(gameSlug).then((result) => {
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(`Request submitted for ${result.gameName ?? "your game"}!`);
      }
      router.replace("/dashboard/requests");
    });
  }, [gameSlug, router]);

  return null;
}
