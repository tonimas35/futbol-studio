// Prueba del Studio de fútbol en un navegador de verdad (Chromium sin ventana).
//
//   node tests/test_futbol.mjs
//
// Sin red: ESPN sale de tests/fixtures (datos reales de ESPN: la jornada de LaLiga del
// 20-9-2026 con el Atlético-Real Madrid, la de Champions del 14-10-2026 con el Roma 3-4 Real
// Madrid, el LASK 3-6 Liverpool y el City 2-4 PSG, un Depor-Levante en juego, partidos sin
// empezar, la final del Mundial 2026, la vuelta del Flamengo-Independiente del Valle de la
// Libertadores, una eliminatoria de la Copa del Rey sin datos, el Lech-Leverkusen de la Europa
// League con su clasificación aparte, el Osnabrück-Bayern de la Copa de Alemania y, para «El dato»,
// temporadas de la Roma y del Real Madrid, recortadas a lo que se usa) y
// html2canvas y JSZip, de node_modules:
//   npm install --no-save playwright-core@1 html2canvas@1.4.1 jszip@3.10.1 mp4-muxer@5.2.1
// En CI usa el Chrome del runner (CHROME_PATH); en local, el Playwright instalado.
//
// Comprueba: las competiciones, la lista de partidos y su estado, generar el carrusel (las 8
// slides, el titular, el minuto a minuto sin tarjetas pisadas, los onces, la clasificación),
// la firma, el jugador del partido, retocar textos, el borrador al recargar, el ZIP 4:5 y 9:16,
// compartir, el vídeo (guion, la mezcla y el MP4),
// «Para tu IA» (copiar y pegar), un partido en juego, uno sin alineaciones ni clasificación,
// las eliminatorias (campeón, global, quién pasa), saltar a un día con partidos, el modo en
// directo (vigilar, avisar y generar a un clic, con el vídeo), el enlace del pitido final (?partido=) y la
// función que avisa al móvil, el resumen de la jornada, «El dato», la versión en inglés,
// tu logo, el móvil y abierto como archivo (con doble clic en index.html, que es como se usa).
import { spawn, execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// (con fileURLToPath, también en Windows)
const REPO = resolve(fileURLToPath(new URL('..', import.meta.url)));
const FIX = join(REPO, 'tests', 'fixtures');
// Un tono de tantos segundos, en WAV y base64 (la voz de mentira del robot)
const wavTone = (secs, rate = 22050) => {
  const n = Math.round(secs * rate), b = Buffer.alloc(44 + n * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + n * 2, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
  b.writeUInt32LE(rate, 24); b.writeUInt32LE(rate * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) b.writeInt16LE(Math.round(6000 * Math.sin((2 * Math.PI * 220 * i) / rate)), 44 + i * 2);
  return b.toString('base64');
};

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
for (const [key, path] of [
  ['html2canvas', 'html2canvas/dist/html2canvas.min.js'],
  ['jszip', 'jszip/dist/jszip.min.js'],
  ['mp4-muxer', 'mp4-muxer/build/mp4-muxer.js'], // el mismo que sirve jsDelivr, sin minificar
]) {
  try {
    LIBS[key] = readFileSync(join(REPO, 'node_modules', path));
  } catch (e) {
    console.error(`Falta ${key}: npm install --no-save html2canvas@1.4.1 jszip@3.10.1 mp4-muxer@5.2.1`);
    process.exit(1);
  }
}

const port = 8900 + Math.floor(Math.random() * 90);
// Python (en Windows se llama python)
const PY = process.platform === 'win32' ? 'python' : 'python3';
const server = spawn(PY, ['-m', 'http.server', String(port), '--bind', '127.0.0.1', '--directory', REPO], { stdio: 'ignore' });
const base = `http://127.0.0.1:${port}`;
for (let i = 0; i < 50; i++) {
  try { if ((await fetch(`${base}/`)).ok) break; } catch (e) { /* aún arrancando */ }
  await new Promise((r) => setTimeout(r, 100));
}

const chromium = await loadChromium();
const browser = await chromium.launch({
  ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}),
});
const failures = [];
const errors = [];
const check = (ok, msg) => {
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${msg}`);
  if (!ok) failures.push(msg);
};
const PIXEL = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');
const json = (body, status = 200) => ({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body });

// strip: claves que se quitan del resumen de ESPN (para probar un partido con menos datos)
// url: por defecto, la página servida; con pathToFileURL, abierta como archivo (doble clic).
// before: lo que hay que preparar antes de abrir la página (la hora, rutas, el almacenamiento).
async function open({ strip = [], viewport = { width: 1280, height: 900 }, url = `${base}/`, before } = {}) {
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
    const league = parts[parts.length - 2];
    const team = u.pathname.match(/\/teams\/(\d+)\/schedule$/);
    // El resumen de un partido, la temporada de un equipo (para «El dato»), la clasificación aparte
    // o la jornada (sin fecha: la de ahora, con el calendario)
    const file = summary ? `sum-${u.searchParams.get('event')}.json`
      : team ? `tm-${team[1]}-${u.searchParams.get('season')}.json`
        : u.pathname.endsWith('/standings') ? `st-${league}.json` : `sb-${league}-${u.searchParams.get('dates') || 'cal'}.json`;
    if (!existsSync(join(FIX, file))) return r.fulfill(summary ? { status: 404, headers: { 'access-control-allow-origin': '*' }, body: '' } : json('{"events":[]}'));
    const data = JSON.parse(readFileSync(join(FIX, file)));
    strip.forEach((k) => delete data[k]);
    return r.fulfill(json(JSON.stringify(data)));
  });
  // Los logos de las competiciones, una imagen de 1 px (el resto de la red, cortada)
  await ctx.route('https://a.espncdn.com/i/leaguelogos/**', (r) => r.fulfill({ status: 200, contentType: 'image/png', headers: { 'access-control-allow-origin': '*' }, body: PIXEL }));
  await ctx.route('https://cdn.jsdelivr.net/**', (r) => {
    const key = Object.keys(LIBS).find((k) => r.request().url().includes(`/${k}@`));
    return key ? r.fulfill({ status: 200, contentType: 'application/javascript', body: LIBS[key] }) : r.abort();
  });
  // Las caras guardadas en el repo (caras/laliga.json), fuera: la prueba que las usa pone las suyas
  await ctx.route(`${base}/caras/laliga.json`, (r) => r.fulfill({ status: 404, body: '' }));
  if (before) await before(ctx);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error' && !/Failed to load resource|net::|Error loading image/.test(m.text())) errors.push(m.text());
  });
  await page.goto(url);
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
const pngSize = (path) => execFileSync(PY, ['-c', 'import struct,sys; d=open(sys.argv[1],"rb").read(24); print(*struct.unpack(">II", d[16:24]))', path]).toString().trim();

try {
  const { ctx, page } = await open();

  // ── Competiciones ──
  const chips = await page.$$eval('.comp-chip', (cs) => cs.map((c) => [c.dataset.league, c.getAttribute('aria-checked')]));
  check(chips.length >= 40 && chips.find(([l]) => l === 'esp.1')[1] === 'true', `${chips.length} competiciones y LaLiga marcada por defecto`);
  await page.waitForFunction(() => [...document.querySelectorAll('.comp-chip img')].every((i) => i.complete), null, { timeout: 10000 }).catch(() => {});
  check(await page.$$eval('.comp-chip img', (i) => i.length) >= 35, `con el logo de cada competición (${await page.$$eval('.comp-chip img', (i) => i.length)})`);

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
  check(names.join(',') === 'Portada,El dato,Minuto a minuto,Estadísticas,Mapa de tiros,Los onces,Jugador del partido,Clasificación,Cierre', `9 slides: ${names.join(', ')}`);
  check(await page.textContent('#slide-portada h1') === 'Remontada del Real Madrid', `titular: ${await page.textContent('#slide-portada h1')}`);
  const portada = await page.$$eval('#slide-portada .scorers', (els) => els.map((e) => [...e.children].map((d) => d.textContent).join(' · ')));
  check(portada[0] === "de Roon 20' · Malen 51', 57'" && /Mbappé 25'.*Rüdiger 90'/.test(portada[1]), `goleadores de cada equipo: ${portada.join(' / ')}`);
  check(/Champions League · Fase liga/.test(await page.textContent('#slide-portada .comp')), 'la competición y la fase en la portada');
  const look = await page.evaluate(() => ({
    seam: document.querySelector('#slide-portada .seam')?.textContent,
    balls: document.querySelectorAll('#slide-portada .scorers i.ball').length,
    art: [...document.querySelectorAll('#slidesPreview .slide')].map((s) => [...s.querySelectorAll('.fc-art')].filter((i) => i.src.startsWith('data:image/jpeg')).length),
  }));
  check(look.seam === 'Final' && look.balls === 6, `«Final» entre los marcadores y un balón por goleador (${look.seam} · ${look.balls})`);
  check(look.art.every((n) => n > 0) && look.art[0] === 2, `cada slide con su fondo pintado; la portada, uno por mitad (${look.art.join(' ')})`);
  // La descripción para TikTok: el gancho (el dato dicho entero, con quién) con el resultado, el mejor, la pregunta y los hashtags
  const caption = (await page.inputValue('#captionText')).split('\n');
  check(caption[0] === '🤯 Se acaba la racha de la Roma: 14 partidos sin perder · Roma 3-4 Real Madrid' && /^⭐ /.test(caption[1]) && /👇$/.test(caption[2])
    && caption[3] === '#futbol #championsleague #roma #realmadrid #deportesentiktok',
    `descripción para TikTok lista (${caption.join(' | ')})`);
  // El estilo: claro por defecto; en oscuro, las slides de datos cambian de fondo (sin volver a pedir nada)
  const sheets = () => page.evaluate(() => ({
    night: ['crono', 'tiros', 'tabla'].filter((id) => document.querySelector(`#slide-${id} .fc-in.paper.night`)).length,
    paper: ['crono', 'tiros', 'tabla'].filter((id) => document.querySelector(`#slide-${id} .fc-in.paper`)).length,
    slides: document.querySelectorAll('#slidesPreview .slide').length,
  }));
  const day = await sheets();
  await page.click('[data-theme="oscuro"]');
  const night = await sheets();
  await page.click('[data-theme="claro"]');
  const back = await sheets();
  check(day.night === 0 && day.paper === 3 && night.night === 3 && night.slides === 9 && back.night === 0,
    `estilo claro por defecto y, al elegir oscuro, las slides de datos en oscuro (${night.night}/3)`);
  const tease = await page.$$eval('#slide-portada .tease > span', (s) => s.map((x) => x.textContent));
  check(tease[0] === 'El dato' && tease[1] === '14 partidos sin perder… hasta hoy', `y abajo, para deslizar, el dato a medias (${tease.join(' · ')})`);

  // El dato: del historial de ESPN de los dos equipos (la Roma venía de 14 sin perder)
  const dato = await page.evaluate(() => ({
    big: document.querySelector('#slide-dato .dt-big')?.textContent,
    unit: document.querySelector('#slide-dato .dt-unit')?.textContent,
    line: document.querySelector('#slide-dato .dt-line')?.textContent,
    more: [...document.querySelectorAll('#slide-dato .dt-more div')].map((d) => d.textContent),
  }));
  check(dato.big === '14' && dato.unit === 'partidos sin perder… hasta hoy' && dato.line === 'Se acaba la racha de la Roma: 14 partidos sin perder en todas las competiciones.',
    `el dato: ${dato.big} · ${dato.unit} · ${dato.line}`);
  check(dato.more.includes('El Real Madrid gana sus últimos 5 partidos ante la Roma.'), `y los otros datos (${dato.more.join(' · ')})`);

  // Minuto a minuto: 7 goles con su marcador, las amarillas y los cambios en pequeño, nada
  // pisado (ni entre ellos ni con las marcas) y cada uno en su parte (nada de la segunda antes
  // del descanso)
  const crono = await page.$eval('#slide-crono', (slide) => {
    const box = (el) => ({ top: el.offsetTop, bottom: el.offsetTop + el.offsetHeight, left: el.offsetLeft, right: el.offsetLeft + el.offsetWidth });
    const evs = [...slide.querySelectorAll('.ev')].map((e) => ({
      ...box(e), side: e.classList.contains('l') ? 'l' : 'r', tiny: e.classList.contains('tiny'), sc: e.querySelector('.sc')?.textContent,
      second: !/^45\+/.test(e.querySelector('.min').textContent) && parseInt(e.querySelector('.min').textContent, 10) > 45,
      yellow: !!e.querySelector('.card:not(.red)'), sub: !!e.querySelector('.arr.in'),
    }));
    const marks = [...slide.querySelectorAll('.ht')].map((e) => ({ top: e.offsetTop - e.offsetHeight / 2, bottom: e.offsetTop + e.offsetHeight / 2, text: e.textContent }));
    const ht = marks.find((k) => /Descanso/.test(k.text));
    let clash = 0;
    for (const a of evs) {
      for (const b of evs) if (a !== b && a.side === b.side && a.top < b.bottom && b.top < a.bottom) clash++;
      for (const k of marks) if (a.top < k.bottom && k.top < a.bottom) clash++;
    }
    const goals = evs.filter((e) => !e.tiny);
    return {
      n: goals.length, tiny: evs.length - goals.length, yellows: evs.filter((e) => e.yellow).length, subs: evs.filter((e) => e.sub).length,
      wrongHalf: evs.filter((e) => (e.second ? e.top < ht.top : e.bottom > ht.bottom)).length,
      last: goals.map((e) => e.sc).filter(Boolean).pop(), clash, marks: marks.map((k) => k.text),
    };
  });
  check(crono.n === 7 && crono.clash === 0, `minuto a minuto: ${crono.n} goles sin pisarse (${crono.clash} choques)`);
  check(crono.yellows === 4 && crono.subs === 4 && crono.wrongHalf === 0,
    `con las amarillas (${crono.yellows}) y los cambios (${crono.subs}), cada uno en su parte (${crono.wrongHalf} fuera de sitio)`);
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
  check(signs.length === 9 && signs.every((t) => t === '@toni_futbol'), `la firma sale en las 9 slides (${signs.length})`);

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
  check(one.suggestedFilename() === 'futbol-roma-rma-2026-10-14-05-tiros.png', `PNG suelta: ${one.suggestedFilename()}`);
  const dir = mkdtempSync(join(tmpdir(), 'fc-studio-'));
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 120000 }), page.click('#downloadBtn')]);
  const zipPath = join(dir, dl.suggestedFilename());
  await dl.saveAs(zipPath);
  const entries = JSON.parse(execFileSync(PY, ['-c', 'import json,sys,zipfile; z=zipfile.ZipFile(sys.argv[1]); print(json.dumps([z.namelist(), z.read("caption.txt").decode()]))', zipPath]).toString());
  check(dl.suggestedFilename() === 'futbol-roma-rma-2026-10-14.zip' && entries[0].filter((n) => n.endsWith('.png')).length === 9, `ZIP con 9 PNG (${dl.suggestedFilename()})`);
  check(/ROMA 3-4 REAL MADRID/.test(entries[1]) && /#ChampionsLeague/.test(entries[1]) && /📊 Se acaba la racha de la Roma/.test(entries[1]), 'con el pie de foto (y el dato)');
  const [dlv] = await Promise.all([page.waitForEvent('download', { timeout: 120000 }), page.click('#downloadVerticalBtn')]);
  const vPath = join(dir, dlv.suggestedFilename());
  await dlv.saveAs(vPath);
  execFileSync(PY, ['-c', 'import sys,zipfile; z=zipfile.ZipFile(sys.argv[1]); open(sys.argv[2],"wb").write(z.read([n for n in z.namelist() if n.endswith(".png")][0]))', vPath, join(dir, 'v.png')]);
  check(pngSize(join(dir, 'v.png')) === '1080 1920', `9:16: ${pngSize(join(dir, 'v.png'))}`);

  // ── Compartir en dos toques ──
  await page.click('#shareCarouselBtn');
  await page.waitForFunction(() => /Toca para compartir/.test(document.querySelector('#shareCarouselBtn .label').textContent), null, { timeout: 120000 });
  await page.click('#shareCarouselBtn');
  check((await page.evaluate(() => window.__shared))[0] === 9, 'compartir manda las 9 imágenes');

  // ── El vídeo: guion automático, la mezcla y el MP4 ──
  const script = await page.$$eval('#scriptLines .script-line', (ls) => ls.map((l) => [l.dataset.scene, l.querySelector('textarea').value, l.querySelector('.script-fit').className]));
  // El marcador, el partido entero (los goles y los tiros, en su minuto), el mejor, la posesión,
  // la tabla, el dato y el cierre
  check(script.map(([id]) => id).join(',') === 'score,goals,jugador,stats,tabla,dato,outro', `guion: una frase por escena (${script.map(([id]) => id).join(', ')})`);
  const told = Object.fromEntries(script.map(([id, line]) => [id, line]));
  check(told.score === 'Remontada del Real Madrid: 4-3 a la Roma.' && told.dato === 'Se acaba la racha de la Roma: 14 partidos sin perder.',
    `y escrita con los datos (${told.score} · ${told.dato})`);
  // Que cuente el partido, no una lista de datos: la remontada (los tiros, solo si dicen algo que no
  // dicen los contadores: 4 goles con 8 a puerta no es «pegada»), el doblete del mejor (sus goles
  // no los había contado la frase del partido), a quién no le sirvió el balón (en la escena de la
  // posesión, sin el porcentaje, que ya sale en pantalla y no cabe) y dónde se queda
  check(told.goals === 'La Roma se adelantó con de Roon y llegó a ir ganando de dos, pero el Real Madrid le dio la vuelta con un gol de Rüdiger en el 90.'
    && told.stats === 'La Roma tuvo más el balón, pero no le sirvió.'
    && told.jugador === 'Malen, el mejor del partido: doblete y 3 de 4 tiros a puerta.'
    && told.tabla === 'El Real Madrid, octavo.',
    `y cuenta el partido (${['goals', 'stats', 'jugador', 'tabla'].map((id) => told[id]).join(' · ')})`);
  check(script.every(([, line, cls]) => !line || /ok/.test(cls)), 'todas caben a ritmo normal');
  await page.fill('#scriptLines textarea[data-scene="outro"]', '¿Mbappé o Malen?');
  await page.waitForTimeout(700);

  check(!(await page.$('#voiceRecBtn')) && !(await page.$('#prompter')), 'sin «Grabar mi voz» ni teleprompter (la voz la pone el robot)');

  // Sin música ni subtítulos por defecto (en TikTok se pone un sonido); si se activa, la urbana,
  // y la épica se elige y se recuerda.
  const mixDuration = () => page.evaluate(async () => {
    const a = document.getElementById('mixPlayer');
    await new Promise((r) => (a.readyState >= 1 ? r() : a.addEventListener('loadedmetadata', r, { once: true })));
    return a.duration;
  });
  check(await page.getAttribute('.lang-opt[data-music="trap"]', 'aria-checked') === 'true' && await page.isHidden('#mixResetBtn'), 'la música, urbana por defecto');
  check(await page.getAttribute('.lang-opt[data-voz="no"]', 'aria-checked') === 'true' && await page.inputValue('#voiceKeyInput') === '',
    'y «Sin voz ni subtítulos» por defecto, mientras se mejora la voz');
  check(!(await page.isChecked('#videoMusic')) && await page.isDisabled('#musicVol'), 'y sin música por defecto (en TikTok se pone un sonido)');
  await page.check('#videoMusic');
  await page.click('#mixPreviewBtn');
  // (la mezcla de un minuto tarda: en Chrome, unos 2-3 minutos)
  await page.waitForFunction(() => !document.getElementById('mixPlayer').hidden, null, { timeout: 300000 });
  const trapLen = await mixDuration();
  check(trapLen > 58.6 && trapLen < 59.8, `«Escuchar la mezcla» prepara la urbana (${trapLen.toFixed(1)} s)`);

  // Con voz y subtítulos, a mano: el Studio le pide la voz al servicio de Modal con tu clave (aquí,
  // uno de mentira: un tono de 1 s por frase, que cabe en cada escena sin alargarla)
  const voiceAsked = [];
  await ctx.route(/jornada90-voz-navegador\.us-east\.modal\.run/, (r) => {
    const body = JSON.parse(r.request().postData());
    voiceAsked.push({ type: r.request().headers()['content-type'], body });
    return r.fulfill(json(JSON.stringify(Object.fromEntries(body.lines.map((l) => [l.id, { audio: wavTone(1), times: null }])))));
  });
  await page.fill('#voiceKeyInput', 'clave-de-prueba');
  await page.click('.lang-opt[data-voz="si"]');
  // Cuántos canvas se crean mientras se hace el vídeo: con uno nuevo por fotograma (los fondos
  // cacheados por el tamaño de la pantalla, que cambia con la cámara) el iPhone se quedaba sin
  // memoria y Safari cerraba la página.
  await page.evaluate(() => {
    // Lo que le llega al vídeo (para ver la portada)
    const render = window.StudioVideo.render;
    window.StudioVideo.render = (data, ...rest) => { window.__videoData = data; return render(data, ...rest); };
    window.__canvases = 0;
    const orig = document.createElement.bind(document);
    document.createElement = (tag, ...rest) => {
      if (String(tag).toLowerCase() === 'canvas') window.__canvases++;
      return orig(tag, ...rest);
    };
  });
  await page.click('#videoBtn');
  await page.waitForFunction(() => !document.getElementById('videoOut').hidden || /No se pudo/.test(document.getElementById('toast').textContent), null, { timeout: 400000 });
  const canvases = await page.evaluate(() => ({ made: window.__canvases, cached: window.StudioVideo.layerCount() }));
  check(canvases.made < 40 && canvases.cached <= 16, `sin comerse la memoria: ${canvases.made} canvas para todo el vídeo, ${canvases.cached} capas guardadas`);
  const video = await page.evaluate(async () => {
    const v = document.getElementById('videoPreview');
    if (!v.src) return { toast: document.getElementById('toast').textContent };
    await new Promise((r) => (v.readyState >= 1 ? r() : v.addEventListener('loadedmetadata', r, { once: true })));
    return { name: document.getElementById('videoDlBtn').download, duration: v.duration, meta: document.getElementById('videoMeta').textContent, toast: document.getElementById('toast').textContent };
  });
  check(/^futbol-roma-rma-2026-10-14-short\.(mp4|webm)$/.test(video.name || ''), `vídeo: ${video.name} (${video.toast})`);
  check(video.duration > 58.6 && video.duration < 59.8, `dura unos 59 s: el aviso, el marcador, el partido (con los onces y 7 goles), 4 escenas, el cierre y la de tu logo (${video.duration?.toFixed(1)} s)`);
  check(video.meta === 'Lleva la voz, música urbana, subtítulos y la apertura con el aviso.', `con voz y subtítulos, lleva todo (${video.meta})`);
  const asked = voiceAsked[0]?.body;
  check(voiceAsked.length === 1 && voiceAsked[0].type.startsWith('text/plain') && asked.token === 'clave-de-prueba'
    && asked.lines[0].id === 'score' && asked.lines[0].text === 'Remontada del Real Madrid: 4 a 3 a la Roma.' && asked.lines.at(-1).text === '¿Mbappé o Malen?',
    `la voz, al servicio de Modal con tu clave y en texto plano (sin preguntar antes por CORS), con «4-3» dicho «4 a 3» (${asked?.lines.map((l) => l.id).join(', ')})`);
  // La portada del vídeo dice de quién es el dato, no solo «14 partidos sin perder… hasta hoy»
  const hook = await page.evaluate(() => window.__videoData?.hook);
  check(hook?.tag === 'El dato' && hook.text === 'Se acaba la racha de la Roma: 14 partidos sin perder', `la portada del vídeo dice de quién es el dato (${hook?.tag} · ${hook?.text})`);
  // El pulso del partido: lo que apretaba cada uno, minuto a minuto, de la narración de ESPN
  const pulse = await page.evaluate(() => window.__videoData?.pulse && { n: window.__videoData.pulse.home.length, home: window.__videoData.pulse.home.some((v) => v > 0), away: window.__videoData.pulse.away.some((v) => v > 0) });
  check(pulse?.n === 91 && pulse.home && pulse.away, `y el pulso del partido, minuto a minuto (${JSON.stringify(pulse)})`);
  const videoData = await page.evaluate(() => window.__videoData);
  // El territorio: el sitio de cada suceso de la narración, con quién tenía el balón, y quién
  // empujaba minuto a minuto; en el vídeo, cada gol y casi todos los tiros caen en el color de su
  // equipo (la ola saca una lengua hasta su sitio)
  const terr = videoData.territory;
  check(terr?.push.length === 91 && terr.spots.length >= 25 && new Set(terr.spots.map((x) => x[3])).size === 2 && terr.spots.every((x) => x[1] >= 0 && x[1] <= 100),
    `el territorio: ${terr?.spots.length} sucesos con su sitio y quién tenía el balón, y quién empujaba cada minuto`);
  const probe = await page.evaluate((d) => window.StudioVideo.probe(d), videoData);
  const shotsOk = probe && probe.filter((x) => x.ok).length, goalsOk = probe && probe.filter((x) => x.goal).every((x) => x.ok);
  check(probe && goalsOk && shotsOk / probe.length >= 0.85, `y en el vídeo cada gol y casi todos los tiros caen en el color de su equipo (${shotsOk} de ${probe?.length})`);
  // Los jugadores: los dos onces en su sitio (el portero, junto a su portería), con quién los
  // cambió; y el id de cada gol, tarjeta y cambio, para poner su cara
  const lu = videoData.lineups;
  check(lu?.home.length === 11 && lu.away.length === 11 && [...lu.home, ...lu.away].every((p) => p.x > 0 && p.x < 1 && p.y > 0 && p.y < 1) && lu.home[0].y < 0.1 && lu.away[0].y < 0.1,
    `los onces del vídeo, cada uno en su sitio (${lu?.home.map((p) => p.last).join(', ')})`);
  const evs = videoData.goals;
  check(evs.filter((e) => e.kind === 'goal' && !e.own).every((e) => videoData.people[e.pid]) && evs.filter((e) => e.kind === 'sub').every((e) => videoData.people[e.pid] && videoData.people[e.pid2]) && lu.home.some((p) => p.on),
    'y la cara de cada goleador y de cada cambio (y quién entró por quién)');
  // El orden: el partido, el mejor del partido, la posesión, la tabla, el dato y la pregunta
  const order = await page.evaluate((d) => window.StudioVideo.plan(d, null).map((x) => x.id).join(','), videoData);
  check(order === 'score,goals,jugador,stats,tabla,dato,outro', `las escenas, en su orden (${order})`);
  // La apertura con el aviso del móvil (encendida por defecto): un compás
  const lens = await page.evaluate(() => [window.StudioVideo.length(window.__videoData, false), window.StudioVideo.length(window.__videoData, true)]);
  check(await page.isChecked('#videoIntro') && Math.abs(lens[1] - lens[0] - 1.6) < 0.01, `la apertura con el aviso del móvil, encendida por defecto, es un compás (${lens.map((x) => x.toFixed(1)).join(' → ')} s)`);
  await page.click('.lang-opt[data-music="epica"]');
  check(await page.isHidden('#mixPlayer') && await page.isVisible('#mixResetBtn'), 'al cambiar a la épica, la mezcla se rehace y sale «↺ Por defecto»');
  await page.click('#mixPreviewBtn');
  await page.waitForFunction(() => !document.getElementById('mixPlayer').hidden, null, { timeout: 300000 });
  const epicLen = await mixDuration();
  check(epicLen > 58.6 && epicLen < 59.8, `y la épica dura lo mismo (${epicLen.toFixed(1)} s)`);
  // La versión larga (TikTok solo paga a partir del minuto): más escenas si hay datos y cada una
  // algo más en pantalla, en compases enteros, hasta pasar del minuto
  const secs = () => page.$$eval('#scriptLines .script-line', (ls) => ls.map((l) => [l.dataset.scene, parseFloat(l.querySelector('small').textContent.replace(',', '.'))]));
  const shortScenes = await secs();
  const shortTotal = await page.textContent('#scriptTotal');
  await page.check('#videoLong');
  const longScenes = await secs();
  const longTotal = await page.textContent('#scriptTotal');
  const bars = longScenes.every(([, t]) => Math.abs(t / 1.6 - Math.round(t / 1.6)) < 0.05);
  check(shortTotal === 'El vídeo dura 59 s.' && longTotal === 'El vídeo dura 1:02.' && longScenes.length >= shortScenes.length && bars,
    `«Versión larga (+1 min)»: ${shortTotal} → ${longTotal} (${longScenes.map(([id, t]) => `${id} ${t}`).join(' · ')})`);
  await page.uncheck('#videoLong');
  check((await secs()).join() === shortScenes.join() && await page.textContent('#scriptTotal') === shortTotal, 'y al quitarla, el vídeo de siempre');
  await page.click('.lang-opt[data-voz="no"]');
  // En el iPhone salía mudo: el AudioEncoder de Safari da para el AAC una descripción que no es la
  // AudioSpecificConfig (WebKit 302253). Con uno de mentira que hace lo mismo, el MP4 tiene que
  // llevar la buena (AAC-LC, 48 kHz, estéreo: 11 90).
  await page.evaluate(() => {
    const bogus = new Uint8Array([3, 25, 0, 0, 0, 4, 17, 64, 21, 0, 0, 0, 0, 1, 244, 0, 0, 1, 244, 0, 5, 2, 17, 144, 6, 1, 2]);
    window.AudioEncoder = class {
      constructor({ output }) { this.output = output; this.first = true; }
      static async isConfigSupported(c) { return { supported: c.codec === 'mp4a.40.2', config: c }; }
      configure(c) { this.c = c; }
      encode(data) {
        const chunk = new EncodedAudioChunk({ type: 'key', timestamp: data.timestamp, duration: Math.round((data.numberOfFrames / data.sampleRate) * 1e6), data: new Uint8Array(8) });
        this.output(chunk, this.first ? { decoderConfig: { codec: 'mp4a.40.2', sampleRate: this.c.sampleRate, numberOfChannels: 2, description: bogus } } : undefined);
        this.first = false;
      }
      async flush() {}
      close() {}
    };
  });
  await page.click('#videoBtn');
  await page.waitForFunction(() => !document.getElementById('videoBtn').classList.contains('btn-loading'), null, { timeout: 400000 });
  const asc = await page.evaluate(async () => {
    const b = new Uint8Array(await (await fetch(document.getElementById('videoDlBtn').href)).arrayBuffer());
    // La caja esds y, dentro, la etiqueta 5 (DecoderSpecificInfo): su largo y sus bytes
    let i = 0;
    while (i < b.length - 4 && !(b[i] === 0x65 && b[i + 1] === 0x73 && b[i + 2] === 0x64 && b[i + 3] === 0x73)) i++;
    if (i >= b.length - 4) return 'sin esds';
    for (let j = i; j < i + 80; j++) {
      if (b[j] === 0x05 && b[j + 1] === 0x80 && b[j + 2] === 0x80 && b[j + 3] === 0x80) {
        return [...b.subarray(j + 5, j + 5 + b[j + 4])].map((x) => x.toString(16).padStart(2, '0')).join(' ');
      }
    }
    return 'sin configuración';
  });
  check(asc === '11 90', `con el AAC de Safari, el MP4 lleva la configuración buena y suena (${asc})`);
  check(await page.textContent('#videoMeta') === 'Lleva música épica y la apertura con el aviso.' && voiceAsked.length === 1,
    `«Sin voz ni subtítulos»: sin pedir la voz, y el vídeo lo dice (${await page.textContent('#videoMeta')})`);
  await page.click('.lang-opt[data-voz="si"]');
  await page.reload();
  await page.waitForSelector('#slide-portada');
  await page.waitForTimeout(500);
  check(await page.inputValue('#scriptLines textarea[data-scene="outro"]') === '¿Mbappé o Malen?', 'al recargar sigue el guion retocado');
  check(await page.getAttribute('.lang-opt[data-music="epica"]', 'aria-checked') === 'true' && await page.getAttribute('.lang-opt[data-voz="si"]', 'aria-checked') === 'true'
    && await page.isChecked('#videoMusic') && await page.inputValue('#voiceKeyInput') === 'clave-de-prueba',
    'y la música (activada y la elegida), «Con voz y subtítulos» y tu clave de la voz');
  await page.click('.lang-opt[data-voz="no"]');
  await page.click('#mixResetBtn');
  check(await page.getAttribute('.lang-opt[data-music="trap"]', 'aria-checked') === 'true' && await page.isHidden('#mixResetBtn'), '«↺ Por defecto» vuelve a la urbana');

  // ── Para tu IA: copiar el contexto y pegar la respuesta ──
  await page.click('#aiBriefBtn');
  const brief = await page.evaluate(() => navigator.clipboard.readText());
  check(/Studio Fútbol · contexto para tu IA/.test(brief) && /\*\*Partido:\*\* Roma 3 – 4 Real Madrid · Champions League/.test(brief)
    && /- Marcador \(1,6 s\): Remontada del Real Madrid/.test(brief) && /@toni_futbol/.test(brief) && /\*\*El dato\*\*[^\n]*\n- Se acaba la racha de la Roma/.test(brief),
    '«Para tu IA» copia qué es el Studio, el partido, el dato y el guion');
  await page.evaluate(() => navigator.clipboard.writeText('Claro, aquí va:\n\n```\nTITULAR: Locura en Roma\n**Los goles:** «Siete goles y Malen, doblete.»\n- Cierre: ¿Te esperabas esto?\n```'));
  await page.click('#aiPasteBtn');
  await page.waitForSelector('#aiPasteDialog[open]');
  await page.click('#aiPasteApply');
  await page.waitForFunction(() => !document.getElementById('aiPasteDialog').open);
  const pasted = await page.evaluate(() => ({
    h1: document.querySelector('#slide-portada h1').textContent,
    goals: document.querySelector('#scriptLines textarea[data-scene="goals"]').value,
    outro: document.querySelector('#scriptLines textarea[data-scene="outro"]').value,
    toast: document.getElementById('toast').textContent,
  }));
  check(pasted.h1 === 'Locura en Roma' && pasted.goals === 'Siete goles y Malen, doblete.' && pasted.outro === '¿Te esperabas esto?' && /Colocado/.test(pasted.toast),
    `«Pegar de tu IA» coloca el titular y las frases del guion (${pasted.toast})`);

  // ── LASK 3-6 Liverpool: goleada y defensa de 5 ──
  await pickDate(page, '2026-10-14');
  let discard = '';
  page.once('dialog', (dlg) => { discard = dlg.message(); dlg.accept(); });
  await generate(page, '401915415');
  check(/Se perderán los textos/.test(discard), 'generar otro partido con retoques pregunta antes');
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
    const { ctx: c2, page: p2 } = await open({
      strip: ['rosters', 'commentary', 'standings'],
      // y sin la clasificación aparte (la que se pide cuando el resumen no la trae)
      before: (ctx) => ctx.route('https://site.api.espn.com/apis/v2/**', (r) => r.fulfill(json('{}'))),
    });
    await pickDate(p2, '2026-09-20');
    await generate(p2, '401882865');
    const n2 = await slideNames(p2);
    check(n2.join(',') === 'Portada,Minuto a minuto,Estadísticas,Cierre', `sin esos datos, solo las slides que se pueden hacer: ${n2.join(', ')}`);
    check(await p2.textContent('#slide-portada h1') === 'El Atlético gana por la mínima', `y el titular sale igual: ${await p2.textContent('#slide-portada h1')}`);
    await c2.close();
  }

  // ── Eliminatorias, finales y competiciones con pocos datos ──
  {
    const { ctx: c5, page: p5 } = await open();
    const tie = async (sel) => p5.textContent(sel).catch(() => '');
    // Un día sin partidos: botones al día con partidos más cercano (el Mundial, a la final)
    await pickLeague(p5, 'fifa.world');
    await p5.waitForSelector('.day-jump', { timeout: 10000 }).catch(() => {});
    const jumps = await p5.$$eval('.day-jump', (b) => b.map((x) => x.dataset.day));
    check(jumps.includes('2026-07-19'), `sin partidos ese día: salta al más cercano (${jumps.join(', ')})`);
    await p5.click('.day-jump[data-day="2026-07-19"]');
    await p5.waitForSelector('.game-card[data-game-id="760517"]', { timeout: 10000 });
    await generate(p5, '760517');
    check(await tie('#slide-portada h1') === 'España, campeona' && /Mundial · Final/.test(await tie('#slide-portada .comp')),
      `la final del Mundial: «${await tie('#slide-portada h1')}» (${await tie('#slide-portada .comp')})`);
    const crono5 = await p5.$$eval('#slide-crono .ht', (h) => h.map((x) => x.textContent));
    check(crono5.includes('Prórroga') && crono5.includes('Final · 1-0'), `con prórroga en el minuto a minuto (${crono5.join(' | ')})`);

    // La vuelta de una eliminatoria: el global y quién pasa
    await pickLeague(p5, 'conmebol.libertadores');
    await pickDate(p5, '2026-09-17');
    check(await tie('.game-card[data-game-id="401912526"] .game-tie') === 'Cuartos · Vuelta · Global 3-1', `la tarjeta del partido: ${await tie('.game-card[data-game-id="401912526"] .game-tie')}`);
    await generate(p5, '401912526');
    check(await tie('#slide-portada h1') === 'El Flamengo pasa a semifinales' && await tie('#slide-portada .agg') === 'Global 3-1',
      `Libertadores, vuelta: «${await tie('#slide-portada h1')}» · ${await tie('#slide-portada .agg')}`);
    check(/^El Flamengo pasa a semifinales: 3-1 en el global\./.test(await p5.$eval('#scriptLines textarea', (t) => t.value)), 'y el guion lo cuenta con el global');

    // Copa del Rey sin datos de ESPN: solo la portada y el cierre (nada de «Sin goles» con 3-3)
    await pickLeague(p5, 'esp.copa_del_rey');
    await pickDate(p5, '2026-10-11');
    await generate(p5, '401918758');
    check((await slideNames(p5)).join(',') === 'Portada,Cierre' && await tie('#slide-portada h1') === 'El Hortaleza pasa la eliminatoria',
      `copa sin datos: ${(await slideNames(p5)).join(', ')} · «${await tie('#slide-portada h1')}»`);

    // Europa League: la clasificación no viene en el resumen y se pide aparte
    await pickLeague(p5, 'uefa.europa');
    await pickDate(p5, '2026-10-15');
    await generate(p5, '401915576');
    check((await slideNames(p5)).includes('Clasificación') && /Así va\s*la Europa League/.test(await tie('#slide-tabla h1')),
      'Europa League: con la clasificación (pedida aparte)');

    // Copa de Alemania: un apellido con «ß» (Meißner, en los goleadores de la portada) no rompe la
    // captura (html2canvas se rompía con las letras que cambian de largo al pasar a mayúsculas)
    await pickLeague(p5, 'ger.dfb_pokal');
    await pickDate(p5, '2026-09-02');
    await generate(p5, '401875174');
    const meissner = /MEISSNER|Meißner/i.test(await p5.textContent('#slide-portada'));
    const [png5] = await Promise.all([p5.waitForEvent('download', { timeout: 90000 }), p5.click('[data-slide-id="portada"] .slide-dl-btn')]);
    check(meissner && /\.png$/.test(png5.suggestedFilename()), `con «ß» en un apellido, la portada se descarga (${png5.suggestedFilename()})`);
    await c5.close();
  }

  // ── En directo: vigila, avisa cuando acaba un partido y lo genera a un clic ──
  {
    // El Depor-Levante va 74' en la primera vuelta y está acabado en la siguiente.
    const sb = JSON.parse(readFileSync(join(FIX, 'sb-esp.1-20261016.json')));
    const ended = JSON.parse(JSON.stringify(sb));
    for (const e of ended.events) {
      if (e.id !== '401882844') continue;
      const st = { ...e.status, displayClock: "90'+4'", type: { ...e.status.type, name: 'STATUS_FULL_TIME', state: 'post', completed: true, description: 'Full Time' } };
      e.status = st;
      e.competitions[0].status = st;
    }
    let polls = 0;
    const { ctx: c6, page: p6 } = await open({
      before: async (ctx) => {
        await ctx.clock.setFixedTime(new Date('2026-10-16T20:30:00+02:00'));
        await ctx.addInitScript(() => { if (!sessionStorage.getItem('seeded')) { sessionStorage.setItem('seeded', '1'); localStorage.setItem('fc-live', JSON.stringify({ on: true, leagues: ['esp.1'] })); } });
        await ctx.route('https://site.api.espn.com/apis/site/v2/sports/soccer/esp.1/scoreboard?dates=20261016', (r) => r.fulfill(json(JSON.stringify(polls++ ? ended : sb))));
      },
    });
    const card = '#liveList .live-card[data-game-id="401882844"]';
    await p6.waitForSelector(card, { timeout: 10000 });
    check(await p6.textContent(`${card} .game-status`) === "En juego · 74'" && /Vigilando/.test(await p6.textContent('#liveSub')),
      `en directo: vigila LaLiga y ve el Depor-Levante en juego (${await p6.textContent(`${card} .game-status`)})`);
    await p6.click('#liveRefresh');
    await p6.waitForSelector(`${card}.fresh`, { timeout: 10000 }).catch(() => {});
    const alert6 = { status: await p6.textContent(`${card} .game-status`), title: await p6.title(), toast: await p6.textContent('#toast') };
    check(alert6.status === 'Final' && /^\(1\) Final · Depor/.test(alert6.title) && /Final: Depor/.test(alert6.toast),
      `cuando acaba, avisa en la tarjeta, la pestaña y el aviso (${alert6.title} · ${alert6.toast})`);
    p6.once('dialog', (d) => d.accept());
    await p6.click(`${card} [data-open]`);
    await p6.waitForSelector('#slide-portada', { timeout: 20000 }).catch(() => {});
    check(await p6.$eval('#gamesList .game-card.selected', (c) => c.dataset.gameId).catch(() => '') === '401882844' && !!(await p6.$('#slide-portada')) && !/^\(/.test(await p6.title()),
      'y a un clic lo genera (la competición, el día y el partido, solos)');
    await p6.waitForSelector('#videoBtn.btn-loading', { timeout: 20000 }).catch(() => {});
    check(!!(await p6.$('#videoBtn.btn-loading')), 'y empieza a crear el vídeo sin otro clic');
    await p6.click('.live-switch');
    check(await p6.$$eval('#liveList .live-card', (c) => c.length) === 0 && JSON.parse(await p6.evaluate(() => localStorage.getItem('fc-live'))).on === false,
      'apagarlo deja de vigilar y se recuerda');
    await c6.close();
  }

  // ── Al pitido final: el enlace del aviso lo genera todo solo ──
  {
    // El aviso llega al acabar: el Depor-Levante, ya acabado (sin la pregunta de «aún se está
    // jugando»; y si saliera alguna, se acepta desde que existe la página, antes de cargar).
    const sbEnded = JSON.parse(readFileSync(join(FIX, 'sb-esp.1-20261016.json')));
    for (const e of sbEnded.events) {
      if (e.id !== '401882844') continue;
      e.status = { ...e.status, displayClock: "90'+4'", type: { ...e.status.type, name: 'STATUS_FULL_TIME', state: 'post', completed: true, description: 'Full Time' } };
      e.competitions[0].status = e.status;
    }
    // Con la voz del robot (tools/piloto.mjs; con &voz=si, el botón «Con voz y subtítulos» del
    // aviso): aquí, un tono por frase, la de los goles de 30 s (no cabe en su escena) y las demás de
    // 1,2 s, con el tiempo de cada palabra
    const asked = [];
    const { ctx: c7, page: p7 } = await open({
      url: `${base}/?partido=esp.1/401882844&dia=2026-10-16&voz=si`,
      before: async (ctx) => {
        ctx.on('page', (pg) => pg.on('dialog', (d) => d.accept()));
        await ctx.exposeFunction('fsVoz', async (lines) => {
          asked.push(lines);
          return Object.fromEntries(lines.map((l) => {
            const secs = l.id === 'goals' ? 30 : 1.2, n = l.text.split(/\s+/).length;
            return [l.id, { audio: wavTone(secs), times: [...Array(n)].map((_, i) => [(i * secs) / n, ((i + 1) * secs) / n]) }];
          }));
        });
        await ctx.clock.setFixedTime(new Date('2026-10-17T10:00:00+02:00'));
        await ctx.route('https://site.api.espn.com/apis/site/v2/sports/soccer/esp.1/scoreboard?dates=20261016', (r) => r.fulfill(json(JSON.stringify(sbEnded))));
      },
    });
    await p7.waitForSelector('#slide-portada', { timeout: 30000 }).catch(() => {});
    const link = await p7.evaluate(() => ({
      league: document.querySelector('.comp-chip[aria-checked="true"]')?.dataset.league,
      date: document.getElementById('dateInput').value,
      game: document.querySelector('#gamesList .game-card.selected')?.dataset.gameId,
      search: location.search,
      caption: document.getElementById('captionText').value.split('\n')[0],
    }));
    check(link.league === 'esp.1' && link.date === '2026-10-16' && link.game === '401882844' && link.search === '',
      `el enlace ?partido= elige la competición, el día y el partido, y se borra de la barra (${link.league} · ${link.date} · ${link.game})`);
    await p7.waitForSelector('#videoBtn.btn-loading', { timeout: 20000 }).catch(() => {});
    check(!!(await p7.$('#slide-portada')) && /Depor 1-0 Levante/.test(link.caption) && !!(await p7.$('#videoBtn.btn-loading')),
      `genera el carrusel, la descripción y empieza el vídeo (${link.caption})`);
    await p7.waitForFunction(() => !document.getElementById('videoOut').hidden || /No se pudo/.test(document.getElementById('toast').textContent), null, { timeout: 400000 });
    const voiced = await p7.evaluate(async () => {
      const v = document.getElementById('videoPreview');
      if (!v.src) return { toast: document.getElementById('toast').textContent };
      await new Promise((r) => (v.readyState >= 1 ? r() : v.addEventListener('loadedmetadata', r, { once: true })));
      const b = new Uint8Array(await (await fetch(v.src)).arrayBuffer());
      return { meta: document.getElementById('videoMeta').textContent, duration: v.duration, total: document.getElementById('scriptTotal').textContent,
        goals: parseFloat(document.querySelector('#scriptLines .script-line[data-scene="goals"] small').textContent.replace(',', '.')),
        score: parseFloat(document.querySelector('#scriptLines .script-line[data-scene="score"] small').textContent.replace(',', '.')),
        audio: /mp4a|Opus/.test(new TextDecoder('latin1').decode(b)) }; // AAC, u Opus en el Chromium sin códecs propietarios
    });
    // Sin voz, lo de siempre (redondeado); con ella, la escena de los goles crece en compases (1,6 s)
    // hasta que caben sus 30 s de frase (y la portada, de un compás, uno más para la suya)
    const plain = Number(voiced.total?.match(/(\d+) s/)?.[1]);
    const fitGrow = (secs, dur) => Math.max(0, Math.ceil((0.15 + secs + 0.35 - dur) / 1.6 - 1e-6) * 1.6);
    const grow = fitGrow(30, voiced.goals) + fitGrow(1.2, voiced.score);
    check(asked.length === 1 && asked[0][0].id === 'score' && asked[0].some((l) => l.id === 'goals') && asked[0].every((l) => l.text),
      `el robot pone la voz a cada frase del guion (${asked[0]?.map((l) => l.id).join(', ')})`);
    check(voiced.meta === 'Lleva la voz, subtítulos y la apertura con el aviso.' && voiced.audio && grow > 0 && Math.abs(voiced.duration - plain - grow) < 0.6,
      `y el vídeo la lleva: la escena de los goles dura lo que su frase, en compases (${voiced.meta} · ${voiced.duration?.toFixed(1)} s, sin voz ${plain} s, +${grow.toFixed(1)} s)`);
    await c7.close();
    // Y por defecto, sin voz ni subtítulos (mientras se mejora la voz): el robot no la pide
    const askedNo = [];
    const { ctx: c7n, page: p7n } = await open({
      url: `${base}/?partido=esp.1/401882844&dia=2026-10-16`,
      before: async (ctx) => {
        ctx.on('page', (pg) => pg.on('dialog', (d) => d.accept()));
        await ctx.exposeFunction('fsVoz', async (lines) => { askedNo.push(lines); return null; });
        await ctx.clock.setFixedTime(new Date('2026-10-17T10:00:00+02:00'));
        await ctx.route('https://site.api.espn.com/apis/site/v2/sports/soccer/esp.1/scoreboard?dates=20261016', (r) => r.fulfill(json(JSON.stringify(sbEnded))));
      },
    });
    await p7n.waitForFunction(() => !document.getElementById('videoOut').hidden || /No se pudo/.test(document.getElementById('toast').textContent), null, { timeout: 400000 });
    const nv = await p7n.evaluate(() => ({ meta: document.getElementById('videoMeta').textContent, voz: document.getElementById('videoOut').dataset.voz,
      mode: document.querySelector('.lang-opt[data-voz="no"]').getAttribute('aria-checked'), saved: localStorage.getItem('fc-mix') || '' }));
    check(askedNo.length === 0 && nv.voz === 'no' && !/voz|subtítulos/.test(nv.meta) && nv.mode === 'true' && !nv.saved.includes('"voz"'),
      `por defecto, el robot hace el vídeo sin voz ni subtítulos: no la pide (${nv.meta})`);
    await c7n.close();
    // Un partido que no está: lo dice y deja el Studio como siempre.
    const { ctx: c7b, page: p7b } = await open({ url: `${base}/?partido=esp.1/999`, before: async (ctx) => { await ctx.clock.setFixedTime(new Date('2026-10-16T22:00:00+02:00')); } });
    await p7b.waitForFunction(() => /ni hoy ni ayer/.test(document.getElementById('toast').textContent), null, { timeout: 15000 }).catch(() => {});
    check(/ni hoy ni ayer/.test(await p7b.textContent('#toast')) && !(await p7b.$('#slide-portada')), 'si el partido no está, avisa y no genera nada');
    await c7b.close();

    // El piloto automático (tools/piloto.mjs): qué partidos hace y el aviso al móvil, con datos de ESPN.
    const pl = await import(pathToFileURL(join(REPO, 'tools/piloto.mjs')).href);
    // La voz: los marcadores dichos, los tiempos de cada palabra del guion y lo que se pide a ElevenLabs
    const sw = pl.spokenWords('Exhibición del Real Madrid: 4-1 al Sevilla.');
    const letters = [...sw.text];
    const times = pl.wordTimes({ characters: letters, character_start_times_seconds: letters.map((_, i) => i / 10), character_end_times_seconds: letters.map((_, i) => (i + 1) / 10) }, sw.counts);
    check(sw.text === 'Exhibición del Real Madrid: 4 a 1 al Sevilla.' && times?.length === 7 && times[4][0] === 2.8 && times[4][1] === 3.3
      && pl.wordTimes({ characters: ['a'] }, sw.counts) === null,
      `voz: «4-1» se dice «4 a 1» y su subtítulo dura lo que las tres palabras (${times?.[4]})`);
    const calls = [];
    const fakeFetch = async (url, o) => { calls.push({ url, o, body: JSON.parse(o.body) }); return { ok: true, json: async () => ({ audio_base64: 'QUJD', alignment: null }) }; };
    const clips = await pl.voiceLines([{ id: 'score', text: 'Victoria del Depor: 1-0 al Levante.' }, { id: 'outro', text: '¿Quién fue el mejor?' }], { key: 'k', voice: 'v1', fetchFn: fakeFetch });
    check(calls.length === 2 && /\/v1\/text-to-speech\/v1\/with-timestamps/.test(calls[0].url) && calls[0].o.headers['xi-api-key'] === 'k'
      && calls[0].body.text === 'Victoria del Depor: 1 a 0 al Levante.' && calls[0].body.next_text === '¿Quién fue el mejor?' && calls[1].body.previous_text === calls[0].body.text
      && clips.score.audio === 'QUJD' && clips.outro.times === null,
      'y a ElevenLabs le pide cada frase con la de antes y la de después, con la clave solo en el robot');
    let failed = '';
    await pl.voiceLines([{ id: 'score', text: 'Hola.' }], { key: 'k', voice: 'v', fetchFn: async () => ({ ok: false, status: 401, text: async () => 'quota_exceeded' }) }).catch((e) => { failed = e.message; });
    check(/ElevenLabs 401: quota_exceeded/.test(failed), `si ElevenLabs falla (sin saldo), lo dice y el vídeo sale sin voz (${failed})`);
    // Con Qwen3-TTS en Modal (tools/voz_modal.py): todas las frases en una petición, con su token
    const qcalls = [];
    const qFetch = async (url, o) => {
      qcalls.push({ url, o, body: JSON.parse(o.body) });
      return { ok: true, json: async () => ({ score: { audio: 'UklG', times: null }, outro: { audio: 'UklH', times: null } }) };
    };
    const qclips = await pl.qwenLines([{ id: 'score', text: 'Victoria del Depor: 1-0 al Levante.' }, { id: 'outro', text: '¿Quién fue el mejor?' }],
      { url: 'https://voz.modal.run', key: 'wk-1', secret: 'ws-1', fetchFn: qFetch });
    check(qcalls.length === 1 && qcalls[0].url === 'https://voz.modal.run' && qcalls[0].o.headers['Modal-Key'] === 'wk-1' && qcalls[0].o.headers['Modal-Secret'] === 'ws-1'
      && qcalls[0].body.lines.map((l) => l.text).join(' | ') === 'Victoria del Depor: 1 a 0 al Levante. | ¿Quién fue el mejor?'
      && qclips.score.audio === 'UklG' && qclips.outro.audio === 'UklH' && qclips.score.times === null,
      'con Qwen3-TTS en Modal, todas las frases en una petición, con «1-0» dicho «1 a 0» y el token solo en el robot');
    let qfailed = '';
    await pl.qwenLines([{ id: 'score', text: 'Hola.' }, { id: 'outro', text: '¿Y?' }], { url: 'u', key: 'k', secret: 's',
      fetchFn: async () => ({ ok: true, json: async () => ({ score: { audio: 'UklG' } }) }) }).catch((e) => { qfailed = e.message; });
    let q401 = '';
    await pl.qwenLines([{ id: 'score', text: 'Hola.' }], { url: 'u', key: 'k', secret: 's',
      fetchFn: async () => ({ ok: false, status: 401, text: async () => 'missing credentials' }) }).catch((e) => { q401 = e.message; });
    check(/«outro»/.test(qfailed) && /Modal 401: missing credentials/.test(q401), `si a Modal le falta una frase o falla, lo dice y el vídeo sale sin voz (${qfailed} · ${q401})`);
    // El motor: el de piloto.json si está puesto; si no, el otro; sin ninguno, sin voz
    const modal = { VOZ_URL: 'u', MODAL_KEY: 'k', MODAL_SECRET: 's' }, eleven = { ELEVENLABS_API_KEY: 'k', ELEVENLABS_VOICE_ID: 'v' };
    check(pl.voiceEngine({ ...modal, ...eleven }, 'qwen')?.name === 'Qwen3-TTS en Modal' && pl.voiceEngine({ ...modal, ...eleven }, 'elevenlabs')?.name === 'ElevenLabs'
      && pl.voiceEngine(eleven, 'qwen')?.name === 'ElevenLabs' && pl.voiceEngine({ VOZ_URL: 'u', MODAL_KEY: 'k' }, 'qwen') === null && pl.voiceEngine({}, 'qwen') === null,
      'la voz: con el motor de piloto.json si está puesto, si no con el otro, y sin ninguno, sin voz');
    // En juego (minuto 74, empezó a las 21:00): a partir de los 80 minutos desde el inicio, el robot
    // se queda vigilándolo para avisar nada más acabar
    const live = [{ league: 'esp.1', day: '2026-10-16', data: JSON.parse(readFileSync(join(FIX, 'sb-esp.1-20261016.json'))) }];
    const kick = Date.parse('2026-10-16T19:00Z');
    check(pl.findNearEnd(live, kick + 90 * 60e3, new Set()).map((f) => f.id).join() === '401882844'
      && pl.findNearEnd(live, kick + 30 * 60e3, new Set()).length === 0 && pl.findFinished(live, kick + 90 * 60e3, new Set()).length === 0,
      'piloto automático: con un partido por el final, se queda vigilándolo (y no lo hace hasta que acaba)');
    const sb = JSON.parse(readFileSync(join(FIX, 'sb-esp.1-20261016.json')));
    for (const e of sb.events) if (e.id === '401882844') e.status = { ...e.status, type: { ...e.status.type, state: 'post', completed: true } };
    const now = Date.parse('2026-10-16T23:10:00+02:00');
    const boards = [{ league: 'esp.1', day: '2026-10-16', data: sb }];
    const found = pl.findFinished(boards, now, new Set());
    check(found.length === 1 && found[0].id === '401882844' && found[0].title === 'Deportivo 1-0 Levante' && found[0].day === '2026-10-16',
      `piloto automático: hace el vídeo de los partidos acabados (${found.map((f) => f.title).join(', ')})`);
    check(pl.findFinished(boards, now, new Set(['401882844'])).length === 0, 'y no repite los que ya tienen vídeo');
    check(pl.findFinished(boards, Date.parse('2026-10-17T03:30:00+02:00'), new Set()).length === 0, 'ni hace los de hace horas');
    // En la Champions (o la Copa), solo si juega un equipo de LaLiga
    const ucl = [{ league: 'uefa.champions', day: '2026-10-16', data: sb }];
    check(pl.findFinished(ucl, now, new Set(), new Set(['999'])).length === 0 && pl.findFinished(ucl, now, new Set(), new Set([String(sb.events.find((e) => e.id === '401882844').competitions[0].competitors[0].team.id)])).length === 1,
      'fuera de LaLiga, solo los partidos de equipos de LaLiga');
    const n = pl.notice({ id: '401882844', title: 'Deportivo 1-0 Levante', caption: '⚽ Final · Depor 1-0 Levante' }, 'tema', 'https://tonimas35.github.io/futbol-studio/');
    check(n.topic === 'tema' && n.title === '⚽ Deportivo 1-0 Levante' && n.message === '⚽ Final · Depor 1-0 Levante'
      && n.click === 'https://tonimas35.github.io/futbol-studio/?video=401882844' && n.actions[0].url === n.click,
      `y el aviso al móvil lleva el resultado, la descripción y el enlace al vídeo (${n.click})`);
    check(pl.notice({ id: '401882844', title: 'x' }, 'tema', 'https://tonimas35.github.io/futbol-studio/', false).click === 'https://github.com/tonimas35/futbol-studio/releases/download/videos/401882844.mp4',
      'y si la web no se ha podido publicar, el vídeo tal cual');
    // Las previas: 3 horas antes de los partidos grandes (los del Madrid, el Barça y el Atlético) y de
    // todos los de la Champions, una vez y nunca a menos de 10 minutos del inicio
    const pre = (id, home, away, iso) => ({ id, date: iso, status: { type: { state: 'pre' } },
      competitions: [{ competitors: [{ homeAway: 'home', team: { id: home, shortDisplayName: `L${home}` } }, { homeAway: 'away', team: { id: away, shortDisplayName: `V${away}` } }] }] });
    const ko = '2026-11-29T20:00Z', t0 = Date.parse(ko);
    const pb = [
      { league: 'esp.1', day: '2026-11-29', data: { events: [pre('1', '86', '243', ko), pre('2', '94', '90', ko)] } },
      { league: 'uefa.champions', day: '2026-11-29', data: { events: [pre('3', '93', '999', ko), pre('4', '998', '999', ko)] } },
    ];
    const cfgP = { equipos: ['86', '83', '1068'], competiciones: ['uefa.champions'], horasAntes: 3 };
    const prev = (now, done = new Set()) => pl.findPrevias(pb, now, done, cfgP);
    check(prev(t0 - 2.5 * 3600e3).map((f) => f.id).join() === '1,3,4' && prev(t0 - 4 * 3600e3).length === 0 && prev(t0 - 5 * 60e3).length === 0
      && prev(t0 - 2 * 3600e3, new Set(['1-previa'])).map((f) => f.id).join() === '3,4',
      'las previas: 3 horas antes de los partidos grandes y de toda la Champions, una vez y no a punto de empezar');
    check(prev(t0 - 2.5 * 3600e3)[0].kind === 'previa' && prev(t0 - 2.5 * 3600e3)[0].title === 'L86 – V243'
      && pl.notice({ id: '1-previa', kind: 'previa', title: 'Previa · Real Madrid – Sevilla', caption: 'x' }, 't', 'https://w/').title === '🔥 Previa · Real Madrid – Sevilla',
      'con su aviso («🔥 Previa · …»)');
    // El resumen de la jornada de LaLiga, al acabar su último partido: la jornada son los días de
    // alrededor mientras ningún equipo repita (del viernes 16 al lunes 19, 10 partidos)
    const ev = (id, home, away, iso, state = 'post', name = 'STATUS_FULL_TIME') => ({ id, date: iso, status: { type: { state, name, completed: state === 'post' } },
      competitions: [{ competitors: [{ homeAway: 'home', team: { id: home } }, { homeAway: 'away', team: { id: away } }] }] });
    const jb = (mon = 'post') => [
      { day: '2026-10-15', evs: [ev('90', '1', '50', '2026-10-15T19:00Z')] },
      { day: '2026-10-16', evs: [ev('1', '1', '2', '2026-10-16T19:00Z')] },
      { day: '2026-10-17', evs: [ev('2', '3', '4', '2026-10-17T12:00Z'), ev('3', '5', '6', '2026-10-17T14:15Z'), ev('4', '7', '8', '2026-10-17T16:30Z'), ev('5', '9', '10', '2026-10-17T19:00Z')] },
      { day: '2026-10-18', evs: [ev('6', '11', '12', '2026-10-18T12:00Z'), ev('7', '13', '14', '2026-10-18T14:15Z'), ev('8', '15', '16', '2026-10-18T16:30Z'), ev('9', '17', '18', '2026-10-18T19:00Z')] },
      { day: '2026-10-19', evs: [ev('10', '19', '20', '2026-10-19T19:00Z', mon), ev('11', '21', '22', '2026-10-19T17:00Z', 'post', 'STATUS_POSTPONED')] },
      { day: '2026-10-21', evs: [ev('12', '1', '3', '2026-10-21T19:00Z', 'pre')] },
    ].map((d) => ({ league: 'esp.1', day: d.day, data: { events: d.evs } }));
    const mondayEnd = Date.parse('2026-10-19T21:05Z');
    const jor = pl.findJornada(jb(), mondayEnd, new Set(), 'esp.1');
    check(jor.length === 1 && jor[0].kind === 'jornada' && jor[0].id === 'jornada-esp-1-2026-10-16' && jor[0].day === '2026-10-19' && jor[0].league === 'esp.1',
      `al acabar el último partido de la jornada, su resumen (${jor.map((j) => `${j.id} · ${j.day}`).join()})`);
    check(pl.findJornada(jb('in'), mondayEnd, new Set(), 'esp.1').length === 0 && pl.findJornada(jb('pre'), Date.parse('2026-10-18T21:05Z'), new Set(), 'esp.1').length === 0,
      'pero no mientras le quede algún partido (el aplazado no cuenta)');
    check(pl.findJornada(jb(), mondayEnd, new Set(['jornada-esp-1-2026-10-16']), 'esp.1').length === 0 && pl.findJornada(jb(), Date.parse('2026-10-20T12:00Z'), new Set(), 'esp.1').length === 0,
      'ni la repite, ni la hace horas después');
    const lone = [{ league: 'esp.1', day: '2026-10-21', data: { events: [ev('12', '1', '3', '2026-10-21T19:00Z')] } }, ...jb().filter((b) => b.day === '2026-10-17')];
    check(pl.findJornada(lone, Date.parse('2026-10-21T21:05Z'), new Set(), 'esp.1').length === 0, 'ni con un aplazado jugado entre semana');
    const nj = pl.notice({ id: 'jornada-esp-1-2026-10-16', kind: 'jornada', title: 'Así fue la jornada · LaLiga · 16-19 oct 2026', caption: '⚽ RESULTADOS' }, 't', 'https://w/');
    check(nj.title === '📊 Así fue la jornada · LaLiga · 16-19 oct 2026' && nj.click === 'https://w/?video=jornada-esp-1-2026-10-16' && nj.actions[0].label === 'Abrir las fotos'
      && pl.notice({ id: 'jornada-esp-1-2026-10-16', kind: 'jornada', title: 'x' }, 't', 'https://w/', false).click === 'https://github.com/tonimas35/futbol-studio/releases/tag/videos',
      `con su aviso («${nj.title}»)`);
    const cfg = JSON.parse(readFileSync(join(REPO, 'piloto.json')));
    const wf = readFileSync(join(REPO, '.github/workflows/piloto.yml'), 'utf8');
    check(cfg.liga === 'esp.1' && cfg.competiciones.includes('uefa.champions') && cfg.previas.equipos.includes('86') && cfg.previas.horasAntes === 3 && /cron: '3,13,23,33,43,53 11-23 \* \* \*'/.test(wf) && /tools\/piloto\.mjs esperar/.test(wf),
      'cada 10 minutos en las horas de partidos (y cada 30 segundos al final de uno), con LaLiga y las copas y competiciones europeas');
    const vg = readFileSync(join(REPO, '.github/workflows/vigia.yml'), 'utf8');
    check(/node tools\/piloto\.mjs buscar/.test(vg) && /sleep 600/.test(vg) && /gh workflow run piloto\.yml/.test(vg) && /gh workflow run vigia\.yml/.test(vg) && /actions: write/.test(vg) && /group: vigia/.test(vg),
      'y el vigía hace de reloj: mira cada 10 minutos, lanza el piloto y, al acabar su vuelta, la siguiente');
  }

  // ── La clasificación al día: al pitido final, ESPN aún no ha contado el partido en la tabla ──
  {
    const { ctx: ct, page: pt } = await open({ before: async (c) => {
      await c.route(/\/summary\?event=401915414$/, (r) => {
        const data = JSON.parse(readFileSync(join(FIX, 'sum-401915414.json')));
        const set = (e, v) => e.stats.forEach((s) => { if ((s.name || s.type) in v) s.value = v[s.name || s.type]; });
        for (const e of data.standings.groups.flatMap((g) => g.standings.entries)) {
          if (String(e.id) === '86') set(e, { gamesPlayed: 1, points: 3, pointDifferential: 1 });
          if (String(e.id) === '104') set(e, { gamesPlayed: 1, points: 1, pointDifferential: 0 });
        }
        return r.fulfill(json(JSON.stringify(data)));
      });
    } });
    await pickLeague(pt, 'uefa.champions');
    await pickDate(pt, '2026-10-14');
    await generate(pt, '401915414');
    const me = await pt.$$eval('#slide-tabla .row.me', (rs) => rs.map((r) => [...r.querySelectorAll('span')].map((s) => s.textContent.trim()).join(' ')));
    check(me.join(' | ') === '8 Real Madrid 2 +2 6 | 25 Roma 2 -1 1', `la tabla cuenta el partido que ESPN aún no tenía, cada uno en su sitio (${me.join(' | ')})`);
    await ct.close();
  }

  // ── Previa: con un partido sin empezar, un vídeo con cómo llegan, el cara a cara y sus goleadores ──
  // (datos reales de ESPN del Real Madrid–Sevilla del 18-10-2026, movido al 29-11 para no pisar otras pruebas)
  {
    const { ctx: cp, page: pp } = await open({ before: async (c) => { await c.clock.setFixedTime(new Date('2026-11-29T12:00:00+01:00')); } });
    await pickLeague(pp, 'esp.1');
    await pickDate(pp, '2026-11-29');
    await pp.click('.game-card[data-game-id="401882839"]');
    const btns = await pp.evaluate(() => ({ gen: document.getElementById('generateBtn').disabled, prev: !document.getElementById('previaBtn').hidden,
      note: document.getElementById('selectedGameInfo').textContent }));
    check(btns.gen && btns.prev && /puedes crear su previa/.test(btns.note), 'sin empezar: no hay carrusel, pero sí «Crear previa»');
    // Lo que le llega al vídeo: con su guion y los subtítulos
    await pp.evaluate(() => {
      const render = window.StudioVideo.render;
      window.StudioVideo.render = (data, cb, opts) => { window.__previaOpts = opts; return render(data, cb, opts); };
    });
    await pp.click('.lang-opt[data-voz="si"]');
    await pp.click('#previaBtn');
    await pp.waitForFunction(() => !document.getElementById('videoOut').hidden || /No se pudo/.test(document.getElementById('toast').textContent), null, { timeout: 400000 });
    const said = await pp.evaluate(() => ({ captions: window.__previaOpts?.captions, toast: document.getElementById('toast').textContent, ...window.__previaOpts?.script }));
    check(said.captions === false && /sin voz ni subtítulos: falta tu clave de la voz/.test(said.toast),
      `con voz pero sin tu clave de la voz, la previa sale sin voz ni subtítulos y lo dice (${said.toast})`);
    check(said.forma === 'El Real Madrid llega con cuatro victorias de cinco.' && said.h2h === 'El Real Madrid ganó los cinco últimos.'
      && said.goleadores === 'Los que más marcan: Mbappé, 7; Sierra, 2.' && /^El Real Madrid, cuarto, a nueve del líder/.test(said.tabla)
      && said.outro === '¿Quién gana? Te leo en comentarios.',
      `y su guion (para la voz; sin ella, sin subtítulos): cómo llegan, el cara a cara, los goleadores y la tabla (${[said.forma, said.h2h, said.goleadores, said.tabla].join(' · ')})`);
    const pv = await pp.evaluate(() => ({ title: document.getElementById('videoOut').dataset.title, caption: document.getElementById('captionText').value.split('\n'),
      dl: document.getElementById('videoDlBtn').download, box: !document.getElementById('captionBox').hidden }));
    check(pv.title === 'Previa · Real Madrid – Sevilla' && pv.dl === 'futbol-rma-sev-2026-11-29-previa.mp4' && pv.box,
      `la previa en vídeo (${pv.title} · ${pv.dl})`);
    check(pv.caption[0] === '🔥 PREVIA · Real Madrid – Sevilla' && pv.caption[1] === '⏰ Hoy, 21:00 · LaLiga'
      && pv.caption[2] === '📊 Cómo llegan: Real Madrid 4G 0E 1P · Sevilla 2G 1E 1P'
      && pv.caption[3] === '🆚 Últimos 5 cara a cara: Real Madrid 5, empates 0, Sevilla 0' && pv.caption[5] === '#futbol #laliga #realmadrid #sevilla #previa',
      `y su descripción: la hora, cómo llegan (sin amistosos) y el cara a cara (${pv.caption.slice(0, 4).join(' | ')})`);
    await cp.close();
  }

  // ── Piloto automático: el aviso abre el vídeo del robot (?video=), listo para compartirlo ──
  {
    const info = { id: '401882844', league: 'esp.1', day: '2026-10-16', voz: true, title: 'Deportivo 1-0 Levante', caption: '⚽ Final · Depor 1-0 Levante\n#futbol', file: 'futbol-dep-lev-2026-10-16-short.mp4' };
    const { ctx: cv, page: pv } = await open({
      url: `${base}/?video=401882844`,
      before: async (c) => {
        await c.route('**/v/401882844.json', (r) => r.fulfill(json(JSON.stringify(info))));
        await c.route('**/v/401882844.mp4', (r) => r.fulfill({ status: 200, contentType: 'video/mp4', body: Buffer.from('mp4 de prueba') }));
      },
    });
    await pv.waitForFunction(() => document.getElementById('robotTitle').textContent !== 'Cargando el vídeo…', null, { timeout: 15000 }).catch(() => {});
    const rv = await pv.evaluate(() => ({
      open: !document.getElementById('robotBox').hidden,
      title: document.getElementById('robotTitle').textContent,
      caption: document.getElementById('robotCaption').value,
      share: !document.getElementById('robotShare').hidden,
      dl: document.getElementById('robotDl').download,
      other: !document.getElementById('robotOtherType').hidden && [document.getElementById('robotOtherType').textContent, document.getElementById('robotOtherType').getAttribute('href')],
      url: location.search,
    }));
    check(rv.open && rv.title === info.title && rv.caption === info.caption && rv.share && rv.dl === info.file && rv.url === '',
      `el aviso abre el vídeo con su descripción, para compartir o descargar (${rv.title})`);
    check(rv.other?.[0] === 'Sin voz ni subtítulos' && rv.other[1] === '?partido=esp.1/401882844&dia=2026-10-16&voz=no',
      `y, como lleva voz, el botón para hacerlo sin voz ni subtítulos en el Studio (${rv.other})`);
    await pv.click('#robotShare');
    await pv.waitForTimeout(300);
    // (en Windows, el portapapeles devuelve los saltos de línea como \r\n)
    check((await pv.evaluate(() => window.__shared)).join() === '1' && (await pv.evaluate(() => navigator.clipboard.readText())).replace(/\r\n/g, '\n') === info.caption,
      'y «Compartir vídeo» lo comparte con la descripción ya copiada');
    await pv.click('#robotClose');
    check(await pv.$eval('#robotBox', (b) => b.hidden) && !!(await pv.$('.game-card, .games-empty')), '«Cerrar» deja el Studio de siempre');
    await cv.close();
    // Y una previa sin voz: el botón para hacerla con voz y subtítulos
    const pinfo = { ...info, id: '401882839-previa', day: '2026-10-18', voz: false };
    const { ctx: cvp, page: pvp } = await open({
      url: `${base}/?video=401882839-previa`,
      before: async (c) => {
        await c.route('**/v/401882839-previa.json', (r) => r.fulfill(json(JSON.stringify(pinfo))));
        await c.route('**/v/401882839-previa.mp4', (r) => r.fulfill({ status: 200, contentType: 'video/mp4', body: Buffer.from('mp4 de prueba') }));
      },
    });
    await pvp.waitForFunction(() => !document.getElementById('robotOtherType').hidden, null, { timeout: 15000 }).catch(() => {});
    const po = await pvp.$eval('#robotOtherType', (a) => [a.textContent, a.getAttribute('href')]);
    check(po[0] === 'Con voz y subtítulos' && po[1] === '?previa=esp.1/401882839&dia=2026-10-18&voz=si', `y, sin voz, el botón para hacerla con voz y subtítulos (${po})`);
    await cvp.close();
    // Si el vídeo ya no está (se guardan unos días), lo dice
    const { ctx: cw, page: pw } = await open({ url: `${base}/?video=401882845` });
    await pw.waitForFunction(() => document.getElementById('robotTitle').textContent !== 'Cargando el vídeo…', null, { timeout: 15000 }).catch(() => {});
    check(/ya no está/.test(await pw.textContent('#robotTitle')) && await pw.$eval('#robotShare', (b) => b.hidden), `si ya no está, lo dice (${await pw.textContent('#robotTitle')})`);
    await cw.close();
    // El resumen de la jornada: sus fotos, en orden, para compartirlas todas a la vez
    const jinfo = { id: 'jornada-esp-1-2026-10-16', kind: 'jornada', title: 'Así fue la jornada · LaLiga · 16-19 oct 2026', caption: '⚽ RESULTADOS · LALIGA\n#LaLiga',
      images: ['jornada-esp-1-2026-10-16-01-portada.png', 'jornada-esp-1-2026-10-16-02-resultados-1.png', 'jornada-esp-1-2026-10-16-03-cierre.png'] };
    const { ctx: cj, page: pj } = await open({
      url: `${base}/?video=${jinfo.id}`,
      before: async (c) => {
        await c.route(`**/v/${jinfo.id}.json`, (r) => r.fulfill(json(JSON.stringify(jinfo))));
        await c.route('**/v/jornada-esp-1-2026-10-16-*.png', (r) => r.fulfill({ status: 200, contentType: 'image/png', body: PIXEL }));
      },
    });
    await pj.waitForFunction(() => document.getElementById('robotTitle').textContent !== 'Cargando el vídeo…', null, { timeout: 15000 }).catch(() => {});
    const rj = await pj.evaluate(() => ({
      title: document.getElementById('robotTitle').textContent,
      photos: document.querySelectorAll('#robotPhotos:not([hidden]) img').length,
      video: !document.getElementById('robotVideo').hidden,
      share: document.getElementById('robotShare').hidden ? '' : document.getElementById('robotShare').textContent,
    }));
    await pj.click('#robotShare').catch(() => {});
    await pj.waitForTimeout(300);
    check(rj.title === jinfo.title && rj.photos === 3 && !rj.video && rj.share === 'Compartir 3 fotos'
      && (await pj.evaluate(() => window.__shared)).join() === '3' && (await pj.evaluate(() => navigator.clipboard.readText())).replace(/\r\n/g, '\n') === jinfo.caption,
      `y el de la jornada, sus fotos para compartirlas todas a la vez (${rj.photos} fotos · ${rj.share})`);
    await cj.close();
  }

  // ── La polémica: el gol del Betis que anuló el VAR, de la narración de ESPN (datos reales del
  // Betis 2-5 Barça del 17-10-2026, movidos al 22-11 para no pisar otras pruebas) ──
  {
    const { ctx: cq, page: pq } = await open();
    await pickDate(pq, '2026-11-22');
    await generate(pq, '401882846');
    await pq.waitForSelector('#scriptLines .script-line', { timeout: 15000 }).catch(() => {});
    const pol = await pq.evaluate(() => ({
      caption: document.getElementById('captionText').value.split('\n'),
      q: document.querySelector('#slide-cierre .q')?.textContent,
      scenes: [...document.querySelectorAll('#scriptLines .script-line')].map((l) => l.dataset.scene),
      line: document.querySelector('#scriptLines textarea[data-scene="goals"]')?.value,
    }));
    check(pol.caption[0] === '😱 El VAR le anula un gol al Betis · Betis 2-5 Barcelona' && pol.caption[2] === '¿Bien anulado el gol del Betis? 👇'
      && pol.q === '¿Bien anulado el gol del Betis?',
      `la polémica: el gancho y la pregunta de la descripción y del cierre (${pol.caption[0]} | ${pol.q})`);
    // En el vídeo, dentro del partido: el reloj se para en su minuto (y su frase va en la del partido)
    check(!pol.scenes.includes('polemica') && pol.line?.includes('El VAR le anula un gol al Betis en el 43, con 1-2.'),
      `y en el vídeo, dentro del partido, con el minuto y cómo iba (${pol.line})`);
    await cq.close();
  }

  // ── Resumen de la jornada: todos los resultados, lo destacado y la clasificación ──
  {
    const { ctx: c8, page: p8 } = await open();
    await pickDate(p8, '2026-09-20');
    check(!(await p8.$eval('#jornadaBar', (b) => b.hidden)), 'con partidos acabados sale «Resumen de la jornada»');
    await p8.fill('#signInput', '@toni_futbol');
    await p8.click('#jornadaBtn');
    await p8.waitForSelector('#jornadaSection:not([hidden])', { timeout: 20000 });
    const jn = await p8.$$eval('#jornadaPreview .slide-label-name', (e) => e.map((x) => x.textContent.replace(/^\d+ · /, '')));
    check(jn.join(',') === 'Portada,Resultados,Clasificación,Cierre', `la jornada: ${jn.join(', ')}`);
    const jp = await p8.evaluate(() => ({
      goals: document.querySelector('#slide-j-portada .jt-big .n')?.textContent,
      facts: [...document.querySelectorAll('#slide-j-portada .jt-facts div')].map((d) => d.textContent),
      rows: document.querySelectorAll('#slide-j-resultados-1 .jr-row').length,
      first: [...(document.querySelector('#slide-j-resultados-1 .jr-row')?.querySelectorAll('.jr-team .nm, .jr-score b') || [])].map((e) => e.textContent).join(' '),
      table: document.querySelectorAll('#slide-j-tabla-1 .row:not(.head)').length,
      foot: document.querySelector('#slide-j-portada .fc-foot span')?.textContent,
      sign: document.querySelector('#slide-j-cierre .fc-sign')?.textContent,
    }));
    check(jp.goals === '15' && jp.rows === 5 && jp.first === 'Getafe 1-0 Málaga' && jp.table === 20,
      `15 goles en 5 partidos, los resultados con goleadores y la tabla de 20 (${jp.first})`);
    check(jp.facts.some((f) => /victorias en casa/.test(f)) && /^LaLiga · 20 sept? 2026$/.test(jp.foot) && jp.sign === '@toni_futbol',
      `lo destacado (${jp.facts.join(' · ')}) y el pie con la fecha de la jornada (${jp.foot} · ${jp.sign})`);
    const [jz] = await Promise.all([p8.waitForEvent('download', { timeout: 90000 }), p8.click('#jornadaZipBtn')]);
    check(jz.suggestedFilename() === 'futbol-jornada-esp-1-2026-09-20.zip', `y se descarga en ZIP (${jz.suggestedFilename()})`);
    check(await p8.$$eval('#slidesPreview .slide', (x) => x.length) === 0, 'sin tocar el carrusel del partido');
    await c8.close();
    // El enlace del robot (?jornada=liga&dia=) la hace sola
    const { ctx: c8b, page: p8b } = await open({ url: `${base}/?jornada=esp.1&dia=2026-09-20` });
    await p8b.waitForSelector('#jornadaSection:not([hidden])', { timeout: 20000 }).catch(() => {});
    const jl = await p8b.evaluate(() => ({ open: !document.getElementById('jornadaSection').hidden, slides: document.querySelectorAll('#jornadaPreview .slide').length, url: location.search, date: document.getElementById('dateInput').value }));
    check(jl.open && jl.slides === 4 && jl.url === '' && jl.date === '2026-09-20', `y el enlace ?jornada= del robot la hace sola (${jl.slides} slides · ${jl.date})`);
    await c8b.close();
  }

  // ── En inglés: slides, guion y jornada (la interfaz sigue en español) ──
  {
    const { ctx: c9, page: p9 } = await open();
    await pickLeague(p9, 'uefa.champions');
    await pickDate(p9, '2026-10-14');
    await generate(p9, '401915414');
    await p9.click('.lang-opt[data-lang="en"]');
    await p9.waitForFunction(() => document.querySelector('#slide-portada h1')?.textContent === 'Real Madrid complete the comeback', null, { timeout: 30000 }).catch(() => {});
    const en = () => p9.evaluate(() => ({
      h1: document.querySelector('#slide-portada h1')?.textContent,
      comp: document.querySelector('#slide-portada .comp')?.textContent,
      marks: [...document.querySelectorAll('#slide-crono .ht')].map((e) => e.textContent),
      labels: [...document.querySelectorAll('#slide-stats .labels span')].map((e) => e.textContent),
      q: document.querySelector('#slide-cierre .q')?.textContent,
      sub: document.querySelector('#slide-cierre .sub')?.textContent,
      script: document.querySelector('#scriptLines textarea[data-scene="score"]')?.value,
      dato: document.querySelector('#slide-dato .dt-line')?.textContent,
      said: document.querySelector('#scriptLines textarea[data-scene="dato"]')?.value,
      on: document.querySelector('.lang-opt[aria-checked="true"]')?.dataset.lang,
    }));
    const e1 = await en();
    check(e1.h1 === 'Real Madrid complete the comeback' && /Champions League · League phase/.test(e1.comp), `en inglés: titular y fase (${e1.h1} · ${e1.comp})`);
    check(e1.marks.includes('Half-time · 1-1') && e1.marks.includes('Full time · 3-4') && e1.labels.includes('Possession'),
      `minuto a minuto y estadísticas en inglés (${e1.marks.join(' | ')} · ${e1.labels.slice(0, 3).join(', ')})`);
    check(e1.q === 'Who was your player of the match?' && e1.sub === 'Let me know in the comments', `el cierre en inglés (${e1.q})`);
    check(e1.script === 'Real Madrid complete the comeback: 4-3 against Roma.', `y el guion del vídeo (${e1.script})`);
    check(e1.dato === "Roma's 14-game unbeaten run in all competitions is over." && e1.said === "Roma's 14-game unbeaten run is over.", `y el dato (${e1.dato} · ${e1.said})`);
    check((await slideNames(p9))[0] === 'Portada' && /Generar/.test(await p9.textContent('#generateBtn')), 'la interfaz sigue en español');
    await p9.reload();
    await p9.waitForSelector('#slide-portada', { timeout: 10000 }).catch(() => {});
    const e2 = await en();
    check(e2.on === 'en' && e2.h1 === 'Real Madrid complete the comeback', `al volver a abrir el Studio sigue en inglés (${e2.on} · ${e2.h1})`);

    // La jornada en inglés
    await pickLeague(p9, 'esp.1');
    await pickDate(p9, '2026-09-20');
    await p9.click('#jornadaBtn');
    await p9.waitForSelector('#jornadaSection:not([hidden])', { timeout: 20000 });
    const ej = await p9.evaluate(() => ({
      title: document.querySelector('#slide-j-portada .jt-title')?.innerText.replace(/\s+/g, ' '),
      goals: document.querySelector('#slide-j-portada .jt-big .l')?.textContent,
      q: document.querySelector('#slide-j-cierre .q')?.textContent,
    }));
    check(/^Matchday round-up$/i.test(ej.title) && /goals in 5 games/i.test(ej.goals) && ej.q === 'What was your game of the round?',
      `la jornada en inglés (${ej.title} · ${ej.goals} · ${ej.q})`);

    // Y de vuelta al español: se rehacen el partido (con el historial ya guardado en el
    // navegador: las temporadas acabadas no se vuelven a pedir) y la jornada
    const past = [];
    p9.on('request', (r) => {
      const u = new URL(r.url());
      if (/\/schedule$/.test(u.pathname) && Number(u.searchParams.get('season')) < 2026) past.push(u.searchParams.get('season'));
    });
    await p9.click('.lang-opt[data-lang="es"]');
    await p9.waitForFunction(() => /^Así fue/.test(document.querySelector('#slide-j-portada .jt-title')?.textContent || ''), null, { timeout: 30000 }).catch(() => {});
    check(/^Así fue/.test(await p9.textContent('#slide-j-portada .jt-title')), 'y al volver al español, la jornada se rehace en español');
    check(await p9.textContent('#slide-dato .dt-big').catch(() => '') === '14' && past.length === 0,
      `y el partido, con el dato y sin volver a pedir a ESPN las temporadas acabadas (${past.length} pedidas)`);
    await c9.close();
  }

  // ── API-Football: las notas y las caras, pedidas desde el navegador con tu clave ──
  // Las notas de este partido son de ejemplo, con el formato de API-Football (dos decimales y «0»
  // para los que no han jugado, como el portero suplente).
  {
    const asked = [];
    const afFile = (path, q) => (path === 'fixtures' ? `af-fixtures-${q.get('date')}.json`
      : path === 'fixtures/players' ? `af-players-${q.get('fixture')}.json` : '');
    const { ctx: ca, page: pa } = await open({
      before: async (c) => {
        await c.route('https://v3.football.api-sports.io/**', (r) => {
          const u = new URL(r.request().url());
          const path = u.pathname.slice(1);
          asked.push(`${path}:${r.request().headers()['x-apisports-key']}`);
          const f = afFile(path, u.searchParams);
          return r.fulfill(json(f && existsSync(join(FIX, f)) ? readFileSync(join(FIX, f)) : '{"errors":[],"response":[]}'));
        });
        // Gollini no tiene foto: API-Football da su silueta gris. Mbappé, una cara de 150 px.
        await c.route('https://media.api-sports.io/**', (r) => r.fulfill({ status: 200, contentType: 'image/png', headers: { 'access-control-allow-origin': '*' },
          body: r.request().url().endsWith('/90000.png') ? readFileSync(join(FIX, 'af-silueta.png'))
            : r.request().url().endsWith('/91008.png') ? readFileSync(join(FIX, 'af-cara.png')) : PIXEL }));
      },
    });
    await pickLeague(pa, 'uefa.champions');
    await pickDate(pa, '2026-10-14');
    // Sin clave, ni se pide: sale sin notas
    await generate(pa, '401915414');
    check(asked.length === 0 && !(await slideNames(pa)).includes('Las notas'), `sin tu clave de API-Football, sin notas y sin pedir nada (${asked.length} peticiones)`);
    check(await pa.$eval('#afKeyInput', (i) => i.type) === 'password', 'la clave se escribe oculta');
    await pa.fill('#afKeyInput', ' clave-de-prueba ');
    await pa.reload();
    await pa.waitForFunction(() => document.getElementById('gamesList').childElementCount && !document.querySelector('#gamesList .loader'), null, { timeout: 30000 });
    check(await pa.inputValue('#afKeyInput') === 'clave-de-prueba', 'y se recuerda en este navegador');
    await pickLeague(pa, 'uefa.champions');
    await pickDate(pa, '2026-10-14');
    await generate(pa, '401915414');
    const an = await slideNames(pa);
    check(an.indexOf('Las notas') === an.indexOf('Jugador del partido') + 1 && an.indexOf('Líderes del partido') === an.indexOf('Las notas') + 1,
      `API-Football: «Las notas» y «Líderes del partido» tras el jugador del partido (${an.join(', ')})`);
    const notas = await pa.evaluate(() => ({
      rows: [...document.querySelectorAll('#slide-notas .col')].map((c) => c.querySelectorAll('.row').length),
      first: [...document.querySelectorAll('#slide-notas .col')].map((c) => `${c.querySelector('.row .nm')?.textContent} ${c.querySelector('.row .rt')?.textContent}`),
      mvp: document.querySelector('#slide-notas .row.mvp .nm')?.textContent,
      faces: [...document.querySelectorAll('#slide-notas .face img')].filter((i) => i.src.startsWith('https://media.api-sports.io/')).length,
      gollini: ((f) => (f && !f.querySelector('img') ? f.textContent : 'con foto'))([...document.querySelectorAll('#slide-notas .row')].find((r) => r.querySelector('.nm').textContent === 'Gollini')?.querySelector('.face')),
    }));
    check(notas.rows.join('-') === '15-15' && notas.first.join(' · ') === 'Malen 8,9 · Mbappé 8,1' && notas.mvp === 'Malen' && notas.faces === 29,
      `la nota y la cara de cada uno, de mejor a peor (${notas.first.join(' · ')} · ${notas.faces} caras)`);
    check(notas.gollini === '95', `sin foto (la silueta de API-Football), el dorsal (${notas.gollini})`);
    const top = await pa.evaluate(() => ({
      name: document.querySelector('#slide-jugador .bar span')?.textContent,
      stat: document.querySelector('#slide-jugador .st')?.textContent.replace(/\s+/g, ' ').trim(),
    }));
    check(top.name === 'Donyell Malen' && top.stat === '8,9 Nota', `el jugador del partido, el de la nota más alta (${top.name} · ${top.stat})`);
    const lid = await pa.evaluate(() => ({
      rows: [...document.querySelectorAll('#slide-lideres .row')].map((r) => `${r.querySelector('.lb').textContent} ${r.querySelector('.nm').textContent.trim()} ${r.querySelector('.v').textContent}`),
      onces: [...document.querySelectorAll('#slide-onces .dot.has-face .face')].filter((i) => i.src.startsWith('https://media.api-sports.io/')).length,
      saves: [...document.querySelectorAll('#slide-lideres .row')].find((r) => /Paradas/.test(r.textContent))?.querySelector('.face img'),
    }));
    check(lid.rows.length === 8 && lid.rows[0] === 'Más pases Bellingham 78' && lid.rows.includes('Paradas Gollini 5'),
      `«Líderes del partido»: el mejor en cada cosa (${lid.rows.slice(0, 3).join(' · ')}…)`);
    check(lid.onces === 21 && lid.saves === null, `y en «Los onces», la cara de los titulares que la tienen (${lid.onces})`);
    // Sin foto grande (Mbappé no la tiene en ESPN): su cara en un retrato
    const mbappe = await pa.$eval('[data-slide-id="jugador"] .slide-pick', (s) => [...s.options].find((o) => /Mbappé/.test(o.textContent))?.value);
    await pa.selectOption('[data-slide-id="jugador"] .slide-pick', mbappe);
    await pa.waitForFunction(() => document.querySelector('#slide-jugador .portrait img')?.dataset.src, null, { timeout: 10000 }).catch(() => {});
    const face = await pa.evaluate(() => ({
      img: document.querySelector('#slide-jugador .portrait img')?.dataset.src,
      crisp: document.querySelector('#slide-jugador .portrait img')?.src.startsWith('data:image/png'),
      size: document.querySelector('#slide-jugador .portrait img')?.naturalWidth,
      on: document.querySelector('#slide-jugador .fc-in').classList.contains('has-face'),
      badge: !!document.querySelector('#slide-jugador .portrait .badge img'),
    }));
    check(face.on && face.badge && face.img === 'https://media.api-sports.io/football/players/91008.png', `sin foto grande, su cara en un retrato con el escudo (${face.img})`);
    check(face.crisp && face.size === 450, `y ampliada con enfoque a 450 px para que no salga borrosa (${face.size} px)`);
    check(asked.join(',') === 'fixtures:clave-de-prueba,fixtures/players:clave-de-prueba', `con 2 peticiones directas a API-Football y tu clave (${asked.join(', ')})`);
    // Al rehacer el mismo partido, lo guardado: ninguna petición más
    await generate(pa, '401915414');
    check(asked.length === 2 && (await slideNames(pa)).includes('Las notas'), `y al rehacerlo, sin gastar más peticiones (${asked.length})`);
    // Si API-Football no deja (el plan, el límite del día…), lo dice y el carrusel sale igual (con
    // otra clave, que vuelve a pedirlo todo)
    await pa.fill('#afKeyInput', 'otra-clave');
    await ca.route('https://v3.football.api-sports.io/**', (r) => r.fulfill(json('{"errors":{"plan":"Free plans do not have access to this season, try from 2021 to 2023."},"response":[]}')));
    await generate(pa, '401915415');
    check(/sin las notas · API-Football: Free plans do not have access/.test(await pa.textContent('#toast')) && !(await slideNames(pa)).includes('Las notas'),
      `si el plan no deja, lo avisa y sale sin notas (${await pa.textContent('#toast')})`);
    // Con la clave mal copiada, API-Football contesta 403 sin cabeceras CORS y el navegador solo ve un
    // fallo de red (aquí, la petición cortada: la respuesta servida por la prueba se saltaría el CORS)
    await pa.fill('#afKeyInput', 'clave-mal-copiada');
    await ca.route('https://v3.football.api-sports.io/**', (r) => r.abort('failed'));
    await generate(pa, '401915415');
    check(/sin las notas · API-Football: no contesta \(¿la clave está bien copiada\?\)/.test(await pa.textContent('#toast')),
      `y con la clave mal copiada, lo dice (${await pa.textContent('#toast')})`);
    await ca.close();
  }

  // ── Caras para el robot: sin las notas de API-Football, las caras guardadas en el repo ──
  {
    const saved = { hecho: '2026-10-17', liga: 'esp.1', equipos: [
      { espn: '104', af: 497, nombre: 'AS Roma', jugadores: [{ id: 1001, nombre: 'D. Malen', dorsal: 14 }, { id: 1002, nombre: 'P. Dybala', dorsal: 21 }] },
      // «Otro Jugador» lleva el dorsal de Bellingham, pero no su apellido: sin cara (mejor que la de otro)
      // Valverde, con un apellido de más; «Aurélien Otro» comparte con Tchouaméni solo el nombre: sin cara
      { espn: '86', af: 541, nombre: 'Real Madrid', jugadores: [{ id: 1003, nombre: 'K. Mbappé', dorsal: 10 }, { id: 1004, nombre: 'Vinícius Júnior', dorsal: 7 }, { id: 1005, nombre: 'Otro Jugador', dorsal: 5 },
        { id: 1007, nombre: 'Federico Valverde Dipetta', dorsal: 8 }, { id: 1008, nombre: 'Aurélien Otro', dorsal: 14 }] },
      { espn: '244', af: 543, nombre: 'Real Betis', jugadores: [{ id: 2001, nombre: 'Isco', dorsal: 22 }] },
    ] };
    const asked = [];
    const { ctx: cf, page: pf } = await open({ before: async (c) => {
      await c.addInitScript(() => { window.fsFacesPace = 0; });
      await c.route(`${base}/caras/**`, (r) => (r.request().url().endsWith('/laliga.json') ? r.fulfill(json(JSON.stringify(saved)))
        : r.fulfill({ status: 200, contentType: 'image/png', body: readFileSync(join(FIX, 'af-cara.png')) })));
      // Los equipos, de la clasificación de LaLiga (la lista /teams de ESPN no lleva CORS: el navegador no la deja leer)
      await c.route(/site\.api\.espn\.com\/.*\/esp\.1\/standings$/, (r) => r.fulfill(json(JSON.stringify({ children: [{ standings: { entries: [
        { team: { id: '86', displayName: 'Real Madrid' } }, { team: { id: '83', displayName: 'Barcelona' } }, { team: { id: '244', displayName: 'Real Betis' } }] } }] }))));
      await c.route(/site\.api\.espn\.com\/.*\/teams$/, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
      await c.route('https://v3.football.api-sports.io/**', (r) => {
        const u = new URL(r.request().url());
        asked.push(`${u.pathname.slice(1)}?${u.searchParams}`);
        const team = (id, name) => ({ id, name });
        const res = u.pathname === '/fixtures' ? [{ league: { id: 140 }, teams: { home: team(541, 'Real Madrid'), away: team(530, 'Atletico Madrid') } }]
          : u.pathname === '/teams' ? [{ team: { id: 9001, name: 'Barcelona SC', country: 'Ecuador' } }, { team: { id: 529, name: 'Barcelona', country: 'Spain' } }]
            : u.searchParams.get('team') === '541' ? [{ players: [{ id: 1003, name: 'K. Mbappé', number: 10 }, { id: 1006, name: 'J. Bellingham', number: 5 }] }]
              : u.searchParams.get('team') === '529' ? [{ players: [{ id: 3001, name: 'Pedri', number: 8 }] }] : [];
        return r.fulfill(json(JSON.stringify({ errors: [], response: res })));
      });
    } });
    await pickLeague(pf, 'uefa.champions');
    await pickDate(pf, '2026-10-14');
    await generate(pf, '401915414');
    // Malen tiene foto grande en ESPN; Mbappé no: su cara, en el retrato
    const pick = await pf.$eval('[data-slide-id="jugador"] .slide-pick', (s) => [...s.options].find((o) => /Mbappé/.test(o.textContent))?.value);
    await pf.selectOption('[data-slide-id="jugador"] .slide-pick', pick);
    await pf.waitForFunction(() => document.querySelector('#slide-jugador .portrait img')?.dataset.src, null, { timeout: 10000 }).catch(() => {});
    const lf = await pf.evaluate(() => ({
      name: document.querySelector('#slide-jugador .bar span')?.textContent,
      face: document.querySelector('#slide-jugador .portrait img')?.dataset.src || '',
      onces: [...document.querySelectorAll('#slide-onces .dot.has-face .face')].map((i) => i.getAttribute('src')).sort(),
      button: !document.getElementById('facesField').hidden,
    }));
    check(lf.name === 'Kylian Mbappé' && lf.face.endsWith('/caras/1003.png') && !(await slideNames(pf)).includes('Las notas'),
      `sin clave (el robot), el jugador del partido con su cara guardada en el repo y sin notas (${lf.name} · ${lf.face.split('/').slice(-2).join('/')})`);
    check(lf.onces.join(' ') === 'caras/1001.png caras/1002.png caras/1003.png caras/1004.png caras/1007.png' && asked.length === 0 && !lf.button,
      `y en «Los onces», por el apellido (o el nombre y un apellido de más; el dorsal solo no basta), sin pedir nada a API-Football (${lf.onces.length} caras)`);
    // Con tu clave, «Caras para el robot» baja las plantillas en laliga.json
    await pf.fill('#afKeyInput', 'clave-de-prueba');
    const [dl] = await Promise.all([pf.waitForEvent('download', { timeout: 30000 }), pf.click('#facesBtn')]);
    const made = JSON.parse(readFileSync(await dl.path(), 'utf8'));
    const eq = Object.fromEntries(made.equipos.map((t) => [t.espn, `${t.af}:${t.jugadores.map((p) => `${p.id}/${p.dorsal}`).join(',')}`]));
    check(dl.suggestedFilename() === 'laliga.json' && made.liga === 'esp.1' && eq['86'] === '541:1003/10,1006/5' && eq['83'] === '529:3001/8' && eq['244'] === '543:2001/22',
      `«Caras para el robot»: las plantillas en laliga.json, cada equipo con su id de ESPN; el que no sale, el de antes (${Object.entries(eq).map(([k, v]) => `${k}→${v}`).join(' · ')})`);
    check(asked.filter((a) => a.startsWith('fixtures')).length === 3 && asked.includes('teams?search=barcelona') && asked.filter((a) => a.startsWith('players/squads')).length === 2
      && /laliga\.json: 3 equipos y 4 jugadores\. Súbelo/.test(await pf.textContent('#toast')),
      `con los partidos de ayer, hoy y mañana, el nombre del que no juega y una plantilla por equipo (${asked.length} peticiones · ${await pf.textContent('#toast')})`);
    await cf.close();
  }

  // ── Tu logo: junto a la firma en cada slide, grande en el cierre y se recuerda ──
  {
    const { ctx: c7, page: p7 } = await open();
    // Sin nada guardado, la firma y el logo de Jornada90
    await p7.waitForSelector('#brandPreview:not([hidden])', { timeout: 10000 }).catch(() => {});
    const def = await p7.evaluate(() => ({ sign: document.getElementById('signInput').value, logo: !document.getElementById('brandPreview').hidden && document.getElementById('brandPreview').src.startsWith('data:image/png') }));
    check(def.sign === '@jornada90fc' && def.logo, `por defecto, la firma y el logo de Jornada90 (${def.sign} · logo: ${def.logo})`);
    await p7.setInputFiles('#brandInput', { name: 'logo.png', mimeType: 'image/png', buffer: PIXEL });
    await p7.waitForSelector('#brandPreview:not([hidden])', { timeout: 10000 }).catch(() => {});
    await pickDate(p7, '2026-09-20');
    await generate(p7, '401882865');
    const brand = () => p7.evaluate(() => ({
      foot: [...document.querySelectorAll('#slidesPreview .fc-brand')].filter((i) => !i.hidden && i.src.startsWith('data:image/png')).length,
      big: !!document.querySelector('#slide-cierre .brand-big:not([hidden])'),
      btn: document.getElementById('brandBtnText').textContent,
    }));
    const b1 = await brand();
    check(b1.foot === 7 && b1.big && b1.btn === 'Cambiar logo', `tu logo: en el pie de ${b1.foot} slides y grande en el cierre`);
    await p7.reload();
    await p7.waitForSelector('#slide-portada', { timeout: 10000 }).catch(() => {});
    const b2 = await brand();
    check(b2.foot === 7 && b2.big && !(await p7.$eval('#brandPreview', (i) => i.hidden)), 'y al volver a abrir el Studio sigue puesto');
    await p7.click('#brandDel');
    const b3 = await brand();
    check(b3.foot === 0 && !b3.big && b3.btn === 'Subir logo', '«Quitar» lo quita de las slides');
    await p7.reload();
    await p7.waitForSelector('#slide-portada', { timeout: 10000 }).catch(() => {});
    await p7.waitForTimeout(800);
    check((await brand()).foot === 0, 'y se recuerda: al volver no sale el de Jornada90');
    await c7.close();
  }

  // ── Abierto como archivo (doble clic en index.html): genera, guarda y descarga ──
  {
    const { ctx: c4, page: p4 } = await open({ url: pathToFileURL(join(REPO, 'index.html')).href });
    await pickDate(p4, '2026-09-20');
    await generate(p4, '401882865');
    check((await slideNames(p4)).length === 8, 'abierto como archivo: genera las 8 slides');
    const tease4 = await p4.$$eval('#slide-portada .tease > span', (s) => s.map((x) => x.textContent));
    check(tease4[0] === 'Desliza' && tease4[1] === 'el mejor del partido y el mapa de tiros', `sin dato, la portada invita a deslizar con lo de dentro (${tease4.join(' · ')})`);
    const [png] = await Promise.all([p4.waitForEvent('download', { timeout: 60000 }), p4.click('[data-slide-id="portada"] .slide-dl-btn')]);
    check(png.suggestedFilename() === 'futbol-atm-rma-2026-09-20-01-portada.png', `y descarga la PNG (${png.suggestedFilename()})`);
    await p4.reload();
    await p4.waitForSelector('#slide-portada', { timeout: 10000 }).catch(() => {});
    check(/Recuperado/.test(await p4.textContent('#draftStatus')), 'y al volver a abrirlo recupera el borrador');
    await c4.close();
  }

  // ── El estadio en 3D: Three.js, de node_modules (en las demás pruebas, sin red, no carga y el
  // vídeo va con el campo en 2D). La portada, los onces, el partido y el final se dibujan ──
  {
    const threeFile = (u) => join(REPO, 'node_modules', 'three', 'build', u.split('/').pop());
    const { ctx: c3d, page: p3d } = await open({
      before: (c) => c.route(/cdn\.jsdelivr\.net\/npm\/three@[\d.]+\/build\/three\.(module|core)\.js$/, (r) => r.fulfill({
        status: 200, contentType: 'application/javascript', headers: { 'access-control-allow-origin': '*' }, body: readFileSync(threeFile(r.request().url())),
      })),
    });
    await p3d.waitForFunction(() => window.StudioVideo && window.Campo3D);
    const res = await p3d.evaluate(async (data) => {
      const v = await window.StudioVideo.prepare(data, null, { intro: true });
      const at = (id) => v.scenes.find((x) => x.id === id);
      const c = document.createElement('canvas');
      c.width = 1080; c.height = 1920;
      const g = c.getContext('2d', { willReadFrequently: true });
      const goals = at('goals');
      // En cada momento, cuántos colores distintos hay en unos cuantos puntos (un fotograma vacío da 1)
      const spread = [at('score').t + 0.8, goals.t + 1.2, goals.t + goals.dur * 0.45, goals.t + goals.dur - 0.5].map((T) => {
        g.clearRect(0, 0, 1080, 1920);
        v.draw(g, T);
        return new Set([[540, 1300], [300, 1500], [800, 1100], [540, 900], [200, 700]].map(([x, y]) => g.getImageData(x, y, 1, 1).data.slice(0, 3).join())).size;
      });
      return { world: v.world, spread };
    }, videoData);
    check(res.world && res.spread.every((n) => n >= 2), `el estadio en 3D: la portada, los onces, el partido y el final (${JSON.stringify(res)})`);
    await c3d.close();
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
