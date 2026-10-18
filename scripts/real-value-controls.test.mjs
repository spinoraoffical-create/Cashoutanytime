import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { AGE_REQUIRED, ageDenial } from "../src/lib/compliance/age.ts";
import { REAL_VALUE_OFF, adjustmentDenial, playerMoneyDenial, realValueDenial, realValueEnabled } from "../src/lib/compliance/real-value.ts";

const off = {};
assert.equal(realValueEnabled("deposits", off), false);
assert.equal(realValueEnabled("game_loads", off), false);
assert.equal(realValueEnabled("redemptions", off), false);
assert.equal(realValueEnabled("payouts", off), false);
assert.equal(realValueDenial("deposits", { REAL_VALUE_DEPOSITS: "true" }), REAL_VALUE_OFF);
assert.equal(realValueDenial("deposits", { REAL_VALUE_DEPOSITS: "ON" }), REAL_VALUE_OFF);
assert.equal(realValueDenial("deposits", { REAL_VALUE_DEPOSITS: " on" }), REAL_VALUE_OFF);
assert.equal(realValueDenial("deposits", { REAL_VALUE_DEPOSITS: "" }), REAL_VALUE_OFF);
assert.equal(realValueDenial("deposits", { REAL_VALUE_DEPOSITS: "on" }), null);
assert.equal(adjustmentDenial({}), REAL_VALUE_OFF);
assert.equal(adjustmentDenial({ REAL_VALUE_ADJUSTMENTS: "true" }), REAL_VALUE_OFF);
assert.equal(adjustmentDenial({ REAL_VALUE_ADJUSTMENTS: "on" }), null);

const today = new Date(Date.UTC(2026, 9, 17));
assert.equal(ageDenial("2008-10-18", today), AGE_REQUIRED);
assert.equal(ageDenial("2008-10-17", today), null);
assert.equal(ageDenial("2010-01-01", today), AGE_REQUIRED);
assert.equal(ageDenial("2026-10-18", today), AGE_REQUIRED);
assert.equal(ageDenial("not-a-date", today), AGE_REQUIRED);
assert.equal(ageDenial("", today), AGE_REQUIRED);
assert.equal(ageDenial("2008-02-29", new Date(Date.UTC(2026, 1, 28))), AGE_REQUIRED);
assert.equal(ageDenial("2008-02-29", new Date(Date.UTC(2026, 2, 1))), null);

function headers(country, region, platform = true) {
  const values = new Map();
  if (platform) values.set("x-vercel-id", "req_test");
  if (country != null) values.set("x-vercel-ip-country", country);
  if (region != null) values.set("x-vercel-ip-country-region", region);
  return { get: (name) => values.get(name) ?? null };
}

const adult = { VERCEL: "1", REAL_VALUE_DEPOSITS: "on", REAL_VALUE_GAME_LOADS: "on", REAL_VALUE_REDEMPTIONS: "on", REAL_VALUE_PAYOUTS: "on" };
assert.equal(playerMoneyDenial({ operation: "deposits", headers: headers(null, null), dateOfBirth: "1990-01-01", env: adult, today }), "We could not confirm your location. This money action was not started.");
assert.equal(playerMoneyDenial({ operation: "payouts", headers: headers("US", "WA"), dateOfBirth: "1990-01-01", env: adult, today }), "This money action is unavailable in your state.");
assert.equal(playerMoneyDenial({ operation: "game_loads", headers: headers("US", "TX"), dateOfBirth: "2015-01-01", env: adult, today }), AGE_REQUIRED);
assert.equal(playerMoneyDenial({ operation: "game_loads", headers: headers("US", "TX"), dateOfBirth: "1990-01-01", env: { ...adult, VERCEL: "0" }, today }), "We could not confirm your location. This money action was not started.");
assert.equal(playerMoneyDenial({ operation: "redemptions", headers: headers("US", "TX"), dateOfBirth: "1990-01-01", env: off, today }), REAL_VALUE_OFF);

let providerCalls = 0;
let balance = 100;
function tryDeposit(env) {
  const denied = realValueDenial("deposits", env);
  if (denied) return denied;
  providerCalls += 1;
  balance -= 10;
  return null;
}
assert.equal(tryDeposit({}), REAL_VALUE_OFF);
assert.equal(providerCalls, 0);
assert.equal(balance, 100);
assert.equal(tryDeposit({ REAL_VALUE_DEPOSITS: "on" }), null);
assert.equal(providerCalls, 1);
assert.equal(balance, 90);

