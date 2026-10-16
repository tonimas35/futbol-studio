// Prueba del Studio de fútbol en un navegador de verdad (Chromium sin ventana).
//
//   node tests/test_futbol.mjs
//
// Sin red: ESPN sale de tests/fixtures (datos reales de ESPN: la jornada de LaLiga del
// 20-9-2026 con el Atlético-Real Madrid, la de Champions del 14-10-2026 con el Roma 3-4 Real
// Madrid, el LASK 3-6 Liverpool y el City 2-4 PSG, un Depor-Levante en juego y partidos sin
// empezar) y html2canvas y JSZip, de node_modules:
//   npm install --no-save playwright-core@1 html2canvas@1.4.1 jszip@3.10.1
// En CI usa el Chrome del runner (CHROME_PATH); en local, el Playwright instalado.
//
// Comprueba: las competiciones, la lista de partidos y su estado, generar el carrusel (las 8
// slides, el titular, el minuto a minuto sin tarjetas pisadas, los onces, la clasificación),
// la firma, el jugador del partido, retocar textos, el borrador al recargar, el ZIP 4:5 y 9:16,
// compartir, un partido en juego, uno sin alineaciones ni clasificación y el móvil.
import { spawn, execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const REPO = resolve(new URL('..', import.meta.url).pathname);
const FIX = join(REPO, 'tests', 'fixtures');

async function loadChromium() {
  for (const name of ['playwright-core', 'playwright']) {
    try { return (await import(name)).chromium; } catch (e) { /* siguiente */ }
  }
  for (const base of [process.env.NODE_PATH, '/opt/node22/lib/node_modules', '/opt/node-tools/node_modules'].filter(Boolean)) {
    try { return createRequire(join(base, 'x'))('playwright').chromium; } catch (e) { /* siguiente */ }
  }
  throw new Error('No se encuentra Playwright (npm install --no-save playwright-core)');
}

const LIBS = {};
for (const [key, path] of [['html2canvas', 'html2canvas/dist/html2canvas.min.js'], ['jszip', 'jszip/dist/jszip.min.js']]) {
  try {
    LIBS[key] = readFileSync(join(REPO, 'node_modules', path));
  } catch (e) {
    console.error(`Falta ${key}: npm install --no-save html2canvas@1.4.1 jszip@3.10.1`);
    process.exit(1);
  }
}

const port = 8900 + Math.floor(Math.random() * 90);
const server = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1', '--directory', REPO], { stdio: 'ignore' });
const base = `http://127.0.0.1:${port}`;
for (let i = 0; i < 50; i++) {
  try { if ((await fetch(`${base}/`)).ok) break; } catch (e) { /* aún arrancando */ }
  await new Promise((r) => setTimeout(r, 100));
}

const chromium = await loadChromium();
const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
const failures = [];
const errors = [];
const check = (ok, msg) => {
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${msg}`);
  if (!ok) failures.push(msg);
};
const json = (body, status = 200) => ({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body });

// strip: claves que se quitan del resumen de ESPN (para probar un partido con menos datos)
async function open({ strip = [], viewport = { width: 1280, height: 900 } } = {}) {
  const ctx = await browser.newContext({ viewport, locale: 'es-ES', timezoneId: 'Europe/Madrid', acceptDownloads: true });
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: base });
  await ctx.addInitScript(() => {
    window.__shared = [];
    navigator.canShare = () => true;
    navigator.share = async (data) => { window.__shared.push((data.files || []).length); };
  });
  await ctx.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => r.abort());
  await ctx.route('https://site.api.espn.com/**', (r) => {
    const u = new URL(r.request().url());
    const parts = u.pathname.split('/');
    const summary = u.pathname.endsWith('/summary');
    const file = summary ? `sum-${u.searchParams.get('event')}.json` : `sb-${parts[parts.length - 2]}-${u.searchParams.get('dates')}.json`;
    if (!existsSync(join(FIX, file))) return r.fulfill(summary ? { status: 404, headers: { 'access-control-allow-origin': '*' }, body: '' } : json('{"events":[]}'));
    const data = JSON.parse(readFileSync(join(FIX, file)));
    strip.forEach((k) => delete data[k]);
    return r.fulfill(json(JSON.stringify(data)));
  });
  await ctx.route('https://cdn.jsdelivr.net/**', (r) => {
    const key = Object.keys(LIBS).find((k) => r.request().url().includes(`/${k}@`));
    return key ? r.fulfill({ status: 200, contentType: 'application/javascript', body: LIBS[key] }) : r.abort();
  });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error' && !/Failed to load resource|net::|Error loading image/.test(m.text())) errors.push(m.text());
  });
  await page.goto(`${base}/`);
  return { ctx, page };
}

async function pickDate(page, iso) {
  await page.fill('#dateInput', iso);
  await page.dispatchEvent('#dateInput', 'change');
  await page.waitForFunction(() => !document.querySelector('#gamesList .loader'));
}
async function pickLeague(page, slug) {
  await page.click(`.comp-chip[data-league="${slug}"]`);
  await page.waitForFunction(() => !document.querySelector('#gamesList .loader'));
}
async function generate(page, id) {
  await page.click(`.game-card[data-game-id="${id}"]`);
  await page.click('#generateBtn');
  await page.waitForFunction(() => !document.getElementById('generateBtn').classList.contains('btn-loading'), null, { timeout: 30000 });
  await page.waitForTimeout(200);
}
const slideNames = (page) => page.$$eval('.slide-label-name', (els) => els.map((e) => e.textContent.replace(/^\d+ · /, '')));
const pngSize = (path) => execFileSync('python3', ['-c', 'import struct,sys; d=open(sys.argv[1],"rb").read(24); print(*struct.unpack(">II", d[16:24]))', path]).toString().trim();

try {
  const { ctx, page } = await open();

  // ── Competiciones ──
  const chips = await page.$$eval('.comp-chip', (cs) => cs.map((c) => [c.dataset.league, c.getAttribute('aria-checked')]));
  check(chips.length >= 25 && chips.find(([l]) => l === 'esp.1')[1] === 'true', `${chips.length} competiciones y LaLiga marcada por defecto`);

  // ── Lista de partidos y su estado ──
  await pickDate(page, '2026-09-20');
  const cards = await page.$$eval('.game-card', (cs) => cs.map((c) => ({
    id: c.dataset.gameId, status: c.querySelector('.game-status').textContent,
    teams: [...c.querySelectorAll('.game-team-abbr')].map((t) => t.textContent), scorers: c.querySelector('.game-scorers').textContent,
  })));
  check(cards.length === 5 && cards.every((c) => c.status === 'Final'), `LaLiga 20-9: 5 partidos acabados (${cards.map((c) => c.status).join(' | ')})`);
  const derbi = cards.find((c) => c.id === '401882865');
  check(derbi?.teams.join('-') === 'Atlético-Real Madrid' && /Grimaldo 53' \(p\)/.test(derbi.scorers), `el derbi: local primero, nombres en español y goleadores (${derbi?.teams.join('-')} · ${derbi?.scorers})`);

  await pickDate(page, '2026-10-17');
  await page.click('.game-card');
  check(/^\d\d:\d\d h$/.test(await page.textContent('.game-card .game-status')) && await page.$eval('#generateBtn', (b) => b.disabled),
    'sin empezar: se ve la hora y no deja generar');

  await pickDate(page, '2026-10-16');
  check(await page.textContent('.game-card .game-status') === "En juego · 74'", "en juego: «En juego · 74'»");
  await page.click('.game-card');
  let dialog = '';
  page.once('dialog', (d) => { dialog = d.message(); d.dismiss(); });
  await page.click('#generateBtn');
  await page.waitForTimeout(300);
  check(/aún se está jugando/.test(dialog) && await page.$eval('#renderedInfo', (e) => e.hidden), 'en juego: pregunta antes y, si se cancela, no genera');

  // ── Champions: Roma 3-4 Real Madrid ──
  await pickLeague(page, 'uefa.champions');
  await pickDate(page, '2026-10-14');
  check((await page.$$('.game-card')).length === 9, 'Champions 14-10: 9 partidos');
  await page.fill('#signInput', '@toni_futbol');
  await generate(page, '401915414');
  const names = await slideNames(page);
  check(names.join(',') === 'Portada,Minuto a minuto,Estadísticas,Mapa de tiros,Los onces,Jugador del partido,Clasificación,Cierre', `8 slides: ${names.join(', ')}`);
  check(await page.textContent('#slide-portada h1') === 'Remontada del Real Madrid', `titular: ${await page.textContent('#slide-portada h1')}`);
  const portada = await page.$$eval('#slide-portada .scorers', (els) => els.map((e) => [...e.children].map((d) => d.textContent).join(' · ')));
  check(portada[0] === "de Roon 20' · Malen 51', 57'" && /Mbappé 25'.*Rüdiger 90'/.test(portada[1]), `goleadores de cada equipo: ${portada.join(' / ')}`);
  check(/Champions League · Fase liga/.test(await page.textContent('#slide-portada .comp')), 'la competición y la fase en la portada');

  // Minuto a minuto: 7 goles con su marcador y nada pisado (ni entre ellos ni con las marcas)
  const crono = await page.$eval('#slide-crono', (slide) => {
    const box = (el) => ({ top: el.offsetTop, bottom: el.offsetTop + el.offsetHeight, left: el.offsetLeft, right: el.offsetLeft + el.offsetWidth });
    const evs = [...slide.querySelectorAll('.ev')].map((e) => ({ ...box(e), side: e.classList.contains('l') ? 'l' : 'r', sc: e.querySelector('.sc')?.textContent }));
    const marks = [...slide.querySelectorAll('.ht')].map((e) => ({ top: e.offsetTop - e.offsetHeight / 2, bottom: e.offsetTop + e.offsetHeight / 2, text: e.textContent }));
    let clash = 0;
    for (const a of evs) {
      for (const b of evs) if (a !== b && a.side === b.side && a.top < b.bottom && b.top < a.bottom) clash++;
      for (const k of marks) if (a.top < k.bottom && k.top < a.bottom) clash++;
    }
    return { n: evs.length, last: evs.map((e) => e.sc).filter(Boolean).pop(), clash, marks: marks.map((k) => k.text) };
  });
  check(crono.n === 7 && crono.clash === 0, `minuto a minuto: ${crono.n} goles sin pisarse (${crono.clash} choques)`);
  check(crono.marks.includes('Descanso · 1-1') && crono.marks.includes('Final · 3-4'), `marcas: ${crono.marks.join(' | ')}`);
  check(crono.last === '3-4', 'el último gol deja el 3-4');

  check(await page.$$eval('#slide-stats .labels span', (s) => s.map((x) => x.textContent).slice(0, 3).join(',')) === 'Posesión,Tiros,A puerta', 'estadísticas: posesión, tiros, a puerta…');
  check(await page.$eval('#slide-tiros .pitch', (img) => img.src.startsWith('data:image/png')), 'mapa de tiros dibujado');
  const onces = await page.$$eval('#slide-onces .pl', (ps) => ps.length);
  const forms = await page.$$eval('#slide-onces .fm', (f) => f.map((x) => x.textContent));
  check(onces === 22 && forms.join(' ') === '4-2-3-1 3-4-2-1', `los onces: ${onces} jugadores y los sistemas ${forms.join(' / ')}`);
  check(/Así va\s*la Champions/.test(await page.textContent('#slide-tabla h1')) && (await page.$$('#slide-tabla .row.me')).length === 2, 'clasificación de la Champions con los dos equipos marcados');
  check(await page.$eval('#slide-tabla .gap', () => true).catch(() => false), 'y «···» entre los dos (están lejos en la tabla)');

  // La firma, en todas las slides
  const signs = await page.$$eval('.slide .fc-sign', (s) => s.map((x) => x.textContent));
  check(signs.length === 8 && signs.every((t) => t === '@toni_futbol'), `la firma sale en las 8 slides (${signs.length})`);

  // Jugador del partido: se puede elegir otro
  const pick = await page.$eval('[data-slide-id="jugador"] .slide-pick', (s) => [...s.options].map((o) => [o.value, o.textContent]));
  const first = await page.textContent('#slide-jugador .bar span');
  await page.selectOption('[data-slide-id="jugador"] .slide-pick', pick[1][0]);
  const second = await page.textContent('#slide-jugador .bar span');
  check(pick.length > 5 && first !== second && pick[1][1].startsWith(second.split(' ').pop()), `jugador del partido: ${first} → ${second}`);

  // ── Retocar y recuperar el borrador ──
  await page.click('#slide-portada h1');
  await page.keyboard.press('Control+End');
  await page.keyboard.type(' en Roma');
  await page.waitForTimeout(800);
  check(await page.$eval('[data-slide-id="portada"]', (w) => w.classList.contains('edited')), 'retocar el titular marca la slide');
  await page.reload();
  await page.waitForSelector('#slide-portada');
  await page.waitForTimeout(300);
  const restored = await page.textContent('#slide-portada h1');
  check(restored === 'Remontada del Real Madrid en Roma' && /Recuperado/.test(await page.textContent('#draftStatus')),
    `al recargar vuelve el carrusel con el retoque (${restored})`);
  check(await page.textContent('#slide-jugador .bar span') === second, 'y con el jugador elegido');
  check(await page.inputValue('#signInput') === '@toni_futbol' && await page.$eval('.comp-chip[data-league="uefa.champions"]', (c) => c.getAttribute('aria-checked')) === 'true',
    'se recuerdan la firma y la competición');
  await page.click('[data-slide-id="portada"] .slide-reset-btn');
  check(await page.textContent('#slide-portada h1') === 'Remontada del Real Madrid' && await page.textContent('#slide-portada .fc-sign') === '@toni_futbol',
    '«↺ original» deshace el retoque y deja la firma');

  // ── Descargas ──
  const [one] = await Promise.all([page.waitForEvent('download'), page.click('[data-slide-id="tiros"] .slide-dl-btn')]);
  check(one.suggestedFilename() === 'futbol-roma-rma-2026-10-14-04-tiros.png', `PNG suelta: ${one.suggestedFilename()}`);
  const dir = mkdtempSync(join(tmpdir(), 'fc-studio-'));
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 120000 }), page.click('#downloadBtn')]);
  const zipPath = join(dir, dl.suggestedFilename());
  await dl.saveAs(zipPath);
  const entries = JSON.parse(execFileSync('python3', ['-c', 'import json,sys,zipfile; z=zipfile.ZipFile(sys.argv[1]); print(json.dumps([z.namelist(), z.read("caption.txt").decode()]))', zipPath]).toString());
  check(dl.suggestedFilename() === 'futbol-roma-rma-2026-10-14.zip' && entries[0].filter((n) => n.endsWith('.png')).length === 8, `ZIP con 8 PNG (${dl.suggestedFilename()})`);
  check(/ROMA 3-4 REAL MADRID/.test(entries[1]) && /#ChampionsLeague/.test(entries[1]), 'con el pie de foto');
  const [dlv] = await Promise.all([page.waitForEvent('download', { timeout: 120000 }), page.click('#downloadVerticalBtn')]);
  const vPath = join(dir, dlv.suggestedFilename());
  await dlv.saveAs(vPath);
  execFileSync('python3', ['-c', 'import sys,zipfile; z=zipfile.ZipFile(sys.argv[1]); open(sys.argv[2],"wb").write(z.read([n for n in z.namelist() if n.endswith(".png")][0]))', vPath, join(dir, 'v.png')]);
  check(pngSize(join(dir, 'v.png')) === '1080 1920', `9:16: ${pngSize(join(dir, 'v.png'))}`);

  // ── Compartir en dos toques ──
  await page.click('#shareCarouselBtn');
  await page.waitForFunction(() => /Toca para compartir/.test(document.querySelector('#shareCarouselBtn .label').textContent), null, { timeout: 120000 });
  await page.click('#shareCarouselBtn');
  check((await page.evaluate(() => window.__shared))[0] === 8, 'compartir manda las 8 imágenes');

  // ── LASK 3-6 Liverpool: goleada y defensa de 5 ──
  await pickDate(page, '2026-10-14');
  await generate(page, '401915415');
  check(await page.textContent('#slide-portada h1') === 'Exhibición del Liverpool', `LASK-Liverpool: ${await page.textContent('#slide-portada h1')}`);
  const five = await page.$$eval('#slide-onces .pl', (ps) => {
    const rows = {};
    ps.forEach((p) => { (rows[p.style.top] ||= []).push(p.querySelector('.nm')); });
    const row = Object.values(rows).find((r) => r.length === 5);
    return row ? row.map((nm) => nm.scrollWidth <= nm.clientWidth + 1 || getComputedStyle(nm).textOverflow === 'ellipsis').every(Boolean) && row.every((nm, i) => !i || nm.parentElement.offsetLeft - row[i - 1].parentElement.offsetLeft >= nm.clientWidth) : false;
  });
  check(five, 'la defensa de 5: los nombres no se montan');

  // ── En juego ──
  await pickLeague(page, 'esp.1');
  await pickDate(page, '2026-10-16');
  page.once('dialog', (d) => d.accept());
  await generate(page, '401882844');
  check(/En juego · 74'/.test(await page.textContent('#slide-portada .comp')) && await page.textContent('#slide-portada h1') === 'Así va el partido', 'en juego: la portada lo dice');
  check(await page.textContent('#slide-cierre .q') === '¿Cómo acaba?' && (await page.$$eval('#slide-crono .ht', (h) => h.map((x) => x.textContent))).includes("Ahora · 74'"), "y el cierre pregunta cómo acaba, con «Ahora · 74'» en la línea");
  await ctx.close();

  // ── Un partido sin alineaciones, sin tiros con sitio ni clasificación ──
  {
    const { ctx: c2, page: p2 } = await open({ strip: ['rosters', 'commentary', 'standings'] });
    await pickDate(p2, '2026-09-20');
    await generate(p2, '401882865');
    const n2 = await slideNames(p2);
    check(n2.join(',') === 'Portada,Minuto a minuto,Estadísticas,Cierre', `sin esos datos, solo las slides que se pueden hacer: ${n2.join(', ')}`);
    check(await p2.textContent('#slide-portada h1') === 'El Atlético gana por la mínima', `y el titular sale igual: ${await p2.textContent('#slide-portada h1')}`);
    await c2.close();
  }

  // ── En el móvil ──
  {
    const { ctx: c3, page: p3 } = await open({ viewport: { width: 390, height: 844 } });
    await pickDate(p3, '2026-09-20');
    await generate(p3, '401882865');
    const wide = await p3.evaluate(() => document.scrollingElement.scrollWidth);
    check(wide <= 390, `móvil: sin scroll de lado (${wide}px)`);
    await p3.click('[data-slide-id="crono"] .slide-zoom-btn');
    const zoomW = await p3.$eval('.slide-wrap.zoomed .slide-preview-wrap', (w) => w.clientWidth);
    check(zoomW >= 330, `ver en grande en el móvil: ${zoomW}px de ancho`);
    await c3.close();
  }
} catch (e) {
  console.error(e);
  failures.push(`excepción: ${e.message}`);
} finally {
  check(!errors.length, `sin errores en la página${errors.length ? `: ${errors.join(' | ')}` : ''}`);
  await browser.close();
  server.kill();
}

console.log(failures.length ? `\n${failures.length} fallos` : '\nTodo OK');
process.exit(failures.length ? 1 : 0);
