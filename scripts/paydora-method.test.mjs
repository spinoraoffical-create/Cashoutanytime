import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { mapPaydoraMethod } from "../src/lib/payments/paydora-method.ts";

assert.equal(mapPaydoraMethod("card"), "card");
assert.equal(mapPaydoraMethod("Credit Card"), "card");
assert.equal(mapPaydoraMethod("Cash App"), "cashapp");
assert.equal(mapPaydoraMethod("chime"), "chime");
assert.equal(mapPaydoraMethod("Google Pay"), "googlepay");
assert.equal(mapPaydoraMethod("Apple Pay"), "applepay");
assert.equal(mapPaydoraMethod("visa"), null);
assert.equal(mapPaydoraMethod(""), null);
assert.equal(mapPaydoraMethod(null), null);

const wallet = readFileSync(new URL("../src/lib/payments/paydora-wallet.ts", import.meta.url), "utf8");
assert.equal(wallet.includes('return "cashapp"'), false);
assert.match(wallet, /Paydora method is not recognized/);

const methods = readFileSync(new URL("../src/app/api/payments/paydora/methods/route.ts", import.meta.url), "utf8");
assert.match(methods, /status: 503/);
assert.match(methods, /realValueDenial\("deposits"\)/);
assert.equal(methods.includes("status: 500"), false);

const webhook = readFileSync(new URL("../src/app/api/payments/paydora/webhook/route.ts", import.meta.url), "utf8");
assert.match(webhook, /methodValue: savedPaymentMethod/);

console.log("paydora method checks passed");
