"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { writeAudit, adminDb } from "@/lib/actions/admin/core";
import { authPhonesFor } from "@/lib/admin/member-phone";
import { latestIpsFor } from "@/lib/admin/signup-ips";
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
  phone: string;
  email: string;
  subCreator: string;
  store: string;
  wallet: number;
  cashout: number;
  coins: number;
  level: number | null;
  createdAt: string;
  status: "Active" | "Suspended";
  parentId: string | null;
  parentName: string;
  suspended: boolean;
  signupIp?: string;
  lastSeenIp?: string;
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

  const roleLabel = parsed.data.kind === "store_creator" ? "store_creator" : parsed.data.roleLabel ?? "sub_creator";
  let promo = code();
  let error: { message: string } | null = null;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    if (attempt > 0) promo = code();
    const inserted = await db.from("agent_accounts").insert({
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
    error = inserted.error;
    if (!error) break;
    if (!/promo_code|duplicate|unique/i.test(error.message)) break;
  }
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
  return { ok: true as const, message: `Agent created. Promo code ${promo} stays on this account.`, promoCode: promo };
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

type PlayerSource = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone?: string | null;
  wallet_balance: number | null;
  cashout_wallet?: number | null;
  coins_balance?: number | null;
  xp?: number | null;
  created_at: string;
  parent_agent_id: string | null;
  is_suspended: boolean | null;
};

const PLAYER_FIELDS = [
  "id",
  "full_name",
  "email",
  "phone",
  "wallet_balance",
  "cashout_wallet",
  "coins_balance",
  "xp",
  "created_at",
  "parent_agent_id",
  "is_suspended",
];

function missingColumn(message: string) {
  const named = message.match(/column profiles\.([a-z_]+) does not exist/i);
  if (named) return named[1];
  const cache = message.match(/Could not find the '([a-z_]+)' column/i);
  return cache?.[1] ?? null;
}

function dash(value: string | null | undefined) {
  const text = value?.trim();
  return text ? text : "—";
}

/** Body of public.calculate_level. Used only when that function is not in the API schema. */
function calculateLevel(xpTotal: number) {
  return Math.max(1, Math.floor(Math.sqrt(Math.max(xpTotal, 0) / 100)) + 1);
}

