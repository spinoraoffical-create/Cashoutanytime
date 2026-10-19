import { handleTelegramWebhook } from "@/lib/telegram/control/webhook-handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ bot: string }> }) {
  const { bot } = await context.params;
  return handleTelegramWebhook(bot, request);
}
