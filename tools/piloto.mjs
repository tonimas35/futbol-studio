// PILOTO AUTOMÁTICO · lo lanza GitHub Actions (.github/workflows/piloto.yml) cada 10 minutos en
// las horas de partidos. Cuando acaba un partido de tus competiciones (piloto.json), hace el vídeo
// con el mismo Studio, lo deja en la web y te avisa al móvil con ntfy: tocas el aviso y lo
// compartes a TikTok.
//
//   node tools/piloto.mjs buscar         los partidos acabados hace poco que aún no tienen vídeo
//   node tools/piloto.mjs video          hace sus vídeos y los sube a la release «videos»
//   node tools/piloto.mjs web <carpeta>  baja a la web los vídeos de los últimos días
//   node tools/piloto.mjs avisar         manda el aviso de cada vídeo nuevo
//
// Los vídeos y su descripción se guardan como archivos de la release «videos» del repositorio
// (<id>.mp4 y <id>.json), que es también la lista de lo que ya está hecho. Sin API-Football: desde
// los servidores de GitHub (IPs compartidas) suspendería la cuenta.
import { execFileSync } from 'node:child_process';
import { appendFileSync, createReadStream, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { extname, join, normalize, resolve } from 'node:path';

const ROOT = resolve(new URL('..', import.meta.url).pathname);
const CONFIG = JSON.parse(readFileSync(join(ROOT, 'piloto.json'), 'utf8'));
const ESPN = 'https://site.api.espn.com/apis/site/v2/sports/soccer';
const RELEASE = 'videos';
// Solo los que empezaron hace menos de 5 horas: al encenderlo no hace los de la mañana.
export const RECENT = 5 * 3600e3;

const madridIso = (ms) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(new Date(ms));
const repo = () => process.env.GITHUB_REPOSITORY || 'tonimas35/futbol-studio';
const output = (key, value) => {
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `${key}=${value}\n`);
  console.log(`${key}=${value}`);
};

async function getJson(url, headers = {}) {
  try {
    const res = await fetch(url, { headers, signal: AbortSignal.timeout(15000) });
    return res.ok ? await res.json() : null;
  } catch (e) {
    return null;
  }
}

// «Real Betis 2-5 Barcelona» (y los penaltis, si los hubo).
export function scoreLine(e) {
  const cs = e.competitions?.[0]?.competitors || [];
  const home = cs.find(c => c.homeAway === 'home') || cs[0];
  const away = cs.find(c => c.homeAway === 'away') || cs[1];
  if (!home || !away) return e.name || 'Partido';
  const name = (c) => c.team?.shortDisplayName || c.team?.displayName || '?';
  const pens = home.shootoutScore != null && away.shootoutScore != null ? ` (${home.shootoutScore}-${away.shootoutScore} pen.)` : '';
  return `${name(home)} ${home.score ?? 0}-${away.score ?? 0} ${name(away)}${pens}`;
}

// Los partidos acabados de los marcadores de ESPN que hay que hacer: recientes, sin vídeo (done) y,
// en las competiciones que no son tu liga, solo si juega uno de sus equipos (local).
export function findFinished(boards, now, done, local = null) {
  const out = [];
  const seen = new Set();
  for (const { league, day, data } of boards) {
    for (const e of data?.events || []) {
      const type = e.status?.type || {};
      if (type.state !== 'post' || !type.completed || seen.has(e.id) || done.has(e.id)) continue;
      if (!(now - Date.parse(e.date) < RECENT)) continue;
      const ids = (e.competitions?.[0]?.competitors || []).map(c => String(c.team?.id));
      if (league !== CONFIG.liga && local && !ids.some(id => local.has(id))) continue;
      seen.add(e.id);
      out.push({ league, id: e.id, day, title: scoreLine(e) });
    }
  }
  return out;
}

