import { createRequire } from "node:module";
import { readFile, writeFile } from "node:fs/promises";
const require = createRequire(import.meta.url);
const sharp = require(process.env.SHARP_PATH || "sharp");
const svg = await readFile(
  new URL("../public/favicon.svg", import.meta.url),
  "utf8",
);
for (const [name, size] of [
  ["icon-192.png", 192],
  ["icon-512.png", 512],
  ["apple-touch-icon.png", 180],
]) {
  await sharp(Buffer.from(svg.replace('rx="16"', 'rx="0"')))
    .resize(size, size)
    .png()
    .toFile(
      new URL(`../public/${name}`, import.meta.url).pathname.replace(
        /^\/([A-Z]:)/i,
        "$1",
      ),
    );
}
const mask = svg
  .replace('viewBox="0 0 64 64"', 'viewBox="0 0 88 88"')
  .replace(
    '<rect width="64" height="64" rx="16"',
    '<rect width="88" height="88"',
  )
  .replace("<g fill=", '<g transform="translate(12 12)" fill=');
await writeFile(
  new URL("../public/icon-maskable.png", import.meta.url),
  await sharp(Buffer.from(mask)).resize(512, 512).png().toBuffer(),
);
