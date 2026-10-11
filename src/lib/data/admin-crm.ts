import "server-only";

import { unstable_cache } from "next/cache";

import {
  ADMIN_PROFILE_SELECT,
  type ProfileRow,
} from "@/lib/admin/spinora-profile";
import { adminDb } from "@/lib/actions/admin/core";

export const CRM_PAGE_SIZE = 25;

export type CrmSegment = "all" | "new" | "active" | "vip" | "banned";

export type CrmOverviewStats = {
  totalPlayers: number;
  newThisWeek: number;
  activeLast7d: number;
  totalFulfilled: number;
};

export type CrmPlayerRow = {
  profile: ProfileRow;
  vip: { name: string; color: string } | null;
  deposits: { fulfilledCount: number; totalDeposited: number } | null;
};

export type CrmPlayersPage = {
  rows: CrmPlayerRow[];
  total: number;
  page: number;
  totalPages: number;
};

function since7dIso() {
  return new Date(Date.now() - 7 * 86_400_000).toISOString();
}

async function fetchOverviewStatsUncached(): Promise<CrmOverviewStats> {
  const db = adminDb();
  const since = since7dIso();

  const rpc = await db.rpc("admin_crm_overview_stats", { since });
  if (!rpc.error && rpc.data && typeof rpc.data === "object") {
    const d = rpc.data as Record<string, number>;
    return {
      totalPlayers: Number(d.total_players ?? 0),
      newThisWeek: Number(d.new_this_week ?? 0),
      activeLast7d: Number(d.active_last_7d ?? 0),
      totalFulfilled: Number(d.total_fulfilled ?? 0),
    };
  }

  const [totalResult, newResult, activeResult, fulfilledRows] = await Promise.all([
    db.from("profiles").select("id", { count: "exact", head: true }),
    db.from("profiles").select("id", { count: "exact", head: true }).gte("created_at", since),
    db.from("profiles").select("id", { count: "exact", head: true }).gte("last_seen_at", since),
    db.from("deposit_requests").select("amount").eq("status", "completed").limit(5000),
  ]);

  const totalFulfilled = (fulfilledRows.data ?? []).reduce(
    (sum, row) => sum + Number(row.amount ?? 0),
    0
  );

  return {
    totalPlayers: totalResult.count ?? 0,
    newThisWeek: newResult.count ?? 0,
    activeLast7d: activeResult.count ?? 0,
    totalFulfilled,
  };
}

export const getCrmOverviewStats = unstable_cache(
  fetchOverviewStatsUncached,
  ["admin-crm-overview-stats"],
  { revalidate: 90 }
);

export async function getCrmOverviewForParents(parentIds: readonly string[]): Promise<CrmOverviewStats> {
  if (!parentIds.length) {
    return { totalPlayers: 0, newThisWeek: 0, activeLast7d: 0, totalFulfilled: 0 };
  }
  const db = adminDb();
  const since = since7dIso();
  const parents = [...parentIds];
  const [totalResult, newResult, activeResult, owned] = await Promise.all([
    db.from("profiles").select("id", { count: "exact", head: true }).in("parent_agent_id", parents),
    db.from("profiles").select("id", { count: "exact", head: true }).in("parent_agent_id", parents).gte("created_at", since),
    db.from("profiles").select("id", { count: "exact", head: true }).in("parent_agent_id", parents).gte("last_seen_at", since),
    db.from("profiles").select("id").in("parent_agent_id", parents).limit(1000),
  ]);
  if (totalResult.error || newResult.error || activeResult.error || owned.error) {
    throw new Error(totalResult.error?.message || newResult.error?.message || activeResult.error?.message || owned.error?.message || "Could not load this creator's CRM.");
  }
  const ids = ((owned.data ?? []) as { id: string }[]).map((row) => row.id);
  let totalFulfilled = 0;
  if (ids.length) {
    const fulfilled = await db
      .from("deposit_requests")
      .select("amount")
      .in("user_id", ids)
      .eq("status", "completed")
      .limit(5000);
    if (fulfilled.error) throw new Error(fulfilled.error.message);
    totalFulfilled = (fulfilled.data ?? []).reduce((sum, row) => sum + Number(row.amount ?? 0), 0);
  }
  return {
    totalPlayers: totalResult.count ?? 0,
    newThisWeek: newResult.count ?? 0,
    activeLast7d: activeResult.count ?? 0,
    totalFulfilled,
  };
}

