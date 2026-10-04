import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const MIGRATIONS_DIR = "./supabase/migrations";
const OUTPUT_FILE = "./supabase/ALL-MIGRATIONS-COMBINED.sql";

async function main() {
  console.log("=== Combining all migrations ===");
  
  const files = readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith(".sql"))
    .sort(); // Sort chronologically by name prefix
  
  console.log(`Found ${files.length} SQL migration files.`);
  
  let combined = "";
  
  for (const file of files) {
    const filePath = join(MIGRATIONS_DIR, file);
    const content = readFileSync(filePath, "utf8");
    combined += `-- ==========================================\n`;
    combined += `-- MIGRATION: ${file}\n`;
    combined += `-- ==========================================\n\n`;
    combined += content;
    combined += "\n\n";
  }
  
  writeFileSync(OUTPUT_FILE, combined, "utf8");
  console.log(`Successfully wrote combined SQL to ${OUTPUT_FILE}`);
}

main().catch(console.error);
