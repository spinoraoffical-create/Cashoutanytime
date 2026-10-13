import assert from "node:assert/strict";

import { decideRateLimit, securityActionFor } from "../src/lib/rate-limit-decision.ts";

assert.equal(securityActionFor("paydoraCreate"), "deposit");
assert.equal(securityActionFor("paydoraPayout"), "withdraw");
assert.equal(securityActionFor("authOtp"), "login");
assert.deepEqual(decideRateLimit({ allowed: true }, false), { allowed: true });

assert.deepEqual(decideRateLimit({ allowed: false, reason: "rate_limit" }, false), {
  allowed: false,
  reason: "limited",
});

assert.deepEqual(decideRateLimit(null, true), { allowed: false, reason: "unavailable" });
assert.deepEqual(decideRateLimit("nope", false), { allowed: false, reason: "unavailable" });
assert.equal(decideRateLimit({ allowed: false }, false).allowed, false);

console.log("rate limit checks passed");
