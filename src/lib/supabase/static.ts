import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/database.types";
import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/supabase/env";

/**
 * Cookie-free anon client for PUBLIC published content (marketing pages).
 * Never carries a user session, so pages using it can be statically
 * rendered / ISR'd. RLS public-read policies are the security boundary.
 */
export function createStaticClient() {
  return createSupabaseClient<Database>(getSupabaseUrl(), getSupabaseAnonKey(), {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
