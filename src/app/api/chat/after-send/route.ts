import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createNotification } from "@/lib/actions/notifications";
import { notifyAdminOfCustomerMessage } from "@/lib/telegram/notify-admin-message";
import { asksForPerson } from "@/lib/ai/escalate";
import { supportReferenceCode } from "@/lib/chat/support-thread";
import { getStaffContext } from "@/lib/data/admin";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let body: {
    conversationId?: string;
    content?: string;
    attachmentType?: "image" | "file" | null;
    kind?: "user" | "admin";
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const { conversationId, content = "", attachmentType = null, kind } = body;
  if (!conversationId || !kind) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const staff = await getStaffContext();

  if (kind === "admin") {
    if (!staff) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { data: conversation } = await supabase
      .from("conversations")
      .select("user_id")
      .eq("id", conversationId)
      .single();

    await supabase
      .from("conversations")
      .update({ updated_at: new Date().toISOString(), admin_id: user.id })
      .eq("id", conversationId);

    if (conversation?.user_id) {
      const preview =
        content.trim() ||
        (attachmentType === "image"
          ? "Sent you an image"
          : attachmentType === "file"
            ? "Sent you a file"
            : "Sent you a message");
      await createNotification(
        conversation.user_id,
        "New message from Support",
        preview.length > 140 ? `${preview.slice(0, 137)}...` : preview,
        "info"
      );
    }
  } else {
    const adminClient = createAdminClient();
    const db = adminClient ?? supabase;
    const { data: ownedRows } = await db
      .from("conversations")
      .select("user_id")
      .eq("id", conversationId)
      .limit(1);
    const conversation = (ownedRows as { user_id: string }[] | null)?.[0];

    if (!conversation || conversation.user_id !== user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    await db
      .from("conversations")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", conversationId);

    void notifyAdminOfCustomerMessage({
      conversationId,
      senderId: user.id,
      content,
      attachmentType,
    });

    const wantsPerson = asksForPerson(content);
    if (wantsPerson && content.trim()) {
      const queue = await readHumanQueue(db, conversationId);
      if (!queue.queued && queue.columnsReady) {
        await db
          .from("conversations")
          .update({
            human_requested_at: new Date().toISOString(),
            support_reference: supportReferenceCode(conversationId),
            updated_at: new Date().toISOString(),
          })
          .eq("id", conversationId);
        void import("@/lib/telegram/control/safe-emit")
          .then(({ safePaymentAlert }) =>
            safePaymentAlert({
              category: "ticket_escalated",
              eventKey: `escalation:${conversationId}`,
              source: "ledger",
              reference: conversationId,
              detail: "A player asked for a person in chat.",
              adminPath: "/admin/chat",
            })
          )
          .catch(() => undefined);
      }
    }
  }

  return NextResponse.json({ ok: true });
}

async function readHumanQueue(
  db: SupabaseClient,
  conversationId: string
): Promise<{ queued: boolean; columnsReady: boolean }> {
  const { data, error } = await db
    .from("conversations")
    .select("human_requested_at")
    .eq("id", conversationId)
    .limit(1);

  if (error) {
    const found = await db
      .from("messages")
      .select("content")
      .eq("conversation_id", conversationId)
      .ilike("content", "%will reply in this chat%")
      .limit(1);
    return { queued: Boolean(found.data?.length), columnsReady: false };
  }

  return {
    queued: Boolean(data?.[0]?.human_requested_at),
    columnsReady: true,
  };
}
