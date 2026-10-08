"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { writeAudit, adminDb } from "@/lib/actions/admin/core";
import { getAgentScope, playerInScope, type AgentScope } from "@/lib/agents/scope";

export type AgentRow = {
  userId: string;
  name: string;
  email: string;
  phone: string;
  tier: string;
  roleLabel: string;
  wallet: number;
  createdAt: string;
  managerId: string | null;
  managerName: string;
  active: boolean;
  promoCode: string;
  commissionBps: number;
  approveLimit: number | null;
  playerCount: number;
};

export type NetworkPlayer = {
  id: string;
  name: string;
  email: string;
  wallet: number;
  createdAt: string;
  parentId: string | null;
  parentName: string;
  suspended: boolean;
};

function code() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let value = "AG";
  for (let i = 0; i < 6; i += 1) value += alphabet[Math.floor(Math.random() * alphabet.length)];
  return value;
}

async function scopeOrError(): Promise<{ scope: AgentScope } | { error: string }> {
  const scope = await getAgentScope();
  if (!scope) return { error: "You don't have access to this area." };
  if (scope.missingTable) return { error: "Apply the agent network migration in Supabase first." };
  return { scope };
}

function canManageAgents(scope: AgentScope) {
  return scope.level === "platform" || scope.level === "store";
}

export async function loadAgentRows(input: {
  q?: string;
  status?: string;
  sort?: string;
}): Promise<{ rows: AgentRow[]; error?: string; stores: { id: string; name: string }[] }> {
  const gate = await scopeOrError();
  if ("error" in gate) return { rows: [], error: gate.error, stores: [] };
  const { scope } = gate;
  if (!canManageAgents(scope)) return { rows: [], error: "You can't manage sub-creators.", stores: [] };

  const db = adminDb();
  let query = db
    .from("agent_accounts")
    .select("user_id, tier, role_label, parent_id, active, promo_code, phone, commission_bps, approve_limit, created_at");

  if (scope.level === "store") query = query.eq("parent_id", scope.userId).eq("tier", "sub_creator");
  if (input.status === "active") query = query.eq("active", true);
  if (input.status === "inactive") query = query.eq("active", false);

  const { data, error } = await query;
  if (error) return { rows: [], error: "Could not load sub-creators.", stores: [] };

  const agents = (data ?? []) as {
    user_id: string;
    tier: string;
    role_label: string;
    parent_id: string | null;
    active: boolean;
    promo_code: string;
    phone: string | null;
    commission_bps: number;
    approve_limit: number | null;
    created_at: string;
  }[];

  const ids = [...new Set(agents.flatMap((row) => [row.user_id, row.parent_id].filter(Boolean) as string[]))];
  const { data: profiles } = ids.length
    ? await db.from("profiles").select("id, full_name, email, wallet_balance").in("id", ids)
    : { data: [] };
  const people = new Map(
    ((profiles ?? []) as { id: string; full_name: string | null; email: string | null; wallet_balance: number | null }[]).map(
      (row) => [row.id, row]
    )
  );

  const { data: counts } = agents.length
    ? await db.from("profiles").select("parent_agent_id").in(
        "parent_agent_id",
        agents.map((row) => row.user_id)
      )
    : { data: [] };
  const playerCount = new Map<string, number>();
  for (const row of (counts ?? []) as { parent_agent_id: string | null }[]) {
    if (!row.parent_agent_id) continue;
    playerCount.set(row.parent_agent_id, (playerCount.get(row.parent_agent_id) ?? 0) + 1);
  }

  let rows: AgentRow[] = agents.map((row) => {
    const person = people.get(row.user_id);
    const manager = row.parent_id ? people.get(row.parent_id) : undefined;
    return {
      userId: row.user_id,
      name: person?.full_name?.trim() || person?.email || "Agent",
      email: person?.email ?? "",
      phone: row.phone ?? "",
      tier: row.tier,
      roleLabel: row.role_label,
      wallet: Number(person?.wallet_balance ?? 0),
      createdAt: row.created_at,
      managerId: row.parent_id,
      managerName: manager?.full_name?.trim() || manager?.email || (row.tier === "store_creator" ? "Platform" : "—"),
      active: row.active,
      promoCode: row.promo_code,
      commissionBps: row.commission_bps,
      approveLimit: row.approve_limit == null ? null : Number(row.approve_limit),
      playerCount: playerCount.get(row.user_id) ?? 0,
    };
  });

  const q = input.q?.trim().toLowerCase();
  if (q) {
    rows = rows.filter((row) =>
      `${row.name} ${row.email} ${row.phone} ${row.promoCode}`.toLowerCase().includes(q)
    );
  }

  const sort = input.sort ?? "newest";
  rows.sort((a, b) => {
    if (sort === "wallet") return b.wallet - a.wallet;
    if (sort === "name") return a.name.localeCompare(b.name);
    return a.createdAt < b.createdAt ? 1 : -1;
  });

  const stores =
    scope.level === "platform"
      ? rows
          .filter((row) => row.tier === "store_creator")
          .map((row) => ({ id: row.userId, name: row.name }))
      : [{ id: scope.userId, name: "You" }];

  return { rows, stores };
}

const createSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email(),
  phone: z.string().trim().max(30).optional().default(""),
  password: z.string().min(8).max(72),
  kind: z.enum(["store_creator", "sub_creator"]),
  roleLabel: z.enum(["sub_creator", "store_sub_creator"]).optional(),
  parentId: z.uuid().optional().nullable(),
  commissionBps: z.coerce.number().int().min(0).max(10000).default(0),
  approveLimit: z.coerce.number().min(0).max(100000).optional(),
});

export async function createAgentAction(input: z.infer<typeof createSchema>) {
  const gate = await scopeOrError();
  if ("error" in gate) return { ok: false as const, error: gate.error };
  const { scope } = gate;
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Check the form." };

  if (parsed.data.kind === "store_creator" && scope.level !== "platform") {
    return { ok: false as const, error: "Only a Super Admin can add a store creator." };
  }
  if (parsed.data.kind === "sub_creator" && !canManageAgents(scope)) {
    return { ok: false as const, error: "You can't add a sub-creator." };
  }

  let parentId: string | null = null;
  if (parsed.data.kind === "sub_creator") {
    parentId = scope.level === "store" ? scope.userId : parsed.data.parentId ?? null;
    if (!parentId) return { ok: false as const, error: "Choose the store creator who manages this agent." };
    if (scope.level === "platform") {
      const { data: parent } = await adminDb()
        .from("agent_accounts")
        .select("tier, active")
        .eq("user_id", parentId)
        .maybeSingle();
      if (!parent || parent.tier !== "store_creator" || parent.active === false) {
        return { ok: false as const, error: "That manager is not an active store creator." };
      }
    }
  }

  const db = adminDb();
  const { data: created, error: authError } = await db.auth.admin.createUser({
    email: parsed.data.email,
    password: parsed.data.password,
    email_confirm: true,
    user_metadata: { full_name: parsed.data.name },
  });
  if (authError || !created.user) {
    return { ok: false as const, error: authError?.message ?? "Could not create the login." };
  }

  const userId = created.user.id;
  await db.from("profiles").update({ full_name: parsed.data.name }).eq("id", userId);

  const promo = code();
  const roleLabel = parsed.data.kind === "store_creator" ? "store_creator" : parsed.data.roleLabel ?? "sub_creator";
  const { error } = await db.from("agent_accounts").insert({
    user_id: userId,
    tier: parsed.data.kind,
    role_label: roleLabel,
    parent_id: parentId,
    phone: parsed.data.phone || null,
    promo_code: promo,
    commission_bps: parsed.data.commissionBps,
    approve_limit: parsed.data.kind === "sub_creator" ? parsed.data.approveLimit ?? 100 : null,
    created_by: scope.userId,
    active: true,
  });
  if (error) {
    return { ok: false as const, error: "The login was created, but the agent record was not. Apply the migration and try again." };
  }

  await writeAudit({
    actorId: scope.userId,
    action: "agent.create",
    entityType: "agent_account",
    entityId: userId,
    after: { tier: parsed.data.kind, parentId, email: parsed.data.email },
  });
  revalidatePath("/admin/sub-creators");
  return { ok: true as const, message: "Agent created.", promoCode: promo };
}

