import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  classifyProviderFailure,
  createPayoutLedger,
  payoutDestinationKey,
} from "../src/lib/payments/payout-reservation.ts";

const userId = "player-1";
const same = {
  userId,
  amount: 25,
  method: "chime",
  destinationKey: "dest-a",
  hold: false,
};

const repeated = createPayoutLedger({ [userId]: 100 });
const first = await repeated.reserve(same);
const second = await repeated.reserve(same);
assert.equal(first.debited, true);
assert.equal(first.status, "reserved");
assert.equal(second.reused, true);
assert.equal(second.debited, false);
assert.equal(second.idempotencyKey, first.idempotencyKey);
assert.equal(repeated.balance(userId), 75);

const concurrent = createPayoutLedger({ [userId]: 100 });
const raced = await Promise.all(Array.from({ length: 12 }, () => concurrent.reserve(same)));
assert.equal(new Set(raced.map((row) => row.idempotencyKey)).size, 1);
assert.equal(raced.filter((row) => row.debited).length, 1);
assert.equal(concurrent.balance(userId), 75);

const timedOut = createPayoutLedger({ [userId]: 40 });
const pending = await timedOut.reserve(same);
assert.equal(classifyProviderFailure(undefined, "connect timeout"), "ambiguous");
assert.equal(classifyProviderFailure(408, "request timeout"), "ambiguous");
assert.equal(classifyProviderFailure(429, "slow down"), "ambiguous");
assert.equal(classifyProviderFailure(500, "provider down"), "ambiguous");
assert.equal(classifyProviderFailure(400, "upstream timeout"), "ambiguous");
const ambiguous = await timedOut.applyProviderResult(userId, pending.idempotencyKey, "ambiguous");
assert.equal(ambiguous.refunded, false);
assert.equal(timedOut.row(pending.idempotencyKey)?.status, "reserved");
assert.equal(timedOut.balance(userId), 15);
const firstAttempt = await timedOut.beginAttempt(userId, pending.idempotencyKey);
const secondAttempt = await timedOut.beginAttempt(userId, pending.idempotencyKey);
assert.equal(firstAttempt.callProvider, true);
assert.equal(secondAttempt.callProvider, false);
assert.equal(secondAttempt.inProgress, true);
timedOut.advance(120_001);
const retryAttempt = await timedOut.beginAttempt(userId, pending.idempotencyKey);
assert.equal(retryAttempt.callProvider, true);
assert.equal(retryAttempt.idempotencyKey, pending.idempotencyKey);
assert.equal(timedOut.balance(userId), 15);

assert.equal(classifyProviderFailure(409, "already exists"), "duplicate");
assert.equal(classifyProviderFailure(400, "card declined"), "rejected");
const declined = await timedOut.applyProviderResult(userId, pending.idempotencyKey, "rejected");
assert.equal(declined.refunded, true);
assert.equal(declined.status, "failed");
assert.equal(timedOut.balance(userId), 40);
const declinedAgain = await timedOut.applyProviderResult(userId, pending.idempotencyKey, "rejected");
assert.equal(declinedAgain.duplicate, true);
assert.equal(declinedAgain.refunded, false);
assert.equal(timedOut.balance(userId), 40);

const paid = createPayoutLedger({ [userId]: 80 });
const sent = await paid.reserve({ ...same, amount: 30 });
const accepted = await paid.applyProviderResult(userId, sent.idempotencyKey, "accepted", "paid");
assert.equal(accepted.status, "paid");
assert.equal(accepted.refunded, false);
assert.equal(paid.balance(userId), 50);
const sameAgain = await paid.reserve({ ...same, amount: 30 });
assert.notEqual(sameAgain.idempotencyKey, sent.idempotencyKey);
assert.equal(sameAgain.debited, true);
assert.equal(paid.balance(userId), 20);
const whileOpen = createPayoutLedger({ [userId]: 80 });
const open = await whileOpen.reserve({ ...same, amount: 30 });
await whileOpen.applyProviderResult(userId, open.idempotencyKey, "accepted", "processing");
const replay = await whileOpen.reserve({ ...same, amount: 30 });
assert.equal(replay.idempotencyKey, open.idempotencyKey);
assert.equal(replay.debited, false);
assert.equal(whileOpen.balance(userId), 50);
const afterPaid = await paid.reserve({ ...same, amount: 10 });
assert.notEqual(afterPaid.idempotencyKey, sent.idempotencyKey);
assert.equal(afterPaid.debited, true);
assert.equal(paid.balance(userId), 10);

