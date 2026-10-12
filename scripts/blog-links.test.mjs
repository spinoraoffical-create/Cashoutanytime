import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const gamesSource = readFileSync(new URL("../src/lib/games.ts", import.meta.url), "utf8");
const names = [...gamesSource.matchAll(/name: "([^"]+)",\s+slug: "([^"]+)"/g)].map((match) => ({
  name: match[1],
  slug: match[2],
}));

function mentions(haystack, phrase) {
  const escaped = phrase.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, "i").test(haystack);
}

function gamesInText(text) {
  const haystack = text.toLowerCase();
  return names
    .filter((game) => mentions(haystack, game.name) || mentions(haystack, game.slug.replace(/-/g, " ")))
    .sort((a, b) => b.name.length - a.name.length);
}

assert.equal(gamesInText("How to play Juwa tonight")[0]?.slug, "juwa");
assert.equal(gamesInText("panda master tips")[0]?.slug, "panda-master");
assert.equal(gamesInText("nothing here").length > 0, false);

const page = readFileSync(new URL("../src/app/blog/[slug]/page.tsx", import.meta.url), "utf8");
assert.match(page, /keepInternalHtml/);
assert.match(page, /href="\/play"/);
assert.match(page, /href="\/register"/);
assert.match(page, /InternalCtas/);
assert.equal(page.includes("https://example.com"), false);

const links = readFileSync(new URL("../src/lib/seo/blog-links.ts", import.meta.url), "utf8");
assert.match(links, /OWN_HOSTS/);
assert.match(links, /keepInternalHtml/);

console.log("blog link checks passed");
