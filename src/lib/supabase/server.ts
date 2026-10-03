import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";

import { getSupabaseAnonKey, getSupabaseUrl, isSupabaseConfigured } from "@/lib/supabase/env";

export async function createClient(): Promise<SupabaseClient> {
  const cookieStore = await cookies();

  return createServerClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // Server Component — ignore
        }
      },
    },
  });
}

/** Safe guard for pages that must not crash when Supabase is unconfigured. */
export function assertSupabaseConfigured(): boolean {
  if (!isSupabaseConfigured() && process.env.NODE_ENV === "development") {
    console.warn(
      "[supabase] NEXT_PUBLIC_SUPABASE_URL / ANON_KEY missing — database features disabled"
    );
  }
  return isSupabaseConfigured();
}
