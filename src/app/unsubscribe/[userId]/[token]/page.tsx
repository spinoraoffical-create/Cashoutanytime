import { createAdminClient } from "@/lib/supabase/admin";
import { validUnsubscribeToken } from "@/lib/offers/tokens";

export default async function UnsubscribePage({
  params,
}: {
  params: Promise<{ userId: string; token: string }>;
}) {
  const { userId, token } = await params;
  const secret = process.env.OFFER_LINK_SECRET || process.env.RESEND_API_KEY || "";
  const admin = createAdminClient();
  const valid = validUnsubscribeToken(userId, token, secret);
  if (!admin || !valid) {
    return (
      <main className="mx-auto max-w-md px-6 py-16 text-center">
        <h1 className="text-2xl font-bold">This unsubscribe link is not valid.</h1>
      </main>
    );
  }

  await admin.from("notification_preferences").upsert(
    { user_id: userId, email_promotions: false },
    { onConflict: "user_id" }
  );

  return (
    <main className="mx-auto max-w-md px-6 py-16 text-center">
      <h1 className="text-2xl font-bold">You will not receive offer emails.</h1>
      <p className="mt-3 text-sm text-muted-foreground">SMS offers stay on until you reply STOP.</p>
    </main>
  );
}
