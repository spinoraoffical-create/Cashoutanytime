import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import {
  getSupabaseAnonKey,
  getSupabaseServiceRoleKey,
  getSupabaseUrl,
  isSupabaseConfigured,
} from "@/lib/supabase/env";

/** Server-only client for auth lookups (never expose to the browser) */
export function createAdminClient(): SupabaseClient | null {
  if (!isSupabaseConfigured()) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[supabase] Admin client unavailable — service role or anon key missing");
    }
    return null;
  }

  const url = getSupabaseUrl();
  const key = getSupabaseServiceRoleKey() ?? getSupabaseAnonKey();

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
