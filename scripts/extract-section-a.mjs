import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = fs.readFileSync(path.join(root, "supabase", "SPINORA-COMPLETE-SCHEMA.sql"), "utf8");
const start = src.indexOf("-- SECTION A START");
const end = src.indexOf("-- SECTION A END");
if (start < 0 || end < 0) throw new Error("Section A markers not found");
const sectionA = src.slice(start, end + "-- SECTION A END".length);
const prereqPath = path.join(root, "supabase", "SECTION-A-PREREQUISITES.sql");
const prereq = fs.existsSync(prereqPath) ? fs.readFileSync(prereqPath, "utf8") : "";
const out = path.join(root, "supabase", "SECTION-A-PATCH.sql");
fs.writeFileSync(
  out,
  `-- Run in Supabase SQL Editor (Dashboard → SQL → New query → Run)
-- If you get "game_accounts does not exist", run SECTION-A-PREREQUISITES.sql first.

${prereq.trim()}

-- ============================================================================
-- SECTION A (main patch)
-- ============================================================================

${sectionA}
`,
  "utf8"
);
console.log("Wrote", out, `(${(sectionA.length / 1024).toFixed(1)} KB)`);
