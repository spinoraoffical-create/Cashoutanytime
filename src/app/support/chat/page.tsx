import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { VipPageLayout } from "@/components/layout/vip-page-layout";
import { AgentThread } from "@/components/agents/agent-thread";
import { UserMessagesInbox } from "@/components/chat/user-messages-inbox";
import { CHAT_PAGE_SHELL_CLASS } from "@/lib/chat/chat-layout";
import { loadMyParentAgent } from "@/lib/actions/player-tickets";
import { getAuthUser } from "@/lib/supabase/session";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Live chat | Sweepstakes Hub",
  robots: { index: false, follow: false },
};

export default async function SupportChatPage() {
  const user = await getAuthUser();
  if (!user) redirect("/login?redirect=/support/chat");
  const { agentId } = await loadMyParentAgent();

  return (
    <VipPageLayout contentClassName="vip-page-content mx-auto flex w-full min-h-0 flex-col py-1">
      <div className={CHAT_PAGE_SHELL_CLASS}>
        <h1 className="text-2xl font-black">Live chat</h1>
        {agentId ? (
          <>
            <p className="text-sm text-[#b9b3c6]">This chat goes to the creator on your account.</p>
            <AgentThread playerId={user.id} agentId={agentId} selfId={user.id} />
          </>
        ) : (
          <>
            <p className="text-sm text-[#b9b3c6]">This chat goes to Customer Chat.</p>
            <UserMessagesInbox />
          </>
        )}
      </div>
    </VipPageLayout>
  );
}
