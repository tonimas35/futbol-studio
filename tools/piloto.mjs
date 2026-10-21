// PILOTO AUTOMÁTICO · lo lanza GitHub Actions (.github/workflows/piloto.yml) cada 10 minutos en
// las horas de partidos. Cuando acaba un partido de tus competiciones (piloto.json), hace el vídeo
// con el mismo Studio, lo deja en la web y te avisa al móvil con ntfy: tocas el aviso y lo
// compartes a TikTok. También la previa de los partidos grandes, los onces confirmados de los
// partidos con un equipo de tu liga en cuanto ESPN los da y, al acabar la jornada de tu liga, su
// resumen en fotos.
//
//   node tools/piloto.mjs buscar         los partidos acabados hace poco que aún no tienen vídeo
//   node tools/piloto.mjs esperar        si alguno va por el final, vigila ESPN hasta su pitido final
//   node tools/piloto.mjs video          hace sus vídeos (y el resumen de la jornada) y los sube a la release «videos»
//   node tools/piloto.mjs web <carpeta>  baja a la web los vídeos de los últimos días
//   node tools/piloto.mjs avisar         manda el aviso de cada vídeo nuevo
//
// Los vídeos y su descripción se guardan como archivos de la release «videos» del repositorio
// (<id>.mp4 y <id>.json; las fotos de la jornada, jornada-…-01-portada.png…), que es también la
// lista de lo que ya está hecho. Sin API-Football: desde
// los servidores de GitHub (IPs compartidas) suspendería la cuenta.
import { execFileSync } from 'node:child_process';
import { appendFileSync, createReadStream, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// (con fileURLToPath, también en Windows)
const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
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

// Los partidos de los marcadores de ESPN que cumplen test, sin vídeo (done) y, en las competiciones
// que no son tu liga, solo si juega uno de sus equipos (local).
function pick(boards, done, local, test) {
  const out = [];
  const seen = new Set();
  for (const { league, day, data } of boards) {
    for (const e of data?.events || []) {
      if (seen.has(e.id) || done.has(e.id) || !test(e)) continue;
      const ids = (e.competitions?.[0]?.competitors || []).map(c => String(c.team?.id));
      if (league !== CONFIG.liga && local && !ids.some(id => local.has(id))) continue;
      seen.add(e.id);
      out.push({ league, id: e.id, day, title: scoreLine(e) });
    }
  }
  return out;
}

// «Real Madrid – Sevilla», para la previa.
export const vsLine = (e) => {
  const cs = e.competitions?.[0]?.competitors || [];
  const name = (c) => c?.team?.shortDisplayName || c?.team?.displayName || '?';
  return `${name(cs.find(c => c.homeAway === 'home') || cs[0])} – ${name(cs.find(c => c.homeAway === 'away') || cs[1])}`;
};

// Las previas: los partidos grandes (los de los equipos de piloto.json, en cualquier competición)
// y todos los de sus competiciones (la Champions entera) que empiezan dentro de las horas de antes
// que diga (3), y aún no tienen previa. Nada si faltan menos de 10 minutos.
export function findPrevias(boards, now, done, cfg = CONFIG.previas) {
  if (!cfg) return [];
  const out = [];
  const seen = new Set();
  for (const { league, day, data } of boards) {
    for (const e of data?.events || []) {
      const left = Date.parse(e.date) - now;
      if (e.status?.type?.state !== 'pre' || seen.has(e.id) || done.has(`${e.id}-previa`)) continue;
      if (!(left > 10 * 60e3 && left <= (cfg.horasAntes || 3) * 3600e3)) continue;
      const ids = (e.competitions?.[0]?.competitors || []).map(c => String(c.team?.id));
      const big = ids.some(id => (cfg.equipos || []).includes(id)) || (cfg.competiciones || []).includes(league);
      if (!big) continue;
      seen.add(e.id);
      out.push({ kind: 'previa', league, id: e.id, day, title: vsLine(e) });
    }
  }
  return out;
}

// Los onces confirmados: los partidos con un equipo de tu liga (local; sin la lista, los de tu
// liga) que empiezan en menos de 80 minutos y aún no tienen su vídeo. Si ESPN ya tiene los onces
// lo dice lineupsReady, con el resumen de cada uno: suelen salir una hora antes.
export const ONCES_BEFORE = 80 * 60e3;
export function findOnces(boards, now, done, local = null) {
  const out = [];
  const seen = new Set();
  for (const { league, day, data } of boards) {
    for (const e of data?.events || []) {
      const left = Date.parse(e.date) - now;
      if (e.status?.type?.state !== 'pre' || seen.has(e.id) || done.has(`${e.id}-onces`)) continue;
      if (!(left > 2 * 60e3 && left <= ONCES_BEFORE)) continue;
      const ids = (e.competitions?.[0]?.competitors || []).map(c => String(c.team?.id));
      if (local ? !ids.some(id => local.has(id)) : league !== CONFIG.liga) continue;
      seen.add(e.id);
      out.push({ kind: 'onces', league, id: e.id, day, title: vsLine(e) });
    }
  }
  return out;
}
// ¿Tiene ya ESPN los dos onces? (los dos equipos, con 11 titulares)
export const lineupsReady = (sum) => (sum?.rosters || []).length === 2
  && sum.rosters.every(r => (r.roster || []).filter(p => p.starter).length >= 11);

// Los acabados hace poco: los que hay que hacer ya.
export function findFinished(boards, now, done, local = null) {
  return pick(boards, done, local, e => e.status?.type?.state === 'post' && e.status.type.completed && now - Date.parse(e.date) < RECENT);
}

// Los que van por el final (siguen en juego y empezaron hace más de 80 minutos, ya en la segunda
// parte): el robot se queda vigilándolos para hacer el vídeo nada más acabar, en vez de esperar a
// su siguiente vuelta de 10 minutos.
export const NEAR_END = 80 * 60e3;
export function findNearEnd(boards, now, done, local = null) {
  return pick(boards, done, local, e => e.status?.type?.state === 'in' && now - Date.parse(e.date) > NEAR_END && now - Date.parse(e.date) < RECENT);
}

// La jornada de tu liga que acaba de terminar: la del último partido acabado hace poco, con los
// partidos de los días de alrededor (hasta 4 antes y 4 después) mientras ningún equipo repita, como
// la cuenta el Studio. Solo si ya no le queda ninguno por jugar (los aplazados no cuentan), tiene
// al menos 5 partidos (no un aplazado jugado entre semana) y aún no tiene sus fotos.
const OFF = /POSTPONED|CANCELED|CANCELLED|ABANDONED|SUSPENDED|FORFEIT/;
export function findJornada(boards, now, done, league = CONFIG.liga) {
  const days = boards.filter(b => b.league === league).sort((a, b) => a.day.localeCompare(b.day));
  const games = (b) => (b.data?.events || []).filter(e => !OFF.test(e.status?.type?.name || ''));
  const teams = (e) => (e.competitions?.[0]?.competitors || []).map(c => String(c.team?.id));
  const last = days.flatMap(b => games(b).filter(e => e.status?.type?.state === 'post' && now - Date.parse(e.date) < RECENT).map(e => ({ b, e })))
    .sort((x, y) => Date.parse(y.e.date) - Date.parse(x.e.date))[0];
  if (!last) return [];
  const at = days.indexOf(last.b);
  const list = [...games(last.b)];
  const seen = new Set(list.flatMap(teams));
  for (const dir of [-1, 1]) {
    for (let i = at + dir; i >= 0 && i < days.length && Math.abs(i - at) <= 4; i += dir) {
      const gs = games(days[i]);
      if (gs.some(e => teams(e).some(id => seen.has(id)))) break;
      gs.forEach(e => { list.push(e); teams(e).forEach(id => seen.add(id)); });
    }
  }
  if (list.length < 5 || list.some(e => e.status?.type?.state !== 'post')) return [];
  const from = list.map(e => madridIso(Date.parse(e.date))).sort()[0];
  const id = `jornada-${league.replace(/\./g, '-')}-${from}`;
  return done.has(id) ? [] : [{ kind: 'jornada', league, id, day: last.b.day, title: `Jornada de ${league} (${list.length} partidos)` }];
}

// Lo que ya está hecho: los <id>.mp4 de la release (y el <id>.json de cada jornada). Si GitHub no
// contesta, error: sin la lista, el robot repetiría cada 10 minutos los vídeos y los avisos.
async function releaseAssets() {
  const headers = process.env.GH_TOKEN ? { authorization: `Bearer ${process.env.GH_TOKEN}` } : {};
  const get = async (url) => {
    const res = await fetch(url, { headers, signal: AbortSignal.timeout(15000) }).catch(() => null);
    if (res?.status === 404) return null;
    if (!res?.ok) throw new Error(`GitHub no deja leer la release «${RELEASE}» (${res?.status || 'sin respuesta'}): sin ella no se sabe qué está hecho`);
    return res.json();
  };
  const rel = await get(`https://api.github.com/repos/${repo()}/releases/tags/${RELEASE}`);
  if (!rel) return []; // aún no hay release: no hay nada hecho
  const all = [];
  for (let page = 1; ; page++) {
    const list = await get(`https://api.github.com/repos/${repo()}/releases/${rel.id}/assets?per_page=100&page=${page}`) || [];
    all.push(...list);
    if (list.length < 100) break;
  }
  return all;
}

async function buscar() {
  // A mano (workflow_dispatch): un partido concreto, aunque ya tenga vídeo.
  // Con «previa:» u «onces:» delante, su previa o sus onces; con «jornada:liga», el resumen de la
  // jornada de ese día.
  const forced = (process.env.PARTIDO || '').trim();
  const day = /^\d{4}-\d{2}-\d{2}$/.test(process.env.DIA || '') ? process.env.DIA : madridIso(Date.now());
  if (/^jornada:/i.test(forced)) {
    const league = forced.replace(/^jornada:/i, '');
    if (!/^[a-z]+\.[\w.]+$/.test(league)) throw new Error(`Liga no válida: ${forced} (p. ej. jornada:esp.1)`);
    output('partidos', JSON.stringify([{ kind: 'jornada', league, id: `jornada-${league.replace(/\./g, '-')}`, day, title: `Jornada de ${league}` }]));
    return;
  }
  if (forced) {
    const kind = (forced.match(/^(previa|onces):/i)?.[1] || 'final').toLowerCase();
    const [league, id] = forced.replace(/^(previa|onces):/i, '').split('/');
    if (!league || !/^\d+$/.test(id || '')) throw new Error(`Partido no válido: ${forced} (tiene que ser liga/id, p. ej. esp.1/401882846, previa:esp.1/401882846, onces:esp.1/401882846 o jornada:esp.1)`);
    output('partidos', JSON.stringify([{ kind, league, id, day, title: `${league}/${id}` }]));
    return;
  }
  const { found, near, previas, onces, jornadas } = await scan();
  console.log(found.length ? `Acabados: ${found.map(f => f.title).join(' · ')}`
    : near.length ? `Por el final: ${near.map(f => f.title).join(' · ')}` : 'Ningún partido acabado sin vídeo');
  if (previas.length) console.log(`Previas: ${previas.map(f => f.title).join(' · ')}`);
  if (onces.length) console.log(`Onces confirmados: ${onces.map(f => f.title).join(' · ')}`);
  if (jornadas.length) console.log(`Jornada acabada: ${jornadas.map(f => f.title).join(' · ')}`);
  // Los onces, primero: tienen que llegar antes de que empiece el partido
  output('partidos', JSON.stringify([...onces, ...found, ...previas, ...jornadas]));
  output('cerca', String(!found.length && !previas.length && !onces.length && !jornadas.length && near.length > 0));
}

// Los marcadores de hoy (y, de madrugada, de ayer): los acabados sin vídeo y los que van por el final.
async function scan(ctx = {}) {
  const now = Date.now();
  const days = [...new Set([madridIso(now), madridIso(now - 6 * 3600e3)])];
  ctx.done ??= new Set((await releaseAssets()).map(a => (a.name.match(/^(\d+(?:-previa|-onces)?)\.mp4$/) || a.name.match(/^(jornada-[\w-]+)\.json$/))?.[1]).filter(Boolean));
  if (!ctx.local) {
    const teams = await getJson(`${ESPN}/${CONFIG.liga}/teams`);
    const ids = (teams?.sports?.[0]?.leagues?.[0]?.teams || []).map(t => String(t.team?.id));
    ctx.local = ids.length ? new Set(ids) : null;
  }
  const board = async (league, day) => ({ league, day, data: await getJson(`${ESPN}/${league}/scoreboard?dates=${day.replaceAll('-', '')}`) });
  const boards = await Promise.all(CONFIG.competiciones.flatMap(league => days.map(day => board(league, day))));
  // Si en tu liga ya no queda nada por jugar y alguno acabó hace poco, los días de alrededor, para
  // ver si era el último de la jornada (guardados mientras se espera).
  let jornadas = [];
  const mine = boards.filter(b => b.league === CONFIG.liga);
  const evs = mine.flatMap(b => b.data?.events || []).filter(e => !OFF.test(e.status?.type?.name || ''));
  if (evs.some(e => e.status?.type?.state === 'post' && now - Date.parse(e.date) < RECENT) && evs.every(e => e.status?.type?.state === 'post')) {
    const anchor = mine.find(b => (b.data?.events || []).some(e => e.status?.type?.state === 'post'))?.day || days[0];
    ctx.around ??= {};
    const around = await Promise.all([-4, -3, -2, -1, 1, 2, 3, 4].map(k => madridIso(Date.parse(`${anchor}T12:00Z`) + k * 86400e3))
      .filter(day => !days.includes(day))
      .map(async day => (ctx.around[day] ??= await board(CONFIG.liga, day))));
    jornadas = findJornada([...mine, ...around], now, ctx.done);
  }
  // Los onces: de los que empiezan pronto, los que ESPN ya tiene (su resumen, uno a uno)
  const soon = findOnces(boards, now, ctx.done, ctx.local);
  const ready = await Promise.all(soon.map(async o => lineupsReady(await getJson(`${ESPN}/${o.league}/summary?event=${o.id}`))));
  return {
    found: findFinished(boards, now, ctx.done, ctx.local),
    near: findNearEnd(boards, now, ctx.done, ctx.local),
    previas: findPrevias(boards, now, ctx.done),
    onces: soon.filter((o, i) => ready[i]),
    jornadas,
  };
}

// Con un partido por el final: mira ESPN cada 30 segundos (con el navegador y ffmpeg ya preparados)
// hasta que acabe alguno, como mucho 50 minutos (la prórroga y los penaltis caben).
async function esperar() {
  const ctx = {};
  const until = Date.now() + 50 * 60e3;
  while (Date.now() < until) {
    await new Promise(ok => setTimeout(ok, 30e3));
    const { found, near, jornadas } = await scan(ctx);
    if (found.length) {
      console.log(`Pitido final: ${found.map(f => f.title).join(' · ')}`);
      if (jornadas.length) console.log(`Y se acaba la jornada: ${jornadas.map(f => f.title).join(' · ')}`);
      return output('partidos', JSON.stringify([...found, ...jornadas]));
    }
    if (!near.length) break;
  }
  console.log('Ninguno ha acabado mientras esperaba');
  output('partidos', '[]');
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

// LA VOZ · con «Con voz y subtítulos» (por defecto va sin ellos mientras se mejora la voz; el botón
// del aviso hace el partido con ellos), el Studio le pide al robot cada frase del guion dicha con la
// voz clonada (window.fsVoz) y el vídeo dura lo que pide cada una. Dos motores (piloto.json → voz.motor; si el elegido no está
// puesto, el otro):
//  · «qwen»: Qwen3-TTS (Apache-2.0) en Modal (tools/voz_modal.py), con VOZ_URL (una variable del
//    repo: la dirección del servicio) y MODAL_KEY y MODAL_SECRET (secretos: su Proxy Auth Token).
//  · «elevenlabs»: ELEVENLABS_API_KEY (un secreto) y ELEVENLABS_VOICE_ID (una variable).
// Sin ninguno, o si falla (sin saldo, caído), el vídeo sale como siempre, con subtítulos. Las
// claves solo están aquí, en Node: la página no las ve.
const VOZ = { motor: 'qwen', modelo: 'eleven_multilingual_v2', velocidad: 1.05, ...CONFIG.voz };

// Lo que se le manda a ElevenLabs: los marcadores dichos («4-1» → «4 a 1»). Cada palabra del guion
// sabe cuántas dichas le tocan, para poner los subtítulos con lo que suena.
export function spokenWords(text) {
  const said = String(text || '').trim().split(/\s+/).filter(Boolean).map(w => w.replace(/^(\d+)-(\d+)([.,:;!?…]*)$/, '$1 a $2$3'));
  return { text: said.join(' '), counts: said.map(w => w.split(' ').length) };
}

// De los tiempos de cada letra (los da ElevenLabs) a los de cada palabra del guion. Si no
// cuadran, null: el Studio las reparte por lo que dura la frase.
export function wordTimes(alignment, counts) {
  const ch = alignment?.characters || [], st = alignment?.character_start_times_seconds || [], en = alignment?.character_end_times_seconds || [];
  const said = [];
  let cur = null;
  ch.forEach((c, i) => {
    if (/\s/.test(c)) cur = null;
    else if (cur) cur[1] = en[i];
    else said.push(cur = [st[i], en[i]]);
  });
  if (!said.length || said.length !== counts.reduce((a, b) => a + b, 0)) return null;
  let k = 0;
  return counts.map(n => [said[k][0], said[(k += n) - 1][1]]);
}

// Las frases, una a una (con la de antes y la de después, para que suenen seguidas):
// { idDeEscena: { audio (MP3 en base64), times } }. Si una falla, ninguna: o todo con voz o nada.
export async function voiceLines(lines, { key, voice, fetchFn = fetch } = {}) {
  const said = lines.map(l => spokenWords(l.text));
  const out = {};
  for (const [i, l] of lines.entries()) {
    const res = await fetchFn(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voice)}/with-timestamps?output_format=mp3_44100_128`, {
      method: 'POST',
      headers: { 'xi-api-key': key, 'content-type': 'application/json' },
      body: JSON.stringify({
        text: said[i].text, model_id: VOZ.modelo,
        previous_text: said[i - 1]?.text || null, next_text: said[i + 1]?.text || null,
        voice_settings: { stability: 0.45, similarity_boost: 0.8, style: 0.2, use_speaker_boost: true, speed: VOZ.velocidad },
      }),
      signal: AbortSignal.timeout(60000),
    });
    if (!res.ok) throw new Error(`ElevenLabs ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const j = await res.json();
    if (!j.audio_base64) throw new Error('ElevenLabs no ha devuelto el audio');
    out[l.id] = { audio: j.audio_base64, times: wordTimes(j.alignment, said[i].counts) };
  }
  return out;
}

// Con Qwen3-TTS en Modal: todas las frases en una petición (la tarjeta se enciende una vez; con el
// arranque, un minuto o así). Devuelve WAV y sin los tiempos de cada palabra: el Studio reparte los
// subtítulos por lo que dura la frase (con la voz clonada, unas centésimas de desfase).
export async function qwenLines(lines, { url, key, secret, fetchFn = fetch } = {}) {
  const res = await fetchFn(url, {
    method: 'POST',
    headers: { 'Modal-Key': key, 'Modal-Secret': secret, 'content-type': 'application/json' },
    body: JSON.stringify({ lines: lines.map(l => ({ id: l.id, text: spokenWords(l.text).text })) }),
    signal: AbortSignal.timeout(10 * 60e3),
  });
  if (!res.ok) throw new Error(`Modal ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const j = await res.json();
  const missing = lines.find(l => !j[l.id]?.audio);
  if (missing) throw new Error(`Modal no ha devuelto la frase «${missing.id}»`);
  return Object.fromEntries(lines.map(l => [l.id, { audio: j[l.id].audio, times: j[l.id].times || null }]));
}

// El motor de la voz con lo que haya puesto (null: sin voz)
export function voiceEngine(env = process.env, motor = VOZ.motor) {
  const engines = {
    qwen: env.VOZ_URL && env.MODAL_KEY && env.MODAL_SECRET
      && { name: 'Qwen3-TTS en Modal', say: lines => qwenLines(lines, { url: env.VOZ_URL, key: env.MODAL_KEY, secret: env.MODAL_SECRET }) },
    elevenlabs: env.ELEVENLABS_API_KEY && env.ELEVENLABS_VOICE_ID
      && { name: 'ElevenLabs', say: lines => voiceLines(lines, { key: env.ELEVENLABS_API_KEY, voice: env.ELEVENLABS_VOICE_ID }) },
  };
  return engines[motor] || engines[motor === 'qwen' ? 'elevenlabs' : 'qwen'] || null;
}

// El vídeo de un partido, como lo haría Toni: el enlace del pitido final (?partido=) genera el
// carrusel y el vídeo con lo que tenga el Studio por defecto (sin música, la firma y el logo de
// Jornada90). Luego, a H.264 para el iPhone y TikTok.
// El Studio en una pestaña nueva, en español y con la hora de Madrid.
export async function studio(browser) {
  // Como un Chrome normal: ESPN contesta 403 (y sin CORS) al «HeadlessChrome» del modo sin ventana
  const userAgent = `Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${browser.version()} Safari/537.36`;
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'es-ES', timezoneId: 'Europe/Madrid', acceptDownloads: true, userAgent });
  const page = await ctx.newPage();
  page.on('dialog', d => d.accept());
  // Lo que falle dentro, en el registro de GitHub Actions
  page.on('pageerror', e => console.warn(`  error en la página: ${e.message}`));
  page.on('console', m => { if (/error|warn/.test(m.type())) console.warn(`  consola: ${m.text()}`); });
  page.on('requestfailed', r => { if (!r.url().startsWith('blob:')) console.warn(`  sin respuesta: ${r.url()} (${r.failure()?.errorText})`); });
  page.on('response', r => { if (r.status() >= 400) console.warn(`  ${r.status()}: ${r.url()}`); });
  return { ctx, page };
}

export async function makeVideo(browser, base, p, dir) {
  const { ctx, page } = await studio(browser);
  try {
    const engine = voiceEngine();
    if (engine) {
      await page.exposeFunction('fsVoz', async (lines) => {
        try {
          const t = Date.now();
          const clips = await engine.say(lines);
          console.log(`  voz (${engine.name}): ${lines.length} frases, ${lines.reduce((n, l) => n + l.text.length, 0)} caracteres, en ${Math.round((Date.now() - t) / 1000)} s`);
          return clips;
        } catch (e) {
          console.warn(`  sin voz: ${e.message}`);
          return null;
        }
      });
    }
    // La previa y los onces, con su propio vídeo (<id>-previa, <id>-onces)
    const pre = p.kind === 'previa' || p.kind === 'onces';
    const file = pre ? `${p.id}-${p.kind}` : p.id;
    // Sin esperar a todas las imágenes: lo que importa es el vídeo, y el Studio espera a sus letras
    await page.goto(`${base}/?${pre ? p.kind : 'partido'}=${p.league}/${p.id}&dia=${p.day}`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => !document.getElementById('videoOut').hidden
      || /No se pudo|no da ese partido|aún no tiene los onces/.test(document.getElementById('toast').textContent), null, { timeout: 20 * 60e3 });
    if (await page.$eval('#videoOut', el => el.hidden)) throw new Error(await page.textContent('#toast'));
    const caption = await page.inputValue('#captionText');
    // Si lleva la voz (y los subtítulos): si no, el aviso no ofrece hacerlo «sin voz»
    const voz = await page.$eval('#videoOut', el => el.dataset.voz === 'si');
    const title = pre ? await page.$eval('#videoOut', el => el.dataset.title || '') || `${p.kind === 'onces' ? 'Onces' : 'Previa'} · ${p.title}`
      : (await page.textContent('#renderedInfo')).split(' · ')[0] || p.title;
    const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#videoDlBtn')]);
    const raw = join(dir, `${file}-raw.mp4`);
    await dl.saveAs(raw);
    // H.264 (el Chrome de Linux puede sacar VP9, que en el iPhone se ve negro) y listo para empezar
    // a verse antes de bajarlo entero
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', raw, '-c:v', 'libx264', '-profile:v', 'high', '-level', '4.0', '-pix_fmt', 'yuv420p',
      '-preset', 'medium', '-crf', '18', '-movflags', '+faststart', '-c:a', 'aac', '-b:a', '192k', join(dir, `${file}.mp4`)]);
    writeFileSync(join(dir, `${file}.json`), JSON.stringify({
      id: file, league: p.league, day: p.day, title, caption, voz, file: dl.suggestedFilename(), made: new Date().toISOString(),
    }, null, 2));
    return { id: file, kind: p.kind || 'final', league: p.league, day: p.day, title, caption, files: [`${file}.mp4`, `${file}.json`] };
  } finally {
    await ctx.close();
  }
}

// El resumen de la jornada, como lo haría Toni: el enlace ?jornada= hace el carrusel y se baja en
// 9:16 para TikTok (el ZIP con las fotos y la descripción). Las fotos quedan como
// jornada-esp-1-2026-10-16-01-portada.png…, y su lista en jornada-esp-1-2026-10-16.json.
export async function makeJornada(browser, base, p, dir) {
  const { ctx, page } = await studio(browser);
  try {
    await page.goto(`${base}/?jornada=${p.league}&dia=${p.day}`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => !document.getElementById('jornadaSection').hidden
      || /No se pudo|No hay partidos/.test(document.getElementById('toast').textContent), null, { timeout: 5 * 60e3 });
    if (await page.$eval('#jornadaSection', el => el.hidden)) throw new Error(await page.textContent('#toast'));
    // «LaLiga · 16-19 oct 2026 · 10 partidos»
    const [comp, dates] = (await page.textContent('#jornadaInfo')).split(' · ');
    const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 10 * 60e3 }), page.click('#jornadaZipVBtn')]);
    const id = dl.suggestedFilename().replace(/^futbol-/, '').replace(/(-9x16)?\.zip$/, '');
    const zip = join(dir, `${id}.zip`), out = join(dir, `${id}-zip`);
    await dl.saveAs(zip);
    mkdirSync(out, { recursive: true });
    execFileSync('unzip', ['-q', '-o', zip, '-d', out]);
    const pngs = readdirSync(out).filter(n => n.endsWith('.png')).sort();
    if (!pngs.length) throw new Error('el ZIP de la jornada no trae fotos');
    const images = pngs.map(n => n.replace(/^futbol-/, ''));
    pngs.forEach((n, i) => renameSync(join(out, n), join(dir, images[i])));
    const caption = readFileSync(join(out, 'caption.txt'), 'utf8');
    const title = `Así fue la jornada · ${comp}${dates ? ` · ${dates}` : ''}`;
    writeFileSync(join(dir, `${id}.json`), JSON.stringify({
      id, kind: 'jornada', league: p.league, day: p.day, title, caption, images, made: new Date().toISOString(),
    }, null, 2));
    // El .json al final: es lo que dice que ya está hecha
    return { id, kind: 'jornada', title, caption, files: [...images, `${id}.json`] };
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
    console.log(`${p.kind === 'jornada' ? 'Jornada' : 'Vídeo'}: ${p.title} (${p.league}/${p.id})`);
    try {
      const { files, ...v } = await (p.kind === 'jornada' ? makeJornada : makeVideo)(browser, base, p, dir);
      gh('release', 'upload', RELEASE, ...files.map(f => join(dir, f)), '--clobber');
      made.push(v);
      console.log(`  hecho: ${v.title}`);
    } catch (e) {
      console.error(`  no se pudo: ${e.message}`);
    }
  }
  await browser.close();
  server.close();
  // Los de hace más de 7 días, fuera (si GitHub no contesta, la próxima vez)
  const old = Date.now() - 7 * 86400e3;
  for (const a of await releaseAssets().catch(() => [])) {
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

// El aviso al móvil: el resultado y, al tocarlo, el vídeo (o las fotos de la jornada) listo para
// compartir. Si la web no se ha podido publicar (GitHub Pages sin activar), el vídeo tal cual,
// desde la release (o la release entera, con las fotos).
// El aviso al móvil. El de un partido acabado abre el Studio con ese partido (&preparar=1): tu
// móvil pide las notas a API-Football con tu clave (el robot no puede) y te deja en «Crear vídeo»;
// el vídeo del robot (sin notas), en su botón. El de los onces, igual: te deja en «Crear onces»,
// para hacerlo con las caras de API-Football de los dos equipos. Las previas y la jornada, lo del robot.
export function notice(v, topic, web, webOk = true) {
  const photos = v.kind === 'jornada';
  const url = webOk ? `${web}?video=${v.id}`
    : `https://github.com/${repo()}/releases/${photos ? `tag/${RELEASE}` : `download/${RELEASE}/${v.id}.mp4`}`;
  const onces = v.kind === 'onces';
  const studio = webOk && !photos && v.kind !== 'previa' && v.league && v.day
    ? `${web}?${onces ? 'onces' : 'partido'}=${v.league}/${String(v.id).replace(/-onces$/, '')}&dia=${v.day}&preparar=1` : null;
  return {
    topic, title: `${{ previa: '🔥', onces: '📋', jornada: '📊' }[v.kind] || '⚽'} ${v.title}`, message: v.caption || (photos ? 'Tus fotos están listas' : 'Tu vídeo está listo'),
    click: studio || url, tags: [photos ? 'frame_with_picture' : 'movie_camera'], priority: onces ? 5 : 4,
    actions: studio ? [{ action: 'view', label: onces ? 'Crear los onces con caras' : 'Crear el vídeo con notas', url: studio }, { action: 'view', label: 'Vídeo del robot', url }]
      : [{ action: 'view', label: photos ? 'Abrir las fotos' : 'Abrir el vídeo', url }],
  };
}

async function avisar() {
  const made = JSON.parse(process.env.HECHOS || '[]');
  const topic = process.env.NTFY_TOPIC || CONFIG.ntfy;
  for (const v of made) {
    const res = await fetch('https://ntfy.sh', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(notice(v, topic, CONFIG.web, process.env.WEB !== 'failure')) });
    console.log(`Aviso: ${v.title} (${res.status})`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [cmd, arg] = process.argv.slice(2);
  const run = { buscar, esperar, video, avisar, web: () => web(resolve(arg || '_site/v')) }[cmd];
  if (!run) {
    console.error('Uso: node tools/piloto.mjs buscar|esperar|video|web <carpeta>|avisar');
    process.exit(2);
  }
  await run();
}
