import assert from "node:assert/strict";
import crypto from "node:crypto";
import { readFileSync } from "node:fs";
import { classifyProviderOutcome, mayRefundLoad } from "../src/lib/game-automation/load-outcome.ts";
import { providerReplyClass, terminalAgentBalance, terminalAgentKey, terminalUserBalance } from "../src/lib/game-automation/terminal-response.ts";

assert.equal(terminalAgentKey({ agentKey: "abc" }), "abc");
assert.equal(terminalAgentKey({ agentkey: "abc" }), "abc");
assert.equal(terminalAgentKey({}), "");
assert.equal(terminalAgentBalance({ Balance: "0" }), 0);
assert.equal(terminalAgentBalance({ balance: 12 }), 12);
assert.equal(terminalAgentBalance({}), null);
assert.equal(terminalUserBalance({ userbalance: "" }), null);
assert.equal(terminalUserBalance({ userBalance: "4.5" }), 4.5);
const published = crypto.createHash("md5").update("agent011595756537cb71121e4569433986bf401a347a7649").digest("hex");
assert.equal(published, "1097bf94d4fa4a70641fc396ea1868ab");
assert.equal(mayRefundLoad({
  outcome: classifyProviderOutcome({ success: false, error: "This provider is paused. The transfer was not sent." }),
  loadType: "load",
  gameApiDebited: false,
  walletRefunded: false,
}), true);
assert.equal(mayRefundLoad({
  outcome: classifyProviderOutcome({ success: false, error: "Provider outcome unknown. The provider answered and the balance was not confirmed." }),
  loadType: "load",
  gameApiDebited: false,
  walletRefunded: false,
}), false);
assert.equal(mayRefundLoad({
  outcome: classifyProviderOutcome({ success: false, error: "This provider is paused. The transfer was not sent." }),
  loadType: "load",
  gameApiDebited: false,
  walletRefunded: true,
}), false);
assert.equal(providerReplyClass("201", "user does not exist"), "account");
assert.equal(providerReplyClass("201", "signature error"), "signature");
assert.equal(providerReplyClass("200", "ok"), "ok");

assert.equal(classifyProviderOutcome({ success: false, error: "Provider outcome unknown. Balance was not returned." }), "unknown");
assert.equal(mayRefundLoad({
  outcome: "unknown",
  loadType: "load",
  gameApiDebited: false,
  walletRefunded: false,
}), false);

for (const file of [
  "src/lib/game-automation/orionstars-api.ts",
  "src/lib/game-automation/milkyway-api.ts",
  "src/lib/game-automation/firekirin-api.ts",
]) {
  const text = readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
  assert.equal(text.includes("agentkey="), false);
  assert.equal(text.includes("agentKey.slice"), false);
  assert.equal(text.includes("changePasswd"), true);
}

const orion = readFileSync(new URL("../src/lib/game-automation/orionstars-api.ts", import.meta.url), "utf8");
assert.match(orion, /https:\/\/orionstars\.vip:8033\/ws\/service\.ashx/);
assert.equal(orion.includes("34.212.168.0"), false);
const milky = readFileSync(new URL("../src/lib/game-automation/milkyway-api.ts", import.meta.url), "utf8");
assert.match(milky, /https:\/\/milkywayapp\.xyz:8033\/ws\/service\.ashx/);
assert.equal(milky.includes("47.252.40.52"), false);
const fire = readFileSync(new URL("../src/lib/game-automation/firekirin-api.ts", import.meta.url), "utf8");
assert.match(fire, /https:\/\/firekirin\.xyz:8033\/ws\/service\.ashx/);
assert.equal(fire.includes("Math.floor(Date.now() / 1000)"), false);

console.log("terminal api safety checks passed");
