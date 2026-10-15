import "server-only";

import { randomUUID } from "crypto";

import { adminDb } from "@/lib/actions/admin/core";
import type { TicketPriority, TicketStatus } from "@/lib/database.types";

const TICKET_ACTION = "player_support_ticket";
const OPEN_STATUSES: TicketStatus[] = ["open", "pending", "in_progress"];

export type StoredTicketMessage = {
  id: string;
  is_staff: boolean;
  body: string;
  attachment_url: string | null;
  created_at: string;
};

export type StoredTicket = {
  id: string;
  ticket_no: number;
  subject: string;
  category: string;
  status: TicketStatus;
  priority: TicketPriority;
  assigned_to: string | null;
  last_message_at: string;
  created_at: string;
  user_id: string;
  profiles: { email: string | null; full_name: string | null } | null;
  messages: StoredTicketMessage[];
};

type TicketMeta = {
  ticketNo: number;
  status: TicketStatus;
  priority: TicketPriority;
  category: string;
  assignedTo: string | null;
  lastMessageAt: string;
  closedAt: string | null;
  messages: StoredTicketMessage[];
};

type ActivityRow = {
  id: string;
  user_id: string;
  description: string | null;
  metadata: TicketMeta | null;
  created_at: string;
};

let tableReady: boolean | null = null;

function missingTable(error: { message?: string; code?: string } | null | undefined) {
  if (!error) return false;
  return error.code === "PGRST205" || /schema cache|does not exist/i.test(error.message ?? "");
}

async function usesTicketTable() {
  if (tableReady !== null) return tableReady;
  const probe = await adminDb().from("support_tickets").select("id").limit(1);
  tableReady = !missingTable(probe.error);
  return tableReady;
}

function asMeta(value: unknown): TicketMeta | null {
  if (!value || typeof value !== "object") return null;
  const row = value as TicketMeta;
  if (!row.ticketNo || !row.status || !Array.isArray(row.messages)) return null;
  return row;
}

function fromActivity(row: ActivityRow, profile: StoredTicket["profiles"]): StoredTicket | null {
  const meta = asMeta(row.metadata);
  if (!meta) return null;
  return {
    id: row.id,
    ticket_no: meta.ticketNo,
    subject: row.description ?? "",
    category: meta.category || "other",
    status: meta.status,
    priority: meta.priority === "low" || meta.priority === "high" || meta.priority === "urgent" ? meta.priority : "normal",
    assigned_to: meta.assignedTo,
    last_message_at: meta.lastMessageAt || row.created_at,
    created_at: row.created_at,
    user_id: row.user_id,
    profiles: profile,
    messages: meta.messages ?? [],
  };
}

async function profilesFor(userIds: string[]) {
  const unique = [...new Set(userIds)];
  const map = new Map<string, StoredTicket["profiles"]>();
  if (!unique.length) return map;
  const { data } = await adminDb().from("profiles").select("id, email, full_name").in("id", unique);
  for (const row of (data ?? []) as { id: string; email: string | null; full_name: string | null }[]) {
    map.set(row.id, { email: row.email, full_name: row.full_name });
  }
  return map;
}

async function activityRows(userId?: string) {
  let query = adminDb()
    .from("activity_log")
    .select("id, user_id, description, metadata, created_at")
    .eq("action", TICKET_ACTION)
    .order("created_at", { ascending: false })
    .limit(200);
  if (userId) query = query.eq("user_id", userId);
  const { data } = await query;
  return (data ?? []) as ActivityRow[];
}

async function nextTicketNo() {
  const rows = await activityRows();
  const max = rows.reduce((highest, row) => Math.max(highest, asMeta(row.metadata)?.ticketNo ?? 0), 0);
  return max + 1;
}

function fromTableRow(
  row: {
    id: string;
    ticket_no: number;
    subject: string;
    category: string;
    status: TicketStatus;
    priority: TicketPriority;
    assigned_to: string | null;
    last_message_at: string;
    created_at: string;
    user_id: string;
    profiles?: StoredTicket["profiles"] | StoredTicket["profiles"][] | null;
  },
  messages: StoredTicketMessage[]
): StoredTicket {
  const profile = Array.isArray(row.profiles) ? row.profiles[0] ?? null : row.profiles ?? null;
  return {
    id: row.id,
    ticket_no: row.ticket_no,
    subject: row.subject,
    category: row.category,
    status: row.status,
    priority: row.priority,
    assigned_to: row.assigned_to,
    last_message_at: row.last_message_at,
    created_at: row.created_at,
    user_id: row.user_id,
    profiles: profile,
    messages,
  };
}

