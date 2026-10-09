import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { collectedDepositAmount } from "../src/lib/payments/paydora.ts";
import { bonusForPercent } from "../src/lib/payments/bonus-math.ts";

assert.equal(collectedDepositAmount({ status: "partial", amount: 20, paidAmount: 10 }), 10);
assert.equal(collectedDepositAmount({ status: "paid", amount: 20, paidAmount: 20 }), 20);
assert.equal(Math.min(20, collectedDepositAmount({ status: "paid", amount: 15, paidAmount: 15 })), 15);
const priced = bonusForPercent(10, 100);
assert.equal(priced.finalCredit, 20);

const create = readFileSync(new URL("../src/app/api/payments/paydora/create/route.ts", import.meta.url), "utf8");
assert.match(create, /amountsForMethod/);

const webhook = readFileSync(new URL("../src/app/api/payments/paydora/webhook/route.ts", import.meta.url), "utf8");
assert.match(webhook, /collectedDepositAmount/);
assert.match(webhook, /Math\.min\(savedAmount, collected\)/);
assert.match(webhook, /verifyPaydoraSignature/);

const payout = readFileSync(new URL("../src/app/api/payments/paydora/payout/route.ts", import.meta.url), "utf8");
assert.equal(payout.includes("body.idempotencyKey"), false);
assert.equal(payout.includes("creditPaydoraDeposit"), false);
assert.match(payout, /cashout_wallet/);
assert.match(payout, /credit_cashout_payout_void/);
assert.match(payout, /already submitted/);

const sql = readFileSync(
  new URL("../supabase/migrations/20261008000190_auto_money.sql", import.meta.url),
  "utf8"
);
assert.match(sql, /load_type NOT IN \('load', 'reload'\)/);
assert.match(sql, /game_api_debited/);
assert.match(sql, /cashout_wallet = cashout_wallet - v_amount/);
assert.match(sql, /unpaid_remainder/);
assert.match(sql, /vip_tier/);
assert.match(sql, /is_suspended/);
assert.match(sql, /record_wheel_spin/);
assert.match(sql, /request_game_account_create/);
assert.equal(sql.includes("GREATEST(0, wallet_balance - v_amount)"), false);

const spin = readFileSync(new URL("../src/lib/actions/spin.ts", import.meta.url), "utf8");
assert.match(spin, /record_wheel_spin/);
assert.equal(spin.includes('.from("wheel_spins").insert'), false);

const callback = readFileSync(new URL("../src/app/auth/callback/route.ts", import.meta.url), "utf8");
assert.match(callback, /startsWith\("\/\/"\)/);
assert.match(callback, /:\/\//);

const stop = readFileSync(new URL("../src/app/api/sms/stop/route.ts", import.meta.url), "utf8");
assert.match(stop, /x-twilio-signature/);

const loads = readFileSync(new URL("../src/lib/actions/game-loads.ts", import.meta.url), "utf8");
assert.match(loads, /finishGameLoad/);
assert.equal(loads.includes('status: "failed"'), false);

const wallet = readFileSync(new URL("../src/app/dashboard/wallet/page.tsx", import.meta.url), "utf8");
assert.equal(wallet.includes("DepositPageClient"), false);

const withdraw = readFileSync(new URL("../src/app/dashboard/withdraw/page.tsx", import.meta.url), "utf8");
assert.equal(withdraw.includes("/dashboard/games"), false);
assert.match(withdraw, /CashoutRequestForm/);

const nav = readFileSync(new URL("../src/lib/admin/nav.ts", import.meta.url), "utf8");
assert.equal(nav.includes("/admin/requests"), false);
assert.equal(nav.includes("/admin/failed-loads"), false);

console.log("auto money checks passed");
