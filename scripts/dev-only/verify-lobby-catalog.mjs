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

const { buildLobbyCatalog } = await import("../src/lib/games-marketing.ts");
const { canonicalGameSlug } = await import("../src/lib/games.ts");

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const { data: dbGames } = await db.from("games").select("id, slug, name, description, image_url, badge_text, is_featured, popularity, play_url, download_url").eq("is_active", true);

const catalog = buildLobbyCatalog(dbGames ?? []);
const keys = catalog.map((g) => canonicalGameSlug(g.slug));
const dupes = keys.filter((k, i) => keys.indexOf(k) !== i);

console.log("DB games:", dbGames?.map((g) => g.slug).join(", "));
console.log("Catalog size:", catalog.length);
console.log("Duplicate canonical slugs:", dupes.length ? [...new Set(dupes)] : "none");

const cashFrenzy = catalog.filter((g) => canonicalGameSlug(g.slug) === "cash-frenzy");
const mrAll = catalog.filter((g) => canonicalGameSlug(g.slug) === "mr-all-in-one");
console.log("cash-frenzy entries:", cashFrenzy.length, cashFrenzy.map((g) => g.slug));
console.log("mr-all-in-one entries:", mrAll.length, mrAll.map((g) => g.slug));
