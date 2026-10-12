import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

import { getSupabaseAnonKey, getSupabaseUrl, isSupabaseConfigured } from "@/lib/supabase/env";

let client: SupabaseClient | null = null;

export function createClient(): SupabaseClient | null {
  if (!isSupabaseConfigured()) {
    if (typeof window !== "undefined") {
      console.warn("[supabase] Env vars missing — auth and realtime disabled");
    }
    return null;
  }

  if (!client) {
    const domain =
      typeof window !== "undefined" && window.location.hostname.endsWith("sweeptakehub.com")
        ? ".sweeptakehub.com"
        : undefined;
    client = createBrowserClient(
      getSupabaseUrl(),
      getSupabaseAnonKey(),
      domain ? { cookieOptions: { domain } } : undefined
    );
  }

  return client;
}
