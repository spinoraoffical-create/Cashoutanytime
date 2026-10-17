import assert from "node:assert/strict";
import crypto from "node:crypto";
import { readFileSync } from "node:fs";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { claimExclusiveFile } from "../src/lib/game-automation/account-claim.ts";
import {
  TERMINAL_ACCOUNT_CREATION_ARMED,
  classifyProbe,
  confirmAccountCreation,
  decideAccountCreation,
  holdPlayerName,
  openTerminalPlayerAccount,
  playerNameHeld,
  releasePlayerName,
} from "../src/lib/game-automation/terminal-account.ts";

const placeholder = crypto
  .createHash("md5")
  .update("agent011598452539cb71121e4569433986bf401a347a7649")
  .digest("hex");
assert.notEqual(placeholder, "7b35f60db33dcfd237fdb48cb5de97c5");

assert.equal(TERMINAL_ACCOUNT_CREATION_ARMED, false);
assert.equal(classifyProbe("201", "signature error"), "signature");
assert.equal(classifyProbe("201", "user does not exist"), "missing");
assert.equal(classifyProbe("200", ""), "ok");
assert.equal(
  decideAccountCreation({ armed: false, capability: "ok", lookup: "missing", nameState: "unknown" }).decision,
  "blocked"
);
assert.equal(
  decideAccountCreation({ armed: true, capability: "signature", lookup: "missing", nameState: "unknown" }).decision,
  "ask-provider"
);
assert.equal(
  decideAccountCreation({ armed: true, capability: "ok", lookup: "signature", nameState: "unknown" }).decision,
  "blocked"
);
assert.equal(
  decideAccountCreation({ armed: true, capability: "ok", lookup: "ok", nameState: "unknown" }).decision,
  "already-exists"
);
assert.equal(
  decideAccountCreation({ armed: true, capability: "ok", lookup: "missing", nameState: "unknown" }).decision,
  "create-once"
);
assert.equal(
  decideAccountCreation({ armed: true, capability: "ok", lookup: "ok", nameState: "available" }).decision,
  "create-once"
);
assert.equal(
  decideAccountCreation({ armed: true, capability: "ok", lookup: "rejected", nameState: "taken" }).decision,
  "already-exists"
);
assert.equal(confirmAccountCreation({ registerCode: "200", verifyCode: "201", balance: null }), "unconfirmed");
assert.equal(confirmAccountCreation({ registerCode: "200", verifyCode: "200", balance: null }), "unconfirmed");
assert.equal(confirmAccountCreation({ registerCode: "200", verifyCode: "200", balance: 0 }), "confirmed");
assert.equal(confirmAccountCreation({ registerCode: "201", verifyCode: "200", balance: 0 }), "rejected");

let registers = 0;
const disarmed = await openTerminalPlayerAccount({
  provider: "fire-kirin",
  account: "player01",
  armed: false,
  capability: async () => {
    throw new Error("capability");
  },
  lookup: async () => {
    throw new Error("lookup");
  },
  register: async () => {
    registers += 1;
    return { code: "200" };
  },
  verify: async () => {
    throw new Error("verify");
  },
});
assert.equal(disarmed.status, "blocked");
assert.equal(registers, 0);

const signedOff = await openTerminalPlayerAccount({
  provider: "milky-way",
  account: "player02",
  armed: true,
  capability: async () => ({ code: "201", message: "signature error" }),
  lookup: async () => ({ code: "201", message: "user does not exist" }),
  register: async () => {
    registers += 1;
    return { code: "200" };
  },
  verify: async () => ({ code: "200", balance: 0 }),
});
assert.equal(signedOff.status, "ask-provider");
assert.equal(registers, 0);

const unclearLookup = await openTerminalPlayerAccount({
  provider: "fire-kirin",
  account: "player03",
  armed: true,
  capability: async () => ({ code: "200", message: "" }),
  lookup: async () => ({ code: "201", message: "signature error" }),
  register: async () => {
    registers += 1;
    return { code: "200" };
  },
  verify: async () => ({ code: "200", balance: 0 }),
});
assert.equal(unclearLookup.status, "blocked");
assert.equal(registers, 0);

releasePlayerName("milky-way", "player04");
const created = await openTerminalPlayerAccount({
  provider: "milky-way",
  account: "player04",
  armed: true,
  capability: async () => ({ code: "200", message: "" }),
  lookup: async () => ({ code: "201", message: "account does not exist" }),
  register: async () => {
    registers += 1;
    return { code: "200", message: "" };
  },
  verify: async () => ({ code: "200", message: "", balance: 0 }),
});
assert.equal(created.status, "confirmed");
assert.equal(registers, 1);
const duplicate = await openTerminalPlayerAccount({
  provider: "milky-way",
  account: "player04",
  armed: true,
  capability: async () => ({ code: "200", message: "" }),
  lookup: async () => ({ code: "201", message: "account does not exist" }),
  register: async () => {
    registers += 1;
    return { code: "200" };
  },
  verify: async () => ({ code: "200", balance: 0 }),
});
assert.equal(duplicate.status, "already-exists");
assert.equal(registers, 1);
assert.equal(playerNameHeld("milky-way", "player04"), true);

