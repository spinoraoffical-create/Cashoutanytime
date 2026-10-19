import { NextResponse } from "next/server";
import { z } from "zod";

import { checkRateLimit } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthUser } from "@/lib/supabase/session";

const schema = z.object({
  endpoint: z.string().url().max(2000),
  keys: z.object({
    p256dh: z.string().min(8).max(255),
    auth: z.string().min(8).max(255),
  }),
});

function missingTable(message: string) {
  return /push_subscriptions|schema cache|does not exist/i.test(message);
}

export async function POST(request: Request) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Sign in before enabling phone notifications." }, { status: 401 });

  const limited = await checkRateLimit("pushSubscribe", user.id);
  if (!limited.allowed) {
    return NextResponse.json({ error: "Please wait a moment before trying again." }, { status: 429 });
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || !parsed.data.endpoint.startsWith("https://")) {
    return NextResponse.json({ error: "That device could not be saved." }, { status: 400 });
  }

  const db = createAdminClient();
  if (!db) return NextResponse.json({ error: "Phone notifications are not configured yet." }, { status: 503 });

  const existing = await db
    .from("push_subscriptions")
    .select("id, user_id")
    .eq("endpoint", parsed.data.endpoint)
    .maybeSingle();
  if (existing.error) {
    if (missingTable(existing.error.message)) {
      return NextResponse.json({ error: "Phone notifications need a database update before they can be saved." }, { status: 503 });
    }
    return NextResponse.json({ error: "That device could not be saved." }, { status: 500 });
  }
  const row = existing.data as { id: string; user_id: string } | null;
  if (row && row.user_id !== user.id) {
    return NextResponse.json({ error: "This device is already registered to another account." }, { status: 403 });
  }

  const saved = row
    ? await db
        .from("push_subscriptions")
        .update({
          p256dh: parsed.data.keys.p256dh,
          auth_secret: parsed.data.keys.auth,
          user_agent: request.headers.get("user-agent")?.slice(0, 200) ?? null,
          disabled_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id)
        .eq("user_id", user.id)
    : await db.from("push_subscriptions").insert({
        user_id: user.id,
        endpoint: parsed.data.endpoint,
        p256dh: parsed.data.keys.p256dh,
        auth_secret: parsed.data.keys.auth,
        user_agent: request.headers.get("user-agent")?.slice(0, 200) ?? null,
      });

  if (saved.error) {
    if (missingTable(saved.error.message)) {
      return NextResponse.json({ error: "Phone notifications need a database update before they can be saved." }, { status: 503 });
    }
    return NextResponse.json({ error: "That device could not be saved." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const body = (await request.json().catch(() => null)) as { endpoint?: string } | null;
  if (!body?.endpoint) return NextResponse.json({ error: "Choose a device to turn off." }, { status: 400 });
  const db = createAdminClient();
  if (!db) return NextResponse.json({ error: "Phone notifications are not configured yet." }, { status: 503 });
  const { error } = await db
    .from("push_subscriptions")
    .update({ disabled_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .eq("endpoint", body.endpoint);
  if (error) return NextResponse.json({ error: "That device could not be turned off." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
