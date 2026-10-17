import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { OrganizationSchema, WebsiteSchema, HomeGamesItemListSchema } from "@/lib/seo/json-ld";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/constants";
import { ClientProviders } from "@/components/providers/client-providers";
import { MobileBottomNav } from "@/components/layout/mobile-bottom-nav";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  preload: true,
  adjustFontFallback: true,
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Sweepstakes Hub | Juwa Casino, Slot Games & Fish Games",
    template: "%s",
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  authors: [{ name: SITE_NAME }],
  creator: SITE_NAME,
  publisher: SITE_NAME,
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
  alternates: {
    types: { "application/rss+xml": `${SITE_URL}/feed.xml` },
  },
};

export const viewport: Viewport = {
  themeColor: "#07060c",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <OrganizationSchema />
        <WebsiteSchema />
        <HomeGamesItemListSchema />
        <link rel="icon" href="/logo.webp" />
        <link rel="preload" href="/logo.webp" as="image" type="image/webp" />
      </head>
      <body className={inter.className} suppressHydrationWarning>
        <ClientProviders>
          {children}
          <MobileBottomNav />
        </ClientProviders>
      </body>
    </html>
  );
}
