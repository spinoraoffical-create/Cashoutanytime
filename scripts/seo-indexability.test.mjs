import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { isPublicIndexablePath } from "../src/lib/seo/sitemap-policy.ts";

const root = new URL("../", import.meta.url);

function source(path) {
  return readFileSync(new URL(path, root), "utf8");
}

assert.equal(isPublicIndexablePath("/play"), true);
assert.equal(isPublicIndexablePath("/"), true);
assert.equal(isPublicIndexablePath("/games/juwa"), true);
assert.equal(isPublicIndexablePath("/games"), false);
assert.equal(isPublicIndexablePath("/login"), false);
assert.equal(isPublicIndexablePath("/register"), false);
assert.equal(isPublicIndexablePath("/reset-password"), false);
assert.equal(isPublicIndexablePath("/dashboard"), false);
assert.equal(isPublicIndexablePath("/dashboard/wallet"), false);
assert.equal(isPublicIndexablePath("/admin"), false);
assert.equal(isPublicIndexablePath("/admin/payments"), false);
assert.equal(isPublicIndexablePath("/api/payments/paydora/webhook"), false);
assert.equal(isPublicIndexablePath("/restricted"), false);
assert.equal(isPublicIndexablePath("/games/juwa/extra"), false);

const config = source("next.config.ts");
assert.match(config, /source:\s*"\/games",\s*destination:\s*"\/play",\s*permanent:\s*true/);
assert.doesNotMatch(config, /source:\s*"\/play",\s*destination:\s*"\/games"/);

const gamesPage = source("src/app/games/page.tsx");
assert.match(gamesPage, /permanentRedirect/);
assert.match(gamesPage, /searchParams/);
assert.doesNotMatch(gamesPage, /redirect\("\/play"\)/);

const playPage = source("src/app/play/page.tsx");
assert.match(playPage, /path:\s*"\/play"/);
assert.match(playPage, /<h1/);
assert.match(playPage, /gameDetailPath\(game\.slug\)/);
assert.doesNotMatch(playPage, /canonical:\s*"\/games"/);

const layout = source("src/app/layout.tsx");
assert.doesNotMatch(layout, /homeMetadata/);
assert.doesNotMatch(layout, /openGraph/);
assert.match(source("src/app/page.tsx"), /homeMetadata/);

const robots = source("src/app/robots.ts");
assert.match(robots, /sitemap:\s*`\$\{SITE_URL\}\/sitemap\.xml`/);
assert.match(robots, /host:\s*"www\.sweeptakehub\.com"/);
assert.match(robots, /\/admin/);
assert.doesNotMatch(robots, /disallow:\s*\["\/play"/);
assert.doesNotMatch(robots, /"\/play"/);

const sitemap = source("src/lib/seo/indexable-urls.ts");
assert.match(sitemap, /isPublicIndexablePath/);
assert.doesNotMatch(sitemap, /lastModified:\s*new Date\(\)/);

const auth = source("src/app/(auth)/layout.tsx");
assert.match(auth, /index:\s*false/);

console.log("seo indexability checks passed");
