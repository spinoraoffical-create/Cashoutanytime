/** Escalate only when the player asks for a person, or the model call throws. */
export function asksForPerson(query: string) {
  return /\b(person|human|agent|owner)\b/i.test(query);
}

export const SUPPORT_TOPIC_PROMPTS = {
  "adding-money": "I need help adding money.",
  "cash-outs": "I need help with a cash out.",
  games: "I need help with a game balance.",
  account: "I need help with my account.",
  rules: "I have a question about the rules.",
} as const;

export type SupportTopicId = keyof typeof SUPPORT_TOPIC_PROMPTS;

const TOPIC_REPLIES: { test: RegExp; reply: string }[] = [
  {
    test: /\b(adding money|add money|deposit|payment|paydora|wallet)\b/i,
    reply:
      "Sweepstakes Hub AI here. To add money, open Wallet, choose a game and an amount, then pay with Paydora. The payment is added to your main wallet when Paydora confirms it. That balance is for loading a game.",
  },
  {
    test: /\b(cash ?outs?|cashout|payout|redeem)\b/i,
    reply:
      "Sweepstakes Hub AI here. Cash out uses the Cash out ready balance. That balance fills when you redeem from a game. After your ID is verified, open Cash out and choose the amount, method, and account.",
  },
  {
    test: /\b(game balances?|games and balances|in-game|load credits|game account)\b/i,
    reply:
      "Sweepstakes Hub AI here. Open the game, then load to move main-wallet money in, or redeem to move winnings to Cash out ready. A balance check shows the live game balance.",
  },
  {
    test: /\b(account and safety|my account|verification|verify|kyc|sign-?in|password)\b/i,
    reply:
      "Sweepstakes Hub AI here. For sign-in, privacy, or an ID check, open KYC and upload your government ID. Cash out stays closed until that ID is verified.",
  },
  {
    test: /\b(rules|responsible play|responsible gaming|limits?)\b/i,
    reply:
      "Sweepstakes Hub AI here. Program rules and play limits are on the Rules page. You can pause play from Responsible Gaming.",
  },
];

export function supportTopicReply(query: string): string | null {
  if (asksForPerson(query)) return null;
  for (const topic of TOPIC_REPLIES) {
    if (topic.test.test(query)) return topic.reply;
  }
  return null;
}

export function supportGreetingReply(query: string): string | null {
  if (asksForPerson(query) || supportTopicReply(query)) return null;
  if (/\b(h+e+y+|h+i+|h+e+l+o+)\b/i.test(query)) {
    return "Sweepstakes Hub AI here. I can help with adding money, cash outs, games and balances, account and safety, or rules and responsible play. Tell me which one you need.";
  }
  return null;
}

export const CHAT_FALLBACK_REPLY =
  "Sweepstakes Hub AI here. I can help with deposits, cash outs, and game accounts. Tell me what you need.";

export const CHAT_PERSON_REPLY =
  "Sweepstakes Hub AI here. A person from Sweepstakes Hub support will reply in this chat.";
