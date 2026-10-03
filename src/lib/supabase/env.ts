/** Shared Supabase env resolution — safe for build, middleware, and server components. */

const PLACEHOLDER_URL = "https://unconfigured.supabase.co";
const PLACEHOLDER_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVuY29uZmlndXJlZCIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNjAwMDAwMDAwfQ.unconfigured";

export function getSupabaseUrl(): string {
  return process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || PLACEHOLDER_URL;
}

export function getSupabaseAnonKey(): string {
  return process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() || PLACEHOLDER_ANON_KEY;
}

export function getSupabaseServiceRoleKey(): string | undefined {
  return (
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
    undefined
  );
}

/** True when real project credentials are present (not build placeholders). */
export function isSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  return Boolean(url && key && !url.includes("unconfigured"));
}
