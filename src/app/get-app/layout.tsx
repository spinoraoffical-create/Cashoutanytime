import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Get the app | Sweepstakes Hub",
  robots: { index: false, follow: false },
};

export default function GetAppLayout({ children }: { children: React.ReactNode }) {
  return children;
}