// Lo que ya tiene vídeo: los <id>.mp4 de la release.
async function releaseAssets() {
  const headers = process.env.GH_TOKEN ? { authorization: `Bearer ${process.env.GH_TOKEN}` } : {};
  const rel = await getJson(`https://api.github.com/repos/${repo()}/releases/tags/${RELEASE}`, headers);
  if (!rel) return [];
  const all = [];
  for (let page = 1; ; page++) {
    const list = await getJson(`https://api.github.com/repos/${repo()}/releases/${rel.id}/assets?per_page=100&page=${page}`, headers);
    if (!list?.length) break;
    all.push(...list);
    if (list.length < 100) break;
  }
  return all;
}

async function buscar() {
  // A mano (workflow_dispatch): un partido concreto, aunque ya tenga vídeo.
  const forced = (process.env.PARTIDO || '').trim();
  if (forced) {
    const [league, id] = forced.split('/');
    if (!league || !/^\d+$/.test(id || '')) throw new Error(`Partido no válido: ${forced} (tiene que ser liga/id, p. ej. esp.1/401882846)`);
    const day = /^\d{4}-\d{2}-\d{2}$/.test(process.env.DIA || '') ? process.env.DIA : madridIso(Date.now());
    output('partidos', JSON.stringify([{ league, id, day, title: forced }]));
    return;
  }
  const now = Date.now();
  // Hoy y, de madrugada, ayer.
  const days = [...new Set([madridIso(now), madridIso(now - 6 * 3600e3)])];
  const done = new Set((await releaseAssets()).map(a => a.name.match(/^(\d+)\.mp4$/)?.[1]).filter(Boolean));
  const teams = await getJson(`${ESPN}/${CONFIG.liga}/teams`);
  const local = new Set((teams?.sports?.[0]?.leagues?.[0]?.teams || []).map(t => String(t.team?.id)));
  const boards = await Promise.all(CONFIG.competiciones.flatMap(league => days.map(async day => ({
    league, day, data: await getJson(`${ESPN}/${league}/scoreboard?dates=${day.replaceAll('-', '')}`),
  }))));
  const found = findFinished(boards, now, done, local.size ? local : null);
  console.log(found.length ? `Acabados: ${found.map(f => f.title).join(' · ')}` : 'Ningún partido acabado sin vídeo');
  output('partidos', JSON.stringify(found));
}

// Un servidor de la carpeta del Studio, para abrirlo en el navegador como en la web.
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.webmanifest': 'application/manifest+json' };
export function serve() {
  const server = createServer((req, res) => {
    const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '');
    const file = join(ROOT, path.endsWith('/') ? `${path}index.html` : path);
    if (!file.startsWith(ROOT) || !existsSync(file) || !statSync(file).isFile()) {
      res.writeHead(404).end();
      return;
    }
    res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream' });
    createReadStream(file).pipe(res);
  });
  return new Promise(ok => server.listen(0, '127.0.0.1', () => ok(server)));
}

// El vídeo de un partido, como lo haría Toni: el enlace del pitido final (?partido=) genera el
// carrusel y el vídeo con lo que tenga el Studio por defecto (sin música, la firma y el logo de
// Jornada90). Luego, a H.264 para el iPhone y TikTok.
export async function makeVideo(browser, base, p, dir) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'es-ES', timezoneId: 'Europe/Madrid', acceptDownloads: true });
  try {
    const page = await ctx.newPage();
    page.on('dialog', d => d.accept());
    page.on('pageerror', e => console.warn(`  error en la página: ${e.message}`));
    await page.goto(`${base}/?partido=${p.league}/${p.id}&dia=${p.day}`);
    await page.waitForFunction(() => !document.getElementById('videoOut').hidden
      || /No se pudo|no da ese partido/.test(document.getElementById('toast').textContent), null, { timeout: 20 * 60e3 });
    if (await page.$eval('#videoOut', el => el.hidden)) throw new Error(await page.textContent('#toast'));
    const caption = await page.inputValue('#captionText');
    const title = (await page.textContent('#renderedInfo')).split(' · ')[0] || p.title;
    const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#videoDlBtn')]);
    const raw = join(dir, `${p.id}-raw.mp4`);
    await dl.saveAs(raw);
    // H.264 (el Chrome de Linux puede sacar VP9, que en el iPhone se ve negro) y listo para empezar
    // a verse antes de bajarlo entero
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', raw, '-c:v', 'libx264', '-profile:v', 'high', '-level', '4.0', '-pix_fmt', 'yuv420p',
      '-preset', 'medium', '-crf', '18', '-movflags', '+faststart', '-c:a', 'aac', '-b:a', '192k', join(dir, `${p.id}.mp4`)]);
    writeFileSync(join(dir, `${p.id}.json`), JSON.stringify({
      id: p.id, league: p.league, day: p.day, title, caption, file: dl.suggestedFilename(), made: new Date().toISOString(),
    }, null, 2));
    return { id: p.id, title, caption };
  } finally {
    await ctx.close();
  }
}

