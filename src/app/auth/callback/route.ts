import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { pickLoginDestination, signedInUsesAdminHome } from "@/lib/auth/account-home";
import { decodeOAuthNext, OAUTH_NEXT_COOKIE, oauthLoginError } from "@/lib/auth/oauth-return";
import { withAuthCookieDomain } from "@/lib/supabase/cookie-domain";
import { syncProfileFromAuthMetadata } from "@/lib/actions/auth";
import { recordEmailVerifiedCoins } from "@/lib/actions/loyalty";
import { linkSignupSecurity } from "@/lib/actions/security";

function publicOrigin(request: NextRequest) {
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() || "https";
  if (forwardedHost) return `${forwardedProto}://${forwardedHost}`;
  return new URL(request.url).origin;
}

function resolveRedirect(request: NextRequest, type: EmailOtpType | null, cookieRedirect = "") {
  const { searchParams } = new URL(request.url);
  const raw =
    searchParams.get("redirect") ||
    searchParams.get("next") ||
    cookieRedirect ||
    (type === "recovery" ? "/reset-password/update" : "/dashboard");
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.includes("://") || raw.includes("\\")) {
    return "/dashboard";
  }
  return raw;
}

function clearOAuthNextCookie(response: NextResponse, host: string | null) {
  response.cookies.set(
    OAUTH_NEXT_COOKIE,
    "",
    withAuthCookieDomain({ path: "/", maxAge: 0 }, host)
  );
  return response;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const origin = publicOrigin(request);
  const host = request.headers.get("host");
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const rawType = searchParams.get("type");
  const type = (rawType === "email" ? "signup" : rawType) as EmailOtpType | null;
  const cookieStore = await cookies();
  const oauthNext = decodeOAuthNext(cookieStore.get(OAUTH_NEXT_COOKIE)?.value);
  const redirect = resolveRedirect(request, type, oauthNext.redirect);
  const referralCode = searchParams.get("ref") || oauthNext.ref || null;
  const agentCode = searchParams.get("agent") || oauthNext.agent || null;
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
          const host = request.headers.get("host");
          cookiesToSet.forEach(({ name, value, options }) => {
            const cookieOptions = withAuthCookieDomain(options, host);
            try {
              cookieStore.set(name, value, cookieOptions);
            } catch {
              /* Route handlers keep the session on the redirect response. */
            }
            response.cookies.set(name, value, cookieOptions);
          });
        },
      },
    }
  );

  const oauthError = searchParams.get("error");
  const errorCode = searchParams.get("error_code");
  if (!code && !tokenHash && (oauthError || errorCode)) {
    console.error("auth callback provider error:", oauthLoginError(errorCode, oauthError));
    return clearOAuthNextCookie(
      NextResponse.redirect(`${origin}/login?error=${oauthLoginError(errorCode, oauthError)}`),
      host
    );
  }

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      console.error("auth callback code error:", error.message);
      return clearOAuthNextCookie(
        NextResponse.redirect(`${origin}/login?error=auth_callback_failed`),
        host
      );
    }
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (error) {
      console.error("auth callback otp error:", error.message);
      return clearOAuthNextCookie(
        NextResponse.redirect(`${origin}/login?error=auth_callback_failed`),
        host
      );
    }
  } else {
    return clearOAuthNextCookie(
      NextResponse.redirect(`${origin}/login?error=auth_callback_failed`),
      host
    );
  }

  try {
    await syncProfileFromAuthMetadata();
  } catch (err) {
    console.error("auth callback profile sync:", err);
  }

  if (type === "signup") {
    try {
      await recordEmailVerifiedCoins();
    } catch (err) {
      console.error("auth callback email coins:", err);
    }
  }

  const {
    data: { user: sessionUser },
  } = await supabase.auth.getUser();

  if (type === "signup" || searchParams.get("verified") === "1" || sessionUser) {
    const createdAt = sessionUser ? new Date(sessionUser.created_at).getTime() : 0;
    const freshGoogleAccount = Boolean(sessionUser && Date.now() - createdAt < 5 * 60 * 1000);
    if (type === "signup" || searchParams.get("verified") === "1" || freshGoogleAccount) {
      try {
        const linked = await linkSignupSecurity(null, sessionUser?.id);
        if (!linked.ok) {
          console.error("auth callback linkSignupSecurity:", linked.error);
        }
      } catch (err) {
        console.error("auth callback linkSignupSecurity:", err);
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

  const {
    data: { user: signedIn },
  } = await supabase.auth.getUser();
  const metadataCode =
    typeof signedIn?.user_metadata?.agent_code === "string" ? signedIn.user_metadata.agent_code : "";
  const lockedCode = agentCode?.trim() || metadataCode.trim();
  if (signedIn && lockedCode) {
    const { assignPlayerToAgentByCode } = await import("@/lib/agents/assign");
    await assignPlayerToAgentByCode(signedIn.id, lockedCode);
  }

  if (signedIn && (type === "signup" || searchParams.get("verified") === "1")) {
    try {
      const { safePaymentAlert } = await import("@/lib/telegram/control/safe-emit");
      await safePaymentAlert({
        category: "email_verified",
        eventKey: `email-verified:${signedIn.id}`,
        source: "ledger",
        reference: signedIn.id,
        detail: "The player confirmed the signup email.",
        adminPath: "/admin/users",
      });
    } catch {
      /* Sign-in already succeeded. A queued alert stays for the daily cron. */
    }
  }

  if (type !== "recovery" && signedIn) {
    const nextPath = pickLoginDestination(redirect, await signedInUsesAdminHome(supabase, signedIn.id));
    if (nextPath !== destUrl.pathname) {
      const nextUrl = new URL(nextPath, origin);
      if (type === "signup") nextUrl.searchParams.set("verified", "1");
      response.headers.set("location", nextUrl.toString());
    }
  }

  return clearOAuthNextCookie(response, host);
}
