import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createFireKirinStoreAdapter } from "../src/lib/store-automation/fire-kirin-adapter.ts";
import { createMilkyWayStoreAdapter } from "../src/lib/store-automation/milky-way-adapter.ts";
import { createOrionStarsStoreAdapter } from "../src/lib/store-automation/orion-stars-adapter.ts";
import { createPandaMasterStoreAdapter } from "../src/lib/store-automation/panda-master-adapter.ts";
import { LIVE_STORE_BLOCKED, createMockStoreAdapter } from "../src/lib/store-automation/adapters.ts";
import { createStoreEngine } from "../src/lib/store-automation/engine.ts";
import { parseGameRecords, parseStoreBalance } from "../src/lib/store-automation/parse.ts";

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function storeMock(slug, role, execute) {
  return createMockStoreAdapter(slug, {
    capability: { accountRole: role },
    execute,
  });
}

const live = [
  createOrionStarsStoreAdapter(),
  createMilkyWayStoreAdapter(),
  createPandaMasterStoreAdapter(),
  createFireKirinStoreAdapter(),
];

for (const adapter of live) {
  const capability = adapter.capability();
  assert.equal(capability.browserAutomationAuthorized, false);
  assert.equal(capability.officialPortalApi, false);
  assert.equal(capability.accountRole, "unverified");
  const blocked = await adapter.execute({
    requestId: "live-1",
    operation: "load",
    websiteUserId: "player-a",
    gameUsername: "alice",
    amount: 10,
  });
  assert.equal(blocked.outcome, "confirmed_failure");
  assert.equal(blocked.message, LIVE_STORE_BLOCKED);
}

assert.equal(createPandaMasterStoreAdapter().capability().terminalApiClient, null);
for (const status of Object.values(createPandaMasterStoreAdapter().capability().functions)) {
  assert.equal(status, "not_implemented");
}
assert.equal(createFireKirinStoreAdapter().capability().captchaOnKnownPortal, true);
assert.match(createOrionStarsStoreAdapter().capability().portalEntryUrl, /Agent\.aspx$/);
assert.match(createMilkyWayStoreAdapter().capability().portalEntryUrl, /:8781\/default\.aspx$/);

assert.equal(parseStoreBalance(0), 0);
assert.equal(parseStoreBalance("0"), 0);
assert.equal(parseStoreBalance(""), null);
assert.equal(parseStoreBalance(undefined), null);
assert.equal(parseStoreBalance("nope"), null);
assert.deepEqual(parseGameRecords([]), []);
assert.equal(parseGameRecords([{ id: "1", kind: "play", amount: "" }]), null);

const engine = createStoreEngine(() => "2026-10-17T00:00:00.000Z");
const orion = storeMock("orion-stars", "store", async (command) => {
  if (command.operation === "create_account") {
    return { outcome: "confirmed_success", gameUsername: command.gameUsername };
  }
  if (command.operation === "check_balance") {
    return { outcome: "confirmed_success", balance: command.amount ?? null };
  }
  if (command.operation === "game_records") {
    return { outcome: "confirmed_success", records: [{ id: "g1", kind: "play", amount: 2 }] };
  }
  if (command.requestId === "load-unknown") {
    return { outcome: "unknown", message: "timed out" };
  }
  if (command.requestId === "load-button") {
    return { outcome: "confirmed_success", message: "clicked" };
  }
  return { outcome: "confirmed_success", providerReference: `rcpt-${command.requestId}`, balance: 15 };
});

const created = await engine.submit(orion, {
  requestId: "create-1",
  operation: "create_account",
  websiteUserId: "player-a",
  gameUsername: "alice",
});
assert.equal(created.state, "confirmed_success");
assert.equal(orion.calls.length, 1);

const createdAgain = await engine.submit(orion, {
  requestId: "create-1",
  operation: "create_account",
  websiteUserId: "player-a",
  gameUsername: "alice",
});
assert.equal(createdAgain.state, "confirmed_success");
assert.equal(orion.calls.length, 1);

const duplicateName = await engine.submit(orion, {
  requestId: "create-2",
  operation: "create_account",
  websiteUserId: "player-a",
  gameUsername: "alice",
});
assert.equal(duplicateName.state, "confirmed_success");
assert.equal(orion.calls.length, 1);

