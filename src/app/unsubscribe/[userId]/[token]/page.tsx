import { turnOffOfferEmails } from "@/lib/offers/turn-off-offer-emails";

export default async function UnsubscribePage({
  params,
}: {
  params: Promise<{ userId: string; token: string }>;
}) {
  const { userId, token } = await params;
  const ok = await turnOffOfferEmails(userId, token);
  if (!ok) {
    return (
      <main className="mx-auto max-w-md px-6 py-16 text-center">
        <h1 className="text-2xl font-bold">This unsubscribe link is not valid.</h1>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-md px-6 py-16 text-center">
      <h1 className="text-2xl font-bold">You will not receive offer emails.</h1>
      <p className="mt-3 text-sm text-muted-foreground">Account emails such as your sign-in code still arrive.</p>
    </main>
  );
}
