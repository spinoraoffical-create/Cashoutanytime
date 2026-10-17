import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { classifyProviderOutcome, mayRefundLoad } from "../src/lib/game-automation/load-outcome.ts";
import { executeGuardedTransfer } from "../src/lib/game-automation/transfer-guard.ts";
import {
  createTransferBackend,
  MemoryTransferStore,
  redactProviderMeta,
  reserveForTest,
} from "../src/lib/game-automation/transfer-ledger.ts";

const requestId = "11111111-1111-4111-8111-111111111111";

function pair() {
  const backend = createTransferBackend();
  const store = new MemoryTransferStore(backend);
  return { backend, store };
}

function claim(action = "recharge") {
  return {
    operationKey: `fire-kirin:${action}:${requestId}`,
    provider: "fire-kirin",
    action,
    amount: 10,
    requestId,
    playerAccount: "player1",
    providerTransactionId: "abc123",
    providerIdempotent: true,
  };
}

async function unpaused(backend, store, action = "recharge") {
  await store.setPaused("fire-kirin", false);
  reserveForTest(backend, requestId, { amount: 10, action, open: true });
}

const duplicate = pair();
await unpaused(duplicate.backend, duplicate.store);
const first = await duplicate.store.claim(claim());
const second = await duplicate.store.claim(claim());
assert.equal(first.decision, "proceed");
assert.equal(second.decision, "hold");

const concurrentBackend = createTransferBackend();
const left = new MemoryTransferStore(concurrentBackend);
const right = new MemoryTransferStore(concurrentBackend);
await left.setPaused("fire-kirin", false);
reserveForTest(concurrentBackend, requestId, { amount: 10, action: "recharge", open: true });
const raced = await Promise.all([left.claim(claim()), right.claim(claim())]);
assert.equal(raced.filter((row) => row.decision === "proceed").length, 1);
assert.equal(raced.filter((row) => row.decision === "hold").length, 1);

const restart = pair();
await unpaused(restart.backend, restart.store);
assert.equal((await restart.store.claim(claim())).decision, "proceed");
assert.equal(await restart.store.markSubmitted(claim().operationKey), true);
const afterCrash = new MemoryTransferStore(restart.backend);
assert.equal((await afterCrash.claim(claim())).decision, "hold");

const lost = pair();
await unpaused(lost.backend, lost.store);
await lost.store.claim(claim());
await lost.store.markSubmitted(claim().operationKey);
assert.equal((await new MemoryTransferStore(lost.backend).claim(claim())).decision, "hold");

const timeout = pair();
await unpaused(timeout.backend, timeout.store);
let timeoutSends = 0;
await assert.rejects(() =>
  executeGuardedTransfer({
    store: timeout.store,
    claim: claim(),
    prepare: async () => {},
    send: async () => {
      timeoutSends += 1;
      throw new Error("Fire Kirin API connection timed out after 15s");
    },
  })
);
assert.equal(timeoutSends, 1);
assert.equal(await timeout.store.state(claim().operationKey), "unknown");
assert.equal((await timeout.store.claim(claim())).decision, "hold");
assert.equal(
  mayRefundLoad({
    outcome: classifyProviderOutcome({ success: false, error: "Fire Kirin API connection timed out after 15s" }),
    loadType: "load",
    gameApiDebited: false,
    walletRefunded: false,
  }),
  false
);

const accepted = pair();
await unpaused(accepted.backend, accepted.store);
let acceptedSends = 0;
const acceptedResult = await executeGuardedTransfer({
  store: accepted.store,
  claim: claim(),
  prepare: async () => {},
  send: async () => {
    acceptedSends += 1;
    return { code: 200, msg: "ok", value: { success: true } };
  },
});
assert.equal(await accepted.store.state(acceptedResult.operationKey), "manual_review");
await assert.rejects(() =>
  executeGuardedTransfer({
    store: accepted.store,
    claim: claim(),
    prepare: async () => {},
    send: async () => {
      acceptedSends += 1;
      return { code: 200, value: { success: true } };
    },
  })
);
assert.equal(acceptedSends, 1);
assert.equal(
  mayRefundLoad({
    outcome: classifyProviderOutcome({ success: false, error: "Provider outcome unknown. Balance was not returned." }),
    loadType: "load",
    gameApiDebited: false,
    walletRefunded: false,
  }),
  false
);
assert.equal(await accepted.store.confirm(acceptedResult.operationKey), true);
assert.equal(await accepted.store.state(acceptedResult.operationKey), "confirmed");