export async function setAgentActiveAction(userId: string, active: boolean) {
  const gate = await scopeOrError();
  if ("error" in gate) return { ok: false as const, error: gate.error };
  const { scope } = gate;
  if (!(await agentInScope(scope, userId))) return { ok: false as const, error: "That agent is outside your network." };

  const { error } = await adminDb().from("agent_accounts").update({ active, updated_at: new Date().toISOString() }).eq("user_id", userId);
  if (error) return { ok: false as const, error: "Could not update status." };
  await writeAudit({
    actorId: scope.userId,
    action: active ? "agent.activate" : "agent.deactivate",
    entityType: "agent_account",
    entityId: userId,
    after: { active },
  });
  revalidatePath("/admin/sub-creators");
  return { ok: true as const };
}

export async function setAgentsActiveAction(userIds: string[], active: boolean) {
  for (const userId of userIds) {
    const result = await setAgentActiveAction(userId, active);
    if (!result.ok) return result;
  }
  return { ok: true as const };
}

const editSchema = z.object({
  userId: z.uuid(),
  phone: z.string().trim().max(30),
  roleLabel: z.enum(["sub_creator", "store_sub_creator", "store_creator"]),
  commissionBps: z.coerce.number().int().min(0).max(10000),
  approveLimit: z.coerce.number().min(0).max(100000),
});

