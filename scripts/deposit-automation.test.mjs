import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import {
  bonusForPercent,
  creditOnce,
  depositKind,
  playerVisibleTo,
  refundFinalCredit,
} from "../src/lib/payments/bonus-math.ts";

const first = bonusForPercent(20, 100);
assert.equal(depositKind(0), "first");
assert.equal(first.bonus, 20);
assert.equal(first.finalCredit, 40);

const reload = bonusForPercent(20, 10);
assert.equal(depositKind(1), "reload");
assert.equal(reload.finalCredit, 22);

const ledger = { balance: 0, credits: new Map(), refunds: new Set() };
const paid = creditOnce(ledger, "dep_20", first.finalCredit);
assert.equal(paid.balance, 40);
assert.equal(paid.duplicate, false);

const replay = creditOnce(ledger, "dep_20", first.finalCredit);
assert.equal(replay.duplicate, true);
assert.equal(replay.balance, 40);

const refund = refundFinalCredit(ledger, "dep_20");
assert.equal(refund.removed, 40);
assert.equal(refund.balance, 0);
const refundReplay = refundFinalCredit(ledger, "dep_20");
assert.equal(refundReplay.duplicate, true);
assert.equal(refundReplay.balance, 0);

assert.equal(playerVisibleTo(["sub-b"], "sub-a"), false);
assert.equal(playerVisibleTo(["sub-a"], "sub-a"), true);
assert.equal(playerVisibleTo(["store", "sub-a"], "sub-a"), true);

assert.throws(() => refundFinalCredit({ balance: 40, credits: new Map(), refunds: new Set() }, "missing"));

const checkout = readFileSync(new URL("../src/components/payments/dollarpay-deposit-modal.tsx", import.meta.url), "utf8");
const gameDeposit = readFileSync(new URL("../src/components/games/game-deposit-section.tsx", import.meta.url), "utf8");
const requests = readFileSync(new URL("../src/app/admin/requests/page.tsx", import.meta.url), "utf8");
assert.match(checkout, /Your wallet is credited when Paydora confirms the payment\./);
assert.match(checkout, /Pay with Paydora/);
assert.match(checkout, /methods\.map/);
const paydora = readFileSync(new URL("../src/lib/payments/paydora.ts", import.meta.url), "utf8");
assert.equal(/cashapp\|venmo\|chime/.test(paydora), false);
assert.equal(/Venmo|PayPal|screenshot|pay manually|nowpayments/i.test(checkout), false);
assert.equal(/screenshot|pay manually|qrImage|DEPOSIT_PAYMENT_METHODS/i.test(gameDeposit), false);
assert.match(requests, /redirect\("\/admin\/deposits"\)/);
assert.equal(existsSync(new URL("../src/app/api/payments/nowpayments/create/route.ts", import.meta.url)), false);
assert.equal(existsSync(new URL("../src/app/api/payments/nowpayments/webhook/route.ts", import.meta.url)), false);

const wallet = readFileSync(new URL("../src/lib/payments/paydora-wallet.ts", import.meta.url), "utf8");
const paydoraWebhook = readFileSync(new URL("../src/app/api/payments/paydora/webhook/route.ts", import.meta.url), "utf8");
assert.equal(wallet.includes("quote?.finalCredit ?? amount"), false);
assert.equal(wallet.includes("crediting the paid amount only"), false);
assert.equal(wallet.includes("final_credit"), true);
assert.equal(paydoraWebhook.includes("Payment intent or game is missing"), true);

console.log("deposit automation checks passed");
