import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { registrationWriteDenial } from "../src/lib/auth/registration-guard.ts";
import { trackedFulfillmentDecision, classifyProviderOutcome, mayRefundLoad } from "../src/lib/game-automation/load-outcome.ts";
import { lockedRestrictionUntil } from "../src/lib/responsible/restriction-lock.ts";

const now = Date.parse("2026-10-19T12:00:00.000Z");
const fresh = {
  sessionUserId: null,
  sessionEmail: null,
  claimedUserId: "player-1",
  claimedEmail: "player@example.com",
  authEmail: "player@example.com",
  createdAtMs: now - 60_000,
  emailConfirmed: false,
  profilePhone: null,
  profileDob: null,
  now,
};

assert.equal(registrationWriteDenial(fresh), null);
assert.equal(
  registrationWriteDenial({ ...fresh, claimedUserId: "someone-else", sessionUserId: "player-1", sessionEmail: "player@example.com" }),
  "This signup does not match the signed-in account."
);
assert.equal(
  registrationWriteDenial({ ...fresh, authEmail: "other@example.com" }),
  "This signup does not match the account email."
);
assert.equal(
  registrationWriteDenial({ ...fresh, profilePhone: "+15550001111" }),
  "This account is already set up. Sign in to change it."
);

assert.equal(trackedFulfillmentDecision("completed", false), "completed");
assert.equal(trackedFulfillmentDecision("pending", false), "run");
assert.equal(trackedFulfillmentDecision("processing", false), "run");
assert.equal(trackedFulfillmentDecision("pending", true), "stop");
assert.equal(trackedFulfillmentDecision("failed", false), "stop");

assert.equal(classifyProviderOutcome({ success: false, error: "HTTP 500" }), "unknown");
assert.equal(mayRefundLoad({
  outcome: classifyProviderOutcome({ success: false, error: "Service unavailable" }),
  loadType: "load",
  gameApiDebited: false,
  walletRefunded: false,
}), false);
assert.equal(classifyProviderOutcome({ success: false, error: "Account not found" }), "confirmed_failure");

const later = new Date(now + 86_400_000).toISOString();
const sooner = new Date(now + 3_600_000).toISOString();
assert.equal(lockedRestrictionUntil(later, "", now), later);
assert.equal(lockedRestrictionUntil(later, sooner, now), later);
assert.equal(lockedRestrictionUntil(later, new Date(now + 172_800_000).toISOString(), now), new Date(now + 172_800_000).toISOString());

const loads = readFileSync(new URL("../src/lib/actions/game-loads.ts", import.meta.url), "utf8");
assert.equal(loads.includes("export async function fulfillTrackedRequest"), false);
const vault = readFileSync(new URL("../src/lib/game-automation/gamevault-service.ts", import.meta.url), "utf8");
assert.equal(vault.includes('.eq("game_slug", "game-vault")'), true);
const settle = readFileSync(new URL("../src/lib/payments/auto-settle.ts", import.meta.url), "utf8");
assert.equal(settle.includes("final_credit: sent"), false);
assert.equal(/case "orion-stars":\s*return false;/.test(settle), true);
const juwa = readFileSync(new URL("../src/lib/game-automation/juwa-service.ts", import.meta.url), "utf8");
assert.equal(juwa.includes("getPlayerBalance"), true);
assert.equal(juwa.includes("Invalid redeem amount for Juwa"), false);
const vegas = readFileSync(new URL("../src/lib/game-automation/vegas-service.ts", import.meta.url), "utf8");
assert.equal(vegas.includes("getUserBalance"), true);
assert.equal(vegas.includes("Invalid redeem amount for Vegas"), false);

console.log("security-fixes.test.mjs passed");
