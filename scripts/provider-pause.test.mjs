import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { providerFulfillmentBlocked } from "../src/lib/game-automation/provider-pause.ts";

assert.equal(providerFulfillmentBlocked({ paused: true }, false), true);
assert.equal(providerFulfillmentBlocked({ paused: false }, false), false);
assert.equal(providerFulfillmentBlocked({ paused: null }, false), true);
assert.equal(providerFulfillmentBlocked(null, false), true);
assert.equal(providerFulfillmentBlocked(undefined, false), true);
assert.equal(providerFulfillmentBlocked(null, true), true);
assert.equal(providerFulfillmentBlocked({ paused: false }, true), true);

const loads = readFileSync(new URL("../src/lib/actions/game-loads.ts", import.meta.url), "utf8");
for (const fn of ["requestGameAccountCreate", "requestGameCheckBalance", "requestGameLoad", "requestGameRedeem"]) {
  const start = loads.indexOf(`export async function ${fn}`);
  assert.ok(start > 0, fn);
  const next = loads.indexOf("export async function ", start + 20);
  const body = loads.slice(start, next === -1 ? loads.length : next);
  const pause = body.indexOf("providerFulfillmentDenial");
  const rpc = body.search(/\.rpc\("request_game_/);
  assert.ok(pause > 0, `${fn} checks pause`);
  if (rpc > 0) assert.ok(pause < rpc, `${fn} checks pause before the wallet request`);
}
assert.ok(loads.indexOf("providerFulfillmentDenial") < loads.indexOf("autoFulfillGameRequest"));

const balances = readFileSync(new URL("../src/lib/admin/live-game-balances-data.ts", import.meta.url), "utf8");
const pauseRead = balances.indexOf("await pausedProviderSlugs");
const firstClient = balances.indexOf("getCashFrenzyApiClient()");
assert.ok(pauseRead > 0 && pauseRead < firstClient, "live balance reads check pause before a provider client");
assert.ok(balances.includes('status: "paused"'));

console.log("provider pause checks passed");
