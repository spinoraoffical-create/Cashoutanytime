import fs from "fs";

const src = fs.readFileSync("src/lib/games.ts", "utf8");
const slugs = [...src.matchAll(/slug:\s*["']([^"']+)["']/g)].map((m) => m[1]);
const names = [...src.matchAll(/name:\s*["']([^"']+)["']/g)].map((m) => m[1]);
const images = [...src.matchAll(/image:\s*["']([^"']+)["']/g)].map((m) => m[1]);

function dupes(arr) {
  const m = new Map();
  for (const x of arr) m.set(x, (m.get(x) || 0) + 1);
  return [...m.entries()].filter(([, c]) => c > 1);
}

const norm = (n) => n.toLowerCase().replace(/[^a-z0-9]/g, "");
const normNames = names.map(norm);
console.log("count", slugs.length);
console.log("dup slugs", dupes(slugs));
console.log("dup names", dupes(names));
console.log("dup images", dupes(images));
console.log("dup norm names", dupes(normNames));
