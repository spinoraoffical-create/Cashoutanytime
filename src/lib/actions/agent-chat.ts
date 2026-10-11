"use server";

import { adminDb } from "@/lib/actions/admin/core";
import { createClient } from "@/lib/supabase/server";

export type AgentChatRow = { id: string; sender_id: string; body: string; created_at: string };

async function allowed(playerId: string, agentId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  if (user.id !== playerId && user.id !== agentId) return null;
  const { data } = await adminDb()
    .from("profiles")
    .select("parent_agent_id")
    .eq("id", playerId)
    .maybeSingle();
  const parentId = (data as { parent_agent_id?: string | null } | null)?.parent_agent_id ?? null;
  if (parentId !== agentId) return null;
  return user;
}

export async function loadAgentThread(playerId: string, agentId: string): Promise<AgentChatRow[]> {
  const user = await allowed(playerId, agentId);
  if (!user) return [];
  const { data } = await adminDb()
    .from("agent_messages")
    .select("id, sender_id, body, created_at")
    .eq("player_id", playerId)
    .eq("agent_id", agentId)
    .order("created_at", { ascending: true });
  return (data ?? []) as AgentChatRow[];
}

export async function sendAgentMessage(input: {
  playerId: string;
  agentId: string;
  body: string;
}): Promise<{ ok: true; row: AgentChatRow } | { ok: false; error: string }> {
  const text = input.body.trim();
  if (!text || text.length > 2000) return { ok: false, error: "Write a message." };
  const user = await allowed(input.playerId, input.agentId);
  if (!user) return { ok: false, error: "Message was not sent." };
  const { data, error } = await adminDb()
    .from("agent_messages")
    .insert({
      player_id: input.playerId,
      agent_id: input.agentId,
      sender_id: user.id,
      body: text,
    })
    .select("id, sender_id, body, created_at")
    .single();
  if (error || !data) return { ok: false, error: "Message was not sent." };
  return { ok: true, row: data as AgentChatRow };
}
