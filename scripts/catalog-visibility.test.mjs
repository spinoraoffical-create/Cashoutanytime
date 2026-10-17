import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  filterPlayCatalog,
  gameDetailPath,
  publicCatalogFromRows,
  publicCatalogSourceIds,
} from "../src/lib/games-marketing.ts";

/** Active rows read from zecitlewsynyioemsqna on 17 Oct 2026. Inactive rows must stay out. */
const ACTIVE = [
  ["dd12873d-3b8a-49cf-b350-5c1e13db2b19", "juwa", "Juwa"],
  ["a6ab6e0d-3f00-4187-8164-985d5ecb78fc", "game-vault", "Game Vault"],
  ["d2bbb8cf-8abe-4f95-9c4d-313411df34e5", "vegas-sweeps", "Vegas Sweeps"],
  ["75dab82a-8b55-454b-80b7-c955d1c5c256", "cash-frenzy", "Cash Frenzy"],
  ["dd86c002-3c5e-46b3-8d74-ecba87187f0c", "mafia", "Mafia"],
  ["e19fd8fc-4b9e-460d-a19e-58a9ec5279c5", "mr-all-in-one", "Mr All In One"],
  ["2e955e0f-bff8-4ec1-93d2-a09f026cd7f5", "cash-machine", "Cash Machine"],
  ["567c707a-3d12-45c1-88c4-19fc5e971ebf", "gameroom", "Game Room"],
];

const INACTIVE = [
  ["612b37af-734b-4d22-b84f-9d3f6ca3e11e", "fire-kirin", "Fire Kirin"],
  ["8db94bee-2e73-446b-8b65-24a21e9f66b0", "orion-stars", "Orion Stars"],
  ["83c0a570-23e7-463e-99c5-0e258c8a7ce4", "milky-way", "Milky Way"],
  ["9912d384-7390-4164-a6f4-850e5585142f", "panda-master", "Panda Master"],
  ["709b64e4-7a3d-4402-be71-e2a2dc09dd59", "vblink", "VBlink"],
];

function row([id, slug, name], isActive) {
  return {
    id,
    slug,
    name,
    description: "",
    image_url: null,
    badge_text: null,
    is_featured: false,
    popularity: 1,
    play_url: null,
    download_url: null,
    is_active: isActive,
  };
}

const rows = [
  ...ACTIVE.map((item) => row(item, true)),
  ...INACTIVE.map((item) => row(item, false)),
];
const catalog = publicCatalogFromRows(rows);

assert.equal(catalog.length, ACTIVE.length);
assert.deepEqual(publicCatalogSourceIds(rows).sort(), ACTIVE.map(([id]) => id).sort());
for (const [id, slug, name] of ACTIVE) {
  const game = catalog.find((item) => item.slug === slug);
  assert.ok(game, slug);
  assert.equal(game.name, name);
  assert.equal(gameDetailPath(game.slug), `/games/${slug}`);
  assert.equal(publicCatalogSourceIds(rows).includes(id), true);
}
for (const [, slug] of INACTIVE) {
  assert.equal(catalog.some((game) => game.slug === slug), false);
}

assert.deepEqual(publicCatalogFromRows([]), []);

const searchable = filterPlayCatalog(catalog, { query: "juwa" });
assert.deepEqual(searchable.map((game) => game.slug), ["juwa"]);
const slots = filterPlayCatalog(catalog, { category: "Slots" });
assert.ok(slots.every((game) => game.category === "Slots"));
assert.ok(slots.some((game) => game.slug === "juwa"));

const hidden = filterPlayCatalog(
  [{ ...catalog[0], upcoming: true, slug: "hidden-upcoming", name: "Hidden" }],
  {}
);
assert.equal(hidden.length, 0);

const serialized = JSON.stringify(catalog);
assert.equal(/password|agent_key|service_role|wallet_balance/i.test(serialized), false);

const nextConfig = readFileSync(new URL("../next.config.ts", import.meta.url), "utf8");
assert.match(nextConfig, /source:\s*"\/games"/);
assert.match(nextConfig, /destination:\s*"\/play"/);
assert.match(nextConfig, /permanent:\s*true/);
assert.equal(readFileSync(new URL("../src/app/games/[slug]/page.tsx", import.meta.url), "utf8").includes("permanentRedirect"), false);

const { isPublicIndexablePath } = await import("../src/lib/seo/sitemap-policy.ts");
assert.equal(isPublicIndexablePath("/games"), false);
assert.equal(isPublicIndexablePath("/games/juwa"), true);
assert.equal(isPublicIndexablePath("/play"), true);
assert.equal(isPublicIndexablePath("/login"), false);

const playPage = readFileSync(new URL("../src/app/play/page.tsx", import.meta.url), "utf8");
assert.match(playPage, /loadActiveGames/);
assert.match(playPage, /publicPlayCatalog/);
assert.match(playPage, /could not be loaded/);
assert.doesNotMatch(playPage, /fire-kirin/);

const query = readFileSync(new URL("../src/lib/data/marketing.ts", import.meta.url), "utf8");
assert.match(query, /\.eq\("is_active", true\)/);
assert.match(query, /Active game catalog could not be read/);

console.log("catalog visibility checks passed");
