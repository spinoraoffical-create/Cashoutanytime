/**
 * Read-only agentLogin for Fire Kirin, Milky Way, and Orion Stars.
 * Prints the provider code and a redacted message. Does not recharge or redeem.
 */
import dns from "node:dns/promises";
import { readFileSync } from "node:fs";
import { FireKirinApiClient } from "../../src/lib/game-automation/firekirin-api.ts";
import { MilkyWayApiClient } from "../../src/lib/game-automation/milkyway-api.ts";
import { OrionStarsApiClient } from "../../src/lib/game-automation/orionstars-api.ts";

function loadEnv(file) {
  const text = readFileSync(file, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnv(new URL("../../.env.local", import.meta.url));

const secrets = Object.values(process.env).filter((value) => typeof value === "string" && value.length > 3);

function redact(message) {
  let text = String(message || "").replace(/\s+/g, " ").slice(0, 180);
  for (const secret of secrets) text = text.split(secret).join("[redacted]");
  return text;
}

function balanceState(value) {
  if (value === null || value === undefined) return "missing";
  if (value === 0) return "confirmed-zero";
  return "numeric";
}

async function check(name, run) {
  try {
    const balance = await run();
    console.log(`${name}: auth=yes balance=${balanceState(balance)} ip=accepted`);
  } catch (error) {
    const message = redact(error instanceof Error ? error.message : "");
    const ip = /white|whitelist/i.test(message);
    console.log(`${name}: auth=no ip=${ip ? "rejected" : "unknown"} msg=${JSON.stringify(message)}`);
  }
}

async function reachableUrl(hostname, port, fallbackIp) {
  try {
    const looked = await dns.lookup(hostname);
    if (looked.address !== "127.0.0.1" && looked.address !== "::1") {
      return `https://${hostname}:${port}/ws/service.ashx`;
    }
  } catch {
    // Use the public DNS address recorded for this host.
  }
  return `https://${fallbackIp}:${port}/ws/service.ashx`;
}

const fireUrl = await reachableUrl("firekirin.xyz", 8033, "52.41.26.140");
const milkyUrl = await reachableUrl("milkywayapp.xyz", 8033, "47.252.40.52");
const orionUrl = await reachableUrl("orionstars.vip", 8033, "34.212.168.0");

await check("fire-kirin", async () => {
  const api = new FireKirinApiClient({ proxyUrl: null, apiUrl: fireUrl });
  return api.getAgentBalance();
});
await check("milky-way", async () => {
  const api = new MilkyWayApiClient({ proxyUrl: null, apiUrl: milkyUrl });
  const session = await api.getFreshSession();
  return session.balance;
});
await check("orion-stars", async () => {
  const api = new OrionStarsApiClient({ proxyUrl: null, apiUrl: orionUrl });
  await api.getValidSession();
  return api.lastAgentBalance;
});

function stateOf(balance) {
  return balanceState(balance);
}

async function lookup(name, api, account, knownAccount) {
  try {
    const result = await api.compareStampReuse(account);
    console.log(
      `${name}: lookup account=${knownAccount ? "existing" : "missing-name"} code=${result.firstCode} class=${result.firstClass} balance=${stateOf(result.balance)} repeat=${result.repeatCode} flags=${JSON.stringify(result.flags)}`
    );
  } catch (error) {
    console.log(`${name}: lookup account=${knownAccount ? "existing" : "missing-name"} error=${JSON.stringify(redact(error instanceof Error ? error.message : ""))}`);
  }
}

let fireAccount = "";
let milkyAccount = "";
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
if (supabaseUrl.includes("zecitlewsynyioemsqna") && serviceKey) {
  const { createClient } = await import("@supabase/supabase-js");
  const db = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: games } = await db.from("games").select("id, slug").in("slug", ["fire-kirin", "milky-way"]);
  const ids = (games || []).map((game) => game.id);
  if (ids.length > 0) {
    const { data: accounts } = await db.from("game_accounts").select("game_id, game_username").in("game_id", ids).limit(20);
    for (const game of games || []) {
      const row = (accounts || []).find((account) => account.game_id === game.id && account.game_username);
      if (!row) continue;
      if (game.slug === "fire-kirin") fireAccount = row.game_username;
      if (game.slug === "milky-way") milkyAccount = row.game_username;
    }
  }
  console.log(`saved-accounts fire=${fireAccount ? "yes" : "no"} milky=${milkyAccount ? "yes" : "no"}`);
} else {
  console.log("saved-accounts unavailable");
}

const fireApi = new FireKirinApiClient({ proxyUrl: null, apiUrl: fireUrl });
const milkyApi = new MilkyWayApiClient({ proxyUrl: null, apiUrl: milkyUrl });
await lookup("fire-kirin", fireApi, fireAccount || "coa-read-missing", Boolean(fireAccount));
await lookup("milky-way", milkyApi, milkyAccount || "coa-read-missing", Boolean(milkyAccount));