const submitted = createPayoutLedger({ [userId]: 20 });
const submittedRow = await submitted.reserve({ ...same, amount: 5 });
await submitted.applyProviderResult(userId, submittedRow.idempotencyKey, "duplicate");
const rejectedLate = await submitted.applyProviderResult(userId, submittedRow.idempotencyKey, "rejected");
assert.equal(rejectedLate.refunded, false);
assert.equal(submitted.balance(userId), 15);
assert.equal(submitted.row(submittedRow.idempotencyKey)?.status, "submitted");

const otherDest = await paid.reserve({ ...same, amount: 10, destinationKey: "dest-b" });
assert.notEqual(otherDest.idempotencyKey, afterPaid.idempotencyKey);

const held = createPayoutLedger({ [userId]: 100 });
const holdA = await held.reserve({ ...same, hold: true });
const holdB = await held.reserve({ ...same, hold: true });
assert.equal(holdA.status, "manual_review");
assert.equal(holdA.debited, false);
assert.equal(holdB.idempotencyKey, holdA.idempotencyKey);
assert.equal(held.balance(userId), 100);
const promoted = await held.reserve({ ...same, hold: false });
assert.equal(promoted.promoted, true);
assert.equal(promoted.debited, true);
assert.equal(promoted.idempotencyKey, holdA.idempotencyKey);
assert.equal(held.balance(userId), 75);

const keyA = payoutDestinationKey({
  method: "Chime",
  amount: 25,
  address: "user@example.com",
  chimePhoneEmail: "",
  cardNumber: "4111111111111111",
  cardValid: "12/30",
});
const keyB = payoutDestinationKey({
  method: "chime",
  amount: 25,
  address: "user@example.com",
  chimePhoneEmail: "",
  cardNumber: "4111111111111111",
  cardValid: "12/30",
});
const keyC = payoutDestinationKey({
  method: "chime",
  amount: 25,
  address: "other@example.com",
  chimePhoneEmail: "",
  cardNumber: "4111111111111111",
  cardValid: "12/30",
});
assert.equal(keyA, keyB);
assert.notEqual(keyA, keyC);
assert.equal(keyA.includes("4111111111111111"), false);

const route = readFileSync(new URL("../src/app/api/payments/paydora/payout/route.ts", import.meta.url), "utf8");
const reservationSql = readFileSync(
  new URL("../supabase/migrations/20261011000270_paydora_payout_reservation.sql", import.meta.url),
  "utf8"
);
const oldMoneySql = readFileSync(
  new URL("../supabase/migrations/20261008000190_auto_money.sql", import.meta.url),
  "utf8"
);
assert.ok(route.indexOf('rpc("reserve_paydora_payout"') < route.indexOf("withdrawal = await createPaydoraWithdrawal"));
assert.equal(route.includes("credit_cashout_payout_void"), false);
assert.match(oldMoneySql, /FUNCTION public.credit_cashout_payout_void/);
assert.match(oldMoneySql, /unpaid_remainder/);
const failFn = reservationSql.slice(
  reservationSql.indexOf("FUNCTION public.fail_paydora_payout"),
  reservationSql.indexOf("REVOKE ALL ON FUNCTION public.fail_paydora_payout")
);
assert.match(failFn, /credit_cashout_payout_void/);
assert.match(failFn, /v_row.status <> 'reserved'/);
assert.match(failFn, /status = 'failed'/);
assert.equal(failFn.includes("credit_paydora_deposit"), false);
const reserveFn = reservationSql.slice(
  reservationSql.indexOf("FUNCTION public.reserve_paydora_payout"),
  reservationSql.indexOf("FUNCTION public.begin_paydora_provider_attempt")
);
assert.ok(reserveFn.indexOf("'debited', false") < reserveFn.lastIndexOf("debit_paydora_payout"));
assert.match(reserveFn, /gen_random_uuid/);
const openIndex = reservationSql.slice(
  reservationSql.indexOf("CREATE UNIQUE INDEX"),
  reservationSql.indexOf(";", reservationSql.indexOf("CREATE UNIQUE INDEX"))
);
assert.match(openIndex, /requested', 'reserved', 'submitted', 'manual_review'/);
assert.equal(openIndex.includes("'paid'"), false);
assert.equal(openIndex.includes("'failed'"), false);

console.log("payout reservation checks passed");
