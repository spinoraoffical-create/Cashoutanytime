/**
 * Read-only signed-call check. getgamelist and checkAccountName only.
 * Does not call registerUser, recharge, redeem, or changePasswd.
 */
import dns from "node:dns/promises";
import { readFileSync } from "node:fs";
import { FireKirinApiClient } from "../../src/lib/game-automation/firekirin-api.ts";
import { MilkyWayApiClient } from "../../src/lib/game-automation/milkyway-api.ts";
import { OrionStarsApiClient } from "../../src/lib/game-automation/orionstars-api.ts";
import { providerReplyClass, providerReplyFlags } from "../../src/lib/game-automation/terminal-response.ts";

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
  let text = String(message || "").replace(/\s+/g, " ").slice(0, 160);
  for (const secret of secrets) text = text.split(secret).join("[redacted]");
  return text;
}

async function reachableUrl(hostname, port, fallbackIp) {
  try {
    const looked = await dns.lookup(hostname);
    if (looked.address !== "127.0.0.1" && looked.address !== "::1") {
      return `https://${hostname}:${port}/ws/service.ashx`;
    }
  } catch {
    // Use the recorded public address when local DNS points at this machine.
  }
  return `https://${fallbackIp}:${port}/ws/service.ashx`;
}

function report(name, code, message, extra) {
  console.log(
    `${name}: code=${code || "none"} class=${providerReplyClass(String(code), message)} flags=${JSON.stringify(providerReplyFlags(message))} extra=${extra} msg=${JSON.stringify(redact(message))}`
  );
}

const fireUrl = await reachableUrl("firekirin.xyz", 8033, "52.41.26.140");
const milkyUrl = await reachableUrl("milkywayapp.xyz", 8033, "47.252.40.52");
const orionUrl = await reachableUrl("orionstars.vip", 8033, "34.212.168.0");

try {
  const fire = new FireKirinApiClient({ proxyUrl: null, apiUrl: fireUrl });
  const listed = await fire.listGames();
  report("fire-kirin getgamelist", listed.code, listed.message, `games=${listed.gameCount === null ? "none" : "counted"}`);
} catch (error) {
  console.log(`fire-kirin getgamelist: transport=${JSON.stringify(redact(error instanceof Error ? error.message : ""))}`);
}

try {
  const milky = new MilkyWayApiClient({ proxyUrl: null, apiUrl: milkyUrl });
  const listed = await milky.listGames();
  report("milky-way getgamelist", listed.code, listed.message, `games=${listed.gameCount === null ? "none" : "counted"}`);
} catch (error) {
  console.log(`milky-way getgamelist: transport=${JSON.stringify(redact(error instanceof Error ? error.message : ""))}`);
}

try {
  const orion = new OrionStarsApiClient({ proxyUrl: null, apiUrl: orionUrl });
  const checked = await orion.checkAccountName("coaunused1");
  report("orion-stars checkAccountName", checked.code, checked.message, `name=${checked.nameState}`);
} catch (error) {
  console.log(`orion-stars checkAccountName: transport=${JSON.stringify(redact(error instanceof Error ? error.message : ""))}`);
}
