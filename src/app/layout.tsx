import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { OrganizationSchema, WebsiteSchema, HomeGamesItemListSchema, HomeFaqSchema } from "@/lib/seo/json-ld";
import { homeMetadata } from "@/lib/seo/metadata";
import { ClientProviders } from "@/components/providers/client-providers";
import { MobileBottomNav } from "@/components/layout/mobile-bottom-nav";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  preload: true,
  adjustFontFallback: true,
});

export const metadata: Metadata = homeMetadata;

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
        <HomeFaqSchema />
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
