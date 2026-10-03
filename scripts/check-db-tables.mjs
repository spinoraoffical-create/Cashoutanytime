import { readFileSync } from "fs";
import { createClient } from "@supabase/supabase-js";

function loadEnv() {
  for (const line of readFileSync(".env.local", "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
loadEnv();
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
for (const t of ["wallet_transactions", "wallet_ledger"]) {
  const r = await db.from(t).select("id").limit(1);
  console.log(t, r.error ? `ERR: ${r.error.message}` : "OK");
}
