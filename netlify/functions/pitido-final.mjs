// AL PITIDO FINAL · cada 5 minutos, de 13:00 a 01:59 en España (11 a 23 h UTC; los partidos de
// Europa), mira ESPN y, cuando acaba un partido de tus competiciones,
// manda un aviso al móvil con ntfy (https://ntfy.sh: la app es gratis y no pide cuenta). Al
// tocarlo se abre el Studio con ?partido=…, que genera solo el carrusel, el vídeo y la
// descripción para TikTok.
// Variables de entorno en Netlify:
// · NTFY_TOPIC: el tema al que te suscribes en la app ntfy (un nombre largo y raro, que no
//   adivine nadie). Sin ella, la función no hace nada.
// · AVISOS_LIGAS (opcional): las competiciones, con el código de ESPN y separadas por comas
//   (por defecto, esp.1,uefa.champions,esp.copa_del_rey).
// No guarda nada: para no avisar dos veces, mira los avisos que ya hay en el tema (ntfy.sh los
// guarda 12 horas).
const ESPN = 'https://site.api.espn.com/apis/site/v2/sports/soccer';
const NTFY = 'https://ntfy.sh';
const STUDIO = 'https://studio-toni.netlify.app/';
const DEFAULT_LEAGUES = ['esp.1', 'uefa.champions', 'esp.copa_del_rey'];
// Solo los que empezaron hace menos de 5 horas: al encenderlo no avisa de los de la mañana.
const RECENT = 5 * 3600e3;
const NAMES = {
  'esp.1': 'LaLiga', 'esp.2': 'LaLiga Hypermotion', 'esp.copa_del_rey': 'Copa del Rey', 'esp.w.1': 'Liga F',
  'uefa.champions': 'Champions League', 'uefa.europa': 'Europa League', 'uefa.europa.conf': 'Conference League',
  'eng.1': 'Premier League', 'ita.1': 'Serie A', 'ger.1': 'Bundesliga', 'fra.1': 'Ligue 1',
  'fifa.world': 'Mundial', 'uefa.euro': 'Eurocopa', 'uefa.nations': 'Nations League',
};

const env = (k) => globalThis.Netlify?.env.get(k) || process.env[k];
// El día en España (YYYY-MM-DD), que es como ESPN reparte los partidos en su calendario.
const madridIso = (ms) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(new Date(ms));

async function getJson(url) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    return res.ok ? await res.json() : null;
  } catch (e) {
    return null;
  }
}

// Los partidos que ya se avisaron (sus enlaces llevan ?partido=liga/id).
async function alreadySent(topic) {
  try {
    const res = await fetch(`${NTFY}/${encodeURIComponent(topic)}/json?poll=1&since=12h`, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const ids = new Set();
    for (const line of (await res.text()).split('\n')) {
      const m = line && /partido=[^/&"]+\/(\d+)/.exec(line);
      if (m) ids.add(m[1]);
    }
    return ids;
  } catch (e) {
    return null;
  }
}

// «Real Betis 1-2 Barcelona» (y los penaltis, si los hubo).
function scoreLine(e) {
  const cs = e.competitions?.[0]?.competitors || [];
  const home = cs.find(c => c.homeAway === 'home') || cs[0];
  const away = cs.find(c => c.homeAway === 'away') || cs[1];
  if (!home || !away) return e.name || 'Partido';
  const name = (c) => c.team?.shortDisplayName || c.team?.displayName || '?';
  const pens = home.shootoutScore != null && away.shootoutScore != null ? ` (${home.shootoutScore}-${away.shootoutScore} pen.)` : '';
  return `${name(home)} ${home.score ?? 0}-${away.score ?? 0} ${name(away)}${pens}`;
}

export function findFinals(boards, now, sent) {
  const out = [];
  const seen = new Set();
  for (const { league, day, data } of boards) {
    for (const e of data?.events || []) {
      const type = e.status?.type || {};
      if (type.state !== 'post' || !type.completed || seen.has(e.id) || sent.has(e.id)) continue;
      if (!(now - Date.parse(e.date) < RECENT)) continue;
      seen.add(e.id);
      out.push({
        id: e.id,
        title: `Final: ${scoreLine(e)}`,
        message: `${NAMES[league] || data.leagues?.[0]?.name || league} · Toca y se generan el vídeo, el carrusel y la descripción`,
        click: `${STUDIO}?partido=${league}/${e.id}&dia=${day}`,
      });
    }
  }
  return out;
}

export default async () => {
  const topic = env('NTFY_TOPIC');
  if (!topic) return new Response('Sin NTFY_TOPIC: no hay a quién avisar');
  const leagues = (env('AVISOS_LIGAS') || '').split(',').map(s => s.trim()).filter(Boolean);
  const now = Date.now();
  // Hoy y, de madrugada, ayer (los de América acaban pasada la medianoche).
  const days = [...new Set([madridIso(now), madridIso(now - 6 * 3600e3)])];
  const sent = await alreadySent(topic);
  // Si ntfy no responde, mejor no avisar que avisar dos veces.
  if (!sent) return new Response('ntfy no responde: se reintenta en 5 minutos', { status: 502 });
  const boards = await Promise.all((leagues.length ? leagues : DEFAULT_LEAGUES).flatMap(league => days.map(async day => ({
    league, day, data: await getJson(`${ESPN}/${league}/scoreboard?dates=${day.replaceAll('-', '')}`),
  }))));
  const finals = findFinals(boards, now, sent);
  for (const f of finals) {
    await fetch(NTFY, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ topic, title: f.title, message: f.message, click: f.click, tags: ['soccer'], priority: 4 }),
    }).catch(() => {});
  }
  return new Response(`${finals.length} aviso(s): ${finals.map(f => f.title).join(' · ') || 'ninguno'}`);
};

// Cada ejecución gasta créditos de Netlify (cómputo): solo en las horas de partidos y cada 5
// minutos, unos 160 avisos posibles al día en vez de 720.
export const config = { schedule: '*/5 11-23 * * *' };
