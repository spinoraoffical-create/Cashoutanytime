import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { getSupabaseAnonKey, getSupabaseUrl, isSupabaseConfigured } from "@/lib/supabase/env";

export async function updateSession(request: NextRequest) {
  const path = request.nextUrl.pathname;

  const protectedRoutes = ["/dashboard", "/admin", "/chat"];
  const adminRoutes = ["/admin"];
  const authRoutes = ["/login", "/register", "/reset-password", "/auth/callback"];

  const isProtected = protectedRoutes.some((r) => path.startsWith(r));
  const isAdmin = adminRoutes.some((r) => path.startsWith(r));
  const isAuth = authRoutes.some((r) => path.startsWith(r));

  const hasSupabaseSession = request.cookies
    .getAll()
    .some((c) => c.name.includes("-auth-token") && c.value);

  if (!isProtected && !isAuth) {
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
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  let {
    data: { user },
  } = await supabase.auth.getUser();

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

  if (
    user &&
    emailConfirmed &&
    isAuth &&
    path !== "/auth/callback" &&
    !path.startsWith("/reset-password/update")
  ) {
    const url = request.nextUrl.clone();
    url.pathname = request.nextUrl.searchParams.get("redirect") || "/dashboard";
    url.searchParams.delete("redirect");
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
