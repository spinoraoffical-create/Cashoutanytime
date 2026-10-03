/**
 * One-off admin DB readiness check. Run: node scripts/check-admin-db.mjs
 */
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

const TABLES = [
  // Spinora core
  "profiles",
  "conversations",
  "messages",
  "deposit_requests",
  "game_load_requests",
  "notifications",
  "referrals",
  // WinSweeps admin
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

loadEnv();
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const db = createClient(url, key, { auth: { persistSession: false } });

const profileCols = [
  "email",
  "full_name",
  "avatar_url",
  "wallet_balance",
  "cashout_wallet",
  "is_suspended",
  "last_seen_at",
  "vip_tier",
  "vip_points",
  "role",
];

async function checkTable(name) {
  const { error } = await db.from(name).select("*", { head: true, count: "exact" });
  if (!error) return { ok: true };
  return { ok: false, code: error.code, message: error.message };
}

async function main() {
  console.log("=== Spinora Admin DB Check ===\n");

  const { data: profile, error: profileErr } = await db
    .from("profiles")
    .select(profileCols.join(","))
    .limit(1)
    .maybeSingle();

  if (profileErr) {
    console.log("profiles:", "FAIL", profileErr.message);
  } else {
    const missing = profileCols.filter((c) => !(c in (profile ?? {})));
    const present = profileCols.filter((c) => c in (profile ?? {}));
    console.log("profiles: OK");
    console.log("  columns present:", present.join(", ") || "(none sampled)");
    if (missing.length) console.log("  columns MISSING:", missing.join(", "));
  }

  const { count: adminCount } = await db
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("role", "admin");

  const { data: roleRows } = await db.from("user_roles").select("user_id").limit(5);
  console.log(`\nlegacy admins (profiles.role=admin): ${adminCount ?? 0}`);
  console.log(`RBAC user_roles rows (sample): ${roleRows?.length ?? 0}`);

  console.log("\n--- Tables ---");
  const missingTable = [];
  const okTable = [];
  for (const t of TABLES) {
    const r = await checkTable(t);
    if (r.ok) okTable.push(t);
    else {
      missingTable.push({ t, ...r });
      console.log(`MISSING  ${t}: ${r.message}`);
    }
  }
  console.log(`\nOK: ${okTable.length}/${TABLES.length} tables reachable`);
  if (missingTable.length === 0) {
    console.log("All checked tables exist.");
  } else {
    console.log(`Missing/failed: ${missingTable.length}`);
  }

  console.log("\n--- Admin page queries ---");
  const pageTests = [
    ["Overview signups", () => db.from("profiles").select("id, email, full_name, created_at").limit(1)],
    ["Users page", () => db.from("profiles").select("id, email, full_name, wallet_balance, cashout_wallet, is_suspended, created_at").limit(1)],
    ["Deposits (Spinora)", () => db.from("deposit_requests").select("*, user:profiles!deposit_requests_user_id_fkey(full_name, email)").limit(1)],
    ["Chat (Spinora)", () => db.from("conversations").select("id, user_id, updated_at, user:profiles!conversations_user_id_fkey(full_name, email, is_online, last_seen_at)").limit(1)],
    ["Game loads", () => db.from("game_load_requests").select("id, status").limit(1)],
    ["Promotions", () => db.from("promotions").select("id, title, status").limit(1)],
    ["Roles", () => db.from("roles").select("id, key, name").limit(3)],
    ["Support", () => db.from("support_tickets").select("id, ticket_no, subject, status").limit(1)],
    ["Ledger", () => db.from("ledger_entries").select("amount").eq("currency", "coins").limit(1)],
    ["WinSweeps requests", () => db.from("requests").select("id, status").limit(1)],
    ["CMS faqs", () => db.from("faqs").select("id, question").limit(1)],
    ["CMS blog", () => db.from("blog_posts").select("id, title").limit(1)],
    ["Settings", () => db.from("site_settings").select("key, value").limit(1)],
    ["Achievements", () => db.from("achievements").select("id, title").limit(1)],
    ["Audit logs", () => db.from("audit_logs").select("id, action, actor:profiles!audit_logs_actor_id_fkey(email, full_name)").limit(1)],
    ["CRM segment", () => db.from("profiles").select("id, email, full_name, last_seen_at, is_suspended, created_at").limit(1)],
    ["Payouts", () => db.from("profiles").select("id, full_name, email, cashout_wallet").gt("cashout_wallet", 0).limit(1)],
  ];
  for (const [name, fn] of pageTests) {
    const { data, error } = await fn();
    if (error) console.log(`FAIL  ${name}: ${error.message}`);
    else console.log(`OK    ${name}${data?.length ? ` (${data.length} row(s))` : ""}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
