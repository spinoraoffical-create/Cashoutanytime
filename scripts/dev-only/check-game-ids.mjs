import fs from "fs";

const src = fs.readFileSync("src/lib/games.ts", "utf8");
const ids = [...src.matchAll(/id:\s*["']([^"']+)["']/g)].map((m) => m[1]);
const slugs = [...src.matchAll(/slug:\s*["']([^"']+)["']/g)].map((m) => m[1]);
const names = [...src.matchAll(/name:\s*["']([^"']+)["']/g)].map((m) => m[1]);

function dupes(arr) {
  const m = new Map();
  for (const x of arr) m.set(x, (m.get(x) || 0) + 1);
  return [...m.entries()].filter(([, c]) => c > 1);
}

console.log("dup ids", dupes(ids));
console.log("dup slugs", dupes(slugs));
console.log("dup names", dupes(names));
