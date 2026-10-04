import fs from "fs";

const text = fs.readFileSync("src/lib/data/marketing.ts", "utf8");
const urls = [...text.matchAll(/cover_image_url: "(https:[^"]+)"/g)].map((m) => m[1]);
const uniq = [...new Set(urls)];

const bad = [];
for (const u of uniq) {
  try {
    const r = await fetch(u, { method: "HEAD", redirect: "follow" });
    if (!r.ok) bad.push({ status: r.status, u });
  } catch {
    bad.push({ status: "err", u });
  }
}

console.log(`checked ${uniq.length}, bad ${bad.length}`);
for (const b of bad) console.log(b.status, b.u);
