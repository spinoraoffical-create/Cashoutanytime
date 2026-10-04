import { readFileSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

const out = join(tmpdir(), "lobby.html");
const res = await fetch("http://localhost:3000/");
writeFileSync(out, await res.text());

const html = readFileSync(out, "utf8");
const slugs = [...html.matchAll(/\/games\/([a-z0-9-]+)/g)].map((m) => m[1]);
const counts = {};
for (const s of slugs) counts[s] = (counts[s] || 0) + 1;
const dupes = Object.entries(counts)
  .filter(([, n]) => n > 1)
  .sort((a, b) => b[1] - a[1]);

console.log("SSR game link count:", slugs.length);
console.log("Duplicate slugs in HTML:", dupes.length ? dupes : "none");
console.log("lobby-games-grid count:", (html.match(/lobby-games-grid/g) || []).length);
