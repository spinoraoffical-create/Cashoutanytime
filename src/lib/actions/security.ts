"use server";

import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const DEVICE_COOKIE = "spinora_did";

function getClientIp(h: Headers): string {
  return (
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    h.get("x-real-ip") ??
    h.get("cf-connecting-ip") ??
    "0.0.0.0"
  );
}

function getUserAgent(h: Headers): string | null {
  return h.get("user-agent");
}

async function readDeviceId(explicit?: string | null): Promise<string | null> {
  const trimmed = explicit?.trim();
  if (trimmed && trimmed.length >= 16) return trimmed;

  const h = await headers();
  const cookie = h.get("cookie") ?? "";
  const match = cookie.match(new RegExp(`${DEVICE_COOKIE}=([^;]+)`));
  if (!match?.[1]) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

type GateResult = {
  allowed: boolean;
  reason?: string;
  message?: string;
};

function friendlyBlockMessage(data: GateResult | null): string {
  if (data?.message) return data.message;
  return "This action is not allowed. Contact support if you think this is a mistake.";
}

/** Call before register OTP / signUp — blocks multi-account from same device/IP. */
export async function checkSignupAllowed(
  deviceId: string,
  email?: string
): Promise<{ allowed: true } | { allowed: false; error: string }> {
  const admin = createAdminClient();
  if (!admin) {
    return { allowed: true };
  }

  const h = await headers();
  const { data, error } = await admin.rpc("check_signup_allowed", {
    p_ip: getClientIp(h),
    p_device_id: deviceId?.trim() || null,
    p_email: email?.trim().toLowerCase() || null,
  });

  if (error) {
    console.error("check_signup_allowed:", error.message);
    return { allowed: true };
  }

  const result = data as GateResult;
  if (!result?.allowed) {
    return { allowed: false, error: friendlyBlockMessage(result) };
  }

  return { allowed: true };
}

/** After new user is created — link device + IP and apply freeplay flags. */
export async function linkSignupSecurity(deviceId?: string | null): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const admin = createAdminClient();
  if (!admin) return;

  const h = await headers();
  const did = await readDeviceId(deviceId);

  const { error } = await admin.rpc("link_user_signup", {
    p_user_id: user.id,
    p_ip: getClientIp(h),
    p_device_id: did,
    p_user_agent: getUserAgent(h),
  });

  if (error) {
    console.error("link_user_signup:", error.message);
  }
}

/** Blocks daily spin + task cash for multi-account / flagged users. */
export async function assertFreeplayAllowed(): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated" };

  const admin = createAdminClient();
  if (!admin) return { ok: true };

  const { data, error } = await admin.rpc("assert_freeplay_allowed", {
    p_user_id: user.id,
  });

  if (error) {
    console.error("assert_freeplay_allowed:", error.message);
    return { ok: true };
  }

  const result = data as GateResult;
  if (!result?.allowed) {
    return { ok: false, error: friendlyBlockMessage(result) };
  }

  return { ok: true };
}