const gh = (...args) => execFileSync('gh', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] });

async function video() {
  const list = JSON.parse(process.env.PARTIDOS || '[]');
  if (!list.length) return output('hechos', '[]');
  const { chromium } = await import('playwright-core');
  const server = await serve();
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
  const dir = join(tmpdir(), 'piloto');
  mkdirSync(dir, { recursive: true });
  try { gh('release', 'view', RELEASE, '--json', 'name'); } catch (e) {
    gh('release', 'create', RELEASE, '--title', 'Vídeos del piloto automático', '--prerelease',
      '--notes', 'Los vídeos que hace el robot al pitido final (tools/piloto.mjs). Se borran solos a los 7 días.');
  }
  const made = [];
  for (const p of list) {
    console.log(`Vídeo: ${p.title} (${p.league}/${p.id})`);
    try {
      const v = await makeVideo(browser, base, p, dir);
      gh('release', 'upload', RELEASE, join(dir, `${p.id}.mp4`), join(dir, `${p.id}.json`), '--clobber');
      made.push(v);
      console.log(`  hecho: ${v.title}`);
    } catch (e) {
      console.error(`  no se pudo: ${e.message}`);
    }
  }
  await browser.close();
  server.close();
  // Los de hace más de 7 días, fuera
  const old = Date.now() - 7 * 86400e3;
  for (const a of await releaseAssets()) {
    if (Date.parse(a.created_at) < old) gh('release', 'delete-asset', RELEASE, a.name, '--yes');
  }
  output('hechos', JSON.stringify(made));
  if (list.length && !made.length) process.exitCode = 1;
}

// Los vídeos de los últimos días, a la carpeta de la web (v/), para abrirlos desde el aviso.
async function web(dir) {
  mkdirSync(dir, { recursive: true });
  const since = Date.now() - (CONFIG.diasEnLaWeb || 3) * 86400e3;
  const names = (await releaseAssets()).filter(a => Date.parse(a.created_at) >= since).map(a => a.name);
  if (names.length) gh('release', 'download', RELEASE, '--dir', dir, '--clobber', ...names.flatMap(n => ['--pattern', n]));
  console.log(`En la web: ${names.length} archivos de vídeos`);
}

// El aviso al móvil: el resultado y, al tocarlo, el vídeo listo para compartir.
export function notice(v, topic, web) {
  const url = `${web}?video=${v.id}`;
  return {
    topic, title: `⚽ ${v.title}`, message: v.caption || 'Tu vídeo está listo', click: url, tags: ['movie_camera'], priority: 4,
    actions: [{ action: 'view', label: 'Abrir el vídeo', url }],
  };
}

async function avisar() {
  const made = JSON.parse(process.env.HECHOS || '[]');
  const topic = process.env.NTFY_TOPIC || CONFIG.ntfy;
  for (const v of made) {
    const res = await fetch('https://ntfy.sh', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(notice(v, topic, CONFIG.web)) });
    console.log(`Aviso: ${v.title} (${res.status})`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [cmd, arg] = process.argv.slice(2);
  const run = { buscar, video, avisar, web: () => web(resolve(arg || '_site/v')) }[cmd];
  if (!run) {
    console.error('Uso: node tools/piloto.mjs buscar|video|web <carpeta>|avisar');
    process.exit(2);
  }
  await run();
}
