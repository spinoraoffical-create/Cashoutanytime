import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { decidePaydoraWebhook } from "../src/lib/payments/paydora-webhook-decision.ts";

const paid = {
  depositsOn: true,
  previouslyHeld: false,
  event: "deposit.paid",
  status: "paid",
  currency: "USD",
  savedAmount: 25,
  collectedAmount: 25,
  hasIntent: true,
  ageBlocked: false,
};

assert.equal(decidePaydoraWebhook(paid).action, "credit");
assert.equal(decidePaydoraWebhook(paid).amount, 25);
assert.equal(decidePaydoraWebhook({ ...paid, status: "cancelled" }).action, "ignore");
assert.equal(decidePaydoraWebhook({ ...paid, status: "failed" }).action, "ignore");
assert.equal(decidePaydoraWebhook({ ...paid, status: "" }).action, "ignore");
assert.equal(decidePaydoraWebhook({ ...paid, currency: "EUR" }).reason, "currency rejected");
assert.equal(decidePaydoraWebhook({ ...paid, currency: "" }).action, "credit");
assert.equal(decidePaydoraWebhook({ ...paid, currency: "" }).amount, 25);
assert.equal(decidePaydoraWebhook({ ...paid, collectedAmount: 20 }).reason, "held: amount mismatch");
assert.equal(decidePaydoraWebhook({ ...paid, savedAmount: 30 }).reason, "held: amount mismatch");
assert.equal(decidePaydoraWebhook({ ...paid, hasIntent: false }).reason, "held: amount mismatch");
assert.equal(decidePaydoraWebhook({ ...paid, ageBlocked: true }).reason, "held: age");
assert.equal(decidePaydoraWebhook({ ...paid, depositsOn: false }).reason, "held: deposits off");
assert.equal(decidePaydoraWebhook({ ...paid, previouslyHeld: true }).reason, "held: awaiting reconciliation");
assert.equal(decidePaydoraWebhook({ ...paid, event: "deposit.refunded", depositsOn: false }).action, "hold");
assert.equal(decidePaydoraWebhook({ ...paid, event: "deposit.refunded" }).action, "reverse");
assert.equal(decidePaydoraWebhook({ ...paid, event: "mystery.event" }).reason, "unknown event");

function apply(store, decision, paymentId) {
  const row = store.get(paymentId) || { balance: 0, credits: 0, status: null, error: null };
  if (row.status === "processed") return row;
  if (decision.action === "credit" && !String(row.error || "").startsWith("held:")) {
    row.balance += decision.amount;
    row.credits += 1;
    row.status = "processed";
    row.error = null;
  } else {
    row.status = decision.action === "ignore" ? "ignored" : "received";
    row.error = decision.reason;
  }
  store.set(paymentId, row);
  return row;
}

const store = new Map();
const first = apply(store, decidePaydoraWebhook(paid), "dep_1");
const duplicate = apply(store, decidePaydoraWebhook(paid), "dep_1");
assert.equal(first.balance, 25);
assert.equal(duplicate.balance, 25);
assert.equal(duplicate.credits, 1);

const held = new Map();
apply(held, decidePaydoraWebhook({ ...paid, depositsOn: false }), "dep_2");
const retry = apply(held, decidePaydoraWebhook({ ...paid, previouslyHeld: true }), "dep_2");
assert.equal(retry.balance, 0);
assert.equal(retry.credits, 0);
assert.match(retry.error, /held:/);

let wins = 0;
const concurrent = new Map();
await Promise.all(
  Array.from({ length: 12 }, async () => {
    const decision = decidePaydoraWebhook(paid);
    const row = apply(concurrent, decision, "dep_race");
    if (row.credits === 1) wins += 1;
  })
);
assert.equal(concurrent.get("dep_race").balance, 25);
assert.equal(concurrent.get("dep_race").credits, 1);

const route = readFileSync(new URL("../src/app/api/payments/paydora/webhook/route.ts", import.meta.url), "utf8");
assert.ok(route.indexOf("verifyPaydoraSignature") < route.indexOf("decidePaydoraWebhook"));
assert.ok(route.indexOf("recordHeldPaydoraWebhook") < route.indexOf("await creditPaydoraDeposit"));
assert.equal(route.includes('|| payload.event === "deposit.paid"'), false);
assert.match(route, /Payment intent or game is missing/);

const sql = readFileSync(new URL("../supabase/migrations/20261017000600_real_value_db_guard.sql", import.meta.url), "utf8");
assert.match(sql, /enabled boolean NOT NULL DEFAULT false/);
assert.match(sql, /ON CONFLICT \(operation\) DO NOTHING/);
assert.equal(sql.includes("enabled = true"), false);
assert.match(sql, /payout-void:%/);
assert.match(sql, /refund:%/);
assert.match(sql, /REVOKE ALL ON TABLE public\.real_value_controls FROM PUBLIC, anon, authenticated/);

console.log("webhook reconciliation checks passed");
