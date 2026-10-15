import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { confirmActionDecision } from "../src/lib/admin/confirm-gate.ts";
import { gameLoadStatusHelp } from "../src/lib/admin/game-load-status.ts";

const loadsPage = readFileSync(new URL("../src/app/admin/game-loads/page.tsx", import.meta.url), "utf8");
const actions = readFileSync(new URL("../src/components/admin/game-load-actions.tsx", import.meta.url), "utf8");
const games = readFileSync(new URL("../src/app/admin/games/page.tsx", import.meta.url), "utf8");
const accounts = readFileSync(new URL("../src/app/admin/game-accounts/page.tsx", import.meta.url), "utf8");
const balances = readFileSync(new URL("../src/app/admin/game-balances/page.tsx", import.meta.url), "utf8");

assert.match(loadsPage, /redirect\("\/admin"\)/);
assert.match(loadsPage, /game_load_requests/);
assert.match(loadsPage, /parent_agent_id/);
assert.equal(actions.includes('mark("completed")'), true);
assert.equal(actions.includes('mark("failed")'), true);
assert.match(actions, /adminUpdateGameLoadStatus/);
assert.match(actions, /disabled=\{busy\}/);

const markFn = actions.slice(actions.indexOf("async function mark"), actions.indexOf("if (load.status"));
assert.ok(markFn.indexOf('confirmActionDecision({ pending: busy') < markFn.indexOf("window.confirm"));
assert.ok(markFn.indexOf("window.confirm") < markFn.indexOf("adminUpdateGameLoadStatus"));
assert.match(markFn, /decision !== "run"\) return/);
assert.equal((markFn.match(/adminUpdateGameLoadStatus\(/g) ?? []).length, 1);

let gameLoadRuns = 0;
function attemptGameLoad(pending, confirmed) {
  const decision = confirmActionDecision({ pending, confirmed });
  if (decision !== "run") return decision;
  gameLoadRuns += 1;
  return decision;
}
assert.equal(attemptGameLoad(false, false), "cancelled");
assert.equal(gameLoadRuns, 0);
assert.equal(attemptGameLoad(true, true), "pending");
assert.equal(gameLoadRuns, 0);
assert.equal(attemptGameLoad(false, true), "run");
assert.equal(gameLoadRuns, 1);
assert.equal(attemptGameLoad(true, true), "pending");
assert.equal(gameLoadRuns, 1);

assert.equal(games.includes("cfg?.webhook_secret"), false);
assert.equal(games.includes("cfg?.api_password"), false);
assert.equal(games.includes("cfg?.api_username ??"), false);
assert.match(games, /authorize\("cms\.manage"\)/);
assert.match(games, /upsertGameAction/);

assert.match(accounts, /redirect\("\/admin"\)/);
assert.match(accounts, /ctx\.isSuperAdmin/);
assert.match(balances, /requireSuperAdmin/);
assert.match(balances, /loadLiveGameBalances/);

assert.match(gameLoadStatusHelp("processing"), /not proof the provider transaction failed/);
assert.match(gameLoadStatusHelp("failed"), /not, by itself, proof/);
assert.match(gameLoadStatusHelp("cancelled"), /cancelled/);

console.log("game center ui checks passed");
