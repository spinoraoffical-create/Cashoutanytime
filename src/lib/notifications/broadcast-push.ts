import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { planPromotionalPush, pushResultLabel, safeNotificationPath, lockScreenText } from "@/lib/notifications/player-notice-rules";

type SubscriptionRow = {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth_secret: string;
  disabled_at: string | null;
};

export type BroadcastPushSummary = {
  configured: boolean;
  accepted: number;
  failed: number;
  expired: number;
  optedOut: number;
  alreadyAccepted: number;
  note: string;
};

function missing(message: string) {
  return /push_subscriptions|push_attempts|schema cache|does not exist/i.test(message);
}

export async function sendBroadcastPush(input: {
  broadcastId: string;
  title: string;
  body: string;
  linkUrl: string | null;
  userIds: string[];
}): Promise<BroadcastPushSummary> {
  const empty = (note: string): BroadcastPushSummary => ({
    configured: false,
    accepted: 0,
    failed: 0,
    expired: 0,
    optedOut: 0,
    alreadyAccepted: 0,
    note,
  });
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY || !process.env.VAPID_SUBJECT) {
    return empty("Phone alerts are not configured yet. The in-app notice was still saved.");
  }
  const db = createAdminClient();
  if (!db || input.userIds.length === 0) {
    return empty("No phone alerts were attempted.");
  }

  const prefs = await db
    .from("notification_preferences")
    .select("user_id, email_promotions")
    .in("user_id", input.userIds.slice(0, 5000));
  if (prefs.error) return empty("Marketing preferences could not be checked. No phone alert was sent.");
  const marketing = new Map(
    ((prefs.data ?? []) as { user_id: string; email_promotions: boolean }[]).map((row) => [row.user_id, row.email_promotions === true])
  );

  const devices = await db
    .from("push_subscriptions")
    .select("id, user_id, endpoint, p256dh, auth_secret, disabled_at")
    .in("user_id", input.userIds.slice(0, 5000));
  if (devices.error) {
    return empty(missing(devices.error.message) ? "Phone alerts need a database update. The in-app notice was still saved." : "Phone alerts could not be loaded. The in-app notice was still saved.");
  }

  const prior = await db
    .from("push_attempts")
    .select("subscription_id, status")
    .eq("broadcast_id", input.broadcastId);
  if (prior.error && !missing(prior.error.message)) {
    return empty("Earlier phone attempts could not be checked. No new phone alert was sent.");
  }
  const acceptedIds = new Set(
    ((prior.data ?? []) as { subscription_id: string; status: string }[])
      .filter((row) => row.status === "accepted")
      .map((row) => row.subscription_id)
  );

  const rows = (devices.data ?? []) as SubscriptionRow[];
  const plan = planPromotionalPush(
    rows.map((row) => ({
      subscriptionId: row.id,
      userId: row.user_id,
      marketingOptIn: marketing.get(row.user_id) === true,
      expired: row.disabled_at != null,
      alreadyAccepted: acceptedIds.has(row.id),
    }))
  );

  let webPush: typeof import("web-push") | null = null;
  try {
    webPush = await import("web-push");
    webPush.setVapidDetails(process.env.VAPID_SUBJECT, process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);
  } catch {
    return empty("Phone alerts are not configured yet. The in-app notice was still saved.");
  }

  const byId = new Map(rows.map((row) => [row.id, row]));
  let accepted = 0;
  let failed = 0;
  let expired = plan.expired;
  const path = safeNotificationPath(input.linkUrl) ?? "/dashboard/inbox";
  const payload = JSON.stringify({
    title: input.title.slice(0, 80),
    body: lockScreenText(input.body) || "You have a new notice.",
    url: path,
  });

  for (const subscriptionId of plan.send) {
    const device = byId.get(subscriptionId);
    if (!device) continue;
    let status: "accepted" | "failed" | "expired" = "failed";
    let providerStatus = 0;
    try {
      const result = await webPush.sendNotification(
        {
          endpoint: device.endpoint,
          keys: { p256dh: device.p256dh, auth: device.auth_secret },
        },
        payload
      );
      providerStatus = result.statusCode;
      status = pushResultLabel(result.statusCode);
    } catch (error) {
      const code = typeof error === "object" && error && "statusCode" in error ? Number(error.statusCode) : 0;
      providerStatus = code;
      status = pushResultLabel(code);
      if (status === "expired") {
        await db.from("push_subscriptions").update({ disabled_at: new Date().toISOString() }).eq("id", device.id);
      }
    }
    if (status === "accepted") accepted += 1;
    else if (status === "expired") expired += 1;
    else failed += 1;
    await db.from("push_attempts").upsert(
      {
        broadcast_id: input.broadcastId,
        subscription_id: device.id,
        user_id: device.user_id,
        status,
        provider_status: providerStatus || null,
      },
      { onConflict: "broadcast_id,subscription_id" }
    );
  }

  const optedOut = input.userIds.filter((id) => marketing.get(id) !== true).length;
  return {
    configured: true,
    accepted,
    failed,
    expired,
    optedOut,
    alreadyAccepted: plan.alreadyAccepted,
    note: `Phone provider accepted ${accepted}. Failed ${failed}. Expired devices ${expired}. Marketing opt-outs ${optedOut}. This does not confirm the phone displayed the alert.`,
  };
}
