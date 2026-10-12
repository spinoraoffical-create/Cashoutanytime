import { turnOffOfferEmails } from "@/lib/offers/turn-off-offer-emails";

type RouteParams = { params: Promise<{ userId: string; token: string }> };

async function unsubscribe(requestParams: RouteParams["params"]) {
  const { userId, token } = await requestParams;
  const ok = await turnOffOfferEmails(userId, token);
  return new Response(ok ? "unsubscribed" : "invalid", {
    status: ok ? 200 : 400,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

/** Gmail and Yahoo POST this URL from the List-Unsubscribe header. */
export function POST(_request: Request, { params }: RouteParams) {
  return unsubscribe(params);
}

export function GET(_request: Request, { params }: RouteParams) {
  return unsubscribe(params);
}
