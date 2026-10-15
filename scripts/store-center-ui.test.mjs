import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const agents = readFileSync(new URL("../src/app/admin/agents/page.tsx", import.meta.url), "utf8");
const directory = readFileSync(new URL("../src/app/admin/sub-creators/page.tsx", import.meta.url), "utf8");
const manager = readFileSync(new URL("../src/components/admin/sub-creators-manager.tsx", import.meta.url), "utf8");
const players = readFileSync(new URL("../src/app/admin/players/page.tsx", import.meta.url), "utf8");
const network = readFileSync(new URL("../src/components/admin/network-players.tsx", import.meta.url), "utf8");
const reports = readFileSync(new URL("../src/app/admin/agent-reports/page.tsx", import.meta.url), "utf8");
const home = readFileSync(new URL("../src/components/admin/agent-home.tsx", import.meta.url), "utf8");
const actions = readFileSync(new URL("../src/lib/actions/agents.ts", import.meta.url), "utf8");
const scope = readFileSync(new URL("../src/lib/agents/scope.ts", import.meta.url), "utf8");

assert.match(agents, /requireStaff/);
assert.match(agents, /getAgentScope/);
assert.match(agents, /redirect\("\/admin"\)/);
assert.match(agents, /\/admin\/sub-creators/);
assert.match(agents, /\/admin\/players/);
assert.match(agents, /\/admin\/agent-inbox/);

assert.match(directory, /requireAgentScope/);
assert.match(directory, /loadAgentRows/);
assert.match(directory, /redirect\("\/admin\/players"\)/);
assert.match(directory, /canAddStore=\{scope\.level === "platform"\}/);

for (const name of ["createAgentAction", "resetAgentPasswordAction", "setAgentActiveAction", "setAgentsActiveAction", "updateAgentAction"]) {
  assert.match(manager, new RegExp(name));
}
assert.match(manager, /window\.confirm/);
assert.match(manager, /\/admin\/sub-creators\/export/);
assert.match(manager, /\/admin\/players\?parent=/);

assert.match(players, /requireAgentScope/);
assert.match(players, /loadNetworkPlayers/);
assert.match(players, /canMove=\{scope\.level !== "sub"\}/);
assert.match(network, /movePlayerAction/);
assert.match(network, /window\.confirm/);

assert.match(reports, /redirect\("\/admin"\)/);
assert.match(reports, /\/admin\/player-transactions/);
assert.match(home, /agent_commissions/);
assert.equal((home.match(/\.in\("parent_agent_id", parents\)/g) ?? []).length, 4);
assert.match(home, /if \(!parents\.length\) return \[\]/);
assert.match(home, /scope\.level === "sub" \? \[scope\.userId\] : parents/);
assert.match(scope, /parentIds: \[ctx\.userId, \.\.\.subs\]/);
assert.match(scope, /parentIds: \[ctx\.userId\]/);
assert.match(home, /commission_amount/);
assert.equal(actions.includes("createAgentAction"), true);

console.log("store center ui checks passed");
