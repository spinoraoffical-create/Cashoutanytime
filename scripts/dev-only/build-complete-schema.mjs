import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const migDir = path.join(root, "supabase", "migrations");
const files = fs.readdirSync(migDir).filter((f) => f.endsWith(".sql")).sort();

const patchFiles = [
  "20260720000200_game_load_rpc_fix.sql",
  "20260720000300_kyc_and_ai_system.sql",
  "20260720000400_game_redeem_fix.sql",
  "20260720000500_redeem_kyc_wallet_trigger.sql",
  "20260722000100_fix_game_accounts_credentials.sql",
  "20260721000300_deposit_wallet_credit.sql",
  "20260721000200_blog_telegram_sent_status.sql",
];

const header = `-- ============================================================================
-- SPINORA — COMPLETE DATABASE SCHEMA (single file)
-- ============================================================================
-- Generated: ${new Date().toISOString()}
--
-- HOW TO RUN IN SUPABASE SQL EDITOR (Dashboard → SQL → New query):
--
--   EXISTING Spinora database (fixes KYC, load, redeem, bots, deposits):
--     Run ONLY SECTION A (from "SECTION A START" through "SECTION A END")
--
--   BRAND NEW empty Supabase project:
--     Run the ENTIRE file (Section A + Section B)
--
-- Notes:
--   • Uses wallet_transactions (not wallet_ledger) for loads/redeems
--   • Redeem credits cashout_wallet (Deposit Redeem), not wallet_balance
--   • KYC must be admin-approved (profiles.kyc_status = 'verified') before redeem
-- ============================================================================

`;

let sectionA = `-- ============================================================================
-- SECTION A START — EXISTING DATABASE PATCH (run this block only)
-- ============================================================================

`;

for (const f of patchFiles) {
  const p = path.join(migDir, f);
  if (!fs.existsSync(p)) {
    console.error("Missing patch file:", f);
    process.exit(1);
  }
  sectionA += `-- --- ${f} ---\n\n`;
  sectionA += fs.readFileSync(p, "utf8").trim() + "\n\n";
}

sectionA += `-- ============================================================================
-- SECTION A END
-- ============================================================================

`;

let sectionB = `-- ============================================================================
-- SECTION B START — FULL MIGRATION HISTORY (fresh install)
-- ============================================================================

`;

for (const f of files) {
  sectionB += `-- ==========================================
-- MIGRATION: ${f}
-- ==========================================

`;
  sectionB += fs.readFileSync(path.join(migDir, f), "utf8").trim() + "\n\n";
}

sectionB += `-- ============================================================================
-- SECTION B END
-- ============================================================================
`;

const complete = header + sectionA + sectionB;
const combinedOnly = `-- SPINORA — ALL MIGRATIONS COMBINED (${files.length} files)
-- Generated: ${new Date().toISOString()}
-- For existing DBs use supabase/SPINORA-COMPLETE-SCHEMA.sql Section A instead.

` + sectionB.replace(/^-- =+\n-- SECTION B START[^\n]*\n-- =+\n\n/, "");

fs.writeFileSync(path.join(root, "supabase", "SPINORA-COMPLETE-SCHEMA.sql"), complete, "utf8");
fs.writeFileSync(path.join(root, "supabase", "ALL-MIGRATIONS-COMBINED.sql"), combinedOnly, "utf8");

console.log("Wrote supabase/SPINORA-COMPLETE-SCHEMA.sql", (complete.length / 1024).toFixed(1), "KB");
console.log("Wrote supabase/ALL-MIGRATIONS-COMBINED.sql", (combinedOnly.length / 1024).toFixed(1), "KB");
console.log("Migrations:", files.length, "| Patch files:", patchFiles.length);
