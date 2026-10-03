import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { syncProfileFromAuthMetadata } from "@/lib/actions/auth";
import { linkSignupSecurity } from "@/lib/actions/security";

function resolveRedirect(request: NextRequest, type: EmailOtpType | null) {
  const { searchParams } = new URL(request.url);
  const raw =
    searchParams.get("redirect") ||
    searchParams.get("next") ||
    (type === "recovery" ? "/reset-password/update" : "/dashboard");
  return raw.startsWith("/") ? raw : "/dashboard";
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const rawType = searchParams.get("type");
  const type = (rawType === "email" ? "signup" : rawType) as EmailOtpType | null;
  const redirect = resolveRedirect(request, type);
  const referralCode = searchParams.get("ref");

  const cookieStore = await cookies();
  const destUrl = new URL(redirect, origin);
  if (type === "signup") {
    destUrl.searchParams.set("verified", "1");
  }

  let response = NextResponse.redirect(destUrl);

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      console.error("auth callback code error:", error.message);
      return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
    }
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (error) {
      console.error("auth callback otp error:", error.message);
      return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
    }
  } else {
    return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
  }

  try {
    await syncProfileFromAuthMetadata();
  } catch (err) {
    console.error("auth callback profile sync:", err);
  }

  if (type === "signup" || searchParams.get("verified") === "1") {
    try {
      await linkSignupSecurity();
    } catch (err) {
      console.error("auth callback linkSignupSecurity:", err);
    }
  } else {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const created = new Date(user.created_at).getTime();
      if (Date.now() - created < 5 * 60 * 1000) {
        try {
          await linkSignupSecurity();
        } catch (err) {
          console.error("auth callback linkSignupSecurity (oauth):", err);
        }
      }
    }
  }

  if (referralCode?.trim()) {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("referred_by")
        .eq("id", user.id)
        .single();

      if (profile && !profile.referred_by) {
        const { data: referrer } = await supabase
          .from("profiles")
          .select("id")
          .eq("referral_code", referralCode.trim().toUpperCase())
          .single();

        if (referrer && referrer.id !== user.id) {
          await supabase
            .from("profiles")
            .update({ referred_by: referrer.id })
            .eq("id", user.id);
        }
      }
    }
  }

  return response;
}
