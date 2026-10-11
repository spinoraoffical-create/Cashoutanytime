import "server-only";

import { notFound, redirect } from "next/navigation";

import { adminDb } from "@/lib/actions/admin/core";
import { getStaffContext } from "@/lib/data/admin";

export type AgentScope = {
  level: "platform" | "store" | "sub";
  userId: string;
  email: string | null;
  /** Sub-creator ids this person may manage. Includes nobody for a sub-creator. */
  subCreatorIds: string[];
  /** Profile ids whose players this person may see (themselves and their subs). */
  parentIds: string[];
  approveLimit: number | null;
  missingTable: boolean;
};

function missing(error: { message?: string } | null) {
  const message = error?.message ?? "";
  return /agent_accounts|schema cache|does not exist/i.test(message);
}

export type AgentScopeRead =
  | { status: "unavailable"; scope: null }
  | { status: "missing"; scope: null }
  | { status: "ok"; scope: AgentScope | null };

export async function readAgentScope(): Promise<AgentScopeRead> {
  const ctx = await getStaffContext();
  if (!ctx) return { status: "unavailable", scope: null };

  const db = adminDb();
  const { data, error } = await db
    .from("agent_accounts")
    .select("user_id, tier, parent_id, active, approve_limit");

  if (error) {
    if (ctx.isSuperAdmin && missing(error)) {
      return {
        status: "ok",
        scope: {
          level: "platform",
          userId: ctx.userId,
          email: ctx.email,
          subCreatorIds: [],
          parentIds: [],
          approveLimit: null,
          missingTable: true,
        },
      };
    }
    if (ctx.isSuperAdmin) {
      return {
        status: "ok",
        scope: {
          level: "platform",
          userId: ctx.userId,
          email: ctx.email,
          subCreatorIds: [],
          parentIds: [],
          approveLimit: null,
          missingTable: false,
        },
      };
    }
    return { status: "missing", scope: null };
  }

  const rows = (data ?? []) as {
    user_id: string;
    tier: string;
    parent_id: string | null;
    active: boolean;
    approve_limit: number | null;
  }[];

  const mine = rows.find((row) => row.user_id === ctx.userId && row.active);

  if (mine?.tier === "store_creator") {
    const subs = rows
      .filter((row) => row.tier === "sub_creator" && row.parent_id === ctx.userId)
      .map((row) => row.user_id);
    return {
      status: "ok",
      scope: {
        level: "store",
        userId: ctx.userId,
        email: ctx.email,
        subCreatorIds: subs,
        parentIds: [ctx.userId, ...subs],
        approveLimit: null,
        missingTable: false,
      },
    };
  }

  if (mine?.tier === "sub_creator") {
    return {
      status: "ok",
      scope: {
        level: "sub",
        userId: ctx.userId,
        email: ctx.email,
        subCreatorIds: [],
        parentIds: [ctx.userId],
        approveLimit: mine.approve_limit == null ? 0 : Number(mine.approve_limit),
        missingTable: false,
      },
    };
  }

  if (ctx.isSuperAdmin) {
    const subs = rows.filter((row) => row.tier === "sub_creator").map((row) => row.user_id);
    return {
      status: "ok",
      scope: {
        level: "platform",
        userId: ctx.userId,
        email: ctx.email,
        subCreatorIds: subs,
        parentIds: rows.map((row) => row.user_id),
        approveLimit: null,
        missingTable: false,
      },
    };
  }

  return { status: "ok", scope: null };
}

export async function getAgentScope(): Promise<AgentScope | null> {
  const result = await readAgentScope();
  if (result.status !== "ok") return null;
  return result.scope;
}

export async function requireAgentScope() {
  const scope = await getAgentScope();
  if (!scope) redirect("/dashboard");
  return scope;
}

export async function playerInScope(scope: AgentScope, playerId: string) {
  if (scope.level === "platform") return true;
  const db = adminDb();
  const { data } = await db.from("profiles").select("parent_agent_id").eq("id", playerId).maybeSingle();
  const parent = (data as { parent_agent_id?: string | null } | null)?.parent_agent_id;
  return Boolean(parent && scope.parentIds.includes(parent));
}

export async function assertCanSeePlayer(playerId: string) {
  const scope = await getAgentScope();
  if (!scope) redirect("/admin");
  if (!(await playerInScope(scope, playerId))) notFound();
  return scope;
}
