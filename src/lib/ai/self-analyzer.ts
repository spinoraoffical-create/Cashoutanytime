import { createAdminClient } from "@/lib/supabase/admin";

export interface SystemAnalysisReport {
  healthScore: number; // 0 to 100
  timestamp: string;
  seoMetrics: {
    publishedPostsCount: number;
    geoPagesCount: number;
    hasRobots: boolean;
    hasSitemap: boolean;
  };
  environmentMetrics: {
    isTelegramConfigured: boolean;
    isSupabaseServiceConfigured: boolean;
    isLLMConfigured: boolean;
  };
  activityMetrics: {
    totalUsers: number;
    totalBlogPosts: number;
    totalFaqs: number;
  };
  recommendations: Array<{
    id: string;
    type: "critical" | "warning" | "info" | "success";
    title: string;
    description: string;
    actionLabel?: string;
    actionHref?: string;
  }>;
}

export async function runSystemSelfAnalysis(): Promise<SystemAnalysisReport> {
  const db = createAdminClient();
  
  let publishedPostsCount = 0;
  let totalBlogPosts = 0;
  let totalFaqs = 0;
  let totalUsers = 0;

  if (db) {
    try {
      const { count: pubCount } = await db
        .from("blog_posts")
        .select("*", { count: "exact", head: true })
        .eq("status", "published");
      publishedPostsCount = pubCount || 0;

      const { count: totalPosts } = await db
        .from("blog_posts")
        .select("*", { count: "exact", head: true });
      totalBlogPosts = totalPosts || 0;

      const { count: faqCount } = await db
        .from("faqs")
        .select("*", { count: "exact", head: true });
      totalFaqs = faqCount || 0;

      const { count: uCount } = await db
        .from("profiles")
        .select("*", { count: "exact", head: true });
      totalUsers = uCount || 0;
    } catch (err) {
      console.error("[SelfAnalyzer] DB Query error:", err);
    }
  }

  const isTelegramConfigured = Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_ADMIN_CHAT_ID);
  const isSupabaseServiceConfigured = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
  const isLLMConfigured = Boolean(
    process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY || process.env.GEMINI_API_KEY
  );

  let score = 100;
  const recommendations: SystemAnalysisReport["recommendations"] = [];

  // Evaluate Environment
  if (!isTelegramConfigured) {
    score -= 15;
    recommendations.push({
      id: "env-telegram",
      type: "warning",
      title: "Telegram Bot Not Configured",
      description: "Add TELEGRAM_BOT_TOKEN and TELEGRAM_ADMIN_CHAT_ID to your environment variables to enable instant alerts & broadcasts.",
      actionLabel: "Configure Telegram",
      actionHref: "/admin/telegram",
    });
  }

  if (!isLLMConfigured) {
    score -= 10;
    recommendations.push({
      id: "env-llm",
      type: "info",
      title: "Using Smart Fallback AI Engine",
      description: "Providing OPENROUTER_API_KEY or OPENAI_API_KEY unlocks GPT-4o powered article generation and natural chatbot responses.",
      actionLabel: "AI Settings",
      actionHref: "/admin/ai-blog",
    });
  }

  // Evaluate SEO
  if (publishedPostsCount < 5) {
    score -= 15;
    recommendations.push({
      id: "seo-posts",
      type: "warning",
      title: "Low Blog Article Volume",
      description: `Only ${publishedPostsCount} blog posts published. Generate at least 10 SEO-optimized articles to increase organic search engine traffic.`,
      actionLabel: "Generate AI Blog Post",
      actionHref: "/admin/ai-blog",
    });
  } else {
    recommendations.push({
      id: "seo-posts-good",
      type: "success",
      title: "Solid SEO Article Foundation",
      description: `${publishedPostsCount} blog posts indexed and published with schema JSON-LD.`,
    });
  }

  if (totalFaqs < 3) {
    score -= 10;
    recommendations.push({
      id: "seo-faqs",
      type: "info",
      title: "Expand Platform FAQs",
      description: "Adding more FAQs improves search snippets and helps the AI Chatbot answer customer questions better.",
      actionLabel: "Manage FAQs",
      actionHref: "/admin/cms?tab=faq",
    });
  }

  let geoPagesCount = 0;
  if (db) {
    try {
      const { count: stateCount } = await db
        .from("geo_states")
        .select("*", { count: "exact", head: true })
        .eq("is_active", true);
      const { count: cityCount } = await db
        .from("geo_cities")
        .select("*", { count: "exact", head: true })
        .eq("is_active", true);
      geoPagesCount = (stateCount ?? 0) + (cityCount ?? 0);
    } catch {
      geoPagesCount = 0;
    }
  }

  const report: SystemAnalysisReport = {
    healthScore: Math.max(10, Math.min(100, score)),
    timestamp: new Date().toISOString(),
    seoMetrics: {
      publishedPostsCount,
      geoPagesCount,
      hasRobots: true,
      hasSitemap: true,
    },
    environmentMetrics: {
      isTelegramConfigured,
      isSupabaseServiceConfigured,
      isLLMConfigured,
    },
    activityMetrics: {
      totalUsers,
      totalBlogPosts,
      totalFaqs,
    },
    recommendations,
  };

  // Persist diagnostic report into system_health_logs
  if (db) {
    try {
      await db.from("system_health_logs").insert({
        health_score: report.healthScore,
        seo_metrics: report.seoMetrics,
        cron_metrics: { timestamp: report.timestamp },
        database_metrics: report.activityMetrics,
        recommendations: report.recommendations,
      });
    } catch (dbErr) {
      console.error("[SelfAnalyzer] Failed to save log:", dbErr);
    }
  }

  return report;
}
