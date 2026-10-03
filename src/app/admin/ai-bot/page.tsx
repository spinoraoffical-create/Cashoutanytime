import type { Metadata } from "next";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminAiBotControlCard } from "@/components/admin/admin-ai-bot-control-card";
import { GlassCard } from "@/components/shared/glass-card";
import { Badge } from "@/components/ui/badge";
import { requirePermission } from "@/lib/data/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { getChatbotSettings } from "@/lib/ai/settings";

export const metadata: Metadata = { title: "AI Chatbot Control" };

type ChatLogRow = {
  id: string;
  user_query: string;
  bot_response: string;
  confidence_score: number;
  escalated_to_human: boolean;
  created_at: string;
};

export default async function AdminAIChatbotPage() {
  await requirePermission("support.manage");
  const chatSettings = await getChatbotSettings();

  let logs: ChatLogRow[] = [];
  let logsError: string | null = null;

  const db = createAdminClient();
  if (!db) {
    logsError = "SUPABASE_SERVICE_ROLE_KEY is missing — AI settings cannot be saved.";
  } else {
    const { data, error } = await db
      .from("ai_chat_logs")
      .select("id, user_query, bot_response, confidence_score, escalated_to_human, created_at")
      .order("created_at", { ascending: false })
      .limit(15);

    if (error) {
      logsError = /ai_chat_logs|schema cache|does not exist/i.test(error.message)
        ? "Run supabase/migrations/20260720000300_kyc_and_ai_system.sql in Supabase SQL Editor."
        : error.message;
    } else {
      logs = (data ?? []) as ChatLogRow[];
    }
  }

  const isLLMConfigured = Boolean(
    process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY || process.env.GEMINI_API_KEY
  );

  const thresholdPct = Math.round(Number(chatSettings.human_handover_threshold) * 100);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <AdminPageHeader
        title="AI Customer Support Chatbot"
        description="Database-backed controls, unified chatbot engine, Telegram escalation, and live conversation logs."
      />

      {logsError && (
        <GlassCard className="border-amber-500/40 bg-amber-500/5 p-4">
          <p className="text-sm font-bold text-amber-400">AI database setup required</p>
          <p className="mt-1 text-xs text-muted-foreground">{logsError}</p>
        </GlassCard>
      )}

      <AdminAiBotControlCard />

      <div className="grid gap-4 sm:grid-cols-3">
        <GlassCard className="p-5">
          <p className="hud-label text-xs text-muted-foreground">AI Support Status</p>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-emerald-400">
              {chatSettings.is_enabled ? "Active" : "Paused"}
            </span>
            <Badge className={chatSettings.is_enabled ? "bg-emerald-500/15 text-emerald-400" : "bg-rose-500/15 text-rose-400"}>
              {chatSettings.is_enabled ? "24/7 Online" : "Offline"}
            </Badge>
          </div>
        </GlassCard>

        <GlassCard className="p-5">
          <p className="hud-label text-xs text-muted-foreground">Engine Mode</p>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-lg font-bold text-foreground">
              {isLLMConfigured ? "LLM + Knowledge Base" : "Knowledge Base Only"}
            </span>
            <Badge variant="outline">{isLLMConfigured ? "LLM Ready" : "Rules Only"}</Badge>
          </div>
        </GlassCard>

        <GlassCard className="p-5">
          <p className="hud-label text-xs text-muted-foreground">Human Handover Threshold</p>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-ws-green">{thresholdPct}%</span>
            <Badge className="bg-ws-green/15 text-ws-green">Auto Escalate</Badge>
          </div>
        </GlassCard>
      </div>

      <GlassCard className="p-6">
        <div className="flex items-center justify-between border-b border-border/50 pb-4 mb-4">
          <h2 className="text-lg font-semibold text-foreground">Recent AI Chatbot Interactions</h2>
          <Badge variant="outline" className="font-mono">
            Unified engine
          </Badge>
        </div>

        <div className="space-y-4">
          {logs.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {logsError
                ? "Chat logs unavailable until the AI migration is applied."
                : "No AI chat logs yet. Logs appear when users chat via the live widget or dashboard."}
            </p>
          ) : (
            logs.map((log) => (
              <div key={log.id} className="border border-border/60 rounded-lg p-4 bg-background/40 space-y-2">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{new Date(log.created_at).toLocaleString()}</span>
                  <div className="flex items-center gap-2">
                    <Badge variant={log.confidence_score >= 0.8 ? "default" : "secondary"}>
                      Confidence: {Math.round(log.confidence_score * 100)}%
                    </Badge>
                    {log.escalated_to_human && (
                      <Badge className="bg-amber-500/20 text-amber-400">Escalated</Badge>
                    )}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-bold text-emerald-400">User Query</p>
                  <p className="text-sm text-foreground bg-background/60 p-2 rounded mt-0.5">{log.user_query}</p>
                </div>
                <div>
                  <p className="text-xs font-bold text-sky-400">AI Response</p>
                  <p className="text-sm text-muted-foreground bg-background/60 p-2 rounded mt-0.5 whitespace-pre-wrap">
                    {log.bot_response}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </GlassCard>
    </div>
  );
}
