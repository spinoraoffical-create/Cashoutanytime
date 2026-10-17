import { readFileSync } from "node:fs";

const env = {};
for (const line of readFileSync(".vercel/.env.production.local", "utf8").split(/\r?\n/)) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eq = trimmed.indexOf("=");
  if (eq < 1) continue;
  env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
}

const keys = [
  "FIREKIRIN_API_URL",
  "FIREKIRIN_AGENT_USERNAME",
  "FIREKIRIN_AGENT_PASSWORD",
  "FIREKIRIN_PROXY_URL",
  "ORIONSTARS_API_URL",
  "ORIONSTARS_AGENT_USERNAME",
  "ORIONSTARS_AGENT_PASSWORD",
  "MILKYWAY_API_URL",
  "MILKYWAY_AGENT_USERNAME",
  "MILKYWAY_AGENT_PASSWORD",
  "MILKYWAY_PROXY_URL",
  "GAMEVAULT_PROXY_URL",
];

for (const key of keys) {
  const value = env[key] || "";
  let shape = "empty";
  if (value) {
    try {
      const url = new URL(value);
      const user = Boolean(url.username || url.password);
      shape = `url host=${url.host} userinfo=${user ? "yes" : "no"}`;
    } catch {
      shape = value.startsWith("eyJ") ? "encrypted-blob" : `text length=${value.length}`;
    }
  }
  console.log(`${key}: ${shape}`);
}
