import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { processAIChatQuery } from "@/lib/ai/chatbot";
import { clientIp, rateLimit } from "@/lib/api/rate-limit";

export async function POST(request: Request) {
  const limited = rateLimit(`ai-bot:${clientIp(request)}`, 30, 60_000);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many requests. Please wait." },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } }
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let body: { message?: string; conversationId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { message = "", conversationId } = body;
  if (!message.trim()) {
    return NextResponse.json({ error: "Message content cannot be empty" }, { status: 400 });
  }

  const aiResult = await processAIChatQuery(message, conversationId, user?.id);

  return NextResponse.json({
    success: true,
    response: aiResult.response,
    confidenceScore: aiResult.confidenceScore,
    escalatedToHuman: aiResult.shouldEscalateToHuman,
  });
}
