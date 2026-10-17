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
import { pathToFileURL } from 'node:url';

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
const server = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1', '--directory', REPO], { stdio: 'ignore' });
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
const pngSize = (path) => execFileSync('python3', ['-c', 'import struct,sys; d=open(sys.argv[1],"rb").read(24); print(*struct.unpack(">II", d[16:24]))', path]).toString().trim();

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
  // La descripción para TikTok: el gancho con el resultado, el mejor, la pregunta y los hashtags
  const caption = (await page.inputValue('#captionText')).split('\n');
  check(caption[0] === '🤯 14 partidos sin perder… hasta hoy · Roma 3-4 Real Madrid' && /^⭐ /.test(caption[1]) && /👇$/.test(caption[2])
    && caption[3] === '#futbol #championsleague #roma #realmadrid #deportesentiktok #tiktokfootballacademy #parati',
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
  const entries = JSON.parse(execFileSync('python3', ['-c', 'import json,sys,zipfile; z=zipfile.ZipFile(sys.argv[1]); print(json.dumps([z.namelist(), z.read("caption.txt").decode()]))', zipPath]).toString());
  check(dl.suggestedFilename() === 'futbol-roma-rma-2026-10-14.zip' && entries[0].filter((n) => n.endsWith('.png')).length === 9, `ZIP con 9 PNG (${dl.suggestedFilename()})`);
  check(/ROMA 3-4 REAL MADRID/.test(entries[1]) && /#ChampionsLeague/.test(entries[1]) && /📊 Se acaba la racha de la Roma/.test(entries[1]), 'con el pie de foto (y el dato)');
  const [dlv] = await Promise.all([page.waitForEvent('download', { timeout: 120000 }), page.click('#downloadVerticalBtn')]);
  const vPath = join(dir, dlv.suggestedFilename());
  await dlv.saveAs(vPath);
  execFileSync('python3', ['-c', 'import sys,zipfile; z=zipfile.ZipFile(sys.argv[1]); open(sys.argv[2],"wb").write(z.read([n for n in z.namelist() if n.endswith(".png")][0]))', vPath, join(dir, 'v.png')]);
  check(pngSize(join(dir, 'v.png')) === '1080 1920', `9:16: ${pngSize(join(dir, 'v.png'))}`);

  // ── Compartir en dos toques ──
  await page.click('#shareCarouselBtn');
  await page.waitForFunction(() => /Toca para compartir/.test(document.querySelector('#shareCarouselBtn .label').textContent), null, { timeout: 120000 });
  await page.click('#shareCarouselBtn');
  check((await page.evaluate(() => window.__shared))[0] === 9, 'compartir manda las 9 imágenes');

  // ── El vídeo: guion automático, la mezcla y el MP4 ──
  const script = await page.$$eval('#scriptLines .script-line', (ls) => ls.map((l) => [l.dataset.scene, l.querySelector('textarea').value, l.querySelector('.script-fit').className]));
  check(script.map(([id]) => id).join(',') === 'score,dato,goals,tiros,jugador,stats,tabla,outro', `guion: una frase por escena (${script.map(([id]) => id).join(', ')})`);
  check(script[0][1] === 'Remontada del Real Madrid: 4-3 a la Roma.' && script[1][1] === 'Se acaba la racha de la Roma: 14 partidos sin perder.' && /Malen marca dos/.test(script[2][1]),
    `y escrita con los datos (${script[0][1]} · ${script[1][1]} · ${script[2][1]})`);
  check(script.every(([, , cls]) => /ok/.test(cls)), 'todas caben a ritmo normal');
  await page.fill('#scriptLines textarea[data-scene="outro"]', '¿Mbappé o Malen?');
  await page.waitForTimeout(700);

  check(!(await page.$('#voiceRecBtn')) && !(await page.$('#prompter')), 'sin «Grabar mi voz» ni teleprompter (la voz llegará de ElevenLabs)');

  // La música: épica por defecto; la urbana se elige y se recuerda.
  const mixDuration = () => page.evaluate(async () => {
    const a = document.getElementById('mixPlayer');
    await new Promise((r) => (a.readyState >= 1 ? r() : a.addEventListener('loadedmetadata', r, { once: true })));
    return a.duration;
  });
  check(await page.getAttribute('.lang-opt[data-music="epica"]', 'aria-checked') === 'true' && await page.isHidden('#mixResetBtn'), 'la música, épica por defecto');
  await page.click('#mixPreviewBtn');
  await page.waitForFunction(() => !document.getElementById('mixPlayer').hidden, null, { timeout: 120000 });
  const epicLen = await mixDuration();
  check(epicLen > 39.4 && epicLen < 40.6, `«Escuchar la mezcla» prepara la épica (${epicLen.toFixed(1)} s)`);

  await page.click('#videoBtn');
  await page.waitForFunction(() => !document.getElementById('videoOut').hidden || /No se pudo/.test(document.getElementById('toast').textContent), null, { timeout: 400000 });
  const video = await page.evaluate(async () => {
    const v = document.getElementById('videoPreview');
    if (!v.src) return { toast: document.getElementById('toast').textContent };
    await new Promise((r) => (v.readyState >= 1 ? r() : v.addEventListener('loadedmetadata', r, { once: true })));
    return { name: document.getElementById('videoDlBtn').download, duration: v.duration, meta: document.getElementById('videoMeta').textContent, toast: document.getElementById('toast').textContent };
  });
  check(/^futbol-roma-rma-2026-10-14-short\.(mp4|webm)$/.test(video.name || ''), `vídeo: ${video.name} (${video.toast})`);
  check(video.duration > 39.4 && video.duration < 40.6, `dura unos 40 s: apertura, 7 escenas, el cierre y la de tu logo (${video.duration?.toFixed(1)} s)`);
  check(video.meta === 'Lleva música épica, subtítulos y la apertura con los escudos.', `lleva todo (${video.meta})`);
  await page.click('.lang-opt[data-music="trap"]');
  check(await page.isHidden('#mixPlayer') && await page.isVisible('#mixResetBtn'), 'al cambiar a la urbana, la mezcla se rehace y sale «↺ Por defecto»');
  await page.click('#mixPreviewBtn');
  await page.waitForFunction(() => !document.getElementById('mixPlayer').hidden, null, { timeout: 120000 });
  const trapLen = await mixDuration();
  check(trapLen > 39.4 && trapLen < 40.6, `y la urbana dura lo mismo (${trapLen.toFixed(1)} s)`);
  await page.reload();
  await page.waitForSelector('#slide-portada');
  await page.waitForTimeout(500);
  check(await page.inputValue('#scriptLines textarea[data-scene="outro"]') === '¿Mbappé o Malen?', 'al recargar sigue el guion retocado');
  check(await page.getAttribute('.lang-opt[data-music="trap"]', 'aria-checked') === 'true', 'y la música elegida');
  await page.click('#mixResetBtn');
  check(await page.getAttribute('.lang-opt[data-music="epica"]', 'aria-checked') === 'true' && await page.isHidden('#mixResetBtn'), '«↺ Por defecto» vuelve a la épica');

  // ── Para tu IA: copiar el contexto y pegar la respuesta ──
  await page.click('#aiBriefBtn');
  const brief = await page.evaluate(() => navigator.clipboard.readText());
  check(/Studio Fútbol · contexto para tu IA/.test(brief) && /\*\*Partido:\*\* Roma 3 – 4 Real Madrid · Champions League/.test(brief)
    && /- Marcador \(4,8 s\): Remontada del Real Madrid/.test(brief) && /@toni_futbol/.test(brief) && /\*\*El dato\*\*[^\n]*\n- Se acaba la racha de la Roma/.test(brief),
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

    // Copa de Alemania: un apellido con «ß» (Meißner) no rompe la descarga
    await pickLeague(p5, 'ger.dfb_pokal');
    await pickDate(p5, '2026-09-02');
    await generate(p5, '401875174');
    const [zip5] = await Promise.all([p5.waitForEvent('download', { timeout: 90000 }), p5.click('#downloadBtn')]);
    check(/\.zip$/.test(zip5.suggestedFilename()), `con «ß» en un apellido, el ZIP se descarga (${zip5.suggestedFilename()})`);
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
    const { ctx: c7, page: p7 } = await open({
      url: `${base}/?partido=esp.1/401882844&dia=2026-10-16`,
      before: async (ctx) => { await ctx.clock.setFixedTime(new Date('2026-10-17T10:00:00+02:00')); },
    });
    p7.on('dialog', (d) => d.accept());
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
    await c7.close();
    // Un partido que no está: lo dice y deja el Studio como siempre.
    const { ctx: c7b, page: p7b } = await open({ url: `${base}/?partido=esp.1/999`, before: async (ctx) => { await ctx.clock.setFixedTime(new Date('2026-10-16T22:00:00+02:00')); } });
    await p7b.waitForFunction(() => /ni hoy ni ayer/.test(document.getElementById('toast').textContent), null, { timeout: 15000 }).catch(() => {});
    check(/ni hoy ni ayer/.test(await p7b.textContent('#toast')) && !(await p7b.$('#slide-portada')), 'si el partido no está, avisa y no genera nada');
    await c7b.close();

    // La función de Netlify que avisa al móvil (ntfy), con ESPN y ntfy de mentira.
    const pf = await import(join(REPO, 'netlify/functions/pitido-final.mjs'));
    const sb = JSON.parse(readFileSync(join(FIX, 'sb-esp.1-20261016.json')));
    for (const e of sb.events) if (e.id === '401882844') e.status = { ...e.status, type: { ...e.status.type, state: 'post', completed: true } };
    const posts = [];
    const realFetch = globalThis.fetch, realNow = Date.now, realTopic = process.env.NTFY_TOPIC;
    globalThis.fetch = async (url, opts = {}) => {
      url = String(url);
      if (url.startsWith('https://ntfy.sh/') && url.includes('/json?poll=1')) return new Response(posts.map((p) => JSON.stringify({ event: 'message', click: JSON.parse(p).click })).join('\n'));
      if (url === 'https://ntfy.sh' && opts.method === 'POST') { posts.push(opts.body); return new Response('{}'); }
      return new Response(JSON.stringify(url.endsWith('/esp.1/scoreboard?dates=20261016') ? sb : { events: [] }));
    };
    Date.now = () => Date.parse('2026-10-16T23:10:00+02:00');
    try {
      delete process.env.NTFY_TOPIC;
      const off = await (await pf.default()).text();
      process.env.NTFY_TOPIC = 'tema-de-prueba';
      const first = await (await pf.default()).text();
      const again = await (await pf.default()).text();
      const sent = JSON.parse(posts[0] || '{}');
      check(/Sin NTFY_TOPIC/.test(off) && posts.length === 1 && /^0 aviso/.test(again) && pf.config.schedule === '*/2 * * * *',
        `aviso al móvil: cada 2 minutos, uno por partido y sin repetir (${first})`);
      check(sent.topic === 'tema-de-prueba' && sent.title === 'Final: Deportivo 1-0 Levante' && sent.click === 'https://studio-toni.netlify.app/?partido=esp.1/401882844&dia=2026-10-16',
        `con el resultado y el enlace que lo genera todo (${sent.click})`);
      Date.now = () => Date.parse('2026-10-17T03:30:00+02:00'); // mira también el 16, pero empezó hace 6 h y media
      posts.length = 0;
      check(/^0 aviso/.test(await (await pf.default()).text()), 'y no avisa de partidos de hace horas');
    } finally {
      globalThis.fetch = realFetch;
      Date.now = realNow;
      if (realTopic === undefined) delete process.env.NTFY_TOPIC; else process.env.NTFY_TOPIC = realTopic;
    }
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

  // ── API-Football (en la web): las notas y las caras, con la función de Netlify ──
  // Las notas de este partido son de ejemplo, con el formato de API-Football (dos decimales y «0»
  // para los que no han jugado, como el portero suplente).
  {
    const asked = [];
    const afFile = (q) => (q.get('path') === 'fixtures' ? `af-fixtures-${q.get('date')}.json`
      : q.get('path') === 'fixtures/players' ? `af-players-${q.get('fixture')}.json` : '');
    const { ctx: ca, page: pa } = await open({
      before: async (c) => {
        await c.route('**/.netlify/functions/apifootball**', (r) => {
          const q = new URL(r.request().url()).searchParams;
          asked.push(q.get('path'));
          const f = afFile(q);
          return r.fulfill(json(f && existsSync(join(FIX, f)) ? readFileSync(join(FIX, f)) : '{"errors":[],"response":[]}'));
        });
        // Gollini no tiene foto: API-Football da su silueta gris
        await c.route('https://media.api-sports.io/**', (r) => r.fulfill({ status: 200, contentType: 'image/png', headers: { 'access-control-allow-origin': '*' },
          body: r.request().url().endsWith('/90000.png') ? readFileSync(join(FIX, 'af-silueta.png')) : PIXEL }));
      },
    });
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
    const face = await pa.evaluate(() => ({
      img: document.querySelector('#slide-jugador .portrait img')?.src,
      on: document.querySelector('#slide-jugador .fc-in').classList.contains('has-face'),
      badge: !!document.querySelector('#slide-jugador .portrait .badge img'),
    }));
    check(face.on && face.badge && face.img === 'https://media.api-sports.io/football/players/91008.png', `sin foto grande, su cara en un retrato con el escudo (${face.img})`);
    check(asked.join(',') === 'fixtures,fixtures/players', `con 2 peticiones (${asked.join(', ')})`);
    // Si API-Football no deja (el plan, el límite del día…), lo dice y el carrusel sale igual
    await ca.route('**/.netlify/functions/apifootball**', (r) => r.fulfill(json('{"errors":{"plan":"Free plans do not have access to this season, try from 2021 to 2023."},"response":[]}')));
    await generate(pa, '401915415');
    check(/sin las notas · API-Football: Free plans do not have access/.test(await pa.textContent('#toast')) && !(await slideNames(pa)).includes('Las notas'),
      `si el plan no deja, lo avisa y sale sin notas (${await pa.textContent('#toast')})`);
    await ca.close();
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
