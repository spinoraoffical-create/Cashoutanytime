import { redirect } from "next/navigation";

import { AgentThread } from "@/components/agents/agent-thread";
import { loadMyParentAgent } from "@/lib/actions/player-tickets";
import { getAuthUser } from "@/lib/supabase/session";

export const dynamic = "force-dynamic";

export default async function MessagesPage() {
  const user = await getAuthUser();
  if (!user) redirect("/login?redirect=/dashboard/messages");
  const { agentId } = await loadMyParentAgent();

  return (
    <div className="space-y-4 pb-8">
      <section className="overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-r from-[#140a22] via-[#24152e] to-[#1a2744] p-5">
        <h1 className="max-w-sm text-3xl font-black leading-tight">Private chat</h1>
        <p className="mt-2 max-w-sm text-sm text-[#b9b3c6]">
          This chat goes to the store or sub-creator on your account.
        </p>
      </section>
      {agentId ? (
        <AgentThread playerId={user.id} agentId={agentId} selfId={user.id} />
      ) : (
        <p className="text-sm text-[#b9b3c6]">You are not assigned.</p>
      )}
    </div>
  );
}
