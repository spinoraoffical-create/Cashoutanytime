import fs from "fs";

const text = fs.readFileSync("src/lib/data/marketing.ts", "utf8");
const urls = [...text.matchAll(/cover_image_url: "(https:[^"]+)"/g)].map((m) => m[1]);
const uniq = [...new Set(urls)];

const bad = [];
for (const u of uniq) {
  const r = await fetch(
    `http://localhost:3001/_next/image?url=${encodeURIComponent(u)}&w=640&q=75`
  );
  if (!r.ok) bad.push({ status: r.status, u });
}

console.log(`checked ${uniq.length} via _next/image, bad ${bad.length}`);
for (const b of bad) console.log(b.status, b.u);
