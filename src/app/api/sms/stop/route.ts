import crypto from "crypto";
import { NextResponse } from "next/server";

import { phoneLookupVariants } from "@/lib/auth/phone";
import { isStopMessage } from "@/lib/offers/audience";
import { createAdminClient } from "@/lib/supabase/admin";

function twilioSignatureValid(url: string, params: Record<string, string>, header: string, token: string) {
  const payload = url + Object.keys(params).sort().reduce((sum, key) => sum + key + params[key], "");
  const expected = crypto.createHmac("sha1", token).update(payload).digest("base64");
  const left = Buffer.from(expected);
  const right = Buffer.from(header);
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

export async function POST(req: Request) {
  const token = process.env.TWILIO_AUTH_TOKEN?.trim();
  const signature = req.headers.get("x-twilio-signature") || "";
  const form = await req.formData().catch(() => null);
  if (!token || !signature || !form) return new NextResponse("FORBIDDEN", { status: 403 });

  const params: Record<string, string> = {};
  form.forEach((value, key) => {
    if (typeof value === "string") params[key] = value;
  });
  const requestUrl = new URL(req.url);
  const proto = req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() || requestUrl.protocol.replace(":", "");
  const host = req.headers.get("x-forwarded-host")?.split(",")[0]?.trim() || requestUrl.host;
  const url = `${proto}://${host}${requestUrl.pathname}`;
  if (!twilioSignatureValid(url, params, signature, token)) {
    return new NextResponse("FORBIDDEN", { status: 403 });
  }

  const body = params.Body || "";
  const from = params.From || "";
  if (!isStopMessage(body) || !from) return new NextResponse("OK");

  const admin = createAdminClient();
  if (!admin) return new NextResponse("OK");
  const variants = phoneLookupVariants(from);
  if (variants.length === 0) return new NextResponse("OK");

  const { data } = await admin.from("profiles").select("id").in("phone", variants).limit(20);
  const ids = ((data ?? []) as { id: string }[]).map((row) => row.id);
  if (ids.length > 0) {
    await admin.from("notification_preferences").update({ sms_marketing: false }).in("user_id", ids);
  }
  return new NextResponse("OK");
}