releasePlayerName("orion-stars", "player05");
const unconfirmed = await openTerminalPlayerAccount({
  provider: "orion-stars",
  account: "player05",
  armed: true,
  capability: async () => ({ code: "200", nameState: "available" }),
  lookup: async () => ({ code: "200", nameState: "available" }),
  register: async () => ({ code: "200", message: "" }),
  verify: async () => ({ code: "201", message: "signature error", balance: null }),
});
assert.equal(unconfirmed.status, "unconfirmed");
assert.equal(playerNameHeld("orion-stars", "player05"), true);
const retry = await openTerminalPlayerAccount({
  provider: "orion-stars",
  account: "player05",
  armed: true,
  capability: async () => ({ code: "200", nameState: "available" }),
  lookup: async () => ({ code: "200", nameState: "available" }),
  register: async () => {
    registers += 1;
    return { code: "200" };
  },
  verify: async () => ({ code: "200", balance: 0 }),
});
assert.equal(retry.status, "already-exists");
assert.equal(registers, 1);

const fire = readFileSync(new URL("../src/lib/game-automation/firekirin-service.ts", import.meta.url), "utf8");
const createBlock = fire.slice(fire.indexOf('loadType === "create_account"'), fire.indexOf("const client = new FireKirinApiClient();\n\n  try"));
assert.equal(createBlock.includes("createFireKirinPlayerOnStore"), false);
assert.match(createBlock, /openTerminalPlayerAccount/);
let claimedRegisters = 0;
releasePlayerName("orion-stars", "player06");
const heldClaim = await openTerminalPlayerAccount({
  provider: "orion-stars",
  account: "player06",
  armed: true,
  capability: async () => ({ code: "200", nameState: "available" }),
  lookup: async () => ({ code: "200", nameState: "available" }),
  claim: async () => "hold",
  register: async () => {
    claimedRegisters += 1;
    return { code: "200" };
  },
  verify: async () => ({ code: "200", balance: 0 }),
});
assert.equal(heldClaim.status, "blocked");
assert.equal(claimedRegisters, 0);
const missingLedger = await openTerminalPlayerAccount({
  provider: "orion-stars",
  account: "player07",
  armed: true,
  capability: async () => ({ code: "200", nameState: "available" }),
  lookup: async () => ({ code: "200", nameState: "available" }),
  claim: async () => "not-installed",
  register: async () => {
    claimedRegisters += 1;
    return { code: "200" };
  },
  verify: async () => ({ code: "200", balance: 0 }),
});
assert.equal(missingLedger.status, "blocked");
assert.equal(claimedRegisters, 0);
const finishLog = [];
releasePlayerName("orion-stars", "player08");
const recorded = await openTerminalPlayerAccount({
  provider: "orion-stars",
  account: "player08",
  armed: true,
  capability: async () => ({ code: "200", nameState: "available" }),
  lookup: async () => ({ code: "200", nameState: "available" }),
  claim: async () => "proceed",
  finish: async (outcome) => {
    finishLog.push(outcome);
  },
  register: async () => {
    claimedRegisters += 1;
    return { code: "200", message: "" };
  },
  verify: async () => ({ code: "200", balance: 0 }),
});
assert.equal(recorded.status, "confirmed");
assert.deepEqual(finishLog, ["submitted", "confirmed"]);
assert.equal(claimedRegisters, 1);
let blockedRegisters = 0;
const finishBlocked = await openTerminalPlayerAccount({
  provider: "orion-stars",
  account: "player09",
  armed: true,
  capability: async () => ({ code: "200", nameState: "available" }),
  lookup: async () => ({ code: "200", nameState: "available" }),
  claim: async () => "proceed",
  finish: async () => {
    throw new Error("record missing");
  },
  register: async () => {
    blockedRegisters += 1;
    return { code: "200" };
  },
  verify: async () => ({ code: "200", balance: 0 }),
});
assert.equal(finishBlocked.status, "blocked");
assert.equal(blockedRegisters, 0);

const lockDir = mkdtempSync(join(tmpdir(), "coa-account-"));
const lockFile = join(lockDir, "lock-child.mjs");
const { writeFileSync } = await import("node:fs");
writeFileSync(
  lockFile,
  [
    "import { openSync, closeSync } from 'node:fs';",
    "const file = process.argv[2];",
    "try { closeSync(openSync(file, 'wx')); console.log('proceed'); }",
    "catch (error) { console.log(error && error.code === 'EEXIST' ? 'hold' : 'error'); }",
  ].join("\n")
);
const lockPath = join(lockDir, "orion-stars-register-coaunused1");
const first = spawnSync(process.execPath, [lockFile, lockPath], { encoding: "utf8" });
const second = spawnSync(process.execPath, [lockFile, lockPath], { encoding: "utf8" });
assert.equal(first.stdout.trim(), "proceed");
assert.equal(second.stdout.trim(), "hold");
assert.equal(claimExclusiveFile("orion-stars:register:coaunused1", lockDir), "hold");

const accountSql = readFileSync(new URL("../supabase/migrations/20261017000400_provider_account_operations.sql", import.meta.url), "utf8");
assert.match(accountSql, /UNIQUE \(operation_key\)/);
assert.match(accountSql, /pg_advisory_xact_lock/);
assert.match(accountSql, /ON CONFLICT \(operation_key\) DO NOTHING/);
assert.equal(/\bcredit_wallet\s*\(/.test(accountSql), false);
assert.equal(/\bdebit_wallet\s*\(/.test(accountSql), false);
assert.equal(accountSql.includes("UPDATE public.profiles"), false);

assert.equal(holdPlayerName("fire-kirin", "heldname"), true);
assert.equal(holdPlayerName("fire-kirin", "heldname"), false);

console.log("terminal account checks passed");
