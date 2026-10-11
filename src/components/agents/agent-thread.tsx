"use client";

import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";

import { loadAgentThread, sendAgentMessage } from "@/lib/actions/agent-chat";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Row = { id: string; sender_id: string; body: string; created_at: string };

export function AgentThread({
  playerId,
  agentId,
  selfId,
  compact = false,
}: {
  playerId: string;
  agentId: string;
  selfId: string;
  compact?: boolean;
}) {
  const [rows, setRows] = useState<Row[]>([]);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;
    void loadAgentThread(playerId, agentId).then((data) => {
      if (!cancelled) setRows(data);
    });

    if (!supabase) {
      return () => {
        cancelled = true;
      };
    }
    const channel = supabase
      .channel(`agent-${playerId}-${agentId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "agent_messages", filter: `player_id=eq.${playerId}` },
        (payload) => {
          const row = payload.new as Row;
          if (row) setRows((current) => (current.some((item) => item.id === row.id) ? current : [...current, row]));
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [agentId, playerId]);

  async function send(event: FormEvent) {
    event.preventDefault();
    const text = body.trim();
    if (!text) return;
    setSending(true);
    const result = await sendAgentMessage({ playerId, agentId, body: text });
    setSending(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setRows((current) => (current.some((item) => item.id === result.row.id) ? current : [...current, result.row]));
    setBody("");
  }

  return (
    <div className={compact ? "flex h-full min-h-0 flex-col" : "flex h-[28rem] flex-col rounded-2xl border border-border"}>
      <div className="flex-1 space-y-2 overflow-y-auto p-4">
        {rows.length === 0 ? <p className="text-sm text-muted-foreground">No messages yet.</p> : null}
        {rows.map((row) => (
          <p
            key={row.id}
            className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
              row.sender_id === selfId ? "ml-auto bg-emerald-500/20" : "bg-muted"
            }`}
          >
            {row.body}
          </p>
        ))}
      </div>
      <form onSubmit={(event) => void send(event)} className="flex gap-2 border-t border-border p-3">
        <Input value={body} onChange={(event) => setBody(event.target.value)} placeholder="Write a message" maxLength={2000} />
        <Button type="submit" disabled={sending}>Send</Button>
      </form>
    </div>
  );
}
