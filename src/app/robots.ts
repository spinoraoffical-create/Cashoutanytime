import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/constants";

const PRIVATE_PATHS = [
  "/dashboard",
  "/dashboard/",
  "/admin",
  "/admin/",
  "/chat",
  "/chat/",
  "/api/",
  "/auth/",
  "/unsubscribe",
  "/restricted",
  "/login",
  "/register",
  "/reset-password",
];

const AI_AGENTS = [
  "GPTBot",
  "ChatGPT-User",
  "OAI-SearchBot",
  "ClaudeBot",
  "PerplexityBot",
  "Google-Extended",
  "Applebot-Extended",
  "Bytespider",
];

export default function robots(): MetadataRoute.Robots {
  const publicRule = {
    allow: ["/", "/llms.txt", "/llms-full.txt", "/faq", "/feed.xml", "/sitemap.xml"],
    disallow: PRIVATE_PATHS,
  };

  return {
    rules: [
      { userAgent: "*", ...publicRule },
      ...AI_AGENTS.map((userAgent) => ({ userAgent, ...publicRule })),
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: "www.sweeptakehub.com",
  };
}
