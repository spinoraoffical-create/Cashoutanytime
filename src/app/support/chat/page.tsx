import { redirect } from "next/navigation";
import { VipPageLayout } from "@/components/layout/vip-page-layout";
import { AgentThread } from "@/components/agents/agent-thread";
import { CHAT_PAGE_SHELL_CLASS } from "@/lib/chat/chat-layout";
import { loadMyParentAgent } from "@/lib/actions/player-tickets";
import { getAuthUser } from "@/lib/supabase/session";

export const dynamic = "force-dynamic";

export default async function SupportChatPage() {
  const user = await getAuthUser();
  if (!user) redirect("/login?redirect=/support/chat");
  const { agentId } = await loadMyParentAgent();

  return (
    <VipPageLayout contentClassName="vip-page-content mx-auto flex w-full min-h-0 flex-col py-1">
      <div className={CHAT_PAGE_SHELL_CLASS}>
        <h1 className="text-2xl font-black">Private chat</h1>
        {agentId ? (
          <AgentThread playerId={user.id} agentId={agentId} selfId={user.id} />
        ) : (
          <p className="text-sm text-[#b9b3c6]">You are not assigned.</p>
        )}
      </div>
    </VipPageLayout>
  );
}