function before(source, gate, action) {
  const gateAt = source.indexOf(gate);
  const actionAt = source.indexOf(action);
  assert.ok(gateAt >= 0 && actionAt > gateAt, `${gate} must come before ${action}`);
}

const create = readFileSync(new URL("../src/app/api/payments/paydora/create/route.ts", import.meta.url), "utf8");
const payout = readFileSync(new URL("../src/app/api/payments/paydora/payout/route.ts", import.meta.url), "utf8");
const webhook = readFileSync(new URL("../src/app/api/payments/paydora/webhook/route.ts", import.meta.url), "utf8");
const loads = readFileSync(new URL("../src/lib/actions/game-loads.ts", import.meta.url), "utf8");
const settle = readFileSync(new URL("../src/lib/payments/auto-settle.ts", import.meta.url), "utf8");
const paydora = readFileSync(new URL("../src/lib/payments/paydora.ts", import.meta.url), "utf8");
const wallet = readFileSync(new URL("../src/lib/payments/paydora-wallet.ts", import.meta.url), "utf8");
const auth = readFileSync(new URL("../src/lib/actions/auth.ts", import.meta.url), "utf8");
const adminUsers = readFileSync(new URL("../src/lib/actions/admin/users.ts", import.meta.url), "utf8");
const mutate = readFileSync(new URL("../src/lib/wallet/service-mutate.ts", import.meta.url), "utf8");

before(create, 'operation: "deposits"', "await createPaydoraDeposit");
before(payout, 'operation: "payouts"', "reserve_paydora_payout");
before(payout, 'operation: "payouts"', "await createPaydoraWithdrawal");
before(webhook, 'realValueDenial("deposits")', "await creditPaydoraDeposit");
before(webhook, "verifyPaydoraSignature", 'realValueDenial("deposits")');
before(webhook, "recordHeldPaydoraWebhook", "await creditPaydoraDeposit");
before(loads, 'blockPlayerMoney("game_loads"', 'rpc("request_game_load"');
before(loads, 'blockPlayerMoney("redemptions"', 'rpc("request_game_redeem"');
before(loads, 'realValueDenial("game_loads")', "withAdminStoreLogin(gameSlug");
before(settle, 'realValueDenial("game_loads")', 'rpc("request_auto_game_load"');
before(paydora, 'realValueDenial("deposits")', 'paydoraFetch("/deposits/create"');
before(paydora, 'realValueDenial("payouts")', 'paydoraFetch("/withdrawals/create"');
before(wallet, 'realValueDenial("deposits")', 'rpc("credit_paydora_deposit"');
const finalize = auth.slice(auth.indexOf("export async function finalizeRegistrationAfterSignUp"));
before(finalize, "ageDenial(input.dateOfBirth)", "persistContactOnProfile");
before(adminUsers, "REAL_VALUE_ADJUSTMENTS", 'rpc(credit ? "credit_wallet"');
before(adminUsers, 'realValueDenial("payouts")', 'rpc("admin_payout_cashout"');
before(mutate, 'realValueDenial("payouts")', 'rpc("admin_payout_cashout"');
const creditFn = mutate.slice(mutate.indexOf("export async function creditCurrentWallet"), mutate.indexOf("export async function debitCurrentWallet"));
before(creditFn, "ledgerOperation", 'rpc("credit_wallet"');
before(creditFn, "adjustmentDenial", 'rpc("credit_wallet"');
const spin = readFileSync(new URL("../src/lib/actions/spin.ts", import.meta.url), "utf8");
before(spin, "adjustmentDenial()", 'rpc("record_wheel_spin"');
const autoOps = readFileSync(new URL("../src/lib/actions/auto-ops.ts", import.meta.url), "utf8");
const staffPayout = readFileSync(new URL("../src/lib/actions/admin/payouts.ts", import.meta.url), "utf8");
before(autoOps, 'realValueDenial("game_loads")', 'rpc("request_auto_game_load"');
before(staffPayout, 'realValueDenial("payouts")', 'rpc("admin_payout_cashout"');

console.log("real value control checks passed");
