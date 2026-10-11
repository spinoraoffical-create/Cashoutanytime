import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

type AuthPhoneUser = {
  id: string;
  phone?: string | null;
  user_metadata?: Record<string, unknown> | null;
};

/** Phone stored on the auth user: the auth phone field, then signup metadata. */
export function phoneOnAuthUser(user: Omit<AuthPhoneUser, "id"> | null | undefined) {
  const direct = user?.phone?.trim();
  if (direct) return direct;
  const meta = user?.user_metadata?.phone;
  return typeof meta === "string" ? meta.trim() : "";
}

/** profiles.phone, then the auth user. A dash only when both are empty. */
export function shownPhone(profilePhone: string | null | undefined, authPhone: string | null | undefined) {
  const profile = profilePhone?.trim();
  if (profile) return profile;
  const auth = authPhone?.trim();
  if (auth) return auth;
  return "—";
}

export async function authPhonesFor(admin: SupabaseClient, ids: string[]) {
  const wanted = new Set(ids.filter(Boolean));
  const found = new Map<string, string>();
  if (!wanted.size) return found;

  for (let page = 1; page <= 50 && wanted.size; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error || !data.users.length) break;
    for (const user of data.users) {
      if (!wanted.has(user.id)) continue;
      const phone = phoneOnAuthUser(user);
      if (phone) found.set(user.id, phone);
      wanted.delete(user.id);
    }
    if (data.users.length < 1000) break;
  }

  return found;
}
