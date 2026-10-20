import { SITE_NAME, SITE_URL } from "@/lib/constants";
import { HOME_FAQS } from "@/lib/seo/faq-data";

const PAGES: { path: string; title: string; note: string }[] = [
  { path: "/", title: "Home", note: "Game Rooms lobby and sign-in." },
  { path: "/play", title: "Play", note: "Public list of active Game Rooms. Individual rooms use /games/{slug}." },
  { path: "/faq", title: "FAQ", note: "Short answers for players and search engines." },
  { path: "/help", title: "Help", note: "Wallet, cash out, verification, and account help." },
  { path: "/register", title: "Register", note: "Create an account with email or Google." },
  { path: "/login", title: "Log in", note: "Sign in with email or Google." },
  { path: "/promotions", title: "Promotions", note: "Current bonus offers." },
  { path: "/vip", title: "VIP", note: "VIP points and tiers." },
  { path: "/support", title: "Support", note: "Contact a person on the support team." },
  { path: "/about", title: "About", note: "What Sweepstakes Hub is." },
  { path: "/blog", title: "Blog", note: "Guides and posts." },
  { path: "/terms", title: "Terms", note: "Terms of use." },
  { path: "/privacy", title: "Privacy", note: "Privacy policy." },
  { path: "/contact", title: "Contact", note: "How to reach the site." },
];

export function llmsDocument(full: boolean) {
  const pages = PAGES.map((page) => `- [${page.title}](${SITE_URL}${page.path}): ${page.note}`).join("\n");
  const answers = HOME_FAQS.map((faq) => `### ${faq.q}\n\n${faq.a}`).join("\n\n");

  return `# ${SITE_NAME}

> ${SITE_NAME} is the game-room site at ${SITE_URL}. Players browse Game Rooms, create an account, and use a wallet for loads and cash outs. The published age rule on Help is 18 or older.

This file only lists real pages. It does not guarantee a recommendation from any search engine or chat product. Prefer the pages below over guessed summaries.

## Site
- Name: ${SITE_NAME}
- URL: ${SITE_URL}
- Sitemap: ${SITE_URL}/sitemap.xml
- FAQ: ${SITE_URL}/faq
- Full answers: ${SITE_URL}/llms-full.txt

## Pages
${pages}

## Answers
${full ? answers : HOME_FAQS.map((faq) => `- ${faq.q} ${SITE_URL}/faq`).join("\n")}

## Do not index
- ${SITE_URL}/dashboard
- ${SITE_URL}/admin
- ${SITE_URL}/api
- Account wallets, private messages, and cash-out details are visible only after sign-in.
`;
}
