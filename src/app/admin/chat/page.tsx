import { AdminChatInbox, type AdminConversation } from "@/components/admin/admin-chat-inbox";
import { getAdminChatConversations, getAdminConversationUnreads } from "@/lib/actions/messages";
import { repairPendingSupportReply } from "@/lib/chat/support-auto-reply";
import { CHAT_PAGE_SHELL_CLASS } from "@/lib/chat/chat-layout";

export const dynamic = "force-dynamic";

export default async function AdminChatPage({
  searchParams,
}: {
  searchParams: Promise<{ userId?: string }>;
}) {
  const { userId } = await searchParams;
  const [conversations, initialUnreads] = await Promise.all([
    getAdminChatConversations(),
    getAdminConversationUnreads(),
  ]);
  await Promise.all(
    conversations.slice(0, 12).map((conversation) => repairPendingSupportReply(conversation.user_id))
  );

  return (
    <div className={CHAT_PAGE_SHELL_CLASS}>
      <div className="mb-4 sm:mb-6 shrink-0">
        <h1 className="text-2xl sm:text-3xl font-bold">Customer Chat</h1>
        <p className="text-muted-foreground text-sm sm:text-base">
          Search any user to message them, or reply to existing chats in real time.
        </p>
      </div>

      <div className="flex-1 min-h-0">
        <AdminChatInbox
          conversations={(conversations as AdminConversation[]) || []}
          initialUserId={userId}
          initialUnreads={initialUnreads}
        />
      </div>
    </div>
  );
}
