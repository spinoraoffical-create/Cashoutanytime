import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { wholeCoinAmount } from "../src/lib/payments/whole-coin.ts";

assert.equal(wholeCoinAmount("cash-frenzy", 16.49), 16);
assert.equal(wholeCoinAmount("cash-machine", 10.99), 10);
assert.equal(wholeCoinAmount("gameroom", 16), 16);
assert.equal(wholeCoinAmount("juwa", 16.49), 16.49);
assert.equal(wholeCoinAmount("cash-frenzy", 0.4), 0);

const settle = readFileSync(new URL("../src/lib/payments/auto-settle.ts", import.meta.url), "utf8");
assert.match(settle, /wholeCoinAmount\(input\.quote\.gameSlug, input\.quote\.finalCredit\)/);
assert.match(settle, /p_amount: sent/);

const frenzy = readFileSync(new URL("../src/lib/game-automation/cashfrenzy-service.ts", import.meta.url), "utf8");
assert.match(frenzy, /The balance must be an integer/);
assert.match(frenzy, /refunded\.error/);

console.log("whole-coin ok");
