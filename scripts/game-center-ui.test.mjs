import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

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
assert.equal(actions.includes("window.confirm"), false);
assert.match(actions, /adminUpdateGameLoadStatus/);

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