export async function listPlayerTickets(userId: string): Promise<StoredTicket[]> {
  if (await usesTicketTable()) {
    const db = adminDb();
    const { data, error } = await db
      .from("support_tickets")
      .select("id, ticket_no, subject, category, status, priority, assigned_to, last_message_at, created_at, user_id")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) {
      if (missingTable(error)) {
        tableReady = false;
      } else {
        return [];
      }
    } else {
      const rows = data ?? [];
      const ids = rows.map((row) => row.id);
      const { data: messageRows } = ids.length
        ? await db.from("ticket_messages").select("id, ticket_id, is_staff, body, attachment_url, created_at").in("ticket_id", ids)
        : { data: [] as { id: string; ticket_id: string; is_staff: boolean; body: string; attachment_url: string | null; created_at: string }[] };
      const grouped = new Map<string, StoredTicketMessage[]>();
      for (const message of messageRows ?? []) {
        const list = grouped.get(message.ticket_id) ?? [];
        list.push({
          id: message.id,
          is_staff: message.is_staff,
          body: message.body,
          attachment_url: message.attachment_url,
          created_at: message.created_at,
        });
        grouped.set(message.ticket_id, list);
      }
      return rows.map((row) => fromTableRow(row, grouped.get(row.id) ?? []));
    }
  }

  const profiles = await profilesFor([userId]);
  return (await activityRows(userId))
    .map((row) => fromActivity(row, profiles.get(row.user_id) ?? null))
    .filter((row): row is StoredTicket => Boolean(row));
}

export async function countOpenTicketsFor(userId: string) {
  const tickets = await listPlayerTickets(userId);
  return tickets.filter((ticket) => OPEN_STATUSES.includes(ticket.status)).length;
}

export async function countOpenTickets() {
  if (await usesTicketTable()) {
    const { count, error } = await adminDb()
      .from("support_tickets")
      .select("id", { count: "exact", head: true })
      .in("status", OPEN_STATUSES);
    if (!error) return count ?? 0;
    if (missingTable(error)) tableReady = false;
    else return null;
  }
  const tickets = (await activityRows())
    .map((row) => fromActivity(row, null))
    .filter((row): row is StoredTicket => Boolean(row));
  return tickets.filter((ticket) => OPEN_STATUSES.includes(ticket.status)).length;
}

export async function listAdminTickets(statuses: TicketStatus[]): Promise<StoredTicket[] | null> {
  if (await usesTicketTable()) {
    const { data, error } = await adminDb()
      .from("support_tickets")
      .select("id, ticket_no, subject, category, status, priority, assigned_to, last_message_at, created_at, user_id, profiles(email, full_name)")
      .in("status", statuses)
      .order("last_message_at", { ascending: false })
      .limit(100);
    if (!error) return (data ?? []).map((row) => fromTableRow(row, []));
    if (missingTable(error)) tableReady = false;
    else return null;
  }
  const rows = await activityRows();
  const matched = rows
    .map((row) => fromActivity(row, null))
    .filter((row): row is StoredTicket => row !== null && statuses.includes(row.status));
  const profiles = await profilesFor(matched.map((row) => row.user_id));
  return matched.map((row) => ({ ...row, profiles: profiles.get(row.user_id) ?? null }));
}

export async function listRecentTickets(limit = 5): Promise<StoredTicket[] | null> {
  if (await usesTicketTable()) {
    const { data, error } = await adminDb()
      .from("support_tickets")
      .select("id, ticket_no, subject, category, status, priority, assigned_to, last_message_at, created_at, user_id, profiles(email, full_name)")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (!error) return (data ?? []).map((row) => fromTableRow(row, []));
    if (!missingTable(error)) return null;
    tableReady = false;
  }
  const tickets = await listAdminTickets(["open", "pending", "in_progress", "resolved", "closed"]);
  if (tickets == null) return null;
  return tickets
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
    .slice(0, limit);
}

export async function getAdminTicket(id: string): Promise<StoredTicket | null> {
  if (await usesTicketTable()) {
    const db = adminDb();
    const { data, error } = await db
      .from("support_tickets")
      .select("id, ticket_no, subject, category, status, priority, assigned_to, last_message_at, created_at, user_id, profiles(email, full_name)")
      .eq("id", id)
      .maybeSingle();
    if (!error && data) {
      const { data: messages } = await db
        .from("ticket_messages")
        .select("id, is_staff, body, attachment_url, created_at")
        .eq("ticket_id", id)
        .order("created_at", { ascending: true });
      return fromTableRow(data, (messages ?? []) as StoredTicketMessage[]);
    }
    if (error && missingTable(error)) tableReady = false;
    else if (!error) return null;
  }

  const { data } = await adminDb()
    .from("activity_log")
    .select("id, user_id, description, metadata, created_at")
    .eq("id", id)
    .eq("action", TICKET_ACTION)
    .maybeSingle();
  if (!data) return null;
  const profiles = await profilesFor([data.user_id]);
  return fromActivity(data as ActivityRow, profiles.get(data.user_id) ?? null);
}