const stolen = await engine.submit(orion, {
  requestId: "create-3",
  operation: "create_account",
  websiteUserId: "player-b",
  gameUsername: "alice",
});
assert.equal(stolen.state, "confirmed_failure");
assert.equal(orion.calls.length, 1);

const otherPlayer = await engine.submit(orion, {
  requestId: "load-foreign",
  operation: "load",
  websiteUserId: "player-b",
  gameUsername: "alice",
  amount: 10,
});
assert.equal(otherPlayer.state, "confirmed_failure");
assert.match(otherPlayer.message, /not owned/);
assert.equal(orion.calls.length, 1);

const loaded = await engine.submit(orion, {
  requestId: "load-1",
  operation: "load",
  websiteUserId: "player-a",
  gameUsername: "alice",
  amount: 10,
});
assert.equal(loaded.state, "confirmed_success");
assert.equal(loaded.providerReference, "rcpt-load-1");
assert.equal(loaded.balance, 15);
assert.equal(loaded.retryAllowed, false);
assert.equal(engine.reconcile("load-1", { providerReference: "rcpt-load-1", balance: 15 }), "matched");
assert.equal(engine.reconcile("load-1", { providerReference: "rcpt-load-1", balance: 14 }), "manual_review");
assert.equal(engine.reconcile("missing", { providerReference: "x", balance: 1 }), "manual_review");

const loadedAgain = await engine.submit(orion, {
  requestId: "load-1",
  operation: "load",
  websiteUserId: "player-a",
  gameUsername: "alice",
  amount: 10,
});
assert.equal(loadedAgain, loaded);
assert.equal(orion.calls.length, 2);

const zero = await engine.submit(orion, {
  requestId: "balance-0",
  operation: "check_balance",
  websiteUserId: "player-a",
  gameUsername: "alice",
  amount: 0,
});
assert.equal(zero.state, "confirmed_success");
assert.equal(zero.balance, 0);

const missingBalance = await engine.submit(orion, {
  requestId: "balance-missing",
  operation: "check_balance",
  websiteUserId: "player-a",
  gameUsername: "alice",
});
assert.equal(missingBalance.state, "manual_review");
assert.equal(missingBalance.balance, null);
assert.match(missingBalance.message, /not saved as zero/);

const records = await engine.submit(orion, {
  requestId: "records-1",
  operation: "game_records",
  websiteUserId: "player-a",
  gameUsername: "alice",
});
assert.equal(records.state, "confirmed_success");
assert.equal(records.records[0].amount, 2);

const callsAfterUnknown = orion.calls.length;
const unknown = await engine.submit(orion, {
  requestId: "load-unknown",
  operation: "load",
  websiteUserId: "player-a",
  gameUsername: "alice",
  amount: 5,
});
assert.equal(unknown.state, "manual_review");
assert.equal(unknown.retryAllowed, false);
const unknownAgain = await engine.submit(orion, {
  requestId: "load-unknown",
  operation: "load",
  websiteUserId: "player-a",
  gameUsername: "alice",
  amount: 5,
});
assert.equal(unknownAgain.state, "manual_review");
assert.equal(orion.calls.length, callsAfterUnknown + 1);

const blockedRetry = await engine.submit(orion, {
  requestId: "load-after-unknown",
  operation: "redeem",
  websiteUserId: "player-a",
  gameUsername: "alice",
  amount: 5,
});
assert.equal(blockedRetry.state, "manual_review");
assert.match(blockedRetry.message, /was not sent again/);
assert.equal(orion.calls.length, callsAfterUnknown + 1);

const sub = storeMock("milky-way", "sub_distributor", async () => {
  throw new Error("sub-distributor adapter must not run");
});
const subCreate = await engine.submit(sub, {
  requestId: "mw-create",
  operation: "create_account",
  websiteUserId: "player-a",
  gameUsername: "bob",
});
assert.equal(subCreate.state, "confirmed_failure");
assert.equal(sub.calls.length, 0);

const fire = storeMock("fire-kirin", "store", async (command) => ({
  outcome: "confirmed_success",
  gameUsername: command.gameUsername,
  providerReference: "fk-1",
  balance: 3,
}));
await engine.submit(fire, {
  requestId: "fk-create",
  operation: "create_account",
  websiteUserId: "player-a",
  gameUsername: "carol",
});
engine.expireSession("fire-kirin");
const expired = await engine.submit(fire, {
  requestId: "fk-load",
  operation: "load",
  websiteUserId: "player-a",
  gameUsername: "carol",
  amount: 3,
});
assert.equal(expired.state, "confirmed_failure");
assert.match(expired.message, /expired before the transfer was sent/);
assert.equal(fire.calls.length, 1);

