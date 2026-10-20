import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { isValidOtpCode } from "../src/lib/auth/phone.ts";
import { passwordIsAcceptable, passwordProblems } from "../src/lib/auth/password-rules.ts";
import { shouldHideAccountExistence } from "../src/lib/auth/recovery.ts";
import { authUserUpdateForContact, browserOAuthUrl, otpFailureMessage } from "../src/lib/auth/otp-safety.ts";
import { withAuthCookieDomain } from "../src/lib/supabase/cookie-domain.ts";

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

assert.equal(isValidOtpCode("012345"), true);
assert.equal(isValidOtpCode(" 012345 "), true);
assert.equal(isValidOtpCode("12345"), false);
assert.equal("12 34 56".replace(/\D/g, "").slice(0, 6), "123456");

const pending = authUserUpdateForContact({
  emailConfirmed: false,
  phone: "+15551234567",
  metadata: { full_name: "Ada" },
});
assert.equal(pending.phone, undefined);
assert.equal(pending.user_metadata.phone, "+15551234567");
const confirmed = authUserUpdateForContact({
  emailConfirmed: true,
  phone: "+15551234567",
  metadata: { full_name: "Ada" },
});
assert.equal(confirmed.phone, "+15551234567");

assert.match(otpFailureMessage({ code: "otp_expired", message: "Token has expired" }), /expired/);
assert.match(otpFailureMessage({ message: "Token is invalid" }), /incorrect/i);
assert.match(otpFailureMessage({ status: 429, message: "rate limit" }), /Too many attempts/);
assert.match(otpFailureMessage({ status: 500, message: "unexpected" }), /could not check/i);
assert.match(otpFailureMessage({ name: "AuthRetryableFetchError", message: "fetch failed" }), /could not check/i);

const started = browserOAuthUrl(
  "https://example.supabase.co/auth/v1/authorize?provider=google&skip_http_redirect=true&redirect_to=https%3A%2F%2Fwww.sweeptakehub.com%2Fauth%2Fcallback"
);
assert.equal(started.includes("skip_http_redirect"), false);
assert.equal(started.includes("provider=google"), true);
assert.equal(browserOAuthUrl("not a url"), "not a url");
assert.equal(withAuthCookieDomain({ path: "/", sameSite: "lax" }, "www.sweeptakehub.com").domain, ".sweeptakehub.com");
assert.equal("domain" in withAuthCookieDomain({ path: "/", sameSite: "lax" }, "localhost"), false);

const authSource = readFileSync(new URL("../src/lib/actions/auth.ts", import.meta.url), "utf8");
const remember = authSource.slice(authSource.indexOf("async function rememberPhoneOnAuthUser"), authSource.indexOf("export async function attachAuthPhoneAfterVerification"));
assert.equal(remember.includes("authUserUpdateForContact"), true);
assert.match(remember, /updateUserById\(userId, attributes\)/);
assert.doesNotMatch(remember, /updateUserById\(userId,\s*\{\s*phone:/);
const formSource = readFileSync(new URL("../src/components/auth/email-auth-form.tsx", import.meta.url), "utf8");
assert.equal(formSource.includes("otpFailureMessage"), true);
assert.equal(formSource.includes("verifying.current"), true);
assert.equal(formSource.includes('type: "signup"'), true);
const googleSource = readFileSync(new URL("../src/components/auth/google-auth-button.tsx", import.meta.url), "utf8");
assert.equal(googleSource.includes("browserOAuthUrl"), true);
assert.equal(googleSource.includes("skipBrowserRedirect: true"), true);
const callbackSource = readFileSync(new URL("../src/app/auth/callback/route.ts", import.meta.url), "utf8");
assert.equal(callbackSource.includes("exchangeCodeForSession"), true);
assert.equal(callbackSource.includes("google_cancelled"), true);
assert.equal(callbackSource.includes('raw.startsWith("//")'), true);
const template = readFileSync(new URL("../supabase/email-templates/confirm-signup.html", import.meta.url), "utf8");
assert.equal(template.includes("{{ .Token }}"), true);
assert.equal(template.includes("ConfirmationURL"), false);

console.log("auth email code checks passed");
