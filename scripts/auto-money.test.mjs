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
const decision = readFileSync(new URL("../src/lib/payments/paydora-webhook-decision.ts", import.meta.url), "utf8");
assert.match(webhook, /collectedFromWebhook/);
assert.match(decision, /collectedDepositAmount/);
assert.equal(webhook.includes("Math.min(savedAmount, collected)"), false);
assert.match(webhook, /verifyPaydoraSignature/);
assert.match(decision, /amountsMatch/);

const payout = readFileSync(new URL("../src/app/api/payments/paydora/payout/route.ts", import.meta.url), "utf8");
assert.equal(payout.includes("body.idempotencyKey"), false);
assert.equal(payout.includes("creditPaydoraDeposit"), false);
assert.equal(payout.includes("randomUUID"), false);
assert.match(payout, /cashout_wallet/);
assert.match(payout, /reserve_paydora_payout/);
assert.match(payout, /fail_paydora_payout/);
assert.match(payout, /already submitted/);
assert.ok(payout.indexOf('outcome !== "rejected"') < payout.indexOf("fail_paydora_payout"));

const sql = readFileSync(
  new URL("../supabase/migrations/20261008000190_auto_money.sql", import.meta.url),
  "utf8"
);
assert.match(sql, /load_type NOT IN \('load', 'reload'\)/);
assert.match(sql, /game_api_debited/);
assert.match(sql, /cashout_wallet = cashout_wallet - v_amount/);
assert.match(sql, /credit_cashout_payout_void/);
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
assert.match(wallet, /id="add-money"/);
assert.match(wallet, /<DepositPageClient embedded games=\{games\} \/>/);

const depositPage = readFileSync(new URL("../src/app/dashboard/deposit/page.tsx", import.meta.url), "utf8");
assert.match(depositPage, /<DepositPageClient games=\{games\} \/>/);
assert.equal(depositPage.includes("embedded"), false);

const depositClient = readFileSync(
  new URL("../src/components/dashboard/deposit-page-client.tsx", import.meta.url),
  "utf8"
);
assert.match(depositClient, /embedded \? undefined : "add-money"/);
assert.match(depositClient, /embedded \? null/);

const withdraw = readFileSync(new URL("../src/app/dashboard/withdraw/page.tsx", import.meta.url), "utf8");
assert.equal(withdraw.includes("/dashboard/games"), false);
assert.match(withdraw, /CashoutRequestForm/);

const nav = readFileSync(new URL("../src/lib/admin/nav.ts", import.meta.url), "utf8");
assert.match(nav, /href: "\/admin\/requests"[\s\S]{0,180}permission: "requests\.manage"/);
assert.match(nav, /href: "\/admin\/failed-loads"[\s\S]{0,180}permission: "requests\.manage"/);
assert.match(nav, /href: "\/admin\/kyc"[\s\S]{0,120}permission: "kyc\.manage"/);

const debitStart = sql.indexOf("CREATE OR REPLACE FUNCTION public.debit_paydora_payout");
const debitEnd = sql.indexOf("CREATE OR REPLACE FUNCTION public.credit_cashout_payout_void");
const debitFn = sql.slice(debitStart, debitEnd);
assert.match(debitFn, /cashout_wallet = cashout_wallet - v_amount/);
assert.equal(debitFn.includes("wallet_balance"), false);
assert.match(debitFn, /INSERT INTO public\.paydora_processed_events/);
assert.match(debitFn, /WHEN unique_violation/);
assert.match(debitFn, /'cashout', 'debit', 'withdrawal'/);

console.log("auto money checks passed");