let active = 0;
let maxActive = 0;
const slow = storeMock("orion-stars", "store", async (command) => {
  active += 1;
  maxActive = Math.max(maxActive, active);
  await delay(40);
  active -= 1;
  return {
    outcome: "confirmed_success",
    gameUsername: "dave",
    providerReference: command.requestId,
    balance: 4,
  };
});
const engine2 = createStoreEngine();
await engine2.submit(slow, {
  requestId: "slow-create",
  operation: "create_account",
  websiteUserId: "player-c",
  gameUsername: "dave",
});
await Promise.all([
  engine2.submit(slow, {
    requestId: "slow-1",
    operation: "load",
    websiteUserId: "player-c",
    gameUsername: "dave",
    amount: 4,
  }),
  engine2.submit(slow, {
    requestId: "slow-2",
    operation: "load",
    websiteUserId: "player-c",
    gameUsername: "dave",
    amount: 4,
  }),
]);
assert.equal(maxActive, 1);
assert.equal(slow.calls.length, 3);

const panda = storeMock("panda-master", "store", async (command) => {
  if (command.operation === "create_account") {
    return { outcome: "confirmed_success", gameUsername: command.gameUsername };
  }
  throw new Error("worker interrupted");
});
const engine3 = createStoreEngine();
await engine3.submit(panda, {
  requestId: "panda-create",
  operation: "create_account",
  websiteUserId: "player-d",
  gameUsername: "erin",
});
const interrupted = await engine3.submit(panda, {
  requestId: "panda-load",
  operation: "load",
  websiteUserId: "player-d",
  gameUsername: "erin",
  amount: 8,
});
assert.equal(interrupted.state, "manual_review");
assert.equal(engine3.sessionState("panda-master"), "expired");
const interruptedAgain = await engine3.submit(panda, {
  requestId: "panda-load",
  operation: "load",
  websiteUserId: "player-d",
  gameUsername: "erin",
  amount: 8,
});
assert.equal(interruptedAgain.state, "manual_review");
assert.equal(panda.calls.length, 2);

const badAmount = await engine3.submit(panda, {
  requestId: "panda-zero",
  operation: "load",
  websiteUserId: "player-d",
  gameUsername: "erin",
  amount: 0,
});
assert.equal(badAmount.state, "confirmed_failure");
assert.match(badAmount.message, /greater than zero/);

const buttonEngine = createStoreEngine();
const buttonAdapter = storeMock("milky-way", "store", async (command) => {
  if (command.operation === "create_account") {
    return { outcome: "confirmed_success", gameUsername: "frank" };
  }
  return { outcome: "confirmed_success", message: "clicked" };
});
await buttonEngine.submit(buttonAdapter, {
  requestId: "frank-create",
  operation: "create_account",
  websiteUserId: "player-e",
  gameUsername: "frank",
});
const button = await buttonEngine.submit(buttonAdapter, {
  requestId: "load-button",
  operation: "load",
  websiteUserId: "player-e",
  gameUsername: "frank",
  amount: 5,
});
assert.equal(button.state, "manual_review");
assert.match(button.message, /unknown/);
assert.equal(button.providerReference, null);

for (const event of engine.audit()) {
  assert.equal(JSON.stringify(event).toLowerCase().includes("password"), false);
  assert.equal(event.retryAllowed, undefined);
}

const sources = [
  "src/lib/store-automation/engine.ts",
  "src/lib/store-automation/adapters.ts",
  "src/lib/store-automation/fire-kirin-adapter.ts",
  "src/lib/store-automation/orion-stars-adapter.ts",
  "src/lib/store-automation/milky-way-adapter.ts",
  "src/lib/store-automation/panda-master-adapter.ts",
];
for (const file of sources) {
  const text = readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
  assert.equal(text.includes("debit_wallet"), false);
  assert.equal(text.includes("credit_wallet"), false);
  assert.equal(text.includes("request_game_load"), false);
  assert.equal(text.includes("playwright"), false);
  assert.equal(text.includes("juwa-service"), false);
  assert.equal(text.includes("from \"https\""), false);
}

console.log("store automation checks passed");
