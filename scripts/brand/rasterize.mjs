// Rasterizes the brand SVGs (assets/brand) into app icons and PNG lockups.
// Usage: node scripts/brand/rasterize.mjs   (uses Playwright's Chromium; set CHROME_PATH to use a system Chrome)
// Sizes <= 32 px use the simplified small-size icon so the flame stays readable.
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');
const brand = path.join(root, 'assets', 'brand');
const icons = path.join(root, 'build', 'icons');
fs.mkdirSync(icons, { recursive: true });

const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
const page = await browser.newPage();
async function render(svgFile, out, w, h = w) {
  const svg = fs.readFileSync(path.join(brand, svgFile));
  await page.setViewportSize({ width: w, height: h });
  await page.setContent(`<html><body style="margin:0;background:transparent"><img src="data:image/svg+xml;base64,${svg.toString('base64')}" style="display:block;width:${w}px;height:${h}px"></body></html>`);
  await page.screenshot({ path: out, omitBackground: true });
}
const viewBox = (f) => fs.readFileSync(path.join(brand, f), 'utf8').match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/).slice(1).map(Number);

for (const s of [16, 24, 32, 48, 64, 128, 256, 512, 1024]) {
  await render(s <= 32 ? 'flare-studio-icon-small.svg' : 'flare-studio-icon.svg', path.join(icons, `${s}x${s}.png`), s);
}
fs.copyFileSync(path.join(icons, '1024x1024.png'), path.join(icons, 'flare.png'));
for (const f of ['flare-studio-lockup-horizontal', 'flare-studio-lockup-horizontal-light', 'flare-studio-lockup-stacked', 'flare-studio-lockup-stacked-light']) {
  const [w, h] = viewBox(`${f}.svg`);
  const W = f.includes('horizontal') ? 1200 : 800;
  await render(`${f}.svg`, path.join(brand, `${f}.png`), W, Math.round((h * W) / w));
}
await browser.close();
console.log('rasterized');
