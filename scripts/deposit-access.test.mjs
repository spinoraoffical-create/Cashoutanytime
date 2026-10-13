import assert from "node:assert/strict";

import { canReadDeposit } from "../src/lib/payments/deposit-access.ts";

const me = "player-1";
assert.equal(canReadDeposit({ userId: me, providerUserName: me, intentUserId: me }), true);
assert.equal(canReadDeposit({ userId: me, providerUserName: "player-2", intentUserId: me }), false);
assert.equal(canReadDeposit({ userId: me, providerUserName: "", intentUserId: "" }), false);
assert.equal(canReadDeposit({ userId: me, providerUserName: null, intentUserId: me }), true);
assert.equal(canReadDeposit({ userId: me, providerUserName: me, intentUserId: "player-2" }), false);

console.log("deposit access checks passed");
