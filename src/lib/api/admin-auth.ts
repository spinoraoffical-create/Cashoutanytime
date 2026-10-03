import { NextResponse } from "next/server";
import { can, getStaffContext, type StaffContext } from "@/lib/data/admin";

export async function requireStaffApi(
  permission?: string
): Promise<{ staff: StaffContext } | NextResponse> {
  const ctx = await getStaffContext();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (permission && !can(ctx, permission)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return { staff: ctx };
}

export function isAuthError(
  result: { staff: StaffContext } | NextResponse
): result is NextResponse {
  return result instanceof NextResponse;
}
