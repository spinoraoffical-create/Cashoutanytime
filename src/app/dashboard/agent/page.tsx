import Link from "next/link";
import { redirect } from "next/navigation";

import { AgentThread } from "@/components/agents/agent-thread";
import { adminDb } from "@/lib/actions/admin/core";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Your agent" };

export default async function PlayerAgentPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const db = adminDb();
  const { data: profile } = await db
    .from("profiles")
    .select("parent_agent_id, full_name")
    .eq("id", user.id)
    .maybeSingle();
  const agentId = (profile as { parent_agent_id?: string | null } | null)?.parent_agent_id;
  const { data: agent } = agentId
    ? await db.from("profiles").select("full_name, email").eq("id", agentId).maybeSingle()
    : { data: null };
  const agentName =
    (agent as { full_name?: string | null; email?: string | null } | null)?.full_name ||
    (agent as { email?: string | null } | null)?.email ||
    "your agent";

  return (
    <div className="mx-auto max-w-2xl space-y-4 px-1 py-6">
      <h1 className="text-3xl font-black">Your agent</h1>
      {agentId ? (
        <>
          <p className="text-sm text-muted-foreground">Chat with {agentName}. A ticket to the platform still goes to support, not to this chat.</p>
          <AgentThread playerId={user.id} agentId={agentId} selfId={user.id} />
        </>
      ) : (
        <p className="text-sm text-muted-foreground">You are not assigned to an agent yet.</p>
      )}
      <Link href="/support" className="inline-flex text-sm font-semibold text-[#ff6b89]">
        Open a ticket to the platform
      </Link>
    </div>
  );
}
