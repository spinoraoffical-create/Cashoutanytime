import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "What's new | Sweepstakes Hub",
  robots: { index: false, follow: false },
};

export default function WhatsNewLayout({ children }: { children: React.ReactNode }) {
  return children;
}
