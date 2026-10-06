import { NextResponse } from "next/server";
import { getSupabaseUrl, isSupabaseConfigured } from "@/lib/supabase/env";

/** Check the Supabase Google authorize URL before the browser leaves the app. */
export async function POST(req: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Sign-in is temporarily unavailable. Please try again later or contact support." },
      { status: 503 }
    );
  }

  let url = "";
  try {
    const body = await req.json();
    url = String(body.url || "");
  } catch {
    url = "";
  }

  const allowed = `${getSupabaseUrl()}/auth/v1/authorize`;
  if (!url.startsWith(allowed)) {
    return NextResponse.json({ error: "Could not start Google sign-in." }, { status: 400 });
  }

  const res = await fetch(url, { redirect: "manual" });
  if (res.status >= 400) {
    const text = await res.text();
    console.error("[auth/google] provider check failed:", res.status, text.slice(0, 240));
    return NextResponse.json(
      {
        error:
          "Google sign-in is not turned on yet. Use email and password, or enable the Google provider in Supabase.",
      },
      { status: 400 }
    );
  }

  return NextResponse.json({ ok: true });
}
