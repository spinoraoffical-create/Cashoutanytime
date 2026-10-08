import { NextResponse } from "next/server";

import { phoneLookupVariants } from "@/lib/auth/phone";
import { isStopMessage } from "@/lib/offers/audience";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(req: Request) {
  const form = await req.formData().catch(() => null);
  const body = String(form?.get("Body") || "");
  const from = String(form?.get("From") || "");
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
