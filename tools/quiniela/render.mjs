// Saca un PNG de 1080×1920 por cada <section class="s"> de un HTML de post.
//   node tools/quiniela/render.mjs quiniela/posts/2027-19-pronostico.html
// Con proxy (HTTPS_PROXY) las peticiones se hacen con curl, que sí sabe usarlo.
import { createRequire } from 'node:module';
import { execFile } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const html = path.resolve(process.argv[2]);
const base = html.replace(/\.html$/, '');
const exe = process.env.CHROME_PATH || ['/opt/pw-browsers/chromium-1243/chrome-linux64/chrome', '/usr/bin/google-chrome', '/usr/bin/chromium'].find((p) => { try { require('node:fs').accessSync(p); return true; } catch { return false; } });
const browser = await chromium.launch({ executablePath: exe });
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
if (process.env.HTTPS_PROXY) {
  const curl = (u) => new Promise((res) => execFile('curl', ['-sSL', '-w', '\n%{content_type}', '--max-time', '30', u], { encoding: 'buffer', maxBuffer: 1e8 }, (e, o) => {
    if (e) return res(null); const i = o.lastIndexOf(10); res({ body: o.subarray(0, i), type: o.subarray(i + 1).toString() || 'application/octet-stream' }); }));
  await page.route(/^https:/, async (r) => { const x = await curl(r.request().url()); if (!x) return r.abort(); await r.fulfill({ status: 200, body: x.body, contentType: x.type }); });
}
await page.goto(pathToFileURL(html).href, { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(600);
const ids = await page.$$eval('section.s', (x) => x.map((e) => e.id));
for (const [i, id] of ids.entries()) await (await page.$('#' + id)).screenshot({ path: `${base}-${String(i + 1).padStart(2, '0')}.png` });
console.log(ids.length, 'fotos →', path.dirname(base));
await browser.close();
