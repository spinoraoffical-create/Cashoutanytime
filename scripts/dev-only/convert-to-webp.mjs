import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const publicDir = path.join(process.cwd(), "public");
const targets = [
  path.join(publicDir, "logo.jpeg"),
  ...fs
    .readdirSync(path.join(publicDir, "games"))
    .filter((f) => f.endsWith(".jpeg"))
    .map((f) => path.join(publicDir, "games", f)),
];

for (const file of targets) {
  const out = file.replace(/\.jpe?g$/i, ".webp");
  await sharp(file)
    .webp({ quality: 82, effort: 4 })
    .toFile(out);
  const before = fs.statSync(file).size;
  const after = fs.statSync(out).size;
  console.log(`${path.basename(file)} → ${path.basename(out)} (${before} → ${after} bytes)`);
}
