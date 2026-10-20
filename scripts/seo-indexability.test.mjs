import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolveSiteUrl, verifiedProfileUrls } from "../src/lib/constants.ts";
import { allCityParams, allStateSlugs, getCityData, getStateData } from "../src/lib/geo-data.ts";
import { isKnownGeoPath, isPublicIndexablePath, NON_INDEXABLE_STATE_SLUGS } from "../src/lib/seo/sitemap-policy.ts";

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
assert.equal(isPublicIndexablePath("/blog/how-to-start"), true);
assert.equal(isPublicIndexablePath("/compare"), false);
assert.equal(isPublicIndexablePath("/sweepstakes-rules"), false);
assert.equal(Boolean(getStateData("texas")), true);
assert.equal(getStateData("compare"), null);
assert.equal(Boolean(getCityData("texas", "houston")), true);
assert.equal(getCityData("texas", "not-a-city"), null);
assert.equal(isKnownGeoPath("/texas"), true);
assert.equal(isKnownGeoPath("/texas/houston"), true);
assert.equal(isKnownGeoPath("/compare"), false);
assert.equal(isPublicIndexablePath("/texas"), false);
assert.equal(isPublicIndexablePath("/texas/houston"), false);
assert.deepEqual([...NON_INDEXABLE_STATE_SLUGS].sort(), allStateSlugs().sort());
assert.equal(allStateSlugs().length, 12);
assert.equal(allCityParams().length, 63);
assert.equal(resolveSiteUrl("http://sweeptakehub.com/play?q=1"), "https://www.sweeptakehub.com/play");
assert.equal(resolveSiteUrl("http://localhost:3000"), "http://localhost:3000");
assert.equal(resolveSiteUrl("https://www.sweeptakehub.com"), "https://www.sweeptakehub.com");
assert.deepEqual(
  verifiedProfileUrls({
    whatsapp: "https://wa.me/1234567890",
    instagram: "https://www.instagram.com/spinora09",
    facebook: "https://www.facebook.com/share/19ea1cSC5W/",
    telegram: "https://t.me/sweeptakehub",
  }),
  ["https://t.me/sweeptakehub"]
);

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
assert.doesNotMatch(sitemap, /allGeoStateSlugs/);
assert.doesNotMatch(sitemap, /allGeoCityParams/);

const statePage = source("src/app/[state]/page.tsx");
const cityPage = source("src/app/[state]/[city]/page.tsx");
assert.match(statePage, /dynamicParams = false/);
assert.match(cityPage, /dynamicParams = false/);
assert.match(statePage, /index:\s*false/);
assert.match(cityPage, /index:\s*false/);
assert.match(source("src/app/not-found.tsx"), /index:\s*false/);

const analytics = source("src/lib/analytics/public-events.ts");
assert.match(analytics, /signup_started/);
assert.match(analytics, /google_signin_failed/);
assert.match(analytics, /track\(name, \{ reason: safeReason \}\)/);
assert.doesNotMatch(analytics, /password/);
assert.doesNotMatch(analytics, /otpValue|access_token|phoneNumber/);
const schema = source("src/lib/seo/json-ld.tsx");
assert.match(schema, /verifiedProfileUrls/);
assert.doesNotMatch(schema, /priceCurrency/);
assert.doesNotMatch(source("content/drafts/OWNER-REVIEW.md"), /export /);

const auth = source("src/app/(auth)/layout.tsx");
assert.match(auth, /index:\s*false/);

console.log("seo indexability checks passed");
