/**
 * Apply Section A patch via Supabase Postgres (requires DATABASE_URL in .env.local).
 * Get it from: Supabase Dashboard → Project Settings → Database → Connection string (URI)
 * Add to .env.local: DATABASE_URL=postgresql://postgres.[ref]:[password]@...
 *
 * Run: node scripts/run-section-a.mjs
 */
import { readFileSync } from "fs";
import { createRequire } from "module";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);

function loadEnv() {
  try {
    const raw = readFileSync(path.join(root, ".env.local"), "utf8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m && !process.env[m[1]]) {
        process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
      }
    }
  } catch {
    /* ignore */
  }
}

loadEnv();

const dbUrl = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
if (!dbUrl) {
  console.error(
    "Missing DATABASE_URL in .env.local — cannot run SQL automatically.\n" +
      "1. Supabase Dashboard → Project Settings → Database → Connection string (URI)\n" +
      "2. Add DATABASE_URL=... to .env.local\n" +
      "3. Re-run: node scripts/run-section-a.mjs\n\n" +
      "OR paste supabase/SECTION-A-PATCH.sql into SQL Editor manually."
  );
  process.exit(1);
}

let pg;
try {
  pg = require("pg");
} catch {
  console.error("Install pg first: npm install pg --save-dev");
  process.exit(1);
}

const patchPath = path.join(root, "supabase", "SECTION-A-PATCH.sql");
if (!readFileSync(patchPath, "utf8").includes("SECTION A START")) {
  await import("./extract-section-a.mjs");
}

const sql = readFileSync(patchPath, "utf8");
const client = new pg.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });

console.log("Connecting to Supabase Postgres...");
await client.connect();
try {
  console.log("Running Section A patch...");
  await client.query(sql);
  console.log("Section A applied successfully.");
} finally {
  await client.end();
}
