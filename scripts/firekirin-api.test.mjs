import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fireKirinTransactionId, isWholeDollar } from "../src/lib/game-automation/firekirin-api.ts";

const id = "123e4567-e89b-12d3-a456-426614174000";
const tx = fireKirinTransactionId(id);
assert.equal(tx, fireKirinTransactionId(id));
assert.equal(tx.length, 20);
assert.equal(tx.includes("-"), false);

assert.equal(isWholeDollar(10), true);
assert.equal(isWholeDollar(10.99), false);
assert.equal(isWholeDollar(0), false);

const api = readFileSync(new URL("../src/lib/game-automation/firekirin-api.ts", import.meta.url), "utf8");
assert.match(api, /https:\/\/firekirin\.xyz:8033\/ws\/service\.ashx/);
assert.equal(api.includes("8034"), false);
assert.equal(api.includes("52.41.26.140"), false);
assert.equal(api.includes("GAMEVAULT_PROXY_URL"), false);
assert.equal(api.includes("Math.floor(amount)"), false);
assert.equal(api.includes("timeUnit"), false);
assert.match(api, /Host: hostHeader/);
assert.match(api, /String\(json\.code\) !== "200"/);
assert.match(api, /\.toLowerCase\(\)/);
assert.match(api, /this\.apiUrl = OFFICIAL_API_URL/);

const service = readFileSync(new URL("../src/lib/game-automation/firekirin-service.ts", import.meta.url), "utf8");
assert.match(service, /complete_game_load/);
assert.match(service, /user_game_accounts/);
assert.match(service, /refund_game_load_wallet/);
assert.match(service, /kickPlayerOut/);
assert.match(service, /new_account/);
assert.match(service, /reload/);
const refund = readFileSync(
  new URL("../supabase/migrations/20261008000200_refund_load_and_reload.sql", import.meta.url),
  "utf8"
);
assert.match(refund, /load_type NOT IN \('load', 'reload'\)/);
assert.match(refund, /wallet_refunded/);
assert.match(service, /status: "completed"/);
assert.match(service, /createFireKirinPlayerOnStore/);
const store = readFileSync(new URL("../src/lib/game-automation/firekirin-store.ts", import.meta.url), "utf8");
assert.match(store, /Store\.aspx/);
assert.match(store, /CreateAccount\.aspx/);
assert.match(store, /Added successfully/i);
assert.equal(store.includes("registerUser"), false);
assert.equal(store.includes("recharge"), false);
assert.equal(store.includes("Trix_123"), false);
assert.equal(store.includes("Trix671"), false);
assert.equal(service.includes("Trix_123"), false);
assert.equal(service.includes("Trix671"), false);

console.log("fire kirin checks passed");
