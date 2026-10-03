import { createClient } from "@/lib/supabase/server";
import { AdminChatInbox, type AdminConversation } from "@/components/admin/admin-chat-inbox";
import { getAdminConversationUnreads } from "@/lib/actions/messages";
import { CHAT_PAGE_SHELL_CLASS } from "@/lib/chat/chat-layout";

export default async function AdminChatPage({
  searchParams,
}: {
  searchParams: Promise<{ userId?: string }>;
}) {
  const { userId } = await searchParams;
  const supabase = await createClient();

  const [{ data: conversations }, initialUnreads] = await Promise.all([
    supabase
      .from("conversations")
      .select(
        "id, user_id, updated_at, user:profiles!conversations_user_id_fkey(full_name, email, is_online, last_seen_at)"
      )
      .eq("is_active", true)
      .order("updated_at", { ascending: false })
      .limit(80),
    getAdminConversationUnreads(),
  ]);

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
