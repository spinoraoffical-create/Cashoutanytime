import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

function loadEnv() {
  try {
    const raw = readFileSync(".env.local", "utf8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m && !process.env[m[1]]) {
        process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
      }
    }
  } catch {
    /* ignore */
  }
}

loadEnv();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const db = createClient(supabaseUrl, supabaseKey);

const TABLES = [
  "profiles",
  "conversations",
  "messages",
  "deposit_requests",
  "game_load_requests",
  "notifications",
  "referrals",
  "roles",
  "permissions",
  "user_roles",
  "vip_tiers",
  "vip_status",
  "reward_rules",
  "ledger_entries",
  "achievements",
  "promotions",
  "banners",
  "broadcasts",
  "support_tickets",
  "ticket_messages",
  "faqs",
  "testimonials",
  "blog_posts",
  "games",
  "game_server_configs",
  "geo_states",
  "geo_cities",
  "payment_methods",
  "requests",
  "wallet_ledger",
  "player_reviews",
  "newsletter_campaigns",
  "audit_logs",
  "site_settings",
  "provision_jobs",
  "telegram_promo_messages",
  "leaderboard_entries",
  "leaderboards",
];

async function checkAll() {
  console.log("=== Checking Table Existence via GET ===");
  for (const table of TABLES) {
    const { error } = await db.from(table).select("*").limit(1);
    if (error) {
      console.log(`❌ Table '${table}' ERROR: ${error.message} (${error.code})`);
    } else {
      console.log(`✅ Table '${table}' OK`);
    }
  }
}

checkAll();
