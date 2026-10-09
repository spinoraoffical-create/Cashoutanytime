import { Suspense } from "react";
import { redirect } from "next/navigation";
import { VipPageLayout } from "@/components/layout/vip-page-layout";
import { UserMessagesInbox } from "@/components/chat/user-messages-inbox";
import { CHAT_PAGE_SHELL_CLASS } from "@/lib/chat/chat-layout";
import { initUserMessagesInbox } from "@/lib/actions/messages";
import { getAuthUser } from "@/lib/supabase/session";

export const dynamic = "force-dynamic";

export default async function SupportChatPage() {
  const user = await getAuthUser();
  if (!user) redirect("/login?redirect=/support/chat");
  const initialData = await initUserMessagesInbox();

  return (
    <VipPageLayout contentClassName="vip-page-content mx-auto flex w-full min-h-0 flex-col py-1">
      <div className={CHAT_PAGE_SHELL_CLASS}>
        <Suspense fallback={<p className="p-6 text-sm text-[#b9b3c6]">Loading support…</p>}>
          <UserMessagesInbox
            variant="thread"
            signedInUserId={user.id}
            initialData={initialData.userId ? initialData : { ...initialData, userId: user.id }}
          />
        </Suspense>
      </div>
    </VipPageLayout>
  );
}
