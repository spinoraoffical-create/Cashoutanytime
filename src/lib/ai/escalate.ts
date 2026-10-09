/** Escalate only when the player asks for a person, or the model call throws. */
export function asksForPerson(query: string) {
  return /\b(person|human)\b/i.test(query);
}

export const CHAT_FALLBACK_REPLY =
  "Sweepstakes Hub AI here. I can help with deposits, cash outs, and game accounts. Tell me what you need.";

export const CHAT_PERSON_REPLY =
  "Sweepstakes Hub AI here. A person from Sweepstakes Hub support will reply in this chat.";
