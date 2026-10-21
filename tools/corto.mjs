// RESPUESTA · el final de un Stitch: un vídeo corto (8-15 s) para pegar en TikTok detrás de los
// 5 segundos de otro vídeo («Compartir → Pegar»), con las escenas, el jugador, los números, el
// dato y la pregunta que contestan a ese vídeo. Lo hace el mismo Studio que el robot
// (?respuesta=liga/id&guion=…, ver respuestaData en futbol.js), en un Chrome sin ventana.
// Lo usa la skill /stitch (.claude/skills/stitch/SKILL.md).
//
//   node tools/corto.mjs <liga/id> <guion.json | '{…}'> [--dia AAAA-MM-DD] [--salida archivo.mp4]
//
// El guion (todo opcional):
//   { "escenas": ["jugador", "dato", "pregunta", "marca"],
//     "jugador": "Vitinha", "etiqueta": "Los números de", "numeros": [{ "v": "94%", "texto": "Pases buenos" }],
//     "dato": { "grande": "12", "texto": "partidos sin perder… hasta hoy", "equipo": "Barcelona" },
//     "pregunta": "¿Quién para al PSG?", "titular": "Festival en París", "equipo": "PSG" }
// Escenas: marcador, jugador, dato, polemica, posesion, estadisticas, tabla, pregunta, marca.
//
// Deja el MP4 en H.264 (el del iPhone y TikTok) y escribe en la consola, en JSON, el archivo, las
// escenas que lleva, lo que dura y la descripción del partido que propone el Studio.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { serve, studio } from './piloto.mjs';

// Lo de la línea de comandos: el partido, el guion y las opciones
export function parseArgs(argv) {
  const opts = { dia: null, salida: null };
  const rest = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--dia') opts.dia = argv[++i];
    else if (argv[i] === '--salida') opts.salida = argv[++i];
    else rest.push(argv[i]);
  }
  const [partido, guion = '{}'] = rest;
  const [league, id] = String(partido || '').split('/');
  if (!/^[a-z]+\.[\w.]+$/.test(league || '') || !/^\d+$/.test(id || '')) throw new Error(`Partido no válido: «${partido || ''}» (tiene que ser liga/id de ESPN, p. ej. uefa.champions/401915399)`);
  if (opts.dia && !/^\d{4}-\d{2}-\d{2}$/.test(opts.dia)) throw new Error(`Día no válido: ${opts.dia} (AAAA-MM-DD)`);
  const text = guion.trim().startsWith('{') ? guion : readFileSync(guion, 'utf8');
  return { league, id, guion: JSON.parse(text), ...opts };
}

// El enlace del Studio que hace la respuesta
export const respuestaUrl = (base, { league, id, dia, guion }) =>
  `${base}/?respuesta=${league}/${id}${dia ? `&dia=${dia}` : ''}&guion=${encodeURIComponent(JSON.stringify(guion))}`;

async function loadChromium() {
  try { return (await import('playwright-core')).chromium; } catch (e) { /* el de la instalación global */ }
  return (await import('playwright')).chromium;
}

async function main() {
  const job = parseArgs(process.argv.slice(2));
  const out = resolve(job.salida || `respuesta-${job.id}.mp4`);
  mkdirSync(dirname(out), { recursive: true });
  const chromium = await loadChromium();
  const exe = process.env.CHROME_PATH || (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : null);
  // Con el proxy de la sesión, si lo hay (ESPN, las letras y las librerías salen de internet)
  const proxy = process.env.HTTPS_PROXY || process.env.https_proxy;
  const browser = await chromium.launch({ ...(exe ? { executablePath: exe } : {}), ...(proxy ? { proxy: { server: proxy, bypass: '127.0.0.1,localhost' } } : {}) });
  const server = await serve();
  const { ctx, page } = await studio(browser);
  // Solo los errores de la página (los avisos del navegador, mientras dibuja, son muchos)
  page.removeAllListeners('console');
  page.on('console', m => { if (m.type() === 'error') console.warn(`  consola: ${m.text()}`); });
  try {
    await page.goto(respuestaUrl(`http://127.0.0.1:${server.address().port}`, job), { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => !document.getElementById('videoOut').hidden
      || /No se pudo|no da ese partido/.test(document.getElementById('toast').textContent), null, { timeout: 10 * 60e3 });
    if (await page.$eval('#videoOut', el => el.hidden)) throw new Error(await page.textContent('#toast'));
    const escenas = await page.$eval('#videoOut', el => el.dataset.escenas || '');
    // Si se ha saltado alguna escena (el partido no tiene esos datos), lo dice
    const aviso = (await page.textContent('#toast')).match(/^Vídeo listo, sin .*/)?.[0] || '';
    const descripcion = await page.inputValue('#captionText');
    const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#videoDlBtn')]);
    const raw = join(mkdtempSync(join(tmpdir(), 'corto-')), 'raw');
    await dl.saveAs(raw);
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', raw, '-c:v', 'libx264', '-profile:v', 'high', '-level', '4.0', '-pix_fmt', 'yuv420p',
      '-preset', 'medium', '-crf', '18', '-movflags', '+faststart', '-c:a', 'aac', '-b:a', '192k', out]);
    const duracion = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', out], { encoding: 'utf8' }).trim());
    console.log(JSON.stringify({ archivo: out, escenas: escenas.split(',').filter(Boolean), duracion: Math.round(duracion * 10) / 10, aviso, descripcion }, null, 2));
  } finally {
    await ctx.close();
    await browser.close();
    server.close();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => {
    console.error(`No se pudo: ${e.message}`);
    process.exit(1);
  });
}
