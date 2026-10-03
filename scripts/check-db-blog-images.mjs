import fs from "fs";

function loadEnv() {
  const env = {};
  for (const line of fs.readFileSync(".env.local", "utf8").split("\n")) {
    if (!line || line.startsWith("#")) continue;
    const i = line.indexOf("=");
    if (i === -1) continue;
    const k = line.slice(0, i);
    let v = line.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    env[k] = v;
  }
  return env;
}

const { NEXT_PUBLIC_SUPABASE_URL: url, NEXT_PUBLIC_SUPABASE_ANON_KEY: key } = loadEnv();

const res = await fetch(
  `${url}/rest/v1/blog_posts?select=slug,cover_image_url,content&is_published=eq.true&limit=50`,
  { headers: { apikey: key, Authorization: `Bearer ${key}` } }
);
const posts = await res.json();

if (!Array.isArray(posts)) {
  console.error("Unexpected response:", posts);
  process.exit(1);
}

const coverUrls = [...new Set(posts.map((p) => p.cover_image_url).filter(Boolean))];
const contentUrls = [
  ...new Set(
    posts.flatMap((p) => [...(p.content ?? "").matchAll(/src="(https:[^"]+)"/g)].map((m) => m[1]))
  ),
];

console.log(`posts: ${posts.length}, cover urls: ${coverUrls.length}, content img urls: ${contentUrls.length}`);

const nullCovers = posts.filter((p) => !p.cover_image_url).map((p) => p.slug);
if (nullCovers.length) console.log("null covers:", nullCovers.join(", "));

async function check(label, urls) {
  const bad = [];
  for (const u of urls) {
    try {
      const r = await fetch(u, { method: "HEAD", redirect: "follow" });
      if (!r.ok) bad.push({ status: r.status, u });
    } catch {
      bad.push({ status: "err", u });
    }
  }
  console.log(`\n${label}: ${bad.length} bad / ${urls.length}`);
  for (const b of bad) console.log(" ", b.status, b.u);
}

await check("cover_image_url", coverUrls);
await check("content img", contentUrls);

// Show unique hostnames
const hosts = [...new Set([...coverUrls, ...contentUrls].map((u) => new URL(u).hostname))];
console.log("\nhosts:", hosts.join(", "));
