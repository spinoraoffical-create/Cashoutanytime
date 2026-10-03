import { createClient } from "@/lib/supabase/client";

/** Sign out everywhere and hard-redirect so cookies and UI fully reset. */
export async function logoutUser(redirectTo = "/"): Promise<{ error?: string }> {
  const supabase = createClient();
  if (supabase) {
    const { error } = await supabase.auth.signOut({ scope: "global" });
    if (error) return { error: error.message };
  }

  window.location.href = redirectTo;
  return {};
}