export async function loadNetworkPlayers(input: {
  q?: string;
  parentId?: string;
  exportAll?: boolean;
}): Promise<{ rows: NetworkPlayer[]; parents: { id: string; name: string }[]; error?: string }> {
  const gate = await scopeOrError();
  if ("error" in gate) return { rows: [], parents: [], error: gate.error };
  const { scope } = gate;
  if (scope.level !== "platform" && scope.parentIds.length === 0) return { rows: [], parents: [] };
  if (input.parentId && input.parentId !== "all" && scope.level !== "platform" && !scope.parentIds.includes(input.parentId)) {
    return { rows: [], parents: [], error: "That parent is outside your network." };
  }

  const db = adminDb();
  const fields = [...PLAYER_FIELDS];
  const scanAll = Boolean(input.exportAll || input.q?.trim());
  const pageSize = scanAll ? 1000 : 300;
  let people: PlayerSource[] = [];

  for (let attempt = 0; attempt < fields.length; attempt += 1) {
    people = [];
    let failed = false;
    for (let from = 0; ; from += pageSize) {
      let query = db.from("profiles").select(fields.join(", "));
      if (scope.level !== "platform") query = query.in("parent_agent_id", scope.parentIds);
      if (input.parentId && input.parentId !== "all") query = query.eq("parent_agent_id", input.parentId);
      const { data, error } = await query.order("created_at", { ascending: false }).range(from, from + pageSize - 1);
      if (error) {
        const column = missingColumn(error.message);
        if (column && fields.includes(column) && column !== "id") {
          fields.splice(fields.indexOf(column), 1);
          failed = true;
          break;
        }
        return { rows: [], parents: [], error: "Could not load players." };
      }
      const batch = (data ?? []) as unknown as PlayerSource[];
      people.push(...batch);
      if (!scanAll || batch.length < pageSize) break;
    }
    if (!failed) break;
  }

  const missingPhone = people.filter((row) => !row.phone?.trim()).map((row) => row.id);
  if (missingPhone.length) {
    const authPhones = await authPhonesFor(db, missingPhone);
    for (const row of people) {
      if (row.phone?.trim()) continue;
      const authPhone = authPhones.get(row.id);
      if (authPhone) row.phone = authPhone;
    }
  }

  const parentIds = [...new Set(people.map((row) => row.parent_agent_id).filter(Boolean) as string[])];
  const { data: agentRows } = parentIds.length
    ? await db.from("agent_accounts").select("user_id, tier, parent_id").in("user_id", parentIds)
    : { data: [] };
  const agents = new Map(
    ((agentRows ?? []) as { user_id: string; tier: string; parent_id: string | null }[]).map((row) => [row.user_id, row])
  );
  const storeIds = [...agents.values()]
    .filter((row) => row.tier === "sub_creator" && row.parent_id)
    .map((row) => row.parent_id as string);
  const nameIds = [...new Set([...parentIds, ...storeIds, ...(scope.level === "sub" ? [] : scope.parentIds)])];
  const { data: nameRows } = nameIds.length
    ? await db.from("profiles").select("id, full_name, email").in("id", nameIds)
    : { data: [] };
  const parentName = new Map(
    ((nameRows ?? []) as { id: string; full_name: string | null; email: string | null }[]).map((row) => [
      row.id,
      row.full_name?.trim() || row.email || "Agent",
    ])
  );

  const levels = new Map<number, number>();
  const xpValues = [...new Set(people.map((row) => Number(row.xp ?? 0)))];
  const probe = await db.rpc("calculate_level", { xp_total: xpValues[0] ?? 0 });
  const functionMissing = Boolean(probe.error && /schema cache|calculate_level/i.test(probe.error.message));
  if (!probe.error && probe.data != null) levels.set(xpValues[0] ?? 0, Number(probe.data));
  await Promise.all(
    xpValues.map(async (xp) => {
      if (levels.has(xp)) return;
      if (functionMissing) {
        levels.set(xp, calculateLevel(xp));
        return;
      }
      const { data, error } = await db.rpc("calculate_level", { xp_total: xp });
      if (!error && data != null) levels.set(xp, Number(data));
    })
  );

  const ips =
    scope.level === "platform" ? await latestIpsFor(db, people.map((row) => row.id)) : null;

  const shaped = people.map((row) => {
    const agent = row.parent_agent_id ? agents.get(row.parent_agent_id) : undefined;
    const parentLabel = row.parent_agent_id ? parentName.get(row.parent_agent_id) || "Agent" : "—";
    const subCreator = agent?.tier === "sub_creator" ? parentLabel : "—";
    const store =
      agent?.tier === "store_creator"
        ? parentLabel
        : agent?.tier === "sub_creator"
          ? dash(agent.parent_id ? parentName.get(agent.parent_id) : "")
          : "—";
    const suspended = Boolean(row.is_suspended);
    return {
      id: row.id,
      name: row.full_name?.trim() || row.email || "Player",
      phone: dash(row.phone),
      email: row.email ?? "",
      subCreator,
      store,
      wallet: Number(row.wallet_balance ?? 0),
      cashout: Number(row.cashout_wallet ?? 0),
      coins: Number(row.coins_balance ?? 0),
      level: levels.has(Number(row.xp ?? 0)) ? levels.get(Number(row.xp ?? 0)) ?? null : null,
      createdAt: row.created_at,
      status: suspended ? "Suspended" as const : "Active" as const,
      parentId: row.parent_agent_id,
      parentName: parentLabel,
      suspended,
      ...(ips
        ? {
            signupIp: dash(ips.signup.get(row.id)),
            lastSeenIp: dash(ips.seen.get(row.id)),
          }
        : {}),
    };
  });

  const q = input.q?.trim().toLowerCase();
  const filtered = q
    ? shaped.filter((row) =>
        [row.name, row.phone === "—" ? "" : row.phone, row.email, row.subCreator === "—" ? "" : row.subCreator, row.store === "—" ? "" : row.store]
          .join(" ")
          .toLowerCase()
          .includes(q)
      )
    : shaped;
  const rows = input.exportAll ? filtered : filtered.slice(0, 300);

  const parentOptions =
    scope.level === "sub"
      ? []
      : scope.parentIds.map((id) => ({ id, name: parentName.get(id) || "Agent" }));

  return { parents: parentOptions, rows };
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
