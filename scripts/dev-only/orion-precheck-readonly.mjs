/** Read-only Orion name check. Does not call registerUser, recharge, or redeem. */
import dns from "node:dns/promises";
import { readFileSync } from "node:fs";
import { OrionStarsApiClient } from "../../src/lib/game-automation/orionstars-api.ts";
import { providerReplyFlags } from "../../src/lib/game-automation/terminal-response.ts";

function loadEnv(file) {
  const text = readFileSync(file, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 1) continue;
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    const key = trimmed.slice(0, eq).trim();
    if (!process.env[key]) process.env[key] = value;
  }
}
loadEnv(new URL("../../.env.local", import.meta.url));

let host = "orionstars.vip";
try {
  const looked = await dns.lookup(host);
  if (looked.address === "127.0.0.1" || looked.address === "::1") host = "34.212.168.0";
} catch {
  host = "34.212.168.0";
}
const api = new OrionStarsApiClient({ proxyUrl: null, apiUrl: `https://${host}:8033/ws/service.ashx` });
const checked = await api.checkAccountName("coaunused1");
let lookup = "unclear";
try {
  await api.queryInfo("coaunused1");
  lookup = "found";
} catch (error) {
  const message = error instanceof Error ? error.message : "";
  const flags = providerReplyFlags(message);
  lookup = flags.missingAccount ? "missing" : flags.signature ? "signature" : "other";
}
console.log(`orion-precheck: name=${checked.nameState} lookup=${lookup} registerUser=not-sent`);
