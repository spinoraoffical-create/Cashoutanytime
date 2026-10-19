import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { InboxList, type InboxItem } from "@/components/notifications/inbox-list";
import { getAuthUser } from "@/lib/supabase/session";
import { createClient } from "@/lib/supabase/server";
import { PLAYER_CHAT_PATH } from "@/lib/notifications/player-notice-rules";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Notifications" };

const PAGE_SIZE = 30;

export default async function InboxPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const user = await getAuthUser();
  if (!user) redirect("/login?redirect=/dashboard/inbox");
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const supabase = await createClient();
  const { data, error, count } = await supabase
    .from("notifications")
    .select("id, title, message, body, type, is_read, created_at, link_url", { count: "exact" })
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .range(from, from + PAGE_SIZE - 1);

  const items: InboxItem[] = ((data ?? []) as {
    id: string;
    title: string;
    message: string | null;
    body: string | null;
    type: string;
    is_read: boolean;
    created_at: string;
    link_url: string | null;
  }[]).map((row) => ({
    id: row.id,
    title: row.title,
    message: row.message || row.body || "",
    type: row.type,
    is_read: row.is_read,
    created_at: row.created_at,
    link_url: row.link_url,
  }));
  const total = count ?? items.length;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-4 pb-10">
      <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-[#1a1030] via-[#24152e] to-[#102044] p-5">
        <h1 className="text-4xl font-black">Notifications</h1>
        <p className="mt-2 max-w-md text-sm text-[#b9b3c6]">Notices for your account stay here. Live chat is a separate page.</p>
        <Link href={PLAYER_CHAT_PATH} className="mt-3 inline-flex rounded-full bg-black/30 px-3 py-1 text-xs font-bold">
          Open live chat
        </Link>
      </section>
      <InboxList items={items} error={error ? "Notifications could not be loaded." : null} />
      {pages > 1 && (
        <div className="flex justify-between text-sm">
          {page > 1 ? <Link href={`/dashboard/inbox?page=${page - 1}`}>Previous</Link> : <span />}
          {page < pages ? <Link href={`/dashboard/inbox?page=${page + 1}`}>Next</Link> : <span />}
        </div>
      )}
    </div>
  );
}
