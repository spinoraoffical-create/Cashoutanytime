import { SITE_NAME, SITE_URL, SITE_DESCRIPTION, SOCIAL_LINKS } from "@/lib/constants";
import type { Game } from "@/lib/games";
import { getGames } from "@/lib/data/marketing";
import { getGamePageUrl } from "@/lib/seo/game-seo";
import { HOME_FAQS } from "@/lib/seo/faq-data";

interface JsonLdProps {
  data: Record<string, unknown>;
}

export function JsonLd({ data }: JsonLdProps) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

export function OrganizationSchema() {
  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@type": "Organization",
        name: SITE_NAME,
        url: SITE_URL,
        logo: `${SITE_URL}/logo.webp`,
        description: SITE_DESCRIPTION,
        sameAs: Object.values(SOCIAL_LINKS).filter(Boolean),
        contactPoint: {
          "@type": "ContactPoint",
          contactType: "customer support",
          availableLanguage: "English",
        },
      }}
    />
  );
}

export function WebsiteSchema() {
  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@type": "WebSite",
        name: SITE_NAME,
        url: SITE_URL,
        description: SITE_DESCRIPTION,
      }}
    />
  );
}

export function BreadcrumbSchema({ items }: { items: { name: string; url: string }[] }) {
  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: items.map((item, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: item.name,
          item: item.url,
        })),
      }}
    />
  );
}

export async function HomeGamesItemListSchema() {
  const games = await getGames();

  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@type": "ItemList",
        name: "Sweepstakes Hub Casino & Slot Games",
        description: "Popular Juwa, Game Vault, fish games, and slot games available on Sweepstakes Hub.",
        numberOfItems: games.length,
        itemListElement: games.map((game, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: game.name,
          url: `${SITE_URL}/games/${game.slug}`,
        })),
      }}
    />
  );
}

export function HomeFaqSchema() {
  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: HOME_FAQS.map((faq) => ({
          "@type": "Question",
          name: faq.q,
          acceptedAnswer: {
            "@type": "Answer",
            text: faq.a,
          },
        })),
      }}
    />
  );
}

export function GamePageSchema({ game }: { game: Game }) {
  const pageUrl = getGamePageUrl(game);

  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@type": "VideoGame",
        name: game.name,
        description: game.bio,
        url: pageUrl,
        image: `${SITE_URL}${game.image}`,
        applicationCategory: "Game",
        operatingSystem: "Android, iOS",
        offers: {
          "@type": "Offer",
          url: pageUrl,
          price: "0",
          priceCurrency: "USD",
          availability: "https://schema.org/InStock",
        },
        publisher: {
          "@type": "Organization",
          name: game.provider,
        },
      }}
    />
  );
}
