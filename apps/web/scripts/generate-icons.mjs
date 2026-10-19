// @ts-check
// Renders the app icons from their SVG sources with Playwright's Chromium:
//   public/favicon.svg        → pwa-192x192.png, pwa-512x512.png, favicon.ico (32 + 16 px)
//   assets/icon-maskable.svg  → pwa-maskable-512x512.png, apple-touch-icon-180x180.png
// Run `npm run icons -w @amh/web` after changing either SVG, and commit the output.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "@playwright/test";

const app = join(dirname(fileURLToPath(import.meta.url)), "..");
const publicDir = join(app, "public");
const rounded = readFileSync(join(publicDir, "favicon.svg"), "utf8");
const fullBleed = readFileSync(join(app, "assets", "icon-maskable.svg"), "utf8");

const browser = await chromium.launch();
const page = await browser.newPage();

/** @param {string} svg @param {number} size */
async function render(svg, size) {
  await page.setViewportSize({ width: size, height: size });
  const sized = svg.replace("<svg ", `<svg width="${size}" height="${size}" `);
  await page.setContent(
    `<!doctype html><html><body style="margin:0;background:transparent">${sized}</body></html>`,
  );
  return page.screenshot({ omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } });
}

/** Wraps PNG images in an .ico container (PNG entries are valid since Windows Vista). */
function ico(/** @type {{ size: number, data: Buffer }[]} */ images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  let offset = 6 + 16 * images.length;
  const entries = images.map(({ size, data }) => {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size, 0);
    entry.writeUInt8(size, 1);
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(data.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += data.length;
    return entry;
  });
  return Buffer.concat([header, ...entries, ...images.map((image) => image.data)]);
}

const outputs = {
  "pwa-192x192.png": await render(rounded, 192),
  "pwa-512x512.png": await render(rounded, 512),
  "pwa-maskable-512x512.png": await render(fullBleed, 512),
  "apple-touch-icon-180x180.png": await render(fullBleed, 180),
  "favicon.ico": ico([
    { size: 32, data: await render(rounded, 32) },
    { size: 16, data: await render(rounded, 16) },
  ]),
};
await browser.close();

for (const [name, data] of Object.entries(outputs)) {
  writeFileSync(join(publicDir, name), data);
  console.warn(`wrote public/${name} (${String(data.length)} bytes)`);
}
