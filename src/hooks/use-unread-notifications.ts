"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function useUnreadNotifications() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const supabase = createClient();
    if (!supabase) return;
    let cancelled = false;
    void supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user || cancelled) return;
      const { count: unread, error } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", data.user.id)
        .eq("is_read", false);
      if (!cancelled && !error && typeof unread === "number") setCount(unread);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return { count };
}
