import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { isValidOtpCode } from "../src/lib/auth/phone.ts";
import { passwordIsAcceptable, passwordProblems } from "../src/lib/auth/password-rules.ts";
import { shouldHideAccountExistence } from "../src/lib/auth/recovery.ts";

assert.equal(passwordIsAcceptable("secret1"), false);
assert.equal(passwordIsAcceptable("secret12"), true);
assert.deepEqual(passwordProblems("short"), [
  "Use at least 8 characters.",
  "Include a number.",
]);
assert.equal(isValidOtpCode("123456"), true);
assert.equal(isValidOtpCode("12345"), false);
assert.equal(isValidOtpCode("1234567"), false);
assert.equal(isValidOtpCode("12ab56"), false);

assert.equal(shouldHideAccountExistence({ code: "user_not_found", message: "User not found" }), true);
assert.equal(shouldHideAccountExistence({ message: "User does not exist" }), true);
assert.equal(shouldHideAccountExistence({ code: "over_email_send_rate_limit", message: "rate limit" }), false);

const home = readFileSync(new URL("../src/lib/auth/account-home.ts", import.meta.url), "utf8");
assert.match(home, /!raw\.startsWith\("\/\/"\)/);
assert.match(home, /!raw\.includes\(":\/\/"\)/);
assert.match(home, /safe\.startsWith\("\/admin"\)/);

console.log("auth email code checks passed");