async function depositStatsForUsers(
  userIds: string[]
): Promise<Map<string, { fulfilledCount: number; totalDeposited: number }>> {
  const map = new Map<string, { fulfilledCount: number; totalDeposited: number }>();
  if (!userIds.length) return map;

  const db = adminDb();
  const rpc = await db.rpc("admin_user_deposit_stats", { p_user_ids: userIds });
  if (!rpc.error && rpc.data?.length) {
    for (const row of rpc.data as {
      user_id: string;
      fulfilled_count: number;
      total_deposited: number;
    }[]) {
      map.set(row.user_id, {
        fulfilledCount: Number(row.fulfilled_count ?? 0),
        totalDeposited: Number(row.total_deposited ?? 0),
      });
    }
    return map;
  }

  const { data: requestRows } = await db
    .from("deposit_requests")
    .select("user_id, amount")
    .in("user_id", userIds)
    .eq("status", "completed");

  for (const r of requestRows ?? []) {
    if (!r.user_id) continue;
    const existing = map.get(r.user_id) ?? { fulfilledCount: 0, totalDeposited: 0 };
    existing.fulfilledCount += 1;
    existing.totalDeposited += Number(r.amount ?? 0);
    map.set(r.user_id, existing);
  }

  return map;
}

export async function getCrmPlayersPage(
  segment: CrmSegment,
  page: number,
  parentIds?: readonly string[]
): Promise<CrmPlayersPage> {
  const safePage = Math.max(1, page);
  if (parentIds && parentIds.length === 0) {
    return { rows: [], total: 0, page: safePage, totalPages: 1 };
  }
  const db = adminDb();
  const since = since7dIso();
  const from = (safePage - 1) * CRM_PAGE_SIZE;
  const to = from + CRM_PAGE_SIZE - 1;

  let profileQuery = db
    .from("profiles")
    .select(
      segment === "vip"
        ? `${ADMIN_PROFILE_SELECT}, vip_status!inner(user_id)`
        : ADMIN_PROFILE_SELECT,
      { count: "exact" }
    )
    .order("created_at", { ascending: false });

  if (parentIds?.length) profileQuery = profileQuery.in("parent_agent_id", [...parentIds]);

  if (segment === "new") profileQuery = profileQuery.gte("created_at", since);
  else if (segment === "active") profileQuery = profileQuery.gte("last_seen_at", since);
  else if (segment === "banned") profileQuery = profileQuery.eq("is_suspended", true);

  const { data: profilesRaw, count: segmentCount } = await profileQuery.range(from, to);
  const profiles = (profilesRaw ?? []) as ProfileRow[];
  const total = segmentCount ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / CRM_PAGE_SIZE));
  const profileIds = profiles.map((p) => p.id!).filter(Boolean);

  const [depositMap, vipResult] = await Promise.all([
    depositStatsForUsers(profileIds),
    profileIds.length
      ? db.from("vip_status").select("user_id, vip_tiers(name, color)").in("user_id", profileIds)
      : Promise.resolve({ data: [] }),
  ]);

  type VipRow = { user_id: string; vip_tiers: { name: string; color: string } | null };
  const vipByUser = new Map<string, { name: string; color: string }>();
  for (const v of (vipResult.data ?? []) as unknown as VipRow[]) {
    if (v.vip_tiers) vipByUser.set(v.user_id, v.vip_tiers);
  }

  const rows: CrmPlayerRow[] = profiles.map((profile) => {
    const id = profile.id!;
    const deposits = depositMap.get(id);
    return {
      profile,
      vip: vipByUser.get(id) ?? null,
      deposits: deposits
        ? {
            fulfilledCount: deposits.fulfilledCount,
            totalDeposited: deposits.totalDeposited,
          }
        : null,
    };
  });

  return { rows, total, page: safePage, totalPages };
}
