import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // 1. Geo-Blocking Compliance Guard (Vercel Edge headers)
  const restrictedStates = (process.env.RESTRICTED_STATES || "WA,ID,NV,MI").split(",");
  const country = request.headers.get("x-vercel-ip-country") || "";
  const region = request.headers.get("x-vercel-ip-country-region") || ""; // State code, e.g. "WA"

  if (
    path !== "/restricted" &&
    country === "US" &&
    restrictedStates.includes(region)
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/restricted";
    return NextResponse.redirect(url);
  }

  if (path === "/restricted") {
    return NextResponse.next();
  }

  // 2. supabase auth & session keeper
  return await updateSession(request);
}

export const config = {
  matcher: [
    // Match all routes except static assets, local files, and API endpoints
    "/((?!api|_next/static|_next/image|favicon.ico|images|games|.*\\..*).*)",
  ],
};

