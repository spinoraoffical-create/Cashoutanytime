import { getBotSenderProfileId } from "@/lib/ai/settings";

export interface AIChatBotResponse {
  response: string;
  confidenceScore: number;
  shouldEscalateToHuman: boolean;
}

/** Live chat is human-only. This does not call a model or write a chat message. */
export async function processAIChatQuery(
  _userQuery: string,
  _conversationId?: string,
  _userId?: string
): Promise<AIChatBotResponse> {
  return {
    response: "",
    confidenceScore: 0,
    shouldEscalateToHuman: true,
  };
}

export { getBotSenderProfileId };
