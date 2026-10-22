"use server";

import { revalidatePath } from "next/cache";
import { assertFreeplayAllowed } from "@/lib/actions/security";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function claimRewardAction(ruleKey: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Not signed in." };

  const freeplay = await assertFreeplayAllowed();
  if (!freeplay.ok) return { ok: false as const, error: freeplay.error };

  const admin = createAdminClient();
  if (!admin) return { ok: false as const, error: "Rewards are unavailable right now." };

  const guarded = await admin.rpc("claim_legacy_freeplay", {
    p_rule: ruleKey,
    p_user: user.id,
  });
  if (!guarded.error) {
    revalidatePath("/dashboard/rewards");
    revalidatePath("/dashboard");
    return { ok: true as const, coins: 0, xp: 0, multiplier: 1 };
  }
  if (!/schema cache|does not exist|claim_legacy_freeplay/i.test(guarded.error.message)) {
    return { ok: false as const, error: guarded.error.message };
  }

  const { data, error } = await admin.rpc("claim_reward", {
    rule_key: ruleKey,
    p_user_id: user.id,
  });
  if (error) {
    return { ok: false as const, error: error.message };
  }

  const row = Array.isArray(data) ? data[0] : data;
  revalidatePath("/dashboard/rewards");
  revalidatePath("/dashboard");
  return {
    ok: true as const,
    coins: Number(row?.coins_awarded ?? 0),
    xp: Number(row?.xp_awarded ?? 0),
    multiplier: Number(row?.multiplier ?? 1),
  };
}

export async function claimPromotionAction(slug: string, code?: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Not signed in." };

  const admin = createAdminClient();
  if (!admin) return { ok: false as const, error: "Promotions are unavailable right now." };

  const { data, error } = await admin.rpc("claim_promotion", {
    promo_slug: slug,
    redeem_code: code ?? null,
    p_user_id: user.id,
  });
  if (error) {
    return { ok: false as const, error: error.message };
  }

  const row = Array.isArray(data) ? data[0] : data;
  revalidatePath("/dashboard/rewards");
  revalidatePath("/promotions");
  return {
    ok: true as const,
    coins: Number(row?.coins_awarded ?? 0),
    xp: Number(row?.xp_awarded ?? 0),
    multiplier: 1,
  };
}
