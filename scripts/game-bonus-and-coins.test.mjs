import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { bonusDetailLines, bonusForPercent, firstDepositBadge, quoteBonus } from "../src/lib/payments/bonus-math.ts";
import { offerIsLive } from "../src/lib/payments/bonus-math.ts";
import {
  COIN_REDEMPTION_ENABLED,
  DEPOSIT_COINS_ENABLED,
  GLOBAL_COIN_BUDGET,
  WELCOME_COIN_TASKS,
  WELCOME_COIN_TOTAL,
  budgetAllows,
  clawbackDepositCoins,
  depositCoinsFor,
  claimSwitchResult,
  availableWelcomeCoins,
  claimSwitchSave,
  redemptionAvailable,
  surveyAnswersValid,
} from "../src/lib/rewards/loyalty-coins.ts";

const juwa = { firstDepositBonusPercent: 50, reloadBonusPercent: 10 };
const vault = { firstDepositBonusPercent: 100, reloadBonusPercent: 10 };
const vegas = { firstDepositBonusPercent: 150, reloadBonusPercent: 10 };
const frenzy = { firstDepositBonusPercent: 200, reloadBonusPercent: 10 };

function sameAsLegacy(paid, percent) {
  const legacy = bonusForPercent(paid, percent);
  const quoted = quoteBonus({ paid, kind: "first", firstDepositBonusPercent: percent, reloadBonusPercent: 10 });
  assert.deepEqual(quoted, legacy);
}

sameAsLegacy(10, 50);
sameAsLegacy(10, 100);
sameAsLegacy(20, 0);
sameAsLegacy(7.5, 10);

const first = quoteBonus({ paid: 10, kind: "first", ...juwa });
const later = quoteBonus({ paid: 10, kind: "reload", ...juwa });
assert.equal(first.bonus, 5);
assert.equal(first.finalCredit, 15);
assert.equal(later.bonus, 1);
assert.equal(later.finalCredit, 11);
assert.equal(quoteBonus({ paid: 10, kind: "first", firstDepositBonusPercent: 75, reloadBonusPercent: 10 }).bonus, 7.5);
assert.equal(quoteBonus({ paid: 10, kind: "first", ...vault }).bonus, 10);
assert.equal(quoteBonus({ paid: 4, kind: "first", ...juwa, minDeposit: 5 }).bonus, 0);
assert.equal(quoteBonus({ paid: 10, kind: "first", ...juwa, endsAt: "2000-01-01T00:00:00.000Z" }).bonus, 0);
assert.equal(offerIsLive({ startsAt: null, endsAt: null }), true);
assert.equal(quoteBonus({ paid: 10, kind: "first", ...vegas }).bonus, 15);
assert.equal(quoteBonus({ paid: 10, kind: "first", ...frenzy }).finalCredit, 30);
assert.equal(quoteBonus({ paid: 10, kind: "first", ...juwa, bonusEnabled: false }).bonus, 0);
assert.equal(quoteBonus({ paid: 100, kind: "first", ...frenzy, maxBonusAmount: 25 }).bonus, 25);
assert.equal(quoteBonus({ paid: 10, kind: "first", firstDepositBonusPercent: null, reloadBonusPercent: 10 }), null);

assert.equal(firstDepositBadge(50), "50% First Deposit Bonus");
assert.equal(firstDepositBadge(100), "100% First Deposit Bonus");
assert.equal(firstDepositBadge(0), null);
assert.equal(firstDepositBadge(50, false), null);
assert.match(bonusDetailLines(vault)[0], /First deposit bonus 100%.*Later deposits 10%/);

