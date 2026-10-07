"use client";

import { useEffect } from "react";
import { toast } from "sonner";

export function BreakReminder() {
  useEffect(() => {
    const minutes = Number(localStorage.getItem("hub-break-reminder") || 30);
    if (!Number.isFinite(minutes) || minutes <= 0) return;
    const id = window.setInterval(() => {
      toast("Break check-in", {
        description: `You've been active for about ${minutes} minutes. Take a break, or keep playing.`,
      });
    }, minutes * 60 * 1000);
    return () => window.clearInterval(id);
  }, []);
  return null;
}
