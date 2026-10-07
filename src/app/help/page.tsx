import Link from "next/link";
import { VipPageLayout } from "@/components/layout/vip-page-layout";
import { getPublishedFaqs } from "@/lib/data/faqs-public";
import { HelpFaqList } from "@/components/player/help-faq-list";
import { GAME_BONUS_RULES } from "@/lib/games";

export const metadata = { title: "Help & FAQ | Sweepstakes Hub" };

const FALLBACK = [
  {
    id: "add",
    category: "wallet",
    question: "How do I add credits to my wallet?",
    answer: `Open Wallet, choose a payment method, and complete checkout. Money lands in the wallet first. Game loads start at $${GAME_BONUS_RULES.minDeposit}.`,
  },
  {
    id: "move",
    category: "redeem",
    question: "When can I move winnings from a game to my wallet?",
    answer: `After a load, move winnings once they reach ${GAME_BONUS_RULES.redeemMin}× that load, up to ${GAME_BONUS_RULES.redeemMax}×. Use Move to Wallet on the game page.`,
  },
  {
    id: "cashout-min",
    category: "redeem",
    question: "What is the minimum wallet cashout?",
    answer: "Open Cash out from the wallet. The payout screen shows the minimum for the method you pick.",
  },
  {
    id: "still-in-game",
    category: "redeem",
    question: "Why is money still inside my game?",
    answer: "A load stays in the game until you move winnings back. Refresh the game balance on the game page, then use Move to Wallet when the rollover is met.",
  },
  {
    id: "fees",
    category: "wallet",
    question: "How much will I receive after fees?",
    answer: "The checkout and cash-out screens show the amount before you confirm. This page does not add a separate fee on top of that.",
  },
  {
    id: "login",
    category: "account",
    question: "Where is my game username and password?",
    answer: "Open the game from Play. If the account is ready, Game login shows the username and password with Copy.",
  },
  {
    id: "verify",
    category: "account",
    question: "How do I verify my account?",
    answer: "From Account, open the verification row. Email, phone, and identity checks keep cash outs moving.",
  },
  {
    id: "age",
    category: "general",
    question: "How old do I have to be to play?",
    answer: "You must be 18 or older.",
  },
  {
    id: "break",
    category: "support",
    question: "What if I want to take a break?",
    answer: "Open Responsible Gaming. You can set a load limit, a short break, or self-exclude. Cash out stays open during self-exclusion.",
  },
  {
    id: "bonus",
    category: "rewards",
    question: "Do new players get a welcome bonus?",
    answer: `The first load bonus is ${GAME_BONUS_RULES.firstTimeBonus}%. Later loads are ${GAME_BONUS_RULES.regularBonus}%.`,
  },
];

export default async function HelpPage() {
  const published = await getPublishedFaqs();
  const faqs = published.length ? published : FALLBACK;

  return (
    <VipPageLayout>
      <main className="mx-auto w-full max-w-3xl space-y-6 px-1 pb-16">
        <div>
          <Link href="/dashboard" className="text-sm font-bold text-[#b9b3c6]">
            Back
          </Link>
          <h1 className="mt-2 text-3xl font-black">Help &amp; FAQ</h1>
        </div>
        <HelpFaqList faqs={faqs} />
      </main>
    </VipPageLayout>
  );
}
