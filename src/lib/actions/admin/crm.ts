"use server";

import { authorize } from "@/lib/actions/admin/core";
import {
  getCrmPlayersPage,
  type CrmPlayersPage,
  type CrmSegment,
} from "@/lib/data/admin-crm";

const SEGMENTS = new Set<CrmSegment>(["all", "new", "active", "vip", "banned"]);

export async function fetchCrmPlayersAction(input: {
  segment: string;
  page?: number;
}): Promise<{ ok: true; data: CrmPlayersPage } | { ok: false; error: string }> {
  const auth = await authorize("users.manage");
  if ("error" in auth) return { ok: false, error: auth.error };

  const segment = SEGMENTS.has(input.segment as CrmSegment)
    ? (input.segment as CrmSegment)
    : "all";
  const page = Math.max(1, Number(input.page) || 1);

  const data = await getCrmPlayersPage(segment, page);
  return { ok: true, data };
}