assert.equal(WELCOME_COIN_TOTAL, 1000);
assert.deepEqual(WELCOME_COIN_TASKS.map((task) => task.coins), [200, 150, 150, 300, 100, 100]);
assert.equal(depositCoinsFor(10), 0);
assert.equal(depositCoinsFor(10, true), 50);
assert.equal(depositCoinsFor(50, true), 250);
assert.equal(depositCoinsFor(1000, true, 5, 500), 500);
assert.equal(clawbackDepositCoins({ granted: 50, alreadyReversed: 20, reverseDollars: 10, originalDollars: 10 }), 30);
assert.equal(depositCoinsFor(0, true), 0);
assert.equal(depositCoinsFor(10.9, true), 50);
assert.equal(DEPOSIT_COINS_ENABLED, false);
assert.equal(COIN_REDEMPTION_ENABLED, false);
assert.equal(redemptionAvailable(), false);
assert.deepEqual(claimSwitchResult({ legacy: true, coinCheckin: false, earning: false }), { freeplay: true, coins: false });
assert.deepEqual(claimSwitchResult({ legacy: false, coinCheckin: true, earning: true }), { freeplay: false, coins: true });
assert.deepEqual(claimSwitchResult({ legacy: false, coinCheckin: true, earning: false }), { freeplay: false, coins: false });
assert.deepEqual(claimSwitchResult({ legacy: true, coinCheckin: true, earning: true }), { freeplay: false, coins: false });
assert.deepEqual(claimSwitchResult({ legacy: false, coinCheckin: false, earning: true }), { freeplay: false, coins: false });
assert.equal(availableWelcomeCoins(WELCOME_COIN_TASKS.map((task) => ({ ...task, enabled: true })), { phoneReady: false, telegramReady: false }), 750);
assert.equal(availableWelcomeCoins(WELCOME_COIN_TASKS.map((task) => ({ ...task, enabled: true })), { phoneReady: true, telegramReady: true }), 1000);
assert.equal(claimSwitchSave({ legacy: true, coinCheckin: true }).ok, false);
assert.equal(claimSwitchSave({ legacy: true, coinCheckin: false }).ok, true);
assert.equal(budgetAllows(29900, 100, GLOBAL_COIN_BUDGET), true);
assert.equal(budgetAllows(29901, 100, GLOBAL_COIN_BUDGET), false);
assert.equal(surveyAnswersValid({ games: "both", source: "friend", interest: "support" }), true);
assert.equal(surveyAnswersValid({ games: "poker", source: "friend", interest: "support" }), false);

const migration = readFileSync(new URL("../supabase/migrations/20261022000100_loyalty_coins.sql", import.meta.url), "utf8");
const landing = readFileSync(new URL("../src/components/games/game-landing-client.tsx", import.meta.url), "utf8");
const settle = readFileSync(new URL("../src/lib/payments/auto-settle.ts", import.meta.url), "utf8");
assert.match(migration, /coins_balance = coalesce\(coins_balance, 0\) \+ task_coins/);
assert.doesNotMatch(migration, /bonus_wallet|cashout_wallet|wallet_balance|vip_points/);
assert.match(migration, /enabled boolean NOT NULL DEFAULT false/);
assert.match(migration, /Coin redemption is not available yet/);
assert.match(migration, /issued \+ task_coins > 30000/);
assert.doesNotMatch(landing, /firstTimeBonus|regularBonus/);
assert.match(settle, /quoteBonus/);
assert.doesNotMatch(settle, /bonusForPercent/);
const completion = readFileSync(new URL("../supabase/migrations/20261022000200_loyalty_completion.sql", import.meta.url), "utf8");
const phoneAction = readFileSync(new URL("../src/lib/actions/loyalty.ts", import.meta.url), "utf8");
assert.doesNotMatch(completion, /FUNCTION public\.claim_reward|bonus_wallet|cashout_wallet|SET vip_points/);
assert.match(completion, /legacy_freeplay_claims_enabled/);
assert.match(completion, /coins_global_budget/);
assert.match(completion, /loyalty_admin_summary/);
assert.match(readFileSync(new URL("../src/lib/rewards/loyalty-coins.ts", import.meta.url), "utf8"), /Both reward systems cannot be active together/);
assert.match(readFileSync(new URL("../src/components/admin/loyalty-controls-form.tsx", import.meta.url), "utf8"), /!state\.ok/);
assert.doesNotMatch(readFileSync(new URL("../src/lib/actions/admin/loyalty.ts", import.meta.url), "utf8"), /coins_checkin_cutover/);
assert.match(completion, /Coin redemption is not available yet/);
assert.match(phoneAction, /PHONE_OTP_SENDING_ENABLED/);
assert.doesNotMatch(phoneAction, /phone confirmed|verification succeeded/i);

console.log("game bonus and coins checks passed");