export async function createStoredTicket(input: {
  userId: string;
  subject: string;
  body: string;
}): Promise<{ ok: true; ticketNo: number } | { ok: false; error: string }> {
  const now = new Date().toISOString();
  if (await usesTicketTable()) {
    const db = adminDb();
    const { data: created, error } = await db
      .from("support_tickets")
      .insert({ user_id: input.userId, subject: input.subject })
      .select("id, ticket_no")
      .single();
    if (!error && created) {
      const { error: messageError } = await db.from("ticket_messages").insert({
        ticket_id: created.id,
        sender_id: input.userId,
        is_staff: false,
        body: input.body,
      });
      if (messageError) return { ok: false, error: "Ticket could not be created." };
      return { ok: true, ticketNo: created.ticket_no as number };
    }
    if (!missingTable(error)) return { ok: false, error: "Ticket could not be created." };
    tableReady = false;
  }

  const ticketNo = await nextTicketNo();
  const meta: TicketMeta = {
    ticketNo,
    status: "open",
    priority: "normal",
    category: "other",
    assignedTo: null,
    lastMessageAt: now,
    closedAt: null,
    messages: [
      {
        id: randomUUID(),
        is_staff: false,
        body: input.body,
        attachment_url: null,
        created_at: now,
      },
    ],
  };
  const { error } = await adminDb().from("activity_log").insert({
    user_id: input.userId,
    action: TICKET_ACTION,
    description: input.subject,
    metadata: meta,
  });
  if (error) return { ok: false, error: "Ticket could not be created." };
  return { ok: true, ticketNo };
}

async function updateActivityTicket(id: string, change: (meta: TicketMeta) => TicketMeta) {
  const db = adminDb();
  const { data } = await db
    .from("activity_log")
    .select("id, metadata")
    .eq("id", id)
    .eq("action", TICKET_ACTION)
    .maybeSingle();
  const meta = asMeta(data?.metadata);
  if (!data || !meta) return null;
  const next = change(meta);
  const { error } = await db.from("activity_log").update({ metadata: next }).eq("id", id);
  if (error) return null;
  return next;
}

export async function addTicketMessage(input: {
  ticketId: string;
  senderId: string;
  isStaff: boolean;
  body: string;
  attachmentUrl?: string | null;
}): Promise<{ userId: string; ticketNo: number; subject: string } | null> {
  if (await usesTicketTable()) {
    const db = adminDb();
    const { error } = await db.from("ticket_messages").insert({
      ticket_id: input.ticketId,
      sender_id: input.senderId,
      is_staff: input.isStaff,
      body: input.body,
      attachment_url: input.attachmentUrl ?? null,
    });
    if (!error) {
      const { data: ticket } = await db
        .from("support_tickets")
        .select("user_id, ticket_no, subject")
        .eq("id", input.ticketId)
        .maybeSingle();
      if (!ticket) return null;
      return { userId: ticket.user_id, ticketNo: ticket.ticket_no, subject: ticket.subject };
    }
    if (!missingTable(error)) return null;
    tableReady = false;
  }

  const current = await getAdminTicket(input.ticketId);
  if (!current) return null;
  const now = new Date().toISOString();
  const saved = await updateActivityTicket(input.ticketId, (meta) => ({
    ...meta,
    lastMessageAt: now,
    status: input.isStaff && meta.status === "open" ? "in_progress" : meta.status === "resolved" && !input.isStaff ? "open" : meta.status,
    messages: [
      ...meta.messages,
      {
        id: randomUUID(),
        is_staff: input.isStaff,
        body: input.body,
        attachment_url: input.attachmentUrl ?? null,
        created_at: now,
      },
    ],
  }));
  if (!saved) return null;
  return { userId: current.user_id, ticketNo: current.ticket_no, subject: current.subject };
}

export async function setStoredTicketStatus(ticketId: string, status: TicketStatus) {
  if (await usesTicketTable()) {
    const { error } = await adminDb()
      .from("support_tickets")
      .update({
        status,
        closed_at: status === "closed" ? new Date().toISOString() : null,
      })
      .eq("id", ticketId);
    if (!error) return true;
    if (!missingTable(error)) return false;
    tableReady = false;
  }
  const saved = await updateActivityTicket(ticketId, (meta) => ({
    ...meta,
    status,
    closedAt: status === "closed" ? new Date().toISOString() : null,
  }));
  return Boolean(saved);
}

export async function assignStoredTicket(ticketId: string, staffId: string) {
  if (await usesTicketTable()) {
    const { error } = await adminDb().from("support_tickets").update({ assigned_to: staffId }).eq("id", ticketId);
    if (!error) return true;
    if (!missingTable(error)) return false;
    tableReady = false;
  }
  const saved = await updateActivityTicket(ticketId, (meta) => ({ ...meta, assignedTo: staffId }));
  return Boolean(saved);
}
