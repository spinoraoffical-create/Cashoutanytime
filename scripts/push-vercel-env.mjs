import { readFileSync } from "fs";
import { spawnSync } from "child_process";
import { join } from "path";

const envPath = join(process.cwd(), ".env.local");
const raw = readFileSync(envPath, "utf8");
const vars = {};

for (const line of raw.split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const m = trimmed.match(/^([A-Z0-9_]+)=(.*)$/);
  if (!m) continue;
  const [, key, rawVal] = m;
  if (key === "VERCEL_OIDC_TOKEN") continue;
  vars[key] = rawVal.replace(/^["']|["']$/g, "");
}

vars.NEXT_PUBLIC_SITE_URL = "https://final-file-omega.vercel.app";
vars.NEXT_PUBLIC_APP_URL = "https://final-file-omega.vercel.app";

const envs = ["production", "preview", "development"];

for (const [name, value] of Object.entries(vars)) {
  if (!value?.trim()) continue;
  for (const target of envs) {
    const res = spawnSync(
      "npx",
      ["vercel", "env", "add", name, target, "--force"],
      {
        input: value,
        stdio: ["pipe", "pipe", "pipe"],
        shell: true,
        cwd: process.cwd(),
      }
    );
    if (res.status !== 0) {
      console.error(`Failed ${name} (${target}):`, res.stderr?.toString() || res.stdout?.toString());
      process.exit(1);
    }
  }
  console.log(`OK ${name}`);
}

console.log("All env vars pushed.");
