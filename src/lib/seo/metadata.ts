import type { Metadata } from "next";
import { SITE_NAME, SITE_URL, SITE_DESCRIPTION } from "@/lib/constants";

interface PageSEO {
  title: string;
  description: string;
  keywords: string[];
  path: string;
  ogImage?: string;
  /** Overrides the default "{title} | Sweepstakes Hub" document title when set */
  documentTitle?: string;
}

export function createMetadata({
  title,
  description,
  keywords,
  path,
  ogImage = "/logo.webp",
  documentTitle,
}: PageSEO): Metadata {
  const fullTitle =
    documentTitle ??
    (title === SITE_NAME ? `${SITE_NAME} | Premium Gaming Support Platform` : `${title} | ${SITE_NAME}`);
  const url = `${SITE_URL}${path}`;

  return {
    title: fullTitle,
    description,
    keywords: keywords.join(", "),
    authors: [{ name: SITE_NAME }],
    creator: SITE_NAME,
    publisher: SITE_NAME,
    metadataBase: new URL(SITE_URL),
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      locale: "en_US",
      url,
      title: fullTitle,
      description,
      siteName: SITE_NAME,
      images: [{ url: ogImage, width: 1200, height: 630, alt: SITE_NAME }],
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description,
      images: [ogImage],
    },
    robots: {
      index: true,
      follow: true,
      googleBot: { index: true, follow: true },
    },
  };
}

export const homeMetadata = createMetadata({
  title: SITE_NAME,
  documentTitle: "Sweepstakes Hub | Juwa Casino, Slot Games & Fish Games",
  description:
    "Play Juwa casino, Game Vault, Fire Kirin, Panda Master, and top slot games on Sweepstakes Hub. Create your game account in minutes, claim deposit bonuses, earn VIP rewards, and get 24/7 live chat support.",
  keywords: [
    "Sweepstakes Hub",
    "juwa casino",
    "juwa 777",
    "juwa slots",
    "slot games",
    "fish games",
    "game vault casino",
    "sweepstakes casino",
    "online casino games",
    "mobile casino",
    "fire kirin",
    "panda master",
    "orion stars",
    "vegas sweeps",
    "game accounts",
    "VIP gaming rewards",
  ],
  path: "/",
});

export const promotionsMetadata = createMetadata({
  title: "Promotions & Bonuses",
  description:
    "Discover exclusive Sweepstakes Hub promotions, bonuses, and limited-time offers for premium gaming accounts and VIP rewards.",
  keywords: ["gaming promotions", "casino bonuses", "Sweepstakes Hub deals", "VIP bonuses", "gaming rewards"],
  path: "/promotions",
});

export const vipMetadata = createMetadata({
  title: "VIP Rewards Program",
  description:
    "Join the Sweepstakes Hub VIP program. Earn points, unlock Bronze to Platinum tiers, and enjoy exclusive gaming benefits and rewards.",
  keywords: ["VIP gaming", "loyalty program", "gaming rewards", "Sweepstakes Hub VIP", "premium gaming"],
  path: "/vip",
});

export const aboutMetadata = createMetadata({
  title: "About Sweepstakes Hub",
  description:
    "Learn about Sweepstakes Hub — the premium gaming support platform trusted by thousands for game accounts, live support, and VIP rewards.",
  keywords: ["about Sweepstakes Hub", "gaming support platform", "trusted gaming", "game account service"],
  path: "/about",
});

export const supportMetadata = createMetadata({
  title: "Support | Sweepstakes Hub",
  description:
    "Get help with adding money, cash outs, Game Rooms, and your account. Chat with Sweepstakes Hub support.",
  keywords: ["gaming support", "live chat help", "Sweepstakes Hub support", "game account help", "customer service"],
  path: "/support",
});
