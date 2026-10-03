import { readFileSync } from "fs";
import { createClient } from "@supabase/supabase-js";

function loadEnv() {
  const raw = readFileSync(".env.local", "utf8");
  for (const line of raw.split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
}

loadEnv();
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const ga = await db.from("game_accounts").select("id,user_id,game_username,credits_balance,game_id,games(slug,name)").limit(10);
const gl = await db
  .from("game_load_requests")
  .select("id,user_id,game_slug,load_type,status,game_username,created_at")
  .order("created_at", { ascending: false })
  .limit(15);
const games = await db.from("games").select("slug,name").limit(20);
const cfg = await db.from("game_server_configs").select("game_id,is_enabled").limit(20);

console.log("game_accounts:", ga.error?.message ?? ga.data);
console.log("game_load_requests:", gl.error?.message ?? gl.data);
console.log("games:", games.error?.message ?? games.data?.map((g) => g.slug));
console.log("game_server_configs count:", cfg.error?.message ?? cfg.data?.length);
