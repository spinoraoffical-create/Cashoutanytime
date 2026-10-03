"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function claimRewardAction(ruleKey: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Not signed in." };

  const { data, error } = await supabase.rpc("claim_reward", { rule_key: ruleKey });
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

  const { data, error } = await supabase.rpc("claim_promotion", {
    promo_slug: slug,
    redeem_code: code ?? null,
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