const short = pair();
await unpaused(short.backend, short.store);
await assert.rejects(
  () =>
    executeGuardedTransfer({
      store: short.store,
      claim: claim(),
      prepare: async () => {},
      send: async () => ({ code: 201, msg: "Insufficient balance", value: { success: false } }),
    }),
  /Insufficient balance/
);
assert.equal(await short.store.state(claim().operationKey), "failed");
assert.equal((await short.store.claim(claim())).decision, "already_recorded");
assert.equal(
  mayRefundLoad({
    outcome: classifyProviderOutcome({ success: false, error: "Insufficient balance" }),
    loadType: "load",
    gameApiDebited: false,
    walletRefunded: false,
  }),
  true
);

const auth = pair();
await unpaused(auth.backend, auth.store);
let authSends = 0;
await assert.rejects(
  () =>
    executeGuardedTransfer({
      store: auth.store,
      claim: claim(),
      prepare: async () => {
        throw new Error("Login failed. Please check and try again.");
      },
      send: async () => {
        authSends += 1;
        return { code: 200, value: { success: true } };
      },
    }),
  /Login failed/
);
assert.equal(authSends, 0);
assert.equal(await auth.store.state(claim().operationKey), "failed");

const review = pair();
await unpaused(review.backend, review.store);
await review.store.claim(claim());
await review.store.markSubmitted(claim().operationKey);
await review.store.finish(claim().operationKey, "unknown", { msg: "timed out" });
assert.equal(await review.store.reconcile(claim().operationKey, "confirmed", "Staff checked the provider record."), true);
assert.equal(await review.store.state(claim().operationKey), "confirmed");
assert.equal(await review.store.reconcile(claim().operationKey, "failed", "again"), false);

const paused = pair();
reserveForTest(paused.backend, requestId, { amount: 10, action: "recharge", open: true });
let pausedSends = 0;
await assert.rejects(
  () =>
    executeGuardedTransfer({
      store: paused.store,
      claim: claim(),
      prepare: async () => {},
      send: async () => {
        pausedSends += 1;
        return { code: 200, value: { success: true } };
      },
    }),
  /paused/
);
assert.equal(pausedSends, 0);
await paused.store.setPaused("fire-kirin", false);
assert.equal((await paused.store.claim(claim())).decision, "proceed");

const pending = pair();
await unpaused(pending.backend, pending.store);
await pending.store.claim(claim());
await assert.rejects(() => pending.store.reconcile(claim().operationKey, "confirmed", "not sent"));
assert.equal(await pending.store.reconcile(claim().operationKey, "failed", "Abandoned before send."), true);

const redacted = redactProviderMeta({ code: "200", sign: "hidden", password: "hidden", nested: { agentKey: "hidden", msg: "ok" } });
assert.equal(redacted.sign, undefined);
assert.equal(redacted.password, undefined);
assert.equal(redacted.nested.agentKey, undefined);
assert.equal(redacted.nested.msg, "ok");

const migration = readFileSync(new URL("../supabase/migrations/20261017000300_provider_transfer_operations.sql", import.meta.url), "utf8");
assert.match(migration, /UNIQUE \(operation_key\)/);
assert.match(migration, /FOR UPDATE/);
assert.match(migration, /pg_advisory_xact_lock/);
assert.equal(/\bcredit_wallet\s*\(/.test(migration), false);
assert.equal(/\bdebit_wallet\s*\(/.test(migration), false);
assert.equal(/update\s+public\.profiles/i.test(migration), false);
assert.match(migration, /GRANT EXECUTE ON FUNCTION public\.claim_provider_transfer/);
assert.match(migration, /TO service_role/);
for (const file of [
  "src/lib/game-automation/firekirin-api.ts",
  "src/lib/game-automation/milkyway-api.ts",
  "src/lib/game-automation/orionstars-api.ts",
]) {
  const text = readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
  assert.match(text, /executeGuardedTransfer/);
  assert.equal(text.includes("beginMoneyAttempt"), false);
}
const ready = readFileSync(new URL("../src/lib/game-automation/provider-ready.ts", import.meta.url), "utf8");
assert.match(ready, /case "orion-stars":[\s\S]*return false;/);
assert.equal(ready.includes("case \"panda-master\""), false);

console.log("transfer ledger checks passed");
