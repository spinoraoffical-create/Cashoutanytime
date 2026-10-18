import { redirect } from "next/navigation";

import { AdminChatInbox, type AdminConversation } from "@/components/admin/admin-chat-inbox";
import { getAdminChatConversations, getAdminConversationUnreads, getRecentCustomersForChat } from "@/lib/actions/messages";
import { CHAT_PAGE_SHELL_CLASS } from "@/lib/chat/chat-layout";
import { platformTicketAccess } from "@/lib/support/ticket-access";

export const dynamic = "force-dynamic";

export default async function AdminChatPage({
  searchParams,
}: {
  searchParams: Promise<{ userId?: string }>;
}) {
  const { userId } = await searchParams;
  const { allowed, isSub, isStore } = await platformTicketAccess();
  if (isStore || isSub) redirect("/admin/agent-inbox");
  if (!allowed) redirect("/admin");
  const [conversations, initialUnreads, recentPlayers] = await Promise.all([
    getAdminChatConversations(),
    getAdminConversationUnreads(),
    getRecentCustomersForChat(),
  ]);

  return (
    <div className={CHAT_PAGE_SHELL_CLASS}>
      <div className="mb-4 sm:mb-6 shrink-0">
        <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">Live chat</h1>
        <p className="text-sm leading-6 text-[#9fb0d0] sm:text-base">
          Search a player to message them, or reply to an existing chat. This screen does not change a wallet.
        </p>
      </div>

      <div className="flex-1 min-h-0">
        <AdminChatInbox
          conversations={(conversations as AdminConversation[]) || []}
          recentPlayers={recentPlayers}
          initialUserId={userId}
          initialUnreads={initialUnreads}
        />
      </div>
    </div>
  );
}
