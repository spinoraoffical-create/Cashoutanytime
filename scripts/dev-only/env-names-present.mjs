import { readFileSync, existsSync } from "node:fs";

const keys = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "FIREKIRIN_AGENT_USERNAME",
  "FIREKIRIN_AGENT_PASSWORD",
  "FIREKIRIN_API_URL",
  "FIREKIRIN_PROXY_URL",
  "ORIONSTARS_AGENT_USERNAME",
  "ORIONSTARS_AGENT_PASSWORD",
  "ORIONSTARS_API_URL",
  "ORIONSTARS_PROXY_URL",
  "MILKYWAY_AGENT_USERNAME",
  "MILKYWAY_AGENT_PASSWORD",
  "MILKYWAY_API_URL",
  "MILKYWAY_PROXY_URL",
  "GAMEVAULT_PROXY_URL",
  "VBLINK_AGENT_USERNAME",
  "VBLINK_AGENT_PASSWORD",
  "VBLINK_API_URL",
  "MAFIA_AGENT_USERNAME",
  "MAFIA_AGENT_PASSWORD",
  "MAFIA_ADMIN_URL",
];

function load(file) {
  if (!existsSync(file)) return null;
  const found = new Set();
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim().replace(/^['"]|['"]$/g, "");
    if (value) found.add(key);
  }
  return found;
}

const files = [".env.local", ".env", ".vercel/.env.production.local", ".vercel/.env.preview.local"];
for (const file of files) {
  const found = load(file);
  if (!found) {
    console.log(`${file}: absent`);
    continue;
  }
  console.log(`${file}: present`);
  for (const key of keys) console.log(`  ${key}=${found.has(key) ? "set" : "missing"}`);
}