export async function updateAgentAction(input: z.infer<typeof editSchema>) {
  const gate = await scopeOrError();
  if ("error" in gate) return { ok: false as const, error: gate.error };
  const parsed = editSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Check the form." };
  if (!(await agentInScope(gate.scope, parsed.data.userId))) {
    return { ok: false as const, error: "That agent is outside your network." };
  }
  const { data: current } = await adminDb()
    .from("agent_accounts")
    .select("tier")
    .eq("user_id", parsed.data.userId)
    .maybeSingle();
  if (parsed.data.roleLabel === "store_creator" && current?.tier !== "store_creator") {
    return { ok: false as const, error: "A sub-creator stays a sub-creator. Store Sub-Creator is a label, not a wider network." };
  }
  const { error } = await adminDb()
    .from("agent_accounts")
    .update({
      phone: parsed.data.phone || null,
      role_label: parsed.data.roleLabel,
      commission_bps: parsed.data.commissionBps,
      approve_limit: parsed.data.roleLabel === "store_creator" ? null : parsed.data.approveLimit,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", parsed.data.userId);
  if (error) return { ok: false as const, error: "Could not save." };
  await writeAudit({
    actorId: gate.scope.userId,
    action: "agent.update",
    entityType: "agent_account",
    entityId: parsed.data.userId,
    after: parsed.data,
  });
  revalidatePath("/admin/sub-creators");
  return { ok: true as const };
}

export async function resetAgentPasswordAction(userId: string, password: string) {
  if (password.length < 8) return { ok: false as const, error: "Use at least 8 characters." };
  const gate = await scopeOrError();
  if ("error" in gate) return { ok: false as const, error: gate.error };
  if (!(await agentInScope(gate.scope, userId))) return { ok: false as const, error: "That agent is outside your network." };
  const { error } = await adminDb().auth.admin.updateUserById(userId, { password });
  if (error) return { ok: false as const, error: error.message };
  await writeAudit({
    actorId: gate.scope.userId,
    action: "agent.password_reset",
    entityType: "agent_account",
    entityId: userId,
  });
  return { ok: true as const, message: "Password updated." };
}

async function agentInScope(scope: AgentScope, userId: string) {
  if (scope.level === "sub") return false;
  const { data } = await adminDb()
    .from("agent_accounts")
    .select("tier, parent_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (!data) return false;
  if (scope.level === "platform") return true;
  return data.tier === "sub_creator" && data.parent_id === scope.userId;
}

export async function loadNetworkPlayers(input: {
  q?: string;
  parentId?: string;
}): Promise<{ rows: NetworkPlayer[]; parents: { id: string; name: string }[]; error?: string }> {
  const gate = await scopeOrError();
  if ("error" in gate) return { rows: [], parents: [], error: gate.error };
  const { scope } = gate;
  const db = adminDb();

  let query = db.from("profiles").select("id, full_name, email, wallet_balance, created_at, parent_agent_id, is_suspended");
  if (scope.level !== "platform") {
    if (scope.parentIds.length === 0) return { rows: [], parents: [], error: undefined };
    query = query.in("parent_agent_id", scope.parentIds);
  }
  if (input.parentId && input.parentId !== "all") {
    if (scope.level !== "platform" && !scope.parentIds.includes(input.parentId)) {
      return { rows: [], parents: [], error: "That parent is outside your network." };
    }
    query = query.eq("parent_agent_id", input.parentId);
  }

  const { data, error } = await query.order("created_at", { ascending: false }).limit(300);
  if (error) return { rows: [], parents: [], error: "Could not load players." };

  const people = (data ?? []) as {
    id: string;
    full_name: string | null;
    email: string | null;
    wallet_balance: number | null;
    created_at: string;
    parent_agent_id: string | null;
    is_suspended: boolean | null;
  }[];

  const q = input.q?.trim().toLowerCase();
  const filtered = q
    ? people.filter((row) => `${row.full_name ?? ""} ${row.email ?? ""}`.toLowerCase().includes(q))
    : people;

  const parentIds = [...new Set(filtered.map((row) => row.parent_agent_id).filter(Boolean) as string[])];
  const { data: parents } = parentIds.length
    ? await db.from("profiles").select("id, full_name, email").in("id", parentIds)
    : { data: [] };
  const parentName = new Map(
    ((parents ?? []) as { id: string; full_name: string | null; email: string | null }[]).map((row) => [
      row.id,
      row.full_name?.trim() || row.email || "Agent",
    ])
  );

  const parentOptions =
    scope.level === "sub"
      ? [{ id: scope.userId, name: "You" }]
      : scope.parentIds.map((id) => ({ id, name: parentName.get(id) || id.slice(0, 8) }));

  return {
    parents: parentOptions,
    rows: filtered.map((row) => ({
      id: row.id,
      name: row.full_name?.trim() || row.email || "Player",
      email: row.email ?? "",
      wallet: Number(row.wallet_balance ?? 0),
      createdAt: row.created_at,
      parentId: row.parent_agent_id,
      parentName: row.parent_agent_id ? parentName.get(row.parent_agent_id) || "Agent" : "Unassigned",
      suspended: Boolean(row.is_suspended),
    })),
  };
}

export async function movePlayerAction(playerId: string, nextParentId: string) {
  const gate = await scopeOrError();
  if ("error" in gate) return { ok: false as const, error: gate.error };
  const { scope } = gate;
  if (scope.level === "sub") return { ok: false as const, error: "Only a store creator or Super Admin can move a player." };
  if (!(await playerInScope(scope, playerId))) return { ok: false as const, error: "That player is outside your network." };
  if (scope.level === "store" && !scope.parentIds.includes(nextParentId)) {
    return { ok: false as const, error: "Choose one of your sub-creators." };
  }
  const { data: next } = await adminDb()
    .from("agent_accounts")
    .select("tier, parent_id, active")
    .eq("user_id", nextParentId)
    .maybeSingle();
  if (!next || next.active === false) return { ok: false as const, error: "That agent is not active." };
  if (scope.level === "store" && next.parent_id !== scope.userId && nextParentId !== scope.userId) {
    return { ok: false as const, error: "That agent is outside your network." };
  }

  const { error } = await adminDb().from("profiles").update({ parent_agent_id: nextParentId }).eq("id", playerId);
  if (error) return { ok: false as const, error: "Could not move the player." };
  await writeAudit({
    actorId: scope.userId,
    action: "player.move_parent",
    entityType: "profile",
    entityId: playerId,
    after: { parent_agent_id: nextParentId },
  });
  revalidatePath("/admin/players");
  revalidatePath(`/admin/users/${playerId}`);
  return { ok: true as const };
}
