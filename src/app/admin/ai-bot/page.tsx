import type { Metadata } from "next";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminAiBotControlCard } from "@/components/admin/admin-ai-bot-control-card";
import { AdminSectionCard } from "@/components/admin/ui/admin-section-card";
import { AdminStatusBadge } from "@/components/admin/ui/admin-status-badge";
import { AdminErrorState } from "@/components/admin/ui/admin-error-state";
import { AdminEmptyState } from "@/components/admin/ui/admin-empty-state";
import { formatNepalTime } from "@/lib/admin/nepal-time";
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
    logsError = "The admin database client is missing, so chatbot settings cannot be saved from here.";
  } else {
    const { data, error } = await db
      .from("ai_chat_logs")
      .select("id, user_query, bot_response, confidence_score, escalated_to_human, created_at")
      .order("created_at", { ascending: false })
      .limit(15);

    if (error) {
      logsError = /ai_chat_logs|schema cache|does not exist/i.test(error.message)
        ? "Chat logs are not available until the AI tables exist."
        : "Chat logs could not be loaded.";
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
        title="Support chatbot"
        description="The switch below is the saved chatbot setting. Opening this page does not send a chat or change the switch. Keys stay hidden."
      />

      {logsError ? <AdminErrorState title="Chat logs could not be loaded" body={logsError} /> : null}

      <AdminAiBotControlCard />

      <div className="grid gap-4 sm:grid-cols-3">
        <AdminSectionCard title="Saved switch" description="On means the stored chatbot switch is enabled. Off means it is disabled.">
          <AdminStatusBadge status={chatSettings.is_enabled ? "On" : "Off"} />
        </AdminSectionCard>
        <AdminSectionCard title="Reply engine" description="This shows whether a model key is present. The key value stays hidden. This page does not call the model.">
          <AdminStatusBadge status={isLLMConfigured ? "Model key present" : "No model key"} />
        </AdminSectionCard>
        <AdminSectionCard title="Handover threshold" description="Stored percent. A chat at or below this confidence can be handed to a person. This page does not send that chat.">
          <p className="text-2xl font-semibold tabular-nums text-white">{thresholdPct}%</p>
        </AdminSectionCard>
      </div>

      <AdminSectionCard title="Recent chatbot replies" description="Saved replies only. This list does not send a new message.">
        {logs.length === 0 ? (
          <AdminEmptyState
            title="No chatbot replies in this list"
            body={logsError ? "Logs stay hidden until they can be loaded." : "Replies appear here after a player uses the existing chat widget."}
          />
        ) : (
          <div className="space-y-4">
            {logs.map((log) => (
              <article key={log.id} className="space-y-2 rounded-xl border border-white/10 bg-[#0c1224] p-4">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#9fb0d0]">
                  <span>{formatNepalTime(log.created_at)}</span>
                  <div className="flex items-center gap-2">
                    <AdminStatusBadge status={`${Math.round(log.confidence_score * 100)}% confidence`} />
                    {log.escalated_to_human ? <AdminStatusBadge status="Escalated" /> : null}
                  </div>
                </div>
                <p className="text-xs font-semibold text-emerald-200">Player</p>
                <p className="rounded-lg bg-white/5 p-2 text-sm text-white">{log.user_query}</p>
                <p className="text-xs font-semibold text-sky-200">Chatbot</p>
                <p className="whitespace-pre-wrap rounded-lg bg-white/5 p-2 text-sm text-[#9fb0d0]">{log.bot_response}</p>
              </article>
            ))}
          </div>
        )}
      </AdminSectionCard>
    </div>
  );
}
