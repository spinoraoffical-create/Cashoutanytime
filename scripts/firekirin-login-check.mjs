import { readFileSync } from "node:fs";
import { FireKirinApiClient } from "../src/lib/game-automation/firekirin-api.ts";

const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
for (const line of env.split(/\r?\n/)) {
  const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (!match) continue;
  if (!process.env[match[1]]) process.env[match[1]] = match[2];
}

async function login(proxyUrl) {
  const client = new FireKirinApiClient(proxyUrl === undefined ? {} : { proxyUrl });
  const session = await client.getValidSession();
  const again = await client.getValidSession();
  if (!session.agentKey) throw new Error("empty agentKey");
  if (again.agentKey !== session.agentKey) throw new Error("agentLogin ran more than once");
  return session.agentKey.length;
}

const viaEnv = await login(undefined).catch((err) => err);
if (typeof viaEnv === "number") {
  console.log(`agentLogin code 200 agentKey length ${viaEnv} via configured route`);
} else {
  const message = viaEnv instanceof Error ? viaEnv.message : String(viaEnv);
  console.error(`configured route failed: ${message.slice(0, 180)}`);
  const direct = await login(null).catch((err) => err);
  if (typeof direct === "number") {
    console.log(`agentLogin code 200 agentKey length ${direct} via direct`);
    process.exit(2);
  }
  const directMessage = direct instanceof Error ? direct.message : String(direct);
  console.error(`direct route failed: ${directMessage.slice(0, 180)}`);
  process.exit(1);
}
