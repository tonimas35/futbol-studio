// Prueba del Studio de fútbol en un navegador de verdad (Chromium sin ventana).
//
//   node tests/test_futbol.mjs
//
// Sin red: ESPN sale de tests/fixtures (datos reales de ESPN: la jornada de LaLiga del
// 20-9-2026 con el Atlético-Real Madrid, la de Champions del 14-10-2026 con el Roma 3-4 Real
// Madrid, el LASK 3-6 Liverpool y el City 2-4 PSG, un Depor-Levante en juego, partidos sin
// empezar, la final del Mundial 2026, la vuelta del Flamengo-Independiente del Valle de la
// Libertadores, una eliminatoria de la Copa del Rey sin datos, el Lech-Leverkusen de la Europa
// League con su clasificación aparte y el Osnabrück-Bayern de la Copa de Alemania) y
// html2canvas y JSZip, de node_modules:
//   npm install --no-save playwright-core@1 html2canvas@1.4.1 jszip@3.10.1 mp4-muxer@5.2.1
// En CI usa el Chrome del runner (CHROME_PATH); en local, el Playwright instalado.
//
// Comprueba: las competiciones, la lista de partidos y su estado, generar el carrusel (las 8
// slides, el titular, el minuto a minuto sin tarjetas pisadas, los onces, la clasificación),
// la firma, el jugador del partido, retocar textos, el borrador al recargar, el ZIP 4:5 y 9:16,
// compartir, el vídeo (guion, grabar la voz con el micrófono de prueba, la mezcla y el MP4),
// «Para tu IA» (copiar y pegar), un partido en juego, uno sin alineaciones ni clasificación,
// las eliminatorias (campeón, global, quién pasa), saltar a un día con partidos, el móvil y
// abierto como archivo (con doble clic en index.html, que es como se usa).
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
  // Micrófono de mentira (un pitido) y sin preguntar: para probar la grabación de la voz.
  args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
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
async function open({ strip = [], viewport = { width: 1280, height: 900 }, url = `${base}/` } = {}) {
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
    // El resumen de un partido, la clasificación aparte o la jornada (sin fecha: la de ahora, con el calendario)
    const file = summary ? `sum-${u.searchParams.get('event')}.json`
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

  // ── El vídeo: guion automático, grabar la voz, la mezcla y el MP4 ──
  const script = await page.$$eval('#scriptLines .script-line', (ls) => ls.map((l) => [l.dataset.scene, l.querySelector('textarea').value, l.querySelector('.script-fit').className]));
  check(script.map(([id]) => id).join(',') === 'score,goals,tiros,jugador,stats,tabla,outro', `guion: una frase por escena (${script.map(([id]) => id).join(', ')})`);
  check(script[0][1] === 'Remontada del Real Madrid: 4-3 a la Roma.' && /Malen marca dos/.test(script[1][1]), `y escrita con los datos (${script[0][1]} · ${script[1][1]})`);
  check(script.every(([, , cls]) => /ok/.test(cls)), 'todas caben a ritmo normal');
  await page.fill('#scriptLines textarea[data-scene="outro"]', '¿Mbappé o Malen?');
  await page.waitForTimeout(700);

  await page.click('#voiceRecBtn');
  await page.waitForFunction(() => document.getElementById('prompter').classList.contains('live'), null, { timeout: 20000 });
  await page.waitForTimeout(2500);
  const prompter = await page.evaluate(() => ({ now: document.querySelector('#prompterLine .now')?.textContent || '', time: document.getElementById('prompterTime').textContent }));
  check(/Grabando/.test(prompter.time) && prompter.now !== '', `teleprompter: resalta la palabra que toca («${prompter.now}» · ${prompter.time})`);
  await page.waitForFunction(() => document.getElementById('prompter').hidden, null, { timeout: 60000 });
  check(!(await page.$eval('#voicePlayer', (a) => a.hidden)) && await page.$eval('#videoVoice', (c) => c.checked)
    && !(await page.$eval('#voiceSyncRow', (r) => r.hidden)), 'al acabar, la voz se escucha, va en el vídeo y sale la barra de sincronía');

  await page.click('#mixPreviewBtn');
  await page.waitForFunction(() => !document.getElementById('mixPlayer').hidden, null, { timeout: 60000 });
  check(true, '«Escuchar la mezcla» prepara el sonido');

  await page.click('#videoBtn');
  await page.waitForFunction(() => !document.getElementById('videoOut').hidden || /No se pudo/.test(document.getElementById('toast').textContent), null, { timeout: 400000 });
  const video = await page.evaluate(async () => {
    const v = document.getElementById('videoPreview');
    if (!v.src) return { toast: document.getElementById('toast').textContent };
    await new Promise((r) => (v.readyState >= 1 ? r() : v.addEventListener('loadedmetadata', r, { once: true })));
    return { name: document.getElementById('videoDlBtn').download, duration: v.duration, meta: document.getElementById('videoMeta').textContent, toast: document.getElementById('toast').textContent };
  });
  check(/^futbol-roma-rma-2026-10-14-short\.(mp4|webm)$/.test(video.name || ''), `vídeo: ${video.name} (${video.toast})`);
  check(video.duration > 33 && video.duration < 34.2, `dura unos 33,6 s: apertura, 6 escenas y el cierre (${video.duration?.toFixed(1)} s)`);
  check(video.meta === 'Lleva tu voz, música, subtítulos y la apertura con los escudos.', `lleva todo (${video.meta})`);
  await page.reload();
  await page.waitForSelector('#slide-portada');
  await page.waitForTimeout(500);
  check(!(await page.$eval('#voicePlayer', (a) => a.hidden)) && await page.inputValue('#scriptLines textarea[data-scene="outro"]') === '¿Mbappé o Malen?',
    'al recargar siguen la voz y el guion retocado');

  // ── Para tu IA: copiar el contexto y pegar la respuesta ──
  await page.click('#aiBriefBtn');
  const brief = await page.evaluate(() => navigator.clipboard.readText());
  check(/Studio Fútbol · contexto para tu IA/.test(brief) && /\*\*Partido:\*\* Roma 3 – 4 Real Madrid · Champions League/.test(brief)
    && /- Marcador \(4,8 s\): Remontada del Real Madrid/.test(brief) && /@toni_futbol/.test(brief), '«Para tu IA» copia qué es el Studio, el partido y el guion');
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
    const { ctx: c2, page: p2 } = await open({ strip: ['rosters', 'commentary', 'standings'] });
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

  // ── Abierto como archivo (doble clic en index.html): genera, guarda y descarga ──
  {
    const { ctx: c4, page: p4 } = await open({ url: pathToFileURL(join(REPO, 'index.html')).href });
    await pickDate(p4, '2026-09-20');
    await generate(p4, '401882865');
    check((await slideNames(p4)).length === 8, 'abierto como archivo: genera las 8 slides');
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
