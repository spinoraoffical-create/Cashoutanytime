/**
 * Verify Trail-web / Spinora setup after Section A + env config.
 * Run: node scripts/verify-setup.mjs
 */
import { readFileSync } from "fs";
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

const OPTIONAL = ["CRON_SECRET", "TELEGRAM_BOT_TOKEN", "TELEGRAM_ADMIN_CHAT_ID", "OPENAI_API_KEY"];
const REQUIRED = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
];

loadEnv();

console.log("=== Env vars ===");
for (const k of REQUIRED) {
  const ok = Boolean(process.env[k]?.trim());
  console.log(`${ok ? "OK" : "MISSING"}  ${k}`);
}
for (const k of OPTIONAL) {
  const ok = Boolean(process.env[k]?.trim());
  console.log(`${ok ? "OK" : "optional"}  ${k}`);
}
const ai = process.env.GEMINI_API_KEY?.trim() || process.env.OPENAI_API_KEY?.trim();
console.log(`${ai ? "OK" : "MISSING"}  AI key (GEMINI or OPENAI) — needed for AI blog`);

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  process.exit(1);
}

const db = createClient(url, key, { auth: { persistSession: false } });

const rpcChecks = [
  ["kyc_submissions table", () => db.from("kyc_submissions").select("id", { head: true, count: "exact" })],
  ["ai_blog_settings", () => db.from("ai_blog_settings").select("id").limit(1)],
  ["wallet_transactions", () => db.from("wallet_transactions").select("id", { head: true, count: "exact" })],
  ["profiles.cashout_wallet", () => db.from("profiles").select("cashout_wallet, kyc_status").limit(1)],
  ["wheel_spins", () => db.from("wheel_spins").select("id", { head: true, count: "exact" })],
  ["get_wheel_daily_stats rpc", () => db.rpc("get_wheel_daily_stats")],
];

console.log("\n=== Database (Section A) ===");
for (const [name, fn] of rpcChecks) {
  const { error } = await fn();
  console.log(`${error ? "FAIL" : "OK"}  ${name}${error ? `: ${error.message}` : ""}`);
}

console.log("\nDone. If wheel_spins FAIL, run supabase/wheel-spins-patch.sql in SQL Editor.");
console.log("If other FAIL, run supabase/SECTION-A-PATCH.sql in SQL Editor.");
