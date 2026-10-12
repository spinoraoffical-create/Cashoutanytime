import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { pickLoginDestination, signedInUsesAdminHome } from "@/lib/auth/account-home";
import { withAuthCookieDomain } from "@/lib/supabase/cookie-domain";
import { getSupabaseAnonKey, getSupabaseUrl, isSupabaseConfigured } from "@/lib/supabase/env";

export async function updateSession(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // Google returns here with a one-time code. Clearing cookies on this request
  // deletes the new session before the browser can store it.
  if (path === "/auth/callback" || path.startsWith("/auth/callback/")) {
    return NextResponse.next({ request });
  }

  const protectedRoutes = ["/dashboard", "/admin", "/chat"];
  const adminRoutes = ["/admin"];
  const authRoutes = ["/login", "/register", "/reset-password", "/auth/callback"];

  const isProtected = protectedRoutes.some((r) => path.startsWith(r));
  const isAdmin = adminRoutes.some((r) => path.startsWith(r));
  const isAuth = authRoutes.some((r) => path.startsWith(r));

  const hasSupabaseSession = request.cookies
    .getAll()
    .some(
      (c) =>
        c.name.includes("-auth-token") &&
        !c.name.includes("code-verifier") &&
        c.value
    );

  if (!isProtected && !isAuth && !hasSupabaseSession) {
    return NextResponse.next({ request });
  }

  if (!isSupabaseConfigured()) {
    if (isProtected) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("error", "supabase_unconfigured");
      return NextResponse.redirect(url);
    }
    return NextResponse.next({ request });
  }

  if (isProtected && !hasSupabaseSession) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirect", path);
    return NextResponse.redirect(url);
  }

  // Dashboard + admin: trust session cookie — layout validates user (skips slow auth API on every click)
  if ((path.startsWith("/dashboard") || path.startsWith("/admin")) && hasSupabaseSession) {
    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({ request });
  const supabase = createServerClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({ request });
        const host = request.headers.get("host");
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, withAuthCookieDomain(options, host))
        );
      },
    },
  });

  let user: { email_confirmed_at?: string | null; confirmed_at?: string | null; id?: string } | null = null;
  try {
    const result = await supabase.auth.getUser();
    user = result.data.user;
  } catch {
    user = null;
  }

  if (!user && hasSupabaseSession) {
    const stale = request.cookies.getAll().filter((cookie) => cookie.name.includes("-auth-token"));
    for (const cookie of stale) request.cookies.delete(cookie.name);
    const cleared = NextResponse.next({ request });
    for (const cookie of stale) {
      if (cookie.name.includes("code-verifier")) continue;
      cleared.cookies.set(
        cookie.name,
        "",
        withAuthCookieDomain({ path: "/", maxAge: 0 }, request.headers.get("host"))
      );
    }
    if (isProtected) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("redirect", path);
      return NextResponse.redirect(url);
    }
    return cleared;
  }

  const emailConfirmed = Boolean(user?.email_confirmed_at ?? user?.confirmed_at);

  if (!user && isProtected) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirect", path);
    return NextResponse.redirect(url);
  }

  if (user && isProtected && !emailConfirmed) {
    await supabase.auth.signOut();
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("error", "email_not_confirmed");
    url.searchParams.set("redirect", path);
    return NextResponse.redirect(url);
  }

  if (user?.id && emailConfirmed && path === "/") {
    if (await signedInUsesAdminHome(supabase, user.id)) {
      const url = request.nextUrl.clone();
      url.pathname = "/admin";
      url.search = "";
      return NextResponse.redirect(url);
    }
  }

  if (
    user?.id &&
    emailConfirmed &&
    isAuth &&
    path !== "/auth/callback" &&
    !path.startsWith("/reset-password/update")
  ) {
    const url = request.nextUrl.clone();
    const destination = pickLoginDestination(
      request.nextUrl.searchParams.get("redirect"),
      await signedInUsesAdminHome(supabase, user.id)
    );
    const parsed = new URL(destination, request.url);
    url.pathname = parsed.pathname;
    url.search = parsed.search;
    return NextResponse.redirect(url);
  }

  if (user && isAdmin) {
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      if (profile?.role !== "admin") {
        const url = request.nextUrl.clone();
        url.pathname = "/dashboard";
        return NextResponse.redirect(url);
      }
    } catch {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}
