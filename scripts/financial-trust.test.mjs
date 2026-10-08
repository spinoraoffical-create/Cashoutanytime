import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { usernameForOwner } from "../src/lib/games/owned-account.ts";

const accounts = [
  { userId: "player-a", gameSlug: "juwa", username: "alice" },
  { userId: "player-b", gameSlug: "juwa", username: "bob" },
];

const redeem = usernameForOwner(accounts, "player-b", "juwa");
assert.equal("username" in redeem && redeem.username, "bob");
assert.notEqual("username" in redeem && redeem.username, "alice");

const load = usernameForOwner(accounts, "player-b", "juwa");
assert.equal("username" in load && load.username, "bob");

const missing = usernameForOwner(accounts, "player-b", "fire-kirin");
assert.deepEqual(missing, { error: "Account not found" });

const sql = readFileSync(
  new URL("../supabase/migrations/20261008000160_financial_trust.sql", import.meta.url),
  "utf8"
);
const redeemSql = sql.slice(sql.indexOf("FUNCTION public.request_game_redeem("), sql.indexOf("FUNCTION public.request_game_check_balance("));
const loadSql = sql.slice(sql.indexOf("FUNCTION public.request_game_load("), sql.indexOf("FUNCTION public.request_game_redeem("));
assert.equal(redeemSql.includes("p_game_username"), false);
assert.equal(loadSql.includes("p_game_username"), false);
assert.match(sql, /CREATE OR REPLACE FUNCTION public.request_game_load\(/);
assert.match(sql, /RAISE EXCEPTION 'Account not found'/);
assert.match(sql, /REVOKE ALL ON FUNCTION public\.fail_stale_game_loads\(integer, uuid, text\) FROM PUBLIC, anon, authenticated/);
assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.fail_stale_game_loads\(integer, uuid, text\) TO service_role/);
assert.match(sql, /CREATE OR REPLACE FUNCTION public\.fail_my_stale_game_load\(\s*p_stale_minutes integer/);
assert.equal(/FUNCTION public\.fail_my_stale_game_load\([\s\S]*p_user_id/.test(sql), false);
assert.match(sql, /auth\.uid\(\)/);

const loads = readFileSync(new URL("../src/lib/actions/game-loads.ts", import.meta.url), "utf8");
assert.equal(loads.includes("p_game_username"), false);
assert.match(loads, /fail_my_stale_game_load/);
assert.equal(loads.includes("fail_stale_game_loads"), false);
assert.equal(loads.includes("juwa_"), false);
assert.equal(loads.includes("vegas_"), false);
assert.equal(loads.includes("userId.slice(0, 8)"), false);
assert.match(loads, /Account not found/);

const kyc = readFileSync(new URL("../src/lib/actions/kyc-actions.ts", import.meta.url), "utf8");
const updateAt = kyc.indexOf("export async function updateKYCStatus");
const readAt = kyc.indexOf("export async function getAdminKYCSubmissions");
assert.ok(kyc.indexOf('authorize("kyc.manage")', readAt) < kyc.indexOf('.from("kyc_submissions")', readAt));
assert.ok(kyc.indexOf('authorize("kyc.manage")', updateAt) < kyc.indexOf('.from("kyc_submissions")', updateAt));

const liveBot = readFileSync(new URL("../src/app/api/chat/live-bot/route.ts", import.meta.url), "utf8");
assert.equal(liveBot.includes("body.userId"), false);
assert.match(liveBot, /auth\.getUser\(\)/);

const status = readFileSync(new URL("../src/app/api/payments/paydora/status/route.ts", import.meta.url), "utf8");
assert.equal(status.includes("creditPaydoraDeposit"), false);

const webhook = readFileSync(new URL("../src/app/api/payments/paydora/webhook/route.ts", import.meta.url), "utf8");
assert.match(webhook, /base_amount/);
assert.match(webhook, /promo_code/);
assert.equal(webhook.includes("saved.user_id || userId"), false);

const settle = readFileSync(new URL("../src/lib/payments/auto-settle.ts", import.meta.url), "utf8");
assert.equal(settle.includes("userId.slice(0, 8)"), false);
assert.match(settle, /bonusForPercent\(savedBase, percent\)/);
assert.equal(settle.includes("row.promo_code || input.promoCode"), false);
assert.match(settle, /promoCode: row\.promo_code/);

const wallet = readFileSync(new URL("../src/lib/payments/paydora-wallet.ts", import.meta.url), "utf8");
assert.equal(wallet.includes("wallet_balance:"), false);
assert.match(wallet, /final_credit/);
assert.match(wallet, /reverse_paydora_deposit is missing/);
assert.match(wallet, /p_user_id: saved\.user_id/);
assert.match(wallet, /alreadyApplied/);

const deposits = readFileSync(new URL("../src/lib/actions/deposits.ts", import.meta.url), "utf8");
assert.equal(deposits.includes("creditPaydoraDeposit"), false);

console.log("financial trust checks passed");
