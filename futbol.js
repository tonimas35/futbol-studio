/* ============================================================
   STUDIO FÚTBOL — carruseles de fútbol con los datos de ESPN
   Eliges competición, día y partido, generas el carrusel, lo retocas y lo descargas: editar
   textos, ver en grande, borradores, ZIP 4:5 y 9:16, compartir y cambiar la foto de un jugador.
   Es una herramienta personal: se abre con doble clic en index.html, sin servidor.
   ============================================================ */

(() => {
  'use strict';

  // ----------------------------------------------------------
  // CONFIG
  // ----------------------------------------------------------
  // ESPN — datos de fútbol gratis, sin auth y con CORS abierto (también desde un archivo local)
  const ESPN = 'https://site.api.espn.com/apis/site/v2/sports/soccer';
  const LOGO = (id) => `https://a.espncdn.com/i/teamlogos/soccer/500/${id}.png`;

  // [código de ESPN, nombre en el botón, nombre en las slides, hashtag]
  const COMPETITIONS = [
    { group: 'España', items: [
      ['esp.1', 'LaLiga', 'LaLiga', 'LaLiga'],
      ['esp.2', 'LaLiga Hypermotion', 'LaLiga Hypermotion', 'LaLigaHypermotion'],
      ['esp.copa_del_rey', 'Copa del Rey', 'Copa del Rey', 'CopaDelRey'],
      ['esp.super_cup', 'Supercopa', 'Supercopa de España', 'Supercopa'],
      ['esp.w.1', 'Liga F', 'Liga F', 'LigaF'],
    ] },
    { group: 'Europa', items: [
      ['uefa.champions', 'Champions', 'Champions League', 'ChampionsLeague'],
      ['uefa.europa', 'Europa League', 'Europa League', 'EuropaLeague'],
      ['uefa.europa.conf', 'Conference', 'Conference League', 'ConferenceLeague'],
    ] },
    { group: 'Grandes ligas', items: [
      ['eng.1', 'Premier League', 'Premier League', 'PremierLeague'],
      ['ita.1', 'Serie A', 'Serie A', 'SerieA'],
      ['ger.1', 'Bundesliga', 'Bundesliga', 'Bundesliga'],
      ['fra.1', 'Ligue 1', 'Ligue 1', 'Ligue1'],
      ['por.1', 'Liga Portugal', 'Liga Portugal', 'LigaPortugal'],
      ['ned.1', 'Eredivisie', 'Eredivisie', 'Eredivisie'],
      ['eng.fa', 'FA Cup', 'FA Cup', 'FACup'],
      ['eng.league_cup', 'Carabao Cup', 'Carabao Cup', 'CarabaoCup'],
    ] },
    { group: 'Selecciones', items: [
      ['fifa.world', 'Mundial', 'Mundial', 'Mundial'],
      ['uefa.euro', 'Eurocopa', 'Eurocopa', 'Eurocopa'],
      ['uefa.nations', 'Nations League', 'Nations League', 'NationsLeague'],
      ['fifa.worldq.uefa', 'Clasificación Mundial', 'Clasificación para el Mundial', 'Mundial'],
      ['fifa.friendly', 'Amistosos', 'Amistoso internacional', 'Selección'],
    ] },
    { group: 'América y más', items: [
      ['conmebol.libertadores', 'Libertadores', 'Copa Libertadores', 'Libertadores'],
      ['mex.1', 'Liga MX', 'Liga MX', 'LigaMX'],
      ['arg.1', 'Liga Argentina', 'Liga Profesional Argentina', 'LigaProfesional'],
      ['bra.1', 'Brasileirão', 'Brasileirão', 'Brasileirao'],
      ['usa.1', 'MLS', 'MLS', 'MLS'],
      ['ksa.1', 'Liga Saudí', 'Liga Saudí', 'SaudiProLeague'],
      ['fifa.cwc', 'Mundial de Clubes', 'Mundial de Clubes', 'MundialDeClubes'],
    ] },
  ];
  const COMP = {};
  COMPETITIONS.forEach(g => g.items.forEach(([slug, chip, name, tag]) => { COMP[slug] = { slug, chip, name, tag }; }));
  const compOf = (slug) => COMP[slug] || { slug, chip: slug, name: slug, tag: 'Futbol' };
  // Competiciones de selecciones: «España», sin artículo (en los clubes, «el Atlético»).
  const NATIONAL = new Set(['fifa.world', 'uefa.euro', 'uefa.nations', 'fifa.worldq.uefa', 'fifa.friendly']);
  const DEFAULT_LEAGUE = 'esp.1';
  const LEAGUE_KEY = 'fc-league';
  const SIGN_KEY = 'fc-sign';

  // La fase, en las copas (en las ligas ESPN pone el nombre de la temporada y no se usa).
  const PHASES = {
    'league-phase': 'Fase liga', 'group-stage': 'Fase de grupos', 'knockout-round-playoffs': 'Playoff',
    'round-of-32': 'Dieciseisavos', 'round-of-16': 'Octavos', 'quarterfinals': 'Cuartos',
    'semifinals': 'Semifinales', 'final': 'Final', 'third-place': 'Tercer puesto',
  };

  // ----------------------------------------------------------
  // NOMBRES EN ESPAÑOL · ESPN los da en inglés
  // ----------------------------------------------------------
  // Clubes: [nombre largo, corto]
  const CLUB_NAMES = {
    'Atlético Madrid': ['Atlético de Madrid', 'Atlético'],
    'Athletic Club': ['Athletic Club', 'Athletic'],
    'Celta Vigo': ['Celta', 'Celta'],
    'Racing Santander': ['Racing de Santander', 'Racing'],
    'Rayo Vallecano': ['Rayo Vallecano', 'Rayo'],
    'Real Betis': ['Real Betis', 'Betis'],
    'Deportivo': ['Deportivo', 'Depor'],
    'Bayern Munich': ['Bayern Múnich', 'Bayern'],
    'Internazionale': ['Inter', 'Inter'],
    'AC Milan': ['Milan', 'Milan'],
    'AS Roma': ['Roma', 'Roma'],
    'Paris Saint-Germain': ['PSG', 'PSG'],
    'Manchester City': ['Manchester City', 'Man. City'],
    'Manchester United': ['Manchester United', 'Man. United'],
    'Tottenham Hotspur': ['Tottenham', 'Tottenham'],
    'Nottingham Forest': ['Nottingham Forest', 'Forest'],
    'Brighton & Hove Albion': ['Brighton', 'Brighton'],
    'Borussia Dortmund': ['Borussia Dortmund', 'Dortmund'],
    'Borussia Mönchengladbach': ['Borussia Mönchengladbach', "M'gladbach"],
    'Bayer Leverkusen': ['Bayer Leverkusen', 'Leverkusen'],
    'FC Cologne': ['Colonia', 'Colonia'],
    'Sporting CP': ['Sporting de Portugal', 'Sporting'],
    'LASK Linz': ['LASK', 'LASK'],
  };
  const COUNTRY_NAMES = {
    Spain: 'España', Germany: 'Alemania', France: 'Francia', England: 'Inglaterra', Italy: 'Italia',
    Netherlands: 'Países Bajos', Belgium: 'Bélgica', Croatia: 'Croacia', Brazil: 'Brasil', Morocco: 'Marruecos',
    'United States': 'Estados Unidos', USA: 'Estados Unidos', Mexico: 'México', Switzerland: 'Suiza', Denmark: 'Dinamarca',
    Scotland: 'Escocia', Wales: 'Gales', Turkey: 'Turquía', 'Türkiye': 'Turquía', Poland: 'Polonia', Norway: 'Noruega',
    Sweden: 'Suecia', Japan: 'Japón', 'South Korea': 'Corea del Sur', 'Korea Republic': 'Corea del Sur', Peru: 'Perú',
    Canada: 'Canadá', Ukraine: 'Ucrania', Czechia: 'Chequia', 'Czech Republic': 'Chequia', Greece: 'Grecia',
    Hungary: 'Hungría', Romania: 'Rumanía', 'Republic of Ireland': 'Irlanda', Ireland: 'Irlanda',
    'Northern Ireland': 'Irlanda del Norte', Iceland: 'Islandia', Finland: 'Finlandia', Slovakia: 'Eslovaquia',
    Slovenia: 'Eslovenia', Egypt: 'Egipto', Algeria: 'Argelia', Tunisia: 'Túnez', Cameroon: 'Camerún',
    'Ivory Coast': 'Costa de Marfil', "Côte d'Ivoire": 'Costa de Marfil', 'Saudi Arabia': 'Arabia Saudí', Qatar: 'Catar',
    Iran: 'Irán', 'Bosnia-Herzegovina': 'Bosnia', 'Bosnia and Herzegovina': 'Bosnia', 'North Macedonia': 'Macedonia del Norte',
    Luxembourg: 'Luxemburgo', Cyprus: 'Chipre', Azerbaijan: 'Azerbaiyán', Kazakhstan: 'Kazajistán', Lithuania: 'Lituania',
    Latvia: 'Letonia', Belarus: 'Bielorrusia', Moldova: 'Moldavia', 'Faroe Islands': 'Islas Feroe', Georgia: 'Georgia',
    'New Zealand': 'Nueva Zelanda', 'South Africa': 'Sudáfrica', Jordan: 'Jordania', Uzbekistan: 'Uzbekistán',
    'Cape Verde': 'Cabo Verde', 'DR Congo': 'RD Congo', Haiti: 'Haití', Panama: 'Panamá', Curacao: 'Curazao',
  };
  // Los que llevan «la» (la Roma, la Real Sociedad…); el resto de clubes, «el».
  const FEMININE = new Set(['Juventus', 'Roma', 'Lazio', 'Fiorentina', 'Real Sociedad', 'Sampdoria', 'Salernitana',
    'Cremonese', 'Reggiana', 'Ponferradina', 'Cultural Leonesa', 'Gimnástica Segoviana']);

  // ----------------------------------------------------------
  // COLORES · ESPN da un color y otro alternativo por equipo, a menudo pobres (el Real Madrid
  // blanco y verde, el Barça granate y amarillo). Los de los clubes más vistos, a mano.
  // bg = fondo, acc = barra y etiquetas, on = texto sobre acc, fg = texto sobre el fondo
  // (solo en los de fondo claro).
  // ----------------------------------------------------------
  const PAPER = '#f2efe8';
  const CLUB_COLORS = {
    // LaLiga
    96: { bg: '#1f4ea8', acc: '#ffffff', on: '#1f4ea8' },                    // Alavés
    93: { bg: '#c8102e', acc: '#ffffff', on: '#c8102e' },                    // Athletic
    1068: { bg: '#cb3524', acc: '#272e61', on: '#ffffff' },                  // Atlético
    83: { bg: '#a50044', acc: '#edbb00', on: '#2b0012' },                    // Barcelona
    85: { bg: '#8ac3ee', acc: '#c8102e', on: '#ffffff', fg: '#0b2a4a' },     // Celta
    90: { bg: '#1f5aa8', acc: '#ffffff', on: '#1f5aa8' },                    // Deportivo
    3751: { bg: '#0c7a3e', acc: '#ffffff', on: '#0c7a3e' },                  // Elche
    88: { bg: '#0a4ea2', acc: '#ffffff', on: '#0a4ea2' },                    // Espanyol
    2922: { bg: '#004fa3', acc: '#ffffff', on: '#004fa3' },                  // Getafe
    1538: { bg: '#a0153e', acc: '#ffffff', on: '#a0153e' },                  // Levante
    99: { bg: '#0c5aa6', acc: '#ffffff', on: '#0c5aa6' },                    // Málaga
    97: { bg: '#a6192e', acc: '#0a2240', on: '#ffffff' },                    // Osasuna
    87: { bg: '#0b7a3e', acc: '#ffffff', on: '#0b7a3e' },                    // Racing
    101: { bg: PAPER, acc: '#e2001a', on: '#ffffff', fg: '#111111' },        // Rayo
    244: { bg: '#0b8a44', acc: '#ffffff', on: '#0b8a44' },                   // Betis
    86: { bg: PAPER, acc: '#1d2a5b', on: '#febe10', fg: '#111111' },         // Real Madrid
    89: { bg: '#0067b1', acc: '#ffffff', on: '#0067b1' },                    // Real Sociedad
    243: { bg: PAPER, acc: '#d81022', on: '#ffffff', fg: '#111111' },        // Sevilla
    94: { bg: PAPER, acc: '#111111', on: '#f18a00', fg: '#111111' },         // Valencia
    102: { bg: '#fce300', acc: '#005187', on: '#ffffff', fg: '#111111' },    // Villarreal
    // Premier
    359: { bg: '#db0007', acc: '#ffffff', on: '#db0007' },                   // Arsenal
    363: { bg: '#034694', acc: '#dba111', on: '#034694' },                   // Chelsea
    364: { bg: '#c8102e', acc: '#f6eb61', on: '#7a0019' },                   // Liverpool
    382: { bg: '#6cabdd', acc: '#1c2c5b', on: '#ffffff', fg: '#0b1f3a' },    // Man City
    360: { bg: '#da291c', acc: '#fbe122', on: '#111111' },                   // Man United
    367: { bg: PAPER, acc: '#132257', on: '#ffffff', fg: '#111111' },        // Tottenham
    361: { bg: '#111111', acc: '#ffffff', on: '#111111' },                   // Newcastle
    362: { bg: '#670e36', acc: '#95bfe5', on: '#2a0518' },                   // Aston Villa
    // Serie A
    111: { bg: '#111111', acc: '#ffffff', on: '#111111' },                   // Juventus
    110: { bg: '#0a1f8f', acc: '#ffffff', on: '#0a1f8f' },                   // Inter
    103: { bg: '#b5121b', acc: '#111111', on: '#ffffff' },                   // Milan
    114: { bg: '#0a6fb4', acc: '#ffffff', on: '#0a6fb4' },                   // Napoli
    104: { bg: '#8e1f2f', acc: '#f0bc42', on: '#3d0a12' },                   // Roma
    112: { bg: '#87d8f7', acc: '#0b2a4a', on: '#ffffff', fg: '#0b2a4a' },    // Lazio
    105: { bg: '#1e71b8', acc: '#ffffff', on: '#1e71b8' },                   // Atalanta
    // Bundesliga
    132: { bg: '#dc052d', acc: '#ffffff', on: '#dc052d' },                   // Bayern
    124: { bg: '#fde100', acc: '#111111', on: '#fde100', fg: '#111111' },    // Dortmund
    131: { bg: '#e32221', acc: '#111111', on: '#ffffff' },                   // Leverkusen
    11420: { bg: PAPER, acc: '#dd0741', on: '#ffffff', fg: '#0c2043' },      // Leipzig
    // Ligue 1
    160: { bg: '#004170', acc: '#da291c', on: '#ffffff' },                   // PSG
    176: { bg: PAPER, acc: '#009cdd', on: '#ffffff', fg: '#111111' },        // Marsella
    167: { bg: PAPER, acc: '#14387f', on: '#ffffff', fg: '#111111' },        // Lyon
    174: { bg: '#e51b22', acc: '#ffffff', on: '#e51b22' },                   // Mónaco
  };
  // Selecciones, por abreviatura (solo en competiciones de selecciones)
  const NATIONAL_COLORS = {
    ESP: { bg: '#c60b1e', acc: '#ffc400', on: '#5a0009' },
    FRA: { bg: '#0b2a6b', acc: '#ffffff', on: '#0b2a6b' },
    GER: { bg: PAPER, acc: '#111111', on: '#ffffff', fg: '#111111' },
    ENG: { bg: PAPER, acc: '#cf081f', on: '#ffffff', fg: '#111111' },
    ITA: { bg: '#0b4fa8', acc: '#ffffff', on: '#0b4fa8' },
    POR: { bg: '#a50021', acc: '#0b6e3a', on: '#ffffff' },
    NED: { bg: '#f36c21', acc: '#111111', on: '#f36c21', fg: '#111111' },
    ARG: { bg: '#75aadb', acc: '#ffffff', on: '#0b2a4a', fg: '#0b2a4a' },
    BRA: { bg: '#fedf00', acc: '#009c3b', on: '#ffffff', fg: '#111111' },
    BEL: { bg: '#c8102e', acc: '#fdda24', on: '#111111' },
    CRO: { bg: '#d0021b', acc: '#ffffff', on: '#d0021b' },
  };
  const DEFAULT_STYLE = { bg: '#1d2b44', acc: '#c8f53c', on: '#111111' };

  // ----------------------------------------------------------
  // Helpers de formato
  // ----------------------------------------------------------
  const asDate = (iso) => new Date(/^\d{4}-\d{2}-\d{2}$/.test(iso) ? `${iso}T12:00:00` : iso);
  const fmtDate = (iso) => asDate(iso).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
  const fmtDateLong = (iso) => asDate(iso).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const fmtFooterDate = (iso) => {
    const d = asDate(iso);
    return `${String(d.getDate()).padStart(2, '0')} · ${String(d.getMonth() + 1).padStart(2, '0')} · ${d.getFullYear()}`;
  };
  const fmtTime = (iso) => new Date(iso).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  // El día de hoy (o con desfase) en la hora de este ordenador, como AAAA-MM-DD
  const localIso = (offset = 0) => {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const num = (v) => {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : null;
  };
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  // Para comparar nombres: sin tildes, minúsculas y solo letras y números.
  const plain = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');

  // ----------------------------------------------------------
  // TOAST
  // ----------------------------------------------------------
  let toastTimer = null;
  function showToast(message, kind = '', sticky = false) {
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent = message;
    el.className = 'toast show ' + kind;
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = sticky ? null : setTimeout(() => { el.className = 'toast'; }, 3200);
  }

  // ----------------------------------------------------------
  // ESPN
  // ----------------------------------------------------------
  const timeoutSignal = (ms) => (typeof AbortSignal !== 'undefined' && AbortSignal.timeout ? AbortSignal.timeout(ms) : undefined);

  async function espnFetch(path) {
    let res;
    try {
      res = await fetch(`${ESPN}${path}`, { signal: timeoutSignal(15000) });
    } catch (e) {
      throw new Error(e.name === 'TimeoutError' ? 'ESPN no responde, prueba en un momento' : `sin conexión con ESPN (${e.message})`);
    }
    if (!res.ok) throw new Error(`ESPN ${res.status}: ${res.statusText}`);
    return res.json();
  }

  function normalizeTeam(cmp, league) {
    const t = cmp?.team || {};
    const espnName = t.displayName || t.name || '';
    const national = NATIONAL.has(league);
    const [long, short] = national
      ? [COUNTRY_NAMES[espnName] || espnName, COUNTRY_NAMES[espnName] || t.shortDisplayName || espnName]
      : CLUB_NAMES[espnName] || [espnName, t.shortDisplayName || espnName];
    return {
      id: String(t.id || ''),
      espnName,
      name: long,
      short,
      abbr: t.abbreviation || short.slice(0, 3).toUpperCase(),
      logo: t.logo || t.logos?.[0]?.href || (t.id ? LOGO(t.id) : ''),
      color: t.color || '',
      alt: t.alternateColor || '',
      national,
      score: num(cmp?.score) ?? 0,
      shootout: num(cmp?.shootoutScore),
      winner: cmp?.winner ?? null,
    };
  }

  function normalizeStatus(st) {
    const type = st?.type || {};
    return {
      state: type.state || 'pre',
      name: type.name || '',
      completed: !!type.completed,
      clock: st?.displayClock || '',
      period: st?.period || 0,
    };
  }

  // Los goles del marcador de ESPN (para la tarjeta del partido): «Grimaldo 53' (p)»
  function cardScorers(details, teamId) {
    return (details || [])
      .filter(d => d.scoringPlay && !d.shootout && String(d.team?.id) === teamId)
      .map(d => {
        const who = d.athletesInvolved?.[0];
        const name = who?.shortName || who?.displayName || '';
        const min = (d.clock?.displayValue || '').replace(/'\+(\d+)'/, "+$1'");
        return `${name} ${min}${d.penaltyKick ? ' (p)' : d.ownGoal ? ' (p.p.)' : ''}`.trim();
      });
  }

  function normalizeEvent(e, league) {
    const c = e.competitions?.[0] || {};
    const side = (ha) => (c.competitors || []).find(x => x.homeAway === ha);
    const home = normalizeTeam(side('home'), league);
    const away = normalizeTeam(side('away'), league);
    return {
      id: String(e.id),
      league,
      date: e.date,
      status: normalizeStatus(c.status || e.status),
      phase: PHASES[e.season?.slug] || '',
      venue: c.venue?.fullName || e.venue?.displayName || '',
      home,
      away,
      scorers: { home: cardScorers(c.details, home.id), away: cardScorers(c.details, away.id) },
    };
  }

  async function fetchGames(league, iso) {
    const data = await espnFetch(`/${league}/scoreboard?dates=${iso.replace(/-/g, '')}`);
    return (data.events || []).map(e => normalizeEvent(e, league))
      .sort((a, b) => new Date(a.date) - new Date(b.date));
  }

  // final · live · pre · off (aplazado, suspendido…)
  function gamePhase(g) {
    const n = g.status.name;
    if (/POSTPONED|CANCELED|CANCELLED|ABANDONED|SUSPENDED|FORFEIT/.test(n)) return 'off';
    if (g.status.state === 'post') return 'final';
    if (g.status.state === 'in') return 'live';
    return 'pre';
  }
  const minuteText = (clock) => String(clock || '').replace(/'\+(\d+)'/, "+$1'");
  function statusLabel(g) {
    const n = g.status.name;
    switch (gamePhase(g)) {
      case 'off':
        return /POSTPONED/.test(n) ? 'Aplazado' : /CANCEL/.test(n) ? 'Cancelado' : 'Suspendido';
      case 'final':
        return /PEN/.test(n) || g.home.shootout != null ? 'Final · penaltis' : /AET|EXTRA/.test(n) ? 'Final · prórroga' : 'Final';
      case 'live':
        return /HALFTIME/.test(n) ? 'Descanso' : `En juego · ${minuteText(g.status.clock)}`;
      default:
        return `${fmtTime(g.date)} h`;
    }
  }

  // ----------------------------------------------------------
  // EL PARTIDO · el resumen de ESPN, en un objeto con todo lo que usan las slides
  // ----------------------------------------------------------
  const SHOT_KIND = {
    'shot-on-target': 'on', 'shot-off-target': 'off', 'shot-blocked': 'off', 'shot-hit-woodwork': 'post',
    'penalty---saved': 'on', 'penalty---missed': 'off',
  };
  const isGoalType = (t) => /^goal/.test(t) || t === 'penalty---scored';

  // «45'+2'» → { label: "45+2'", t: 45,2 } · t sirve para colocarlo en la línea del partido
  function minuteOf(ev) {
    const dv = ev.clock?.displayValue || ev.time?.displayValue || '';
    const m = dv.match(/(\d+)'(?:\+(\d+)')?/);
    const period = ev.period?.number || 0;
    if (!m) {
      const v = Math.ceil((ev.clock?.value || 0) / 60);
      return { label: `${v}'`, t: v, base: v, period };
    }
    const base = Number(m[1]), extra = Number(m[2] || 0);
    return { label: extra ? `${base}+${extra}'` : `${base}'`, t: base + Math.min(extra, 9) * 0.1, base, extra, period };
  }

  const statsMap = (list) => Object.fromEntries((list || []).map(s => [s.name, num(s.value ?? s.displayValue)]));

  function parseMatch(sum, game) {
    const comp = sum.header?.competitions?.[0] || {};
    const cmpOf = (ha) => (comp.competitors || []).find(c => c.homeAway === ha);
    const team = (ha) => {
      const fresh = cmpOf(ha) ? normalizeTeam(cmpOf(ha), game.league) : {};
      const base = game[ha];
      return {
        ...base,
        score: fresh.score ?? base.score,
        shootout: fresh.shootout ?? base.shootout,
        winner: fresh.winner ?? base.winner,
        formation: '',
        players: [],
        side: ha,
      };
    };
    const m = {
      id: game.id,
      league: game.league,
      date: game.date,
      phase: game.phase,
      status: comp.status ? normalizeStatus(comp.status) : game.status,
      venue: sum.gameInfo?.venue?.fullName || game.venue,
      home: team('home'),
      away: team('away'),
      goals: [], cards: [], pens: [], subs: [], shots: [],
      stats: { home: null, away: null },
      standings: null,
    };
    if (m.status.state === 'pre') m.status = game.status; // el resumen a veces va por detrás

    // ─── Plantillas ───
    const byId = {};
    for (const r of sum.rosters || []) {
      const t = r.homeAway === 'away' ? m.away : r.homeAway === 'home' ? m.home : null;
      if (!t) continue;
      t.formation = r.formation || '';
      t.players = (r.roster || []).map(p => {
        const a = p.athlete || {};
        const player = {
          id: String(a.id || ''),
          name: a.displayName || '',
          last: a.lastName || a.displayName || '',
          short: a.shortName || a.displayName || '',
          jersey: p.jersey || '',
          pos: p.position?.abbreviation || '',
          starter: !!p.starter,
          place: Number(p.formationPlace) || 0,
          subIn: !!p.subbedIn,
          subOut: !!p.subbedOut,
          headshot: a.headshot?.href || '',
          side: t.side,
          s: statsMap(p.stats),
        };
        byId[player.id] = player;
        return player;
      });
    }
    const other = (side) => (side === 'home' ? 'away' : 'home');
    const sideOfTeamId = (id) => (String(id) === m.home.id ? 'home' : String(id) === m.away.id ? 'away' : null);

    // ─── Goles, tarjetas, penaltis fallados y cambios ───
    for (const k of sum.keyEvents || []) {
      if (k.shootout) continue;
      const type = k.type?.type || '';
      const ids = (k.participants || []).map(p => String(p.athlete?.id || ''));
      const names = (k.participants || []).map(p => p.athlete?.displayName || '');
      const min = minuteOf(k);
      const evSide = sideOfTeamId(k.team?.id);
      if (k.scoringPlay || isGoalType(type) || type === 'own-goal') {
        const own = /own/.test(type);
        const scorerSide = byId[ids[0]]?.side || (own ? (evSide && other(evSide)) : evSide);
        m.goals.push({
          side: own ? (scorerSide ? other(scorerSide) : evSide) : scorerSide,
          scorer: ids[0], scorerName: names[0], assist: own || /penalty/.test(type) ? '' : ids[1] || '',
          assistName: own || /penalty/.test(type) ? '' : names[1] || '',
          own, pen: /penalty/.test(type), header: /header/.test(type), freeKick: /free-kick/.test(type), volley: /volley/.test(type),
          min,
        });
      } else if (/red/.test(type)) {
        m.cards.push({ side: byId[ids[0]]?.side || evSide, player: ids[0], name: names[0], red: true, min });
      } else if (type === 'yellow-card') {
        m.cards.push({ side: byId[ids[0]]?.side || evSide, player: ids[0], name: names[0], red: false, min });
      } else if (type === 'penalty---saved' || type === 'penalty---missed') {
        m.pens.push({ side: byId[ids[0]]?.side || evSide, player: ids[0], name: names[0], saved: type === 'penalty---saved', min });
      } else if (type === 'substitution') {
        m.subs.push({ side: evSide, in: ids[0], out: ids[1], min });
      }
    }
    // Si las cuentas no salen (un gol en propia mal asignado), se prueba al revés; si aun así
    // no cuadran, el minuto a minuto no pone el marcador de cada gol.
    const tally = () => ['home', 'away'].map(s => m.goals.filter(g => g.side === s).length);
    const fits = () => { const [h, a] = tally(); return h === m.home.score && a === m.away.score; };
    if (!fits() && m.goals.some(g => g.own)) {
      m.goals.filter(g => g.own).forEach(g => { g.side = g.side && other(g.side); });
      if (!fits()) m.goals.filter(g => g.own).forEach(g => { g.side = g.side && other(g.side); });
    }
    m.goalsOk = fits();
    let run = [0, 0];
    m.goals.forEach(g => {
      if (g.side) run = g.side === 'home' ? [run[0] + 1, run[1]] : [run[0], run[1] + 1];
      g.score = [...run];
    });
    m.halftime = m.goalsOk && m.status.state === 'post'
      ? ['home', 'away'].map(s => m.goals.filter(g => g.side === s && g.min.period === 1).length) : null;

    // ─── Tiros con su sitio en el campo (del minuto a minuto de ESPN) ───
    const sideOfName = (name) => {
      const p = plain(name);
      if (!p) return null;
      if (p === plain(m.home.espnName)) return 'home';
      if (p === plain(m.away.espnName)) return 'away';
      return null;
    };
    for (const x of sum.commentary || []) {
      const p = x.play;
      const type = p?.type?.type || '';
      if (!p || p.fieldPositionX == null || p.fieldPositionY == null || type === 'own-goal') continue;
      const kind = isGoalType(type) ? 'goal' : SHOT_KIND[type];
      if (!kind) continue;
      let side = sideOfName(p.team?.displayName);
      if (!side) {
        const inText = (x.text || '').match(/\(([^)]+)\)/)?.[1];
        side = sideOfName(inText);
      }
      if (!side) continue;
      m.shots.push({ side, kind, x: p.fieldPositionX, y: p.fieldPositionY, x2: p.fieldPosition2X ?? null, y2: p.fieldPosition2Y ?? null });
    }

    // ─── Estadísticas de equipo ───
    for (const t of sum.boxscore?.teams || []) {
      const s = sideOfTeamId(t.team?.id);
      if (s) m.stats[s] = Object.fromEntries((t.statistics || []).map(x => [x.name, num(x.displayValue ?? x.value)]));
    }

    // ─── Clasificación (la del grupo de los dos equipos, si hay) ───
    const groups = sum.standings?.groups || [];
    const group = groups.find(g => (g.standings?.entries || []).some(e => [m.home.id, m.away.id].includes(String(e.id))));
    if (group) {
      const stat = (e, n) => num((e.stats || []).find(s => s.name === n || s.type === n)?.value);
      m.standings = group.standings.entries.map(e => {
        const espnName = typeof e.team === 'string' ? e.team : e.team?.displayName || '';
        const named = m.home.national
          ? [COUNTRY_NAMES[espnName] || espnName]
          : CLUB_NAMES[espnName] || [espnName];
        return {
          id: String(e.id || e.team?.id || ''),
          name: named[1] || named[0],
          logo: e.team?.logos?.[0]?.href || (String(e.id) === m.home.id ? m.home.logo : String(e.id) === m.away.id ? m.away.logo : LOGO(e.id)),
          rank: stat(e, 'rank'), gp: stat(e, 'gamesPlayed'), gd: stat(e, 'pointDifferential'), pts: stat(e, 'points'),
        };
      }).filter(r => r.rank != null).sort((a, b) => a.rank - b.rank);
      m.standingsName = (group.header || '').replace(/Standings$/i, '').trim();
    }
    return m;
  }

  async function fetchMatch(game) {
    const sum = await espnFetch(`/${game.league}/summary?event=${game.id}`);
    return parseMatch(sum, game);
  }

  // ----------------------------------------------------------
  // STATE
  // ----------------------------------------------------------
  const state = {
    league: DEFAULT_LEAGUE,
    selectedDate: null,
    games: [],
    selectedGame: null,
    rendered: null,       // el partido del preview (lo que leen las slides, las descargas y el borrador)
    jugadorId: null,      // el jugador del partido, si se ha elegido otro en el desplegable
    script: null,         // guion del vídeo: { idDeEscena: frase } (lo escribe autoScript y lo retocas)
    scriptGame: null,     // id del partido de ese guion
    photoOverrides: {},   // id del jugador → foto subida (ya sin fondo)
    sign: '',
    generating: false,
  };

  // ----------------------------------------------------------
  // COLORES DE CADA EQUIPO
  // ----------------------------------------------------------
  const mixHex = (hex, to, f) => {
    const a = parseInt(hex.slice(1), 16), b = parseInt(to.slice(1), 16);
    const ch = (s) => Math.round(((a >> s) & 255) * (1 - f) + ((b >> s) & 255) * f);
    return '#' + [16, 8, 0].map(s => ch(s).toString(16).padStart(2, '0')).join('');
  };
  const luminance = (hex) => {
    const c = [16, 8, 0].map(s => ((parseInt(hex.slice(1), 16) >> s) & 255) / 255)
      .map(v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  };
  const contrast = (a, b) => {
    const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
    return (x + 0.05) / (y + 0.05);
  };
  const rgba = (hex, a) => {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  };
  const hexOf = (c) => (/^[0-9a-f]{6}$/i.test(c || '') ? `#${c.toLowerCase()}` : null);

  // Un equipo sin colores a mano: los de ESPN, arreglados para que se lean.
  function autoColors(color, alt) {
    let bg = hexOf(color) || DEFAULT_STYLE.bg;
    const a = hexOf(alt);
    if (contrast('#ffffff', bg) < 3) {
      // Blanco, amarillo, celeste…: fondo claro con texto oscuro (el blanco puro, como papel).
      const base = luminance(bg) > 0.8 ? PAPER : bg;
      const acc = a && contrast(a, base) >= 3 ? a : '#111111';
      return { bg: base, acc, on: contrast('#ffffff', acc) >= 4.5 ? '#ffffff' : '#111111', fg: '#111111' };
    }
    // Los colores puros de ESPN (#0000ff, #ff0000) quedan chillones: un poco más oscuros.
    const ch = [16, 8, 0].map(s => (parseInt(bg.slice(1), 16) >> s) & 255);
    if (Math.max(...ch) === 255 && Math.min(...ch) < 30) bg = mixHex(bg, '#000000', 0.2);
    const acc = a && a !== bg && contrast(a, bg) >= 2.5 ? a : '#ffffff';
    return { bg, acc, on: contrast('#ffffff', acc) >= 4.5 ? '#ffffff' : '#111111' };
  }

  function teamStyle(team) {
    const t = team?.bg ? team
      : (team?.national && NATIONAL_COLORS[team.abbr]) || CLUB_COLORS[team?.id] || (team ? autoColors(team.color, team.alt) : DEFAULT_STYLE);
    const light = !!t.fg;
    return {
      ...t,
      fg: t.fg || '#ffffff',
      hi: mixHex(t.bg, '#ffffff', light ? 0.4 : 0.16),
      lo: mixHex(t.bg, '#000000', light ? 0.14 : 0.5),
      dk: light ? '#111111' : mixHex(t.bg, '#000000', 0.55),
      hl: contrast(t.acc, t.bg) >= 3.5 ? t.acc : (t.fg || '#ffffff'),
      line: light ? 'rgba(0,0,0,.15)' : 'rgba(255,255,255,.18)',
      card: light ? 'rgba(0,0,0,.07)' : 'rgba(0,0,0,.22)',
      ink: light ? (contrast(t.acc, PAPER) >= 3 ? t.acc : '#111111') : t.bg, // el color del equipo sobre papel
    };
  }
  const styleVars = (st) =>
    `--t-bg:${st.bg};--t-hi:${st.hi};--t-lo:${st.lo};--t-acc:${st.acc};--t-on:${st.on};--t-fg:${st.fg};--t-dk:${st.dk};--t-hl:${st.hl};--t-line:${st.line};--t-card:${st.card}`;

  // ----------------------------------------------------------
  // CÓMO SE NOMBRA A UN EQUIPO · «el Atlético», «la Roma», «España»
  // ----------------------------------------------------------
  const article = (t) => (t.national ? '' : FEMININE.has(t.short) || FEMININE.has(t.name) ? 'la ' : 'el ');
  const theTeam = (t) => `${article(t)}${t.short}`;
  const ofTeam = (t) => (article(t) === 'el ' ? `del ${t.short}` : `de ${article(t)}${t.short}`);

  // ----------------------------------------------------------
  // LECTURAS DEL PARTIDO
  // ----------------------------------------------------------
  const sides = (m) => {
    const h = m.home.score, a = m.away.score;
    let winner = h > a ? 'home' : a > h ? 'away' : null;
    if (!winner && m.home.shootout != null && m.away.shootout != null && m.home.shootout !== m.away.shootout) {
      winner = m.home.shootout > m.away.shootout ? 'home' : 'away';
    }
    return { winner, loser: winner && (winner === 'home' ? 'away' : 'home'), draw: h === a };
  };
  const live = (m) => m.status.state === 'in';
  const pensWon = (m) => m.home.shootout != null && m.away.shootout != null;
  const playerById = (m, id) => [...m.home.players, ...m.away.players].find(p => p.id === String(id));
  const surname = (p) => p?.last || p?.name || '';
  const nameOf = (m, id, fallback) => surname(playerById(m, id)) || (fallback || '').split(' ').slice(-1)[0];

  // El gol que deja el partido decidido (el que pone al ganador por delante para siempre)
  function decisiveGoal(m) {
    const { winner, loser } = sides(m);
    if (!winner || !m.goalsOk || pensWon(m)) return null;
    const need = m[loser].score + 1;
    return m.goals.filter(g => g.side === winner)[need - 1] || null;
  }
  const cameBack = (m) => {
    const { winner } = sides(m);
    if (!winner || !m.goalsOk) return false;
    const w = winner === 'home' ? 0 : 1;
    return m.goals.some(g => g.score[1 - w] > g.score[w]);
  };

  function headline(m) {
    const { winner, draw } = sides(m);
    const h = m.home.score, a = m.away.score;
    if (live(m)) return 'Así va el partido';
    if (pensWon(m) && winner) return `${cap(theTeam(m[winner]))} pasa en los penaltis`;
    if (draw) {
      const last = m.goals[m.goals.length - 1];
      if (h === 0) return 'Empate sin goles';
      if (m.goalsOk && last && last.min.base >= 85) return 'Empate en el último suspiro';
      return `Empate a ${h}`;
    }
    const w = m[winner];
    const margin = Math.abs(h - a);
    const key = decisiveGoal(m);
    if (cameBack(m)) return `Remontada ${ofTeam(w)}`;
    if (key && key.min.base >= 85) return `${cap(theTeam(w))} lo gana en el ${key.min.label}`;
    if (/AET|EXTRA/.test(m.status.name)) return `${cap(theTeam(w))} gana en la prórroga`;
    if (margin >= 4) return `Goleada ${ofTeam(w)}`;
    if (margin === 3) return `Exhibición ${ofTeam(w)}`;
    if (h + a >= 6) return 'Festival de goles';
    if (margin === 1 && h + a <= 3) return `${cap(theTeam(w))} gana por la mínima`;
    return `Victoria ${ofTeam(w)}`;
  }

  // Cuánto ha jugado: titular hasta que le cambian, suplente desde que entra.
  function minutesPlayed(m, p) {
    const end = live(m) ? clockMinute(m) : Math.max(90, ...m.goals.concat(m.cards).map(e => e.min.base));
    const off = m.subs.find(s => s.out === p.id);
    const on = m.subs.find(s => s.in === p.id);
    const red = m.cards.find(c => c.red && c.player === p.id);
    const stop = Math.min(off ? off.min.base : end, red ? red.min.base : end);
    if (p.starter) return stop;
    if (p.subIn && on) return Math.max(1, stop - on.min.base);
    return p.subIn ? 15 : 0;
  }

  // Nota del jugador: goles y asistencias mandan; luego tiros, paradas y el resultado.
  function rating(m, p) {
    const s = p.s, v = (k) => s[k] || 0;
    const { winner, draw } = sides(m);
    let r = 6 * v('totalGoals') + 4 * v('goalAssists') + 1.2 * v('shotsOnTarget') + 0.4 * (v('totalShots') - v('shotsOnTarget'))
      + 0.3 * v('foulsSuffered') - 2.5 * v('redCards') - 0.6 * v('yellowCards') - 3 * v('ownGoals');
    if (p.pos === 'G') r += 0.9 * v('saves') + (v('goalsConceded') === 0 && p.starter ? 3 : 0);
    r += winner === p.side ? 1.5 : draw ? 0.5 : 0;
    r += p.starter ? 0.5 : 0;
    return r;
  }
  const playedList = (m) => [...m.home.players, ...m.away.players].filter(p => p.starter || p.subIn);
  const rankedPlayers = (m) => playedList(m).map(p => ({ p, r: rating(m, p) })).sort((a, b) => b.r - a.r).map(x => x.p);
  const bestPlayer = (m) => (state.jugadorId && playerById(m, state.jugadorId)) || rankedPlayers(m)[0] || null;

  // ----------------------------------------------------------
  // PIEZAS DE LAS SLIDES
  // ----------------------------------------------------------
  // Imagen transparente: hueco para tocar y subir la foto de un jugador que no tiene.
  const BLANK = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
  const officialPhoto = (p) => p?.headshot || '';
  const photoSrc = (p) => (p && (state.photoOverrides[p.id] || officialPhoto(p))) || '';
  const hasPhoto = (p) => !!photoSrc(p);
  // Foto del jugador (la subida o la de ESPN). Sin foto, un hueco invisible que se puede tocar.
  const photoTag = (p, cls) => {
    if (!p) return '';
    const off = officialPhoto(p) || BLANK;
    const src = photoSrc(p) || BLANK;
    return `<img class="${cls}${src === BLANK ? ' blank' : ''}" src="${src}" alt="" crossorigin="anonymous" data-player="${p.id}" data-official="${off}" onerror="this.style.display='none'"/>`;
  };
  const logoTag = (team, cls) => (team?.logo
    ? `<img class="${cls}" src="${team.logo}" alt="" crossorigin="anonymous" onerror="this.style.display='none'"/>`
    : '');
  const grain = '<div class="fc-grain"></div>';
  const footLeft = (m) => `${compOf(m.league).name} · ${fmtFooterDate(m.date)}`;
  const foot = (m) => `<div class="fc-foot"><span>${esc(footLeft(m))}</span><span class="fc-sign" data-noedit>${esc(state.sign)}</span></div>`;
  const fitSize = (text, base, steps) => {
    const len = String(text).length;
    for (const [max, size] of steps) if (len <= max) return size;
    return base;
  };

  function tplSinDatos(m, title) {
    return `
      <div class="fc-in" style="${styleVars(teamStyle(null))}">
        <div class="fc-kick"><b>${title}</b></div>
        <div class="fc-empty">ESPN aún no tiene estos datos del partido.<br>Prueba a generar de nuevo en unos minutos.</div>
        ${foot(m)}${grain}
      </div>`;
  }

  // ----------------------------------------------------------
  // 1 · PORTADA · el marcador, cada equipo en su mitad, con sus goleadores
  // ----------------------------------------------------------
  // Los goles de un equipo, juntos por jugador («Malen 51', 57' (p)»), y sus rojas:
  // [{ text, red }]. scorerLines, lo mismo en HTML para la portada.
  function scorerList(m, side) {
    const lines = [];
    const byName = new Map();
    for (const g of m.goals.filter(x => x.side === side)) {
      const who = g.own ? `${nameOf(m, g.scorer, g.scorerName)} (p.p.)` : nameOf(m, g.scorer, g.scorerName);
      const min = `${g.min.label}${g.pen ? ' (p)' : ''}`;
      if (byName.has(who)) byName.get(who).push(min);
      else { byName.set(who, [min]); lines.push(who); }
    }
    const goals = lines.map(who => ({ text: `${who} ${byName.get(who).join(', ')}`, red: false }));
    const reds = m.cards.filter(c => c.red && c.side === side)
      .map(c => ({ text: `${nameOf(m, c.player, c.name)} ${c.min.label}`, red: true }));
    return [...goals, ...reds];
  }
  const scorerLines = (m, side) => scorerList(m, side).map(x => (x.red ? `<i class="card red"></i>${esc(x.text)}` : esc(x.text)));

  function tplPortada(m) {
    const { winner } = sides(m);
    const half = (team, side) => {
      const lines = scorerLines(m, side);
      const size = lines.length <= 3 ? 36 : lines.length <= 5 ? 30 : 25;
      return `
        <div class="half ${side === 'home' ? 'l' : 'r'}${winner === side ? ' won' : ''}" style="${styleVars(teamStyle(team))}">
          ${logoTag(team, 'wm')}
          ${logoTag(team, 'crest')}
          ${team.shootout != null && pensWon(m) ? `<div class="pens">${team.shootout} en los penaltis</div>` : ''}
          <div class="n">${team.score}</div>
          <div class="name" style="font-size:${fitSize(team.name, 34, [[10, 48], [14, 42], [18, 36]])}px">${esc(team.name)}</div>
          <div class="scorers" style="font-size:${size}px">${lines.slice(0, 7).map(l => `<div>${l}</div>`).join('')}</div>
        </div>`;
    };
    const c = compOf(m.league);
    const chip = [c.name, m.phase, live(m) ? `En juego · ${minuteText(m.status.clock)}` : ''].filter(Boolean).join(' · ');
    return `
      ${half(m.home, 'home')}
      ${half(m.away, 'away')}
      <div class="fade"></div>
      <div class="comp">${esc(chip)}</div>
      <div class="head"><h1>${esc(headline(m))}</h1></div>
      ${foot(m)}${grain}`;
  }

  // ----------------------------------------------------------
  // 2 · MINUTO A MINUTO · la línea del partido: goles, rojas y penaltis fallados
  // ----------------------------------------------------------
  const CRONO = { top: 320, bottom: 1150, axis: 540 };

  function cronoEvents(m) {
    const evs = [];
    m.goals.forEach(g => {
      if (!g.side) return;
      const how = [g.own ? 'En propia puerta' : g.pen ? 'De penalti' : g.header ? 'De cabeza' : g.freeKick ? 'De falta' : g.volley ? 'De volea' : '',
        g.assist ? `Asist. ${nameOf(m, g.assist, g.assistName)}` : ''].filter(Boolean).join(' · ');
      evs.push({ side: g.side, min: g.min, kind: 'goal', name: nameOf(m, g.scorer, g.scorerName), how, score: m.goalsOk ? g.score : null });
    });
    m.cards.filter(c => c.red && c.side).forEach(c => evs.push({ side: c.side, min: c.min, kind: 'red', name: nameOf(m, c.player, c.name), how: 'Tarjeta roja' }));
    m.pens.filter(p => p.side).forEach(p => evs.push({ side: p.side, min: p.min, kind: 'pen', name: nameOf(m, p.player, p.name), how: p.saved ? 'Penalti parado' : 'Penalti fallado' }));
    return evs.sort((a, b) => a.min.t - b.min.t);
  }

  // Coloca las tarjetas de cada lado lo más cerca posible de su minuto, sin pisarse entre
  // ellas ni tapar las marcas de la línea (el descanso, la prórroga, «ahora»): bands.
  function placeEvents(evs, yOf, bands) {
    const gap = 10;
    const clear = (y, h, down) => {
      for (const b of bands) if (y < b.y1 && y + h > b.y0) y = down ? b.y1 + gap : b.y0 - gap - h;
      return y;
    };
    for (const side of ['home', 'away']) {
      const list = evs.filter(e => e.side === side);
      list.forEach((e, i) => {
        e.h = e.kind === 'goal' ? 84 : 62;
        let y = Math.max(yOf(e.min.t) - e.h / 2, CRONO.top - 20);
        if (i) y = Math.max(y, list[i - 1].y + list[i - 1].h + gap);
        e.y = clear(y, e.h, true);
      });
      // Si se salen por abajo, se suben desde el final.
      for (let i = list.length - 1; i >= 0; i--) {
        const limit = i === list.length - 1 ? CRONO.bottom + 16 - list[i].h : list[i + 1].y - gap - list[i].h;
        if (list[i].y > limit) list[i].y = clear(limit, list[i].h, false);
      }
    }
  }
  // El minuto del partido en juego («74'» → 74; «90'+3'» → 90)
  const clockMinute = (m) => Number(String(m.status.clock).match(/\d+/)?.[0] || 0);

  function cronoAxis(m, evs, yOf, total) {
    const W = 1080, H = 1350;
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const ctx = c.getContext('2d');
    const X = CRONO.axis;
    ctx.lineCap = 'round';
    // La línea del partido (en juego, a rayas lo que queda) y una marca cada 15 minutos
    const now = live(m) ? yOf(clockMinute(m)) : CRONO.bottom;
    ctx.strokeStyle = '#111111'; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.moveTo(X, CRONO.top); ctx.lineTo(X, now); ctx.stroke();
    if (now < CRONO.bottom) {
      ctx.strokeStyle = 'rgba(17,17,17,.3)'; ctx.setLineDash([10, 12]);
      ctx.beginPath(); ctx.moveTo(X, now); ctx.lineTo(X, CRONO.bottom); ctx.stroke();
      ctx.setLineDash([]); ctx.strokeStyle = '#111111';
    }
    ctx.lineWidth = 4;
    for (let t = 15; t < total; t += 15) {
      if (t === 45 || t === 90) continue;
      ctx.beginPath(); ctx.moveTo(X - 12, yOf(t)); ctx.lineTo(X + 12, yOf(t)); ctx.stroke();
    }
    // Cada suceso: un punto en su minuto y una línea hasta su tarjeta
    for (const e of evs) {
      const st = teamStyle(m[e.side]);
      const ink = st.ink;
      const dir = e.side === 'home' ? -1 : 1;
      const ty = yOf(e.min.t), cy = e.y + e.h / 2;
      ctx.strokeStyle = rgba(ink.length === 7 ? ink : '#111111', 0.6); ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(X, ty); ctx.lineTo(X + dir * 22, cy); ctx.lineTo(X + dir * 36, cy); ctx.stroke();
      ctx.beginPath(); ctx.arc(X, ty, e.kind === 'goal' ? 14 : 10, 0, Math.PI * 2);
      ctx.fillStyle = e.kind === 'red' ? '#e3172d' : ink; ctx.fill();
      ctx.lineWidth = 4; ctx.strokeStyle = '#ece9e2'; ctx.stroke();
    }
    return c.toDataURL('image/png');
  }

  function tplCrono(m) {
    const evs = cronoEvents(m);
    const et = m.status.period > 2 || /AET|EXTRA|PEN/.test(m.status.name) || evs.some(e => e.min.period > 2);
    const total = et ? 120 : 90;
    const yOf = (t) => CRONO.top + (Math.min(Math.max(t, 0), total + 1) / (total + 1)) * (CRONO.bottom - CRONO.top);
    // Las marcas de la línea: el descanso, la prórroga y, en juego, el minuto de ahora.
    const marks = [{ y: Math.round(yOf(45.5)), text: m.halftime ? `Descanso · ${m.halftime[0]}-${m.halftime[1]}` : 'Descanso' }];
    if (et) marks.push({ y: Math.round(yOf(90.5)), text: 'Prórroga' });
    if (live(m)) marks.push({ y: Math.round(yOf(clockMinute(m))), text: `Ahora · ${minuteText(m.status.clock)}` });
    if (live(m) && clockMinute(m) < 46) marks.shift(); // aún no ha llegado el descanso
    placeEvents(evs, yOf, marks.map(k => ({ y0: k.y - 26, y1: k.y + 26 })));
    const ev = (e) => {
      const st = teamStyle(m[e.side]);
      const icon = e.kind === 'red' ? '<i class="card red"></i>' : '';
      return `
        <div class="ev ${e.side === 'home' ? 'l' : 'r'}${e.kind === 'goal' ? '' : ' minor'}" style="top:${Math.round(e.y)}px;height:${e.h}px;${styleVars(st)}">
          <span class="min">${e.min.label}</span>
          <div class="who"><span class="name">${icon}${esc(e.name)}</span>${e.how ? `<span class="how">${esc(e.how)}</span>` : ''}</div>
          ${e.score ? `<span class="sc">${e.score[0]}-${e.score[1]}</span>` : ''}
        </div>`;
    };
    return `
      <div class="fc-in paper">
        <h1 class="title">Minuto a minuto</h1>
        <div class="teams"><span>${logoTag(m.home, 'lg')}${esc(m.home.short)}</span><span>${esc(m.away.short)}${logoTag(m.away, 'lg')}</span></div>
        <img class="axis" src="${cronoAxis(m, evs, yOf, total)}" alt=""/>
        <div class="ht" style="top:${CRONO.top - 6}px">0'</div>
        ${marks.map(k => `<div class="ht" style="top:${k.y}px">${k.text}</div>`).join('')}
        ${live(m) ? '' : `<div class="ht" style="top:${CRONO.bottom + 44}px">Final · ${m.home.score}-${m.away.score}</div>`}
        ${evs.length ? evs.map(ev).join('') : '<div class="none">Sin goles</div>'}
        ${foot(m)}${grain}
      </div>`;
  }

  // ----------------------------------------------------------
  // 3 · LAS ESTADÍSTICAS · cada equipo en su mitad, con su número
  // ----------------------------------------------------------
  // [etiqueta, valor de cada lado, true si tener más es mejor]
  function statRows(m) {
    const H = m.stats.home, A = m.stats.away;
    if (!H || !A) return [];
    const both = (k) => H[k] != null && A[k] != null;
    const rows = [];
    if (both('possessionPct')) rows.push({ label: 'Posesión', v: [H.possessionPct, A.possessionPct], fmt: (x) => `${Math.round(x)}<small>%</small>`, more: true });
    if (both('totalShots')) rows.push({ label: 'Tiros', v: [H.totalShots, A.totalShots], more: true });
    if (both('shotsOnTarget')) rows.push({ label: 'A puerta', v: [H.shotsOnTarget, A.shotsOnTarget], more: true });
    if (both('totalPasses')) {
      const pct = (s) => (s.accuratePasses != null && s.totalPasses ? Math.round(s.accuratePasses / s.totalPasses * 100) : null);
      rows.push({ label: 'Pases', v: [H.totalPasses, A.totalPasses], pct: [pct(H), pct(A)], more: true });
    }
    if (both('wonCorners')) rows.push({ label: 'Córners', v: [H.wonCorners, A.wonCorners], more: true });
    const reds = both('redCards') && (H.redCards || A.redCards);
    if (both('saves') && !reds) rows.push({ label: 'Paradas', v: [H.saves, A.saves], more: true });
    if (both('foulsCommitted')) rows.push({ label: 'Faltas', v: [H.foulsCommitted, A.foulsCommitted], more: false });
    if (both('yellowCards')) rows.push({ label: 'Amarillas', v: [H.yellowCards, A.yellowCards], more: false });
    if (reds) rows.push({ label: 'Rojas', v: [H.redCards, A.redCards], more: false });
    return rows.slice(0, 8);
  }

  function tplStats(m) {
    const rows = statRows(m);
    if (rows.length < 3) return tplSinDatos(m, 'Estadísticas');
    const cell = (r, i) => {
      const [a, b] = r.v;
      const worse = a === b ? false : r.more ? r.v[i] < r.v[1 - i] : r.v[i] > r.v[1 - i];
      const val = r.fmt ? r.fmt(r.v[i]) : r.v[i];
      const extra = r.pct && r.pct[i] != null ? `<small> · ${r.pct[i]}%</small>` : '';
      return `<div class="n${worse ? ' lose' : ''}">${val}${extra}</div>`;
    };
    const half = (team, i) => `
      <div class="half ${i ? 'r' : 'l'}" style="${styleVars(teamStyle(team))}">
        <div class="team">${logoTag(team, '')}<span>${esc(team.short)}</span></div>
        <div class="col">${rows.map(r => cell(r, i)).join('')}</div>
      </div>`;
    return `
      ${half(m.home, 0)}
      ${half(m.away, 1)}
      <div class="labels">${rows.map(r => `<div><span>${r.label}</span></div>`).join('')}</div>
      ${foot(m)}${grain}`;
  }

  // ----------------------------------------------------------
  // 4 · MAPA DE TIROS · el campo entero: el local tira hacia la izquierda y el visitante hacia
  // la derecha (así cada uno queda en su lado, como en la portada)
  // ----------------------------------------------------------
  function pitchChart(m) {
    const W = 952, H = Math.round(W * 68 / 105);
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const ctx = c.getContext('2d');
    const sx = W / 105, sy = H / 68; // metros → píxeles
    ctx.fillStyle = '#e1ddd3'; ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 10; i += 2) { ctx.fillStyle = '#dcd8cd'; ctx.fillRect((i * W) / 10, 0, W / 10, H); }
    ctx.strokeStyle = 'rgba(17,17,17,.35)'; ctx.lineWidth = 3;
    const rect = (x, y, w, h) => ctx.strokeRect(x * sx, y * sy, w * sx, h * sy);
    rect(0.05, 0.05, 104.9, 67.9);
    ctx.beginPath(); ctx.moveTo(52.5 * sx, 0); ctx.lineTo(52.5 * sx, H); ctx.stroke();
    ctx.beginPath(); ctx.arc(52.5 * sx, 34 * sy, 9.15 * sx, 0, Math.PI * 2); ctx.stroke();
    for (const left of [true, false]) {
      const x0 = left ? 0 : 105;
      const d = left ? 1 : -1;
      const box = (depth, width) => rect(left ? 0 : 105 - depth, 34 - width / 2, depth, width);
      box(16.5, 40.32);
      box(5.5, 18.32);
      ctx.fillStyle = 'rgba(17,17,17,.35)';
      ctx.beginPath(); ctx.arc((x0 + d * 11) * sx, 34 * sy, 4, 0, Math.PI * 2); ctx.fill();
      const a = Math.acos(5.5 / 9.15);
      ctx.beginPath();
      if (left) ctx.arc(11 * sx, 34 * sy, 9.15 * sx, -a, a);
      else ctx.arc(94 * sx, 34 * sy, 9.15 * sx, Math.PI - a, Math.PI + a);
      ctx.stroke();
      // La portería
      ctx.lineWidth = 5;
      ctx.beginPath(); ctx.moveTo(x0 * sx, (34 - 3.66) * sy); ctx.lineTo(x0 * sx, (34 + 3.66) * sy); ctx.stroke();
      ctx.lineWidth = 3;
    }
    // ESPN da cada tiro en % del campo, atacando hacia x = 100. El local se gira hacia la izquierda.
    const at = (s, x, y) => (s.side === 'home' ? [(100 - x) / 100 * W, (100 - y) / 100 * H] : [x / 100 * W, y / 100 * H]);
    const order = { off: 0, post: 0, on: 1, goal: 2 };
    const shots = [...m.shots].sort((a, b) => order[a.kind] - order[b.kind]);
    for (const s of shots) {
      const ink = teamStyle(m[s.side]).ink;
      const [x, y] = at(s, s.x, s.y);
      if (s.kind === 'goal') {
        if (s.x2 != null && s.y2 != null) {
          const [x2, y2] = at(s, s.x2, s.y2);
          ctx.strokeStyle = ink; ctx.lineWidth = 4;
          ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x2, y2); ctx.stroke();
        }
        ctx.beginPath(); ctx.arc(x, y, 17, 0, Math.PI * 2);
        ctx.fillStyle = ink; ctx.fill();
        ctx.lineWidth = 5; ctx.strokeStyle = '#ffffff'; ctx.stroke();
        ctx.beginPath(); ctx.arc(x, y, 20, 0, Math.PI * 2);
        ctx.lineWidth = 3; ctx.strokeStyle = ink; ctx.stroke();
      } else if (s.kind === 'on') {
        ctx.beginPath(); ctx.arc(x, y, 11, 0, Math.PI * 2);
        ctx.fillStyle = ink; ctx.fill();
      } else {
        ctx.beginPath(); ctx.arc(x, y, 10, 0, Math.PI * 2);
        ctx.fillStyle = '#ece9e2'; ctx.fill();
        ctx.lineWidth = 4; ctx.strokeStyle = ink; ctx.stroke();
      }
    }
    return c.toDataURL('image/png');
  }

  // Tiros y a puerta de cada equipo: los de ESPN y, si no están, los que hay en el mapa.
  function shotTotals(m, side) {
    const count = (kinds) => m.shots.filter(s => s.side === side && kinds.includes(s.kind)).length;
    return { total: m.stats[side]?.totalShots ?? count(['goal', 'on', 'off', 'post']), on: m.stats[side]?.shotsOnTarget ?? count(['goal', 'on']) };
  }

  function tplTiros(m) {
    const total = (side) => shotTotals(m, side).total;
    const onT = (side) => shotTotals(m, side).on;
    const side = (team, s) => `
      <div class="side ${s === 'home' ? 'l' : 'r'}">
        ${logoTag(team, 'lg')}
        <div><span class="n">${total(s)}</span><span class="l">tiros · ${onT(s)} a puerta</span></div>
      </div>`;
    return `
      <div class="fc-in paper">
        <h1 class="title">Mapa de tiros</h1>
        <div class="sides">${side(m.home, 'home')}${side(m.away, 'away')}</div>
        <img class="pitch" src="${pitchChart(m)}" alt=""/>
        <div class="arrows"><span>Tiros ${esc(ofTeam(m.home))}</span><span>Tiros ${esc(ofTeam(m.away))}</span></div>
        <div class="key"><span><i class="goal"></i>Gol</span><span><i class="on"></i>A puerta</span><span><i class="off"></i>Fuera o bloqueado</span></div>
        ${foot(m)}${grain}
      </div>`;
  }

  // ----------------------------------------------------------
  // 5 · LOS ONCES · las dos alineaciones en el campo, con su sistema
  // ----------------------------------------------------------
  // Profundidad de cada puesto (de la portería hacia arriba) y su lado (izquierda < 0).
  function depthOf(pos) {
    const p = pos.toUpperCase();
    if (p === 'G' || p === 'GK') return 0;
    if (/^(LWB|RWB)$/.test(p)) return 1.5;
    if (/^(LB|RB)$/.test(p)) return 1.2;
    if (/^(CD|CB|D|SW)/.test(p)) return 1;
    if (/^(DM|CDM)/.test(p)) return 2;
    if (/^(LM|RM)$/.test(p)) return 3.1;
    if (/^(CM|M)/.test(p)) return 3;
    if (/^(AM|CAM)/.test(p)) return 4;
    if (/^(LW|RW|LF|RF|CF-L|CF-R|SS)$/.test(p)) return 5;
    if (/^(F|ST|CF)$/.test(p)) return 5.2;
    return 3.5;
  }
  function sideOf(pos) {
    const p = pos.toUpperCase();
    if (/-L$/.test(p)) return -1;
    if (/-R$/.test(p)) return 1;
    if (/^L/.test(p)) return -2;
    if (/^R/.test(p)) return 2;
    return 0;
  }
  const starters = (team) => team.players.filter(p => p.starter);
  const lineupOk = (team) => starters(team).length === 11 && starters(team).some(p => depthOf(p.pos) === 0);

  // Filas del sistema (4-2-3-1 → 4, 2, 3, 1) con sus jugadores, de izquierda a derecha.
  function lineupRows(team) {
    const all = starters(team);
    const gk = all.find(p => depthOf(p.pos) === 0) || all[0];
    const field = all.filter(p => p !== gk)
      .map(p => ({ p, d: depthOf(p.pos), s: sideOf(p.pos) }))
      .sort((a, b) => a.d - b.d || a.p.place - b.p.place);
    let counts = (team.formation || '').split('-').map(Number).filter(n => n > 0);
    if (counts.reduce((a, b) => a + b, 0) !== field.length) {
      // Sin sistema (o no cuadra): por líneas de profundidad.
      counts = [];
      field.forEach((f, i) => {
        if (i && Math.floor(f.d) === Math.floor(field[i - 1].d)) counts[counts.length - 1]++;
        else counts.push(1);
      });
    }
    const rows = [];
    let i = 0;
    for (const n of counts) {
      rows.push(field.slice(i, i + n).sort((a, b) => a.s - b.s || a.p.place - b.p.place).map(f => f.p));
      i += n;
    }
    return { gk, rows };
  }

  const ONCES = { left: 260, top: 56, W: 744, H: 1149 };

  function oncesPitch() {
    const { W, H } = ONCES;
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const ctx = c.getContext('2d');
    const s = W / 68; // metros → píxeles (el campo en vertical: 68 de ancho y 105 de largo)
    for (let i = 0; i < 14; i++) {
      ctx.fillStyle = i % 2 ? 'rgba(255,255,255,0.035)' : 'rgba(0,0,0,0.05)';
      ctx.fillRect(0, (i * H) / 14, W, H / 14 + 1);
    }
    ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 4;
    ctx.strokeRect(2, 2, W - 4, H - 4);
    ctx.beginPath(); ctx.moveTo(0, H / 2); ctx.lineTo(W, H / 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(W / 2, H / 2, 9.15 * s, 0, Math.PI * 2); ctx.stroke();
    for (const top of [true, false]) {
      const y0 = top ? 0 : H;
      const d = top ? 1 : -1;
      const box = (depth, width) => ctx.strokeRect(W / 2 - (width / 2) * s, top ? 2 : H - depth * s - 2, width * s, depth * s);
      box(16.5, 40.32);
      box(5.5, 18.32);
      const a = Math.acos(5.5 / 9.15);
      ctx.beginPath();
      if (top) ctx.arc(W / 2, 11 * s, 9.15 * s, Math.PI / 2 - a, Math.PI / 2 + a);
      else ctx.arc(W / 2, H - 11 * s, 9.15 * s, -Math.PI / 2 - a, -Math.PI / 2 + a);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.5)';
      ctx.beginPath(); ctx.arc(W / 2, y0 + d * 11 * s, 5, 0, Math.PI * 2); ctx.fill();
    }
    return c.toDataURL('image/png');
  }

  function tplOnces(m) {
    const { left, top, W, H } = ONCES;
    const half = H / 2;
    const players = [];
    for (const side of ['home', 'away']) {
      const team = m[side];
      const st = teamStyle(team);
      const { gk, rows } = lineupRows(team);
      const spots = [{ p: gk, x: 0.5, y: 0.07, n: 1 }];
      rows.forEach((row, r) => {
        const y = rows.length > 1 ? 0.27 + r * (0.6 / (rows.length - 1)) : 0.55;
        row.forEach((p, i) => spots.push({ p, x: (i + 1) / (row.length + 1), y, n: row.length }));
      });
      for (const { p, x, y, n } of spots) {
        // En una línea de 5 los nombres tienen menos sitio: más pequeños y más estrechos.
        const nameW = Math.min(170, Math.floor(W / (n + 1)) - 8);
        const nameSize = n >= 5 ? 23 : 27;
        // El local abajo, atacando hacia arriba; el visitante arriba y girado.
        const px = left + (side === 'home' ? x : 1 - x) * W;
        const py = top + (side === 'home' ? H - y * half : y * half);
        const goals = m.goals.filter(g => g.scorer === p.id && !g.own).length;
        const yellow = m.cards.some(c => !c.red && c.player === p.id);
        const red = m.cards.some(c => c.red && c.player === p.id);
        const off = m.subs.find(s => s.out === p.id);
        const tags = '<b class="ball"></b>'.repeat(Math.min(goals, 3)) + (red ? '<i class="red"></i>' : yellow ? '<i></i>' : '');
        players.push(`
          <div class="pl${p === gk ? ' gk' : ''}" style="left:${Math.round(px)}px;top:${Math.round(py - 41)}px;${styleVars(st)}">
            <div class="dot">${esc(p.jersey)}</div>
            <div class="nm" style="max-width:${nameW}px;font-size:${nameSize}px">${esc(surname(p))}</div>
            ${tags ? `<div class="tags">${tags}</div>` : ''}
            ${off ? `<div class="sub">▼ ${off.min.label}</div>` : ''}
          </div>`);
      }
    }
    const label = (team, y) => `
      <div class="tm" style="top:${y}px">
        ${logoTag(team, 'lg')}
        <span class="nm">${esc(team.short)}</span>
        ${team.formation ? `<span class="fm">${esc(team.formation)}</span>` : ''}
      </div>`;
    return `
      <div class="fc-in pitchbg">
        <h1 class="title" style="font-size:70px;width:190px;left:40px">Los<br>onces</h1>
        <img class="pitch" src="${oncesPitch()}" alt=""/>
        ${label(m.away, top + half / 2 - 110)}
        ${label(m.home, top + half + half / 2 - 110)}
        ${players.join('')}
        ${foot(m)}${grain}
      </div>`;
  }

  // ----------------------------------------------------------
  // 6 · JUGADOR DEL PARTIDO · el mejor del partido con sus 3 números
  // ----------------------------------------------------------
  function keyNumbers(m, p) {
    const v = (k) => p.s[k] || 0;
    const plural = (n, one, many) => (n === 1 ? one : many);
    const gk = p.pos === 'G';
    const cands = [
      { v: v('totalGoals'), label: plural(v('totalGoals'), 'Gol', 'Goles'), w: 10 * v('totalGoals'), ok: v('totalGoals') > 0 },
      { v: v('goalAssists'), label: plural(v('goalAssists'), 'Asistencia', 'Asistencias'), w: 8 * v('goalAssists'), ok: v('goalAssists') > 0 },
      { v: v('saves'), label: plural(v('saves'), 'Parada', 'Paradas'), w: 3 * v('saves'), ok: gk && v('saves') > 0 },
      { v: 0, label: 'Portería a cero', w: 9, ok: gk && v('goalsConceded') === 0 && p.starter, text: '0' },
      { v: `${v('shotsOnTarget')}/${v('totalShots')}`, label: 'Tiros a puerta', w: 2 * v('shotsOnTarget'), ok: v('totalShots') > 0 },
      { v: v('foulsSuffered'), label: plural(v('foulsSuffered'), 'Falta recibida', 'Faltas recibidas'), w: v('foulsSuffered'), ok: v('foulsSuffered') >= 2 },
      { v: minutesPlayed(m, p), label: 'Minutos', w: 0.1, ok: true },
    ];
    return cands.filter(c => c.ok).sort((a, b) => b.w - a.w).slice(0, 3);
  }
  const bigNumSize = (v, base) => {
    const len = String(v).length;
    return len <= 2 ? base : len === 3 ? Math.round(base * 0.92) : len === 4 ? Math.round(base * 0.84) : Math.round(base * 0.7);
  };
  const scoreLine = (m) => `${m.home.short} ${m.home.score} — ${m.away.score} ${m.away.short}`;

  function tplJugador(m) {
    const p = bestPlayer(m);
    if (!p) return tplSinDatos(m, 'Jugador del partido');
    const team = m[p.side];
    const st = teamStyle(team);
    const nums = keyNumbers(m, p);
    const line = scoreLine(m);
    return `
      <div class="fc-in" style="${styleVars(st)}">
        ${logoTag(team, 'wm')}
        ${p.jersey ? `<div class="dorsal">${esc(p.jersey)}</div>` : ''}
        ${photoTag(p, 'photo')}
        <div class="ph-photo" data-noedit data-for="${p.id}"${hasPhoto(p) ? ' hidden' : ''}>Toca aquí para poner su foto</div>
        <div class="fade"></div>
        <div class="bar"><span>${esc(p.name)}</span></div>
        <div class="fc-kick"><b>Jugador</b> del partido</div>
        <div class="stats">
          ${nums.map(s => `
            <div class="st">
              <div class="n" style="font-size:${bigNumSize(s.text ?? s.v, 250)}px">${s.text ?? s.v}</div>
              <span class="fc-chip">${s.label}</span>
            </div>`).join('')}
        </div>
        <div class="fc-tape" style="font-size:${line.length > 26 ? 42 : 54}px">${esc(line)}</div>
        ${foot(m)}${grain}
      </div>`;
  }

  // ----------------------------------------------------------
  // 7 · CLASIFICACIÓN · 12 filas con los dos equipos dentro (y «···» si están lejos)
  // ----------------------------------------------------------
  const TABLE_ROWS = 12;
  // «Así va …» con su artículo
  const TABLE_NAMES = {
    'esp.1': 'LaLiga', 'esp.2': 'LaLiga Hypermotion', 'esp.w.1': 'la Liga F', 'uefa.champions': 'la Champions',
    'uefa.europa': 'la Europa League', 'uefa.europa.conf': 'la Conference', 'eng.1': 'la Premier', 'ita.1': 'la Serie A',
    'ger.1': 'la Bundesliga', 'fra.1': 'la Ligue 1', 'por.1': 'la Liga Portugal', 'ned.1': 'la Eredivisie', 'mex.1': 'la Liga MX',
    'arg.1': 'la Liga Argentina', 'bra.1': 'el Brasileirão', 'usa.1': 'la MLS', 'ksa.1': 'la Liga Saudí',
  };
  // n filas con los dos equipos dentro; si están lejos, las de cada uno con «···» en medio
  // (null). La slide lleva 12 y el vídeo, 11.
  function tableRows(m, n = TABLE_ROWS) {
    const rows = m.standings || [];
    if (rows.length <= n) return rows;
    const idx = [m.home.id, m.away.id].map(id => rows.findIndex(r => r.id === id)).filter(i => i >= 0).sort((a, b) => a - b);
    if (!idx.length) return rows.slice(0, n);
    const [a, b = a] = [idx[0], idx[idx.length - 1]];
    if (b - a < n) {
      const start = Math.max(0, Math.min(rows.length - n, a - Math.floor((n - (b - a + 1)) / 2)));
      return rows.slice(start, start + n);
    }
    const k = Math.floor(n / 2);
    const around = (i) => {
      const start = Math.max(0, Math.min(rows.length - k, i - 2));
      return rows.slice(start, start + k);
    };
    return [...around(a), null, ...around(b)];
  }
  // «LaLiga», «la Champions», «el grupo B»…
  function tableName(m) {
    const group = (m.standingsName || '').match(/group\s+([A-Z0-9]+)/i)?.[1];
    return group ? `el grupo ${group}` : TABLE_NAMES[m.league] || compOf(m.league).name;
  }

  function tplTabla(m) {
    const rows = tableRows(m);
    const mine = { [m.home.id]: m.home, [m.away.id]: m.away };
    // La fila de cada equipo del partido, con su color (los de fondo blanco, con el del acento:
    // el blanco no se vería sobre el papel).
    const meStyle = (team) => {
      const st = teamStyle(team);
      return contrast(st.bg, '#ece9e2') < 1.3 ? `background:${st.acc};color:${st.on}` : `background:${st.bg};color:${st.fg}`;
    };
    const row = (r) => {
      if (!r) return '<div class="gap">···</div>';
      const me = mine[r.id];
      const gd = r.gd == null ? '' : r.gd > 0 ? `+${r.gd}` : `${r.gd}`;
      return `
        <div class="row${me ? ' me' : ''}"${me ? ` style="${meStyle(me)}"` : ''}>
          <span class="rk">${r.rank}</span>
          <img class="lg" src="${r.logo}" alt="" crossorigin="anonymous" onerror="this.style.visibility='hidden'"/>
          <span class="tn">${esc(me ? me.short : r.name)}</span>
          <span class="c">${r.gp ?? ''}</span>
          <span class="c">${gd}</span>
          <span class="pts">${r.pts ?? ''}</span>
        </div>`;
    };
    const what = tableName(m);
    return `
      <div class="fc-in paper">
        <h1 class="title" style="font-size:${what.length > 16 ? 88 : 104}px">Así va<br>${esc(what)}</h1>
        <div class="tbl">
          <div class="row head"><span class="rk">#</span><span></span><span>Equipo</span><span class="c">PJ</span><span class="c">DG</span><span class="pts">Pts</span></div>
          ${rows.map(row).join('')}
        </div>
        ${foot(m)}${grain}
      </div>`;
  }

  // ----------------------------------------------------------
  // 8 · CIERRE · la pregunta para los comentarios y tu firma
  // ----------------------------------------------------------
  const closingQuestion = (m) => (live(m) ? '¿Cómo acaba?' : sides(m).draw && !pensWon(m) ? '¿Quién mereció ganar?' : '¿Quién fue el mejor del partido?');

  function tplCierre(m) {
    const { winner } = sides(m);
    const team = m[winner || 'home'];
    const p = bestPlayer(m);
    return `
      <div class="fc-in" style="${styleVars(teamStyle(team))}">
        ${p && hasPhoto(p) ? photoTag(p, 'photo') : logoTag(team, 'wm')}
        <div class="fade"></div>
        <div class="qwrap"><h1 class="q">${closingQuestion(m)}</h1><div class="sub">Te leo en comentarios</div></div>
        <div class="handle">
          <span class="fc-chip">Sígueme para más fútbol</span>
          <div class="h fc-sign" data-noedit>${esc(state.sign)}</div>
        </div>
        ${grain}
      </div>`;
  }

  // ----------------------------------------------------------
  // LAS SLIDES DEL CARRUSEL · las que no tienen datos (un amistoso sin alineaciones, una copa
  // sin clasificación) no salen
  // ----------------------------------------------------------
  const SLIDE_DEFS = [
    { id: 'portada', name: 'Portada', cls: 'fc fc-portada', tpl: tplPortada },
    { id: 'crono', name: 'Minuto a minuto', cls: 'fc fc-crono', tpl: tplCrono },
    { id: 'stats', name: 'Estadísticas', cls: 'fc fc-stats', tpl: tplStats, show: (m) => statRows(m).length >= 3 },
    { id: 'tiros', name: 'Mapa de tiros', cls: 'fc fc-tiros', tpl: tplTiros, show: (m) => m.shots.length >= 4 },
    { id: 'onces', name: 'Los onces', cls: 'fc fc-onces', tpl: tplOnces, show: (m) => lineupOk(m.home) && lineupOk(m.away) },
    { id: 'jugador', name: 'Jugador del partido', cls: 'fc fc-jugador', tpl: tplJugador, show: (m) => !!bestPlayer(m),
      pick: (m) => rankedPlayers(m).slice(0, 16).map(p => ({ value: p.id, label: `${surname(p)} · ${m[p.side].abbr}` })),
      pickValue: (m) => bestPlayer(m)?.id || '',
      onPick: (value) => { state.jugadorId = value; } },
    { id: 'tabla', name: 'Clasificación', cls: 'fc fc-tabla', tpl: tplTabla, show: (m) => (m.standings?.length || 0) >= 4 },
    { id: 'cierre', name: 'Cierre', cls: 'fc fc-cierre', tpl: tplCierre },
  ];
  const slideDefs = () => state.shownDefs || [];

  // ----------------------------------------------------------
  // COMPETICIONES Y PARTIDOS
  // ----------------------------------------------------------
  function renderCompPicker() {
    const wrap = document.getElementById('compPicker');
    wrap.innerHTML = COMPETITIONS.map(g => `
      <div class="comp-group">
        <span class="comp-group-name">${g.group}</span>
        <div class="comp-chips">
          ${g.items.map(([slug, chip]) => `<button class="comp-chip" type="button" role="radio" data-league="${slug}" aria-checked="${slug === state.league}">${chip}</button>`).join('')}
        </div>
      </div>`).join('');
    wrap.addEventListener('click', (e) => {
      const btn = e.target.closest('.comp-chip');
      if (btn) setLeague(btn.dataset.league);
    });
  }

  function setLeague(slug) {
    if (!COMP[slug]) return;
    state.league = slug;
    try { localStorage.setItem(LEAGUE_KEY, slug); } catch (e) { /* sin almacenamiento: no se recuerda */ }
    document.querySelectorAll('.comp-chip').forEach(b => b.setAttribute('aria-checked', String(b.dataset.league === slug)));
    loadGames(state.selectedDate || localIso());
  }

  function renderGamesList(games) {
    const wrap = document.getElementById('gamesList');
    if (!games.length) {
      wrap.innerHTML = `<div class="games-empty">No hay partidos de ${esc(compOf(state.league).name)} este día. Prueba con otra fecha.</div>`;
      return;
    }
    wrap.innerHTML = games.map(g => {
      const ph = gamePhase(g);
      const started = ph === 'final' || ph === 'live';
      const row = (team, other) => `
        <div class="game-team${ph === 'final' && team.score < other.score ? ' lost' : ''}">
          <img class="game-team-logo" src="${team.logo}" alt="" onerror="this.style.opacity=0"/>
          <span class="game-team-abbr">${esc(team.short)}</span>
          <span class="game-score">${started ? team.score : ''}</span>
        </div>`;
      const tint = (team) => rgba(teamStyle(team).bg === PAPER ? '#8a8a8a' : teamStyle(team).bg, 0.5);
      const scorers = [g.scorers.home.join(', '), g.scorers.away.join(', ')].filter(Boolean).join(' — ');
      return `
        <div class="game-card" data-game-id="${g.id}" role="button" tabindex="0" aria-pressed="false"
          aria-label="${esc(g.home.name)} contra ${esc(g.away.name)}, ${statusLabel(g)}"
          style="--c1:${tint(g.home)};--c2:${tint(g.away)}">
          <span class="game-status ${ph}">${statusLabel(g)}</span>
          <div class="game-teams">${row(g.home, g.away)}${row(g.away, g.home)}</div>
          <div class="game-scorers">${esc(scorers)}</div>
        </div>`;
    }).join('');
    wrap.querySelectorAll('.game-card').forEach(card => {
      card.addEventListener('click', () => selectGame(card.dataset.gameId));
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          selectGame(card.dataset.gameId);
        }
      });
    });
  }

  let gamesSeq = 0;
  async function loadGames(iso) {
    const seq = ++gamesSeq;
    state.selectedDate = iso;
    state.selectedGame = null;
    const wrap = document.getElementById('gamesList');
    wrap.innerHTML = '<div class="games-empty"><span class="loader"></span> Cargando partidos…</div>';
    document.getElementById('selectedGameInfo').textContent = 'Selecciona un partido arriba.';
    updateGenerateBtn();
    try {
      const games = await fetchGames(state.league, iso);
      if (seq !== gamesSeq) return; // llegó tarde: ya se ha pedido otra cosa
      state.games = games;
      renderGamesList(games);
    } catch (e) {
      if (seq !== gamesSeq) return;
      console.error(e);
      wrap.innerHTML = `<div class="games-empty">Error cargando partidos: ${esc(e.message)}. Reintenta en unos segundos.</div>`;
    }
  }

  function selectGame(gameId) {
    const id = String(gameId);
    const game = state.games.find(g => g.id === id);
    if (!game) return;
    document.querySelectorAll('.game-card').forEach(c => {
      const on = c.dataset.gameId === id;
      c.classList.toggle('selected', on);
      c.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    state.selectedGame = game;
    const ph = gamePhase(game);
    const name = `<strong>${esc(game.home.name)}</strong> – <strong>${esc(game.away.name)}</strong> · ${fmtDate(game.date)}`;
    const note = {
      pre: `Aún no ha empezado (${statusLabel(game)}): vuelve cuando acabe.`,
      off: `${statusLabel(game)}: no hay partido que contar.`,
      live: `Se está jugando (${statusLabel(game)}): si lo generas ahora, las slides cuentan el marcador de este momento.`,
    }[ph];
    document.getElementById('selectedGameInfo').innerHTML = note ? `${name}<br>${note}` : name;
    updateGenerateBtn();
  }

  function updateGenerateBtn() {
    const g = state.selectedGame;
    document.getElementById('generateBtn').disabled = !!state.generating || !g || !['final', 'live'].includes(gamePhase(g));
  }

  // ----------------------------------------------------------
  // GENERAR
  // ----------------------------------------------------------
  let genSeq = 0;
  async function generateCarousel() {
    const game = state.selectedGame;
    if (!game || state.generating || !canDiscardEdits()) return;
    if (gamePhase(game) === 'live' && !confirm(`${game.home.short} – ${game.away.short} aún se está jugando (${statusLabel(game)}). Las slides contarán el marcador de ahora. ¿Generar igualmente?`)) return;
    const seq = ++genSeq;
    const btn = document.getElementById('generateBtn');
    state.generating = true;
    updateGenerateBtn();
    btn.classList.add('btn-loading');
    try {
      const match = await fetchMatch(game);
      if (seq !== genSeq) return;
      state.rendered = match;
      state.jugadorId = null;
      renderSlides(match);
      resetVideo();
      afterRender(match);
      contentChanged(true);
      showToast('Carrusel generado · revisa el preview', 'success');
    } catch (e) {
      console.error(e);
      showToast(`No se pudo generar: ${e.message}`, 'error');
    } finally {
      state.generating = false;
      btn.classList.remove('btn-loading');
      updateGenerateBtn();
    }
  }

  function afterRender(m) {
    document.getElementById('downloadBtn').disabled = false;
    document.getElementById('downloadVerticalBtn').disabled = false;
    updateShareBtn();
    const info = document.getElementById('renderedInfo');
    info.textContent = `${m.home.short} ${m.home.score}-${m.away.score} ${m.away.short} · ${compOf(m.league).name} · ${fmtDate(m.date)}${live(m) ? ' · en juego' : ''}`;
    info.hidden = false;
    updateVideoBtn();
  }

  // ----------------------------------------------------------
  // PREVIEW DE LAS SLIDES
  // ----------------------------------------------------------
  const ZOOM_BTN = `
          <button class="slide-zoom-btn" type="button" title="Ver en grande" aria-label="Ver en grande">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" x2="14" y1="3" y2="10"/><line x1="3" x2="10" y1="21" y2="14"/>
            </svg>
          </button>`;

  function renderSlides(m) {
    const preview = document.getElementById('slidesPreview');
    state.shownDefs = SLIDE_DEFS.filter(d => !d.show || d.show(m));
    preview.innerHTML = state.shownDefs.map((def, i) => `
      <div class="slide-wrap" data-slide-id="${def.id}">
        <div class="slide-label">
          <span class="slide-label-name">${i + 1} · ${def.name}</span>
          ${def.pick ? `<select class="slide-pick" data-slide="${def.id}" aria-label="Jugador">${def.pick(m)
            .map(o => `<option value="${o.value}"${o.value === def.pickValue(m) ? ' selected' : ''}>${esc(o.label)}</option>`).join('')}</select>` : ''}
          <button class="slide-reset-btn" type="button" title="Deshacer los cambios de esta slide">↺ original</button>
        </div>
        <div class="slide-preview-wrap">
          <div class="ab slide ${def.cls}" id="slide-${def.id}">
            ${def.tpl(m)}
          </div>
          ${ZOOM_BTN}
        </div>
        <div class="slide-foot">
          <button class="slide-dl-btn" data-dl-slide="${def.id}" aria-label="Descargar ${def.name} como PNG">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/>
            </svg>
            descargar PNG
          </button>
        </div>
      </div>`).join('');
    preview.querySelectorAll('.slide').forEach(makeSlideEditable);
    setTimeout(scaleSlides, 50);
    preview.querySelectorAll('.slide-dl-btn').forEach(btn => {
      btn.addEventListener('click', () => downloadSingleSlide(btn.dataset.dlSlide, btn));
    });
  }

  // Rehace una sola slide (al cambiar de jugador en el desplegable) y el cierre, que usa su foto.
  function rerenderSlide(def) {
    for (const d of [def, SLIDE_DEFS.find(x => x.id === 'cierre')]) {
      const el = document.getElementById(`slide-${d.id}`);
      if (!el) continue;
      const wrap = el.closest('.slide-wrap');
      if (d !== def && wrap.classList.contains('edited')) continue; // el cierre retocado se queda como está
      el.innerHTML = d.tpl(state.rendered);
      makeSlideEditable(el);
      wrap.classList.remove('edited');
    }
    contentChanged();
  }

  function scaleSlides() {
    document.querySelectorAll('.slide-preview-wrap').forEach(wrap => {
      const slide = wrap.querySelector('.slide');
      const w = wrap.clientWidth;
      if (slide && w) slide.style.transform = `scale(${w / 1080})`;
    });
  }
  window.addEventListener('resize', scaleSlides);

  // ----------------------------------------------------------
  // EDICIÓN A MANO · se toca un texto de la slide y se escribe encima
  // ----------------------------------------------------------
  const INLINE_TAGS = new Set(['SPAN', 'EM', 'B', 'STRONG', 'I', 'BR', 'SMALL']);
  const originalSlides = new WeakMap(); // slide → HTML recién generado, para «↺ original»

  // Cada bloque con texto propio se puede editar (el titular entero con sus <span>, no cada
  // trozo). La firma y el aviso de la foto no: salen de otro sitio.
  function makeSlideEditable(slideEl) {
    const walk = (el) => {
      if (el.hasAttribute('data-noedit')) return;
      const ownText = [...el.childNodes].some(n => n.nodeType === Node.TEXT_NODE && n.textContent.trim());
      const onlyInline = [...el.children].every(c => INLINE_TAGS.has(c.tagName));
      if (ownText && onlyInline) {
        el.contentEditable = 'true';
        el.spellcheck = false;
        return;
      }
      [...el.children].forEach(walk);
    };
    [...slideEl.children].forEach(walk);
    originalSlides.set(slideEl, slideEl.innerHTML);
  }

  function setupSlideEditing(preview) {
    preview.addEventListener('input', (e) => {
      if (!e.target.isContentEditable) return;
      e.target.closest('.slide-wrap')?.classList.add('edited');
      contentChanged();
    });
    // Enter = salto de línea (<br>), no un bloque nuevo que descuadre la slide.
    preview.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && e.target.isContentEditable) {
        e.preventDefault();
        document.execCommand('insertLineBreak');
      }
    });
    // Pegar solo el texto: lo copiado de otra web traería sus fuentes y colores.
    preview.addEventListener('paste', (e) => {
      if (!e.target.isContentEditable) return;
      e.preventDefault();
      document.execCommand('insertText', false, e.clipboardData.getData('text/plain').replace(/\s*\n\s*/g, ' '));
    });
    preview.addEventListener('click', (e) => {
      const btn = e.target.closest('.slide-reset-btn');
      if (!btn) return;
      const wrap = btn.closest('.slide-wrap');
      const slide = wrap.querySelector('.slide');
      slide.innerHTML = originalSlides.get(slide);
      applySign(slide);
      wrap.classList.remove('edited');
      contentChanged();
    });
    preview.addEventListener('change', (e) => {
      const sel = e.target.closest('.slide-pick');
      if (!sel) return;
      const def = slideDefs().find(d => d.id === sel.dataset.slide);
      const wrap = sel.closest('.slide-wrap');
      if (wrap.classList.contains('edited') && !confirm('Se perderán los textos que has cambiado en esta slide. ¿Seguir?')) {
        sel.value = def.pickValue(state.rendered);
        return;
      }
      def.onPick(sel.value);
      rerenderSlide(def);
    });
  }

  function canDiscardEdits() {
    return !document.querySelector('#slidesPreview .slide-wrap.edited')
      || confirm('Se perderán los textos que has cambiado a mano. ¿Seguir?');
  }

  // ----------------------------------------------------------
  // TU FIRMA · abajo a la derecha de cada slide y en el cierre
  // ----------------------------------------------------------
  function applySign(root = document) {
    root.querySelectorAll('.fc-sign').forEach(el => { el.textContent = state.sign; });
  }
  function onSignInput(e) {
    state.sign = e.target.value.trim();
    try { localStorage.setItem(SIGN_KEY, state.sign); } catch (err) { /* sin almacenamiento */ }
    applySign();
    // También en lo que guarda «↺ original»: la firma no es un retoque de la slide.
    document.querySelectorAll('#slidesPreview .slide').forEach(slide => {
      if (!originalSlides.has(slide)) return;
      const tpl = document.createElement('template');
      tpl.innerHTML = originalSlides.get(slide);
      applySign(tpl.content);
      originalSlides.set(slide, tpl.innerHTML);
    });
    if (state.rendered) contentChanged();
  }

  // ----------------------------------------------------------
  // VER EN GRANDE · la slide ocupa casi toda la pantalla y se sigue retocando igual
  // ----------------------------------------------------------
  const zoomUi = document.createElement('div');
  zoomUi.className = 'zoom-ui';
  zoomUi.innerHTML = `
    <button class="zoom-close" type="button" data-zoom="close" title="Cerrar (Esc)" aria-label="Cerrar">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>
    </button>
    <button class="zoom-nav prev" type="button" data-zoom="-1" title="Anterior (←)" aria-label="Slide anterior">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg>
    </button>
    <button class="zoom-nav next" type="button" data-zoom="1" title="Siguiente (→)" aria-label="Slide siguiente">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>
    </button>`;
  const zoomGhost = Object.assign(document.createElement('div'), { className: 'zoom-ghost' });
  const zoomedWrap = () => document.querySelector('.slide-wrap.zoomed');
  const zoomList = (wrap) => [...wrap.parentElement.querySelectorAll('.slide-wrap')];

  function openZoom(wrap) {
    document.activeElement?.blur();
    zoomedWrap()?.classList.remove('zoomed');
    zoomGhost.style.height = `${wrap.offsetHeight}px`;
    wrap.before(zoomGhost);
    wrap.classList.add('zoomed');
    wrap.appendChild(zoomUi);
    document.body.classList.add('zoom-open');
    const all = zoomList(wrap);
    zoomUi.querySelector('.prev').disabled = wrap === all[0];
    zoomUi.querySelector('.next').disabled = wrap === all[all.length - 1];
    scaleSlides();
    zoomUi.querySelector('.zoom-close').focus({ preventScroll: true });
  }

  function closeZoom() {
    const wrap = zoomedWrap();
    if (!wrap) return;
    document.activeElement?.blur();
    document.querySelector('.photo-menu')?.remove();
    wrap.classList.remove('zoomed');
    zoomUi.remove();
    zoomGhost.remove();
    document.body.classList.remove('zoom-open');
    scaleSlides();
    wrap.scrollIntoView({ block: 'nearest' });
  }

  function zoomStep(dir) {
    const wrap = zoomedWrap();
    const all = wrap ? zoomList(wrap) : [];
    const next = all[all.indexOf(wrap) + dir];
    if (next) openZoom(next);
  }

  function setupZoom() {
    let downOnBackdrop = false;
    document.addEventListener('pointerdown', (e) => { downOnBackdrop = !!e.target.classList?.contains('zoomed'); });
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('.slide-zoom-btn');
      if (btn) return openZoom(btn.closest('.slide-wrap'));
      const act = e.target.closest('.zoom-ui [data-zoom]')?.dataset.zoom;
      if (act) return act === 'close' ? closeZoom() : zoomStep(Number(act));
      if (downOnBackdrop && e.target.classList.contains('zoomed')) closeZoom();
    });
    document.addEventListener('keydown', (e) => {
      if (!zoomedWrap()) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        closeZoom();
      } else if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && !e.target.closest?.('[contenteditable="true"], select, input')) {
        e.preventDefault();
        zoomStep(e.key === 'ArrowLeft' ? -1 : 1);
      }
    });
  }

  // ----------------------------------------------------------
  // VÍDEO SHORT · los datos de las slides para video.js, que dibuja y codifica
  // ----------------------------------------------------------
  // El grano de las slides va en el CSS en base64 (para que la descarga funcione abriendo el
  // archivo); el vídeo usa el mismo.
  let grainCache = null;
  function grainUrl() {
    if (grainCache) return grainCache;
    const box = document.createElement('div');
    box.className = 'fc';
    box.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
    const g = document.createElement('div');
    g.className = 'fc-grain';
    box.appendChild(g);
    document.body.appendChild(box);
    const bg = getComputedStyle(g).backgroundImage;
    box.remove();
    grainCache = bg.match(/^url\("?([\s\S]*?)"?\)$/)?.[1] || null;
    return grainCache;
  }

  // El texto de la slide tal como está escrito (el CSS lo pone en mayúsculas y los saltos son <br>).
  function writtenText(sel) {
    const el = document.querySelector(sel);
    if (!el) return '';
    const copy = el.cloneNode(true);
    copy.querySelectorAll('br').forEach(br => br.replaceWith(' '));
    return copy.textContent.replace(/\s+/g, ' ').trim();
  }
  const listEs = (xs) => (xs.length > 1 ? `${xs.slice(0, -1).join(', ')} y ${xs[xs.length - 1]}` : xs[0] || '');
  // «al Real Madrid», «a la Roma», «a España»
  const toTeam = (t) => (article(t) === 'el ' ? `al ${t.short}` : `a ${article(t)}${t.short}`);
  const extraTime = (m, evs) => m.status.period > 2 || /AET|EXTRA|PEN/.test(m.status.name) || evs.some(e => e.min.period > 2);

  function videoData(m) {
    const { winner } = sides(m);
    const team = (side) => {
      const t = m[side];
      return {
        name: t.name, short: t.short, abbr: t.abbr, score: t.score, shootout: pensWon(m) ? t.shootout : null,
        logo: t.logo, style: teamStyle(t), won: winner === side, lost: !!winner && winner !== side,
        the: theTeam(t), to: toTeam(t),
        lines: scorerList(m, side).map(x => (x.red ? `${x.text} · roja` : x.text)),
      };
    };
    const evs = cronoEvents(m);
    const p = bestPlayer(m);
    const keys = p ? keyNumbers(m, p) : [];
    const rows = statRows(m);
    const tbl = (m.standings?.length || 0) >= 4 ? tableRows(m, 11) : null;
    const closingSide = winner || 'home';
    const c = compOf(m.league);
    return {
      home: team('home'),
      away: team('away'),
      live: live(m),
      clock: minuteText(m.status.clock),
      comp: [c.name, m.phase].filter(Boolean).join(' · '),
      date: asDate(m.date).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }),
      headline: writtenText('#slide-portada .head h1') || headline(m),
      goals: evs.map(e => ({ side: e.side, min: e.min.label, t: e.min.t, kind: e.kind, name: e.name, how: e.how, score: e.score || null, style: teamStyle(m[e.side]) })),
      goalsTitle: evs.every(e => e.kind === 'goal') ? 'LOS GOLES' : 'MINUTO A MINUTO',
      halftime: m.halftime,
      extraTime: extraTime(m, evs),
      shots: m.shots.length >= 4 ? {
        home: shotTotals(m, 'home'), away: shotTotals(m, 'away'),
        list: m.shots.map(s => ({ side: s.side, kind: s.kind, x: s.x, y: s.y, x2: s.x2, y2: s.y2 })),
      } : null,
      jugador: p && {
        first: p.name.endsWith(surname(p)) ? p.name.slice(0, -surname(p).length).trim() : '',
        last: surname(p), number: p.jersey,
        photo: hasPhoto(p) ? [photoSrc(p)] : null,
        logo: m[p.side].logo, style: teamStyle(m[p.side]),
        stats: keys.map(s => ({ v: s.text ?? s.v, label: s.label })),
        scoreLine: scoreLine(m),
      },
      stats: rows.length >= 3 ? rows.slice(0, 5).map(r => ({ label: r.label, v: r.v, more: r.more, pct: r.label === 'Posesión' })) : null,
      table: tbl && {
        title: `Así va ${tableName(m)}`,
        rows: tbl.map(r => r && {
          rank: r.rank, pts: r.pts, logo: r.logo,
          name: r.id === m.home.id ? m.home.short : r.id === m.away.id ? m.away.short : r.name,
          me: r.id === m.home.id ? 'home' : r.id === m.away.id ? 'away' : null,
        }),
      },
      closing: {
        question: writtenText('#slide-cierre .q') || closingQuestion(m),
        style: teamStyle(m[closingSide]), side: closingSide,
        photo: p && hasPhoto(p) ? [photoSrc(p)] : null,
      },
      sign: state.sign,
      grain: grainUrl(),
    };
  }

  let videoUrl = null;
  let audioUrl = null;
  let videoFile = null;
  let videoBusy = false;
  function updateVideoBtn() {
    document.getElementById('videoBtn').disabled = videoBusy || recording || !state.rendered;
    document.getElementById('mixPreviewBtn').disabled = videoBusy || recording || mixBusy || !state.rendered;
    syncScript();
  }
  function resetVideo() {
    document.getElementById('videoOut').hidden = true;
    videoFile = null;
    document.getElementById('videoPreview').removeAttribute('src');
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    videoUrl = null;
    audioUrl = null;
  }
  const videoOptions = () => {
    const withVoice = !!voice && document.getElementById('videoVoice').checked;
    return {
      music: document.getElementById('videoMusic').checked,
      script: state.script, ...mixLevels(), intro: document.getElementById('videoIntro').checked,
      voice: withVoice ? voice.blob : null, voiceLead: withVoice ? voice.lead || 0 : null, voiceShift: withVoice ? voice.shift || 0 : 0,
    };
  };

  async function makeVideo() {
    const m = state.rendered;
    if (!m || videoBusy || !window.StudioVideo) return;
    const btn = document.getElementById('videoBtn');
    const label = btn.querySelector('.label');
    videoBusy = true;
    updateVideoBtn();
    btn.classList.add('btn-loading');
    document.activeElement?.blur();
    try {
      const out = await window.StudioVideo.render(videoData(m), (p, stage) => {
        label.textContent = stage || `Creando el vídeo… ${Math.round(p * 100)}%`;
      }, { ...videoOptions(), captions: document.getElementById('videoSubs').checked });
      if (state.rendered !== m) {
        showToast('Has generado otro partido mientras tanto: vuelve a crear el vídeo', 'error');
        return;
      }
      resetVideo();
      const base = `futbol-${stamp(m)}-short`;
      videoUrl = URL.createObjectURL(out.blob);
      const preview = document.getElementById('videoPreview');
      // Que el preview no se quede en el primer fotograma: el marcador con la cinta.
      preview.addEventListener('loadedmetadata', () => { preview.currentTime = 2.6 + (out.mix?.lead || 0); }, { once: true });
      preview.src = videoUrl;
      const dl = document.getElementById('videoDlBtn');
      dl.href = videoUrl;
      dl.download = `${base}.${out.ext}`;
      videoFile = new File([out.blob], dl.download, { type: out.blob.type });
      document.getElementById('videoShareBtn').hidden = !(navigator.canShare && navigator.canShare({ files: [videoFile] }));
      const adl = document.getElementById('audioDlBtn');
      adl.hidden = !out.audio;
      if (out.audio) {
        audioUrl = URL.createObjectURL(out.audio);
        adl.href = audioUrl;
        adl.download = `${base}-musica.wav`;
      }
      const parts = [out.mix?.voice && 'tu voz', out.mix?.music && 'música', out.mix?.captions && 'subtítulos', out.mix?.intro && 'la apertura con los escudos'].filter(Boolean);
      document.getElementById('videoMeta').textContent = parts.length ? `Lleva ${listEs(parts)}.` : 'Sin sonido ni subtítulos.';
      document.getElementById('videoOut').hidden = false;
      showToast(out.note || 'Vídeo listo · revísalo y descárgalo', out.note ? '' : 'success');
    } catch (e) {
      console.error('Vídeo:', e);
      showToast(`No se pudo crear el vídeo: ${e.message}`, 'error');
    } finally {
      videoBusy = false;
      label.textContent = 'Crear vídeo';
      btn.classList.remove('btn-loading');
      updateVideoBtn();
    }
  }

  async function shareVideo() {
    if (!videoFile) return;
    try {
      await navigator.share({ files: [videoFile] });
    } catch (e) {
      if (e.name !== 'AbortError') showToast(`No se pudo compartir: ${e.message}`, 'error');
    }
  }

  // ----------------------------------------------------------
  // GUION DEL VÍDEO · una frase por escena, escrita sola con los datos del partido. Sale en los
  // subtítulos (con la palabra que suena resaltada) y es lo que lees si grabas tu voz.
  // ----------------------------------------------------------
  const SCENE_NAMES = {
    score: 'Marcador', goals: 'Los goles', tiros: 'Mapa de tiros', jugador: 'Jugador del partido',
    stats: 'Estadísticas', tabla: 'Clasificación', outro: 'Cierre',
  };
  const NUM_WORDS = ['cero', 'uno', 'dos', 'tres', 'cuatro', 'cinco'];
  const ORDINALS = ['', 'primero', 'segundo', 'tercero', 'cuarto', 'quinto', 'sexto', 'séptimo', 'octavo', 'noveno', 'décimo'];
  const ordinal = (n) => ORDINALS[n] || `${n}.º`;

  function autoScript(d) {
    const end = (str) => (/[.!?…]$/.test(str) ? str : `${str}.`);
    const H = d.home, A = d.away;
    const W2 = H.won ? H : A.won ? A : null, L2 = W2 === H ? A : H;
    const hl = end(d.headline);
    let result;
    if (d.live) result = `De momento, ${H.score}-${A.score}.`;
    else if (W2 && W2.shootout != null) result = `${cap(W2.the)} gana ${W2.shootout}-${L2.shootout} en los penaltis.`;
    else if (!W2) result = H.score ? `${cap(H.the)} y ${A.the} empatan a ${H.score}.` : `${cap(H.the)} y ${A.the} no pasan del 0-0.`;
    else if (plain(hl).includes(plain(W2.short))) result = null; // el titular ya dice quién gana
    else result = `${cap(W2.the)} gana ${W2.score}-${L2.score} ${L2.to}.`;
    const script = {
      score: result ? `${hl} ${result}` : `${hl.replace(/[.!?…]$/, '')}: ${W2.score}-${L2.score} ${L2.to}.`,
      outro: d.closing.question,
    };

    const goals = d.goals.filter(e => e.kind === 'goal');
    if (d.goals.length) {
      const tally = new Map();
      goals.forEach(e => tally.set(e.name, (tally.get(e.name) || 0) + 1));
      const top = [...tally].sort((a, b) => b[1] - a[1])[0];
      const reds = d.goals.filter(e => e.kind === 'red').map(e => e.name);
      const parts = [];
      if (top && top[1] > 1) {
        const others = [...tally.keys()].filter(n => n !== top[0]);
        parts.push(`${top[0]} marca ${NUM_WORDS[top[1]] || top[1]}.`);
        if (others.length) parts.push(`También ${others.length > 1 ? 'marcan' : 'marca'} ${listEs(others)}.`);
      } else if (tally.size) {
        parts.push(`${tally.size > 1 ? 'Marcan' : 'Marca'} ${listEs([...tally.keys()])}.`);
      }
      if (reds.length) parts.push(`Roja para ${listEs(reds)}.`);
      script.goals = parts.join(' ') || 'Así fue el partido, minuto a minuto.';
    }
    if (d.shots) {
      script.tiros = `${cap(H.the)}, ${d.shots.home.total} tiros y ${d.shots.home.on} a puerta; ${A.the}, ${d.shots.away.total} y ${d.shots.away.on}.`;
    }
    if (d.jugador) {
      const say = (s) => (s.label === 'Portería a cero' ? 'portería a cero' : `${String(s.v).replace('/', ' de ')} ${s.label.toLocaleLowerCase('es')}`);
      const [a, b] = d.jugador.stats;
      script.jugador = `${d.jugador.last}, el mejor del partido${a ? `: ${say(a)}${b ? ` y ${say(b)}` : ''}` : ''}.`;
    }
    if (d.stats) {
      const pos = d.stats.find(r => r.label === 'Posesión');
      if (pos && pos.v[0] !== pos.v[1]) {
        const i = pos.v[0] > pos.v[1] ? 0 : 1;
        script.stats = `${cap((i ? A : H).the)} tuvo el balón: ${Math.round(pos.v[i])}% de posesión.`;
      } else {
        script.stats = 'Así fueron las estadísticas.';
      }
    }
    if (d.table) {
      const rank = (side) => d.table.rows.find(r => r?.me === side)?.rank;
      const [rh, ra] = [rank('home'), rank('away')];
      script.tabla = rh && ra ? `${H.short}, ${ordinal(rh)}; ${A.short}, ${ordinal(ra)}.`
        : rh ? `${cap(H.the)} es ${ordinal(rh)}.` : ra ? `${cap(A.the)} es ${ordinal(ra)}.` : 'Así va la clasificación.';
    }
    return script;
  }

  let scriptData = null;   // los datos del vídeo del partido del guion (para saber sus escenas)
  let scriptSaveTimer = null;
  let voice = null;        // { blob, url, gameId, script, lead, shift, autoShift }
  let recording = false;

  // Cada vez que cambia el partido generado, guion nuevo (y la voz de otro partido, fuera).
  function syncScript() {
    const box = document.getElementById('scriptBox');
    const m = state.rendered;
    box.hidden = !m || !window.StudioVideo?.plan;
    if (box.hidden) return;
    if (state.scriptGame === m.id && scriptData) return;
    scriptData = videoData(m);
    if (state.scriptGame !== m.id || !state.script) {
      state.script = autoScript(scriptData);
      state.scriptGame = m.id;
    }
    if (voice && voice.gameId !== m.id) dropVoice();
    renderScript();
  }

  function renderScript() {
    const list = document.getElementById('scriptLines');
    const plan = window.StudioVideo.plan(scriptData, state.script);
    list.innerHTML = '';
    plan.forEach((sc, i) => {
      const li = document.createElement('li');
      li.className = 'script-line';
      li.dataset.scene = sc.id;
      const label = document.createElement('span');
      label.className = 'script-label';
      label.textContent = `${i + 1} · ${SCENE_NAMES[sc.id] || sc.id} `;
      const secs = document.createElement('small');
      secs.textContent = `${sc.dur.toLocaleString('es-ES', { maximumFractionDigits: 1 })} s`;
      label.append(secs);
      const area = document.createElement('textarea');
      area.rows = 2;
      area.dataset.scene = sc.id;
      area.value = state.script[sc.id] || '';
      area.setAttribute('aria-label', `Guion: ${SCENE_NAMES[sc.id] || sc.id}`);
      const fitEl = document.createElement('span');
      fitEl.className = 'script-fit';
      li.append(label, area, fitEl);
      list.append(li);
    });
    updateScriptFit();
    updateVoiceUi();
  }

  function updateScriptFit() {
    const plan = window.StudioVideo.plan(scriptData, state.script);
    plan.forEach(sc => {
      const el = document.querySelector(`#scriptLines .script-line[data-scene="${sc.id}"] .script-fit`);
      if (!el) return;
      const [cls, msg] = !sc.words ? ['empty', 'Sin frase: esta escena va sin subtítulos']
        : sc.speed <= 1.1 ? ['ok', 'Cabe a ritmo normal']
          : sc.speed <= 1.3 ? ['warn', 'Algo rápido: mejor una palabra menos']
            : ['bad', 'Muy rápido: quita palabras'];
      el.className = `script-fit ${cls}`;
      el.textContent = msg;
    });
  }

  function onScriptInput(e) {
    const area = e.target.closest('textarea[data-scene]');
    if (!area) return;
    state.script = { ...state.script, [area.dataset.scene]: area.value.replace(/\s*\n\s*/g, ' ') };
    updateScriptFit();
    updateVoiceUi();
    clearTimeout(scriptSaveTimer);
    scriptSaveTimer = setTimeout(saveDraft, 500);
  }

  function resetScript() {
    if (!scriptData) return;
    scriptData = videoData(state.rendered); // con el titular y la pregunta de ahora
    state.script = autoScript(scriptData);
    renderScript();
    saveDraft();
  }

  // ─── Tu voz ───
  const PROMPT_LEAD = 0.2;  // el teleprompter va 0,2 s por delante de los subtítulos
  const SYNC_STEP = 0.05;
  const syncText = (shift) => (Math.abs(shift) < SYNC_STEP / 2 ? 'sin mover'
    : `${Math.abs(shift).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} s ${shift < 0 ? 'antes' : 'después'}`);
  function saveVoice() {
    if (!voice) return;
    const { blob, gameId, script, lead, shift, autoShift } = voice;
    dbPut('drafts', 'voice', { blob, gameId, script, lead, shift, autoShift, savedAt: Date.now() });
  }
  let syncSaveTimer = null;
  function onSyncInput() {
    if (!voice) return;
    voice.shift = Number(document.getElementById('voiceSync').value);
    document.getElementById('voiceSyncOut').textContent = syncText(voice.shift);
    mixChanged();
    clearTimeout(syncSaveTimer);
    syncSaveTimer = setTimeout(saveVoice, 400);
  }
  function autoSync() {
    if (!voice) return;
    voice.shift = voice.autoShift || 0;
    updateVoiceUi();
    mixChanged();
    saveVoice();
  }
  const sameScript = (a, b) => JSON.stringify(a || {}) === JSON.stringify(b || {});
  function setVoice(v) {
    if (voice?.url) URL.revokeObjectURL(voice.url);
    voice = v ? { ...v, url: URL.createObjectURL(v.blob) } : null;
    updateVoiceUi();
  }
  function dropVoice() {
    setVoice(null);
    dbDel('drafts', 'voice');
  }
  function updateVoiceUi() {
    const player = document.getElementById('voicePlayer');
    const has = !!voice;
    if (has && player.getAttribute('src') !== voice.url) player.src = voice.url;
    if (!has) player.removeAttribute('src');
    player.hidden = !has;
    document.getElementById('voiceDelBtn').hidden = !has;
    document.getElementById('videoVoiceLabel').hidden = !has;
    document.getElementById('voiceSyncRow').hidden = !has;
    if (has) {
      document.getElementById('voiceSync').value = voice.shift || 0;
      document.getElementById('voiceSyncOut').textContent = syncText(voice.shift || 0);
    }
    showMix();
    document.getElementById('voiceRecBtn').querySelector('.label').textContent = has ? 'Repetir grabación' : 'Grabar mi voz';
    const status = document.getElementById('voiceStatus');
    status.classList.toggle('warn', has && !sameScript(voice.script, state.script));
    status.textContent = !has
      ? 'Lee el guion mientras corre el vídeo: la palabra que toca se resalta, como en los subtítulos. Antes, una cuenta atrás de 3 segundos.'
      : !sameScript(voice.script, state.script)
        ? 'Has cambiado el guion después de grabar: vuelve a grabar para que tu voz y los subtítulos digan lo mismo.'
        : 'Tu voz está lista: va en el vídeo con la música más baja mientras hablas.';
  }

  // ─── Volumen · por defecto, la música y la voz como suenan siempre (100 %). Las barras se
  // recuerdan en este navegador y «Escuchar la mezcla» crea solo el sonido para ajustarlas. ───
  const MIX_KEY = 'fc-mix';
  let mixBusy = false;
  let mixUrl = null;
  const mixLevels = () => ({
    musicVolume: Number(document.getElementById('musicVol').value) / 100,
    voiceVolume: Number(document.getElementById('voiceVol').value) / 100,
  });
  function showMix() {
    const music = document.getElementById('musicVol'), voiceVol = document.getElementById('voiceVol');
    document.getElementById('musicVolOut').textContent = `${music.value}%`;
    document.getElementById('voiceVolOut').textContent = `${voiceVol.value}%`;
    music.disabled = !document.getElementById('videoMusic').checked;
    document.getElementById('voiceVolLabel').hidden = !voice;
    document.getElementById('mixResetBtn').hidden = music.value === '100' && voiceVol.value === '100';
  }
  function loadMix() {
    try {
      const saved = JSON.parse(localStorage.getItem(MIX_KEY) || '{}');
      if (Number.isFinite(saved.music)) document.getElementById('musicVol').value = saved.music;
      if (Number.isFinite(saved.voice)) document.getElementById('voiceVol').value = saved.voice;
    } catch (e) { /* sin localStorage: por defecto */ }
    showMix();
  }
  function mixChanged() {
    showMix();
    const player = document.getElementById('mixPlayer');
    player.pause();
    player.hidden = true;
    try {
      localStorage.setItem(MIX_KEY, JSON.stringify({
        music: Number(document.getElementById('musicVol').value), voice: Number(document.getElementById('voiceVol').value),
      }));
    } catch (e) { /* sin localStorage: vale para esta vez */ }
  }
  function resetMix() {
    document.getElementById('musicVol').value = 100;
    document.getElementById('voiceVol').value = 100;
    mixChanged();
  }
  async function previewMix() {
    const m = state.rendered;
    if (!m || mixBusy || videoBusy || recording || !window.StudioVideo?.audio) return;
    const opts = videoOptions();
    if (!opts.music && !opts.voice) {
      showToast('No hay nada que escuchar: activa la música o graba tu voz');
      return;
    }
    const btn = document.getElementById('mixPreviewBtn');
    mixBusy = true;
    updateVideoBtn();
    btn.classList.add('btn-loading');
    try {
      const wav = await window.StudioVideo.audio(videoData(m), opts);
      if (mixUrl) URL.revokeObjectURL(mixUrl);
      mixUrl = URL.createObjectURL(wav);
      const player = document.getElementById('mixPlayer');
      player.src = mixUrl;
      player.hidden = false;
      player.play().catch(() => { /* sin permiso para sonar solo: tiene sus controles */ });
    } catch (e) {
      console.error('Mezcla:', e);
      showToast(`No se pudo preparar el sonido: ${e.message}`, 'error');
    } finally {
      mixBusy = false;
      btn.classList.remove('btn-loading');
      updateVideoBtn();
    }
  }

  // El teleprompter: la frase de la escena con lo ya dicho, la palabra que toca y lo que falta,
  // y debajo la siguiente.
  let prompterKey = '';
  function updatePrompterText(words, t) {
    const i = words.findIndex(w => w.end > t);
    const scene = i >= 0 ? words[i].scene : -1;
    const line = words.filter(w => w.scene === scene);
    const now = line.findIndex(w => t >= w.start && t < w.end);
    const key = `${scene}:${now}:${line.filter(w => t >= w.end).length}`;
    if (key === prompterKey) return;
    prompterKey = key;
    const lineEl = document.getElementById('prompterLine');
    lineEl.replaceChildren(...line.flatMap((w, j) => {
      const span = document.createElement('span');
      span.textContent = w.text;
      span.className = j === now ? 'now' : t >= w.end ? 'said' : '';
      return j ? [' ', span] : [span];
    }));
    const nextScene = words.find(w => w.scene > scene)?.scene;
    document.getElementById('prompterNext').textContent = nextScene == null ? ''
      : words.filter(w => w.scene === nextScene).map(w => w.text).join(' ');
  }

  async function recordVoice() {
    const m = state.rendered;
    if (!m || videoBusy || recording || !window.StudioVideo?.prepare) return;
    document.activeElement?.blur();
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      showToast('Este navegador no puede grabar audio: prueba con Chrome', 'error');
      return;
    }
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    } catch (e) {
      showToast('Sin acceso al micrófono: dale permiso en el navegador', 'error');
      return;
    }
    recording = true;
    updateVideoBtn();
    const overlay = document.getElementById('prompter');
    const count = document.getElementById('prompterCount');
    const clock = document.getElementById('prompterTime');
    overlay.classList.remove('live');
    clock.textContent = 'Preparando…';
    document.getElementById('prompterLine').textContent = '';
    document.getElementById('prompterNext').textContent = '';
    prompterKey = '';
    overlay.hidden = false;
    document.body.classList.add('zoom-open');
    let cancelled = false;
    const cancel = () => { cancelled = true; };
    const onKey = (e) => { if (e.key === 'Escape') cancel(); };
    document.getElementById('prompterStop').onclick = cancel;
    document.addEventListener('keydown', onKey);
    try {
      const script = { ...state.script };
      // Con la apertura o sin ella, como esté marcado: se apunta para colocar la voz.
      const prep = await window.StudioVideo.prepare(videoData(m), script, { intro: document.getElementById('videoIntro').checked });
      const canvas = document.getElementById('prompterCanvas');
      const ctx = canvas.getContext('2d');
      ctx.setTransform(canvas.width / prep.W, 0, 0, canvas.height / prep.H, 0, 0);
      prep.draw(ctx, 0);
      updatePrompterText(prep.words, PROMPT_LEAD);
      for (const n of [3, 2, 1]) {
        if (cancelled) break;
        count.textContent = n;
        clock.textContent = 'Empieza en…';
        await new Promise(r => setTimeout(r, 1000));
      }
      count.textContent = '';
      if (cancelled) return;
      const mime = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm', 'audio/ogg;codecs=opus']
        .find(x => MediaRecorder.isTypeSupported(x));
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime, audioBitsPerSecond: 128000 } : {});
      const chunks = [];
      rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      const started = new Promise(r => { rec.onstart = r; });
      const stopped = new Promise(r => { rec.onstop = r; });
      rec.start(250);
      await started;
      const t0 = performance.now();
      overlay.classList.add('live');
      await new Promise((resolve) => {
        const tick = () => {
          const t = (performance.now() - t0) / 1000;
          // Lo que ves va un poco adelantado: lees la palabra cuando se ilumina y la dices un
          // instante después, justo con su subtítulo.
          prep.draw(ctx, Math.min(t + PROMPT_LEAD, prep.duration));
          updatePrompterText(prep.words, t + PROMPT_LEAD);
          clock.textContent = `Grabando · ${Math.floor(Math.min(t, prep.duration))} / ${Math.round(prep.duration)} s`;
          if (cancelled || t >= prep.duration) resolve();
          else requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      });
      rec.stop();
      await stopped;
      if (cancelled) {
        showToast('Grabación cancelada');
        return;
      }
      const blob = new Blob(chunks, { type: rec.mimeType || mime || 'audio/webm' });
      // Lo que aún llegue tarde (la reacción, el arranque del micro), se adelanta solo.
      let lag = 0;
      try { lag = await window.StudioVideo.measureVoiceLag(blob, prep.words); } catch (e) { console.warn('Sincronía:', e); }
      const shift = -Math.round(lag / SYNC_STEP) * SYNC_STEP;
      setVoice({ blob, gameId: m.id, script, lead: prep.lead, shift, autoShift: shift });
      document.getElementById('videoVoice').checked = true;
      saveVoice();
      showToast(shift ? `Voz grabada · la he movido ${syncText(shift)} para que vaya con los subtítulos` : 'Voz grabada · escúchala y crea el vídeo', 'success');
    } catch (e) {
      console.error('Grabar voz:', e);
      showToast(`No se pudo grabar: ${e.message}`, 'error');
    } finally {
      stream.getTracks().forEach(tr => tr.stop());
      document.removeEventListener('keydown', onKey);
      overlay.hidden = true;
      overlay.classList.remove('live');
      document.body.classList.remove('zoom-open');
      recording = false;
      updateVideoBtn();
    }
  }

  // ----------------------------------------------------------
  // BORRADORES · el partido, sus retoques y las fotos subidas se guardan en este navegador
  // (IndexedDB): si se recarga la página, al volver está todo como estaba.
  // ----------------------------------------------------------
  let dbPromise = null;
  function db() {
    if (!('indexedDB' in window)) return Promise.resolve(null);
    dbPromise ||= new Promise((resolve) => {
      try {
        const req = indexedDB.open('futbol-studio', 1);
        req.onupgradeneeded = () => {
          req.result.createObjectStore('drafts');
          req.result.createObjectStore('photos');
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(null); // modo privado o sin espacio: sin borradores
      } catch (e) {
        resolve(null);
      }
    });
    return dbPromise;
  }
  async function dbRun(store, mode, fn) {
    const conn = await db();
    if (!conn) return undefined;
    return new Promise((resolve) => {
      try {
        const tx = conn.transaction(store, mode);
        const out = fn(tx.objectStore(store));
        tx.oncomplete = () => resolve(typeof out === 'function' ? out() : out?.result);
        tx.onerror = tx.onabort = () => resolve(undefined);
      } catch (e) {
        resolve(undefined);
      }
    });
  }
  const dbGet = (store, key) => dbRun(store, 'readonly', st => st.get(key));
  const dbPut = (store, key, value) => dbRun(store, 'readwrite', st => st.put(value, key));
  const dbDel = (store, key) => dbRun(store, 'readwrite', st => st.delete(key));
  const dbEntries = (store) => dbRun(store, 'readonly', st => {
    const rows = [];
    st.openCursor().onsuccess = (e) => {
      const cur = e.target.result;
      if (cur) { rows.push([cur.key, cur.value]); cur.continue(); }
    };
    return () => rows;
  });

  function slideEdits() {
    const edits = {};
    document.querySelectorAll('#slidesPreview .slide-wrap.edited').forEach(w => {
      edits[w.dataset.slideId] = w.querySelector('.slide').innerHTML;
    });
    return edits;
  }
  function applyEdits(edits = {}) {
    Object.entries(edits).forEach(([id, html]) => {
      const wrap = document.querySelector(`#slidesPreview .slide-wrap[data-slide-id="${id}"]`);
      if (!wrap) return;
      const slide = wrap.querySelector('.slide');
      slide.innerHTML = html;
      // Las fotos subidas eran URLs de la sesión anterior: se vuelven a enlazar.
      slide.querySelectorAll('img[data-player]').forEach(img => {
        img.src = state.photoOverrides[img.dataset.player] || img.dataset.official;
      });
      applySign(slide);
      wrap.classList.add('edited');
    });
  }

  async function saveDraft() {
    if (!state.rendered) return;
    await dbPut('drafts', 'match', {
      savedAt: Date.now(),
      match: state.rendered,
      jugadorId: state.jugadorId,
      script: state.scriptGame === state.rendered.id ? state.script : null,
      edits: slideEdits(),
    });
    try { localStorage.removeItem(PENDING_KEY); } catch (e) { /* sin almacenamiento */ }
    const status = document.getElementById('draftStatus');
    status.textContent = `Guardado en este navegador · ${new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`;
    status.hidden = false;
  }

  let saveTimer = null;
  function contentChanged(now = false) {
    sharePrepared = null;
    resetShareBtn();
    clearTimeout(saveTimer);
    saveTimer = null;
    if (now) saveDraft();
    else saveTimer = setTimeout(() => { saveTimer = null; saveDraft(); }, 500);
  }
  // Al cerrar la pestaña, el navegador puede cortar el guardado en IndexedDB a medias: los
  // retoques van también a localStorage, que es inmediato, y al volver se aplican.
  const PENDING_KEY = 'fc-pending';
  function flushDrafts() {
    if (!saveTimer) return;
    try {
      localStorage.setItem(PENDING_KEY, JSON.stringify({ at: Date.now(), id: state.rendered?.id || '', edits: slideEdits() }));
    } catch (e) { /* sin espacio: queda lo de IndexedDB */ }
    contentChanged(true);
  }
  function takePending(id, savedAt) {
    try {
      const raw = localStorage.getItem(PENDING_KEY);
      localStorage.removeItem(PENDING_KEY);
      const pending = raw && JSON.parse(raw);
      return pending && pending.id === id && pending.at > savedAt ? pending.edits : null;
    } catch (e) {
      return null;
    }
  }
  window.addEventListener('pagehide', flushDrafts);
  document.addEventListener('visibilitychange', () => { if (document.hidden) flushDrafts(); });

  async function restoreDraft() {
    try {
      for (const [key, blob] of (await dbEntries('photos')) || []) {
        state.photoOverrides[key] ||= URL.createObjectURL(blob);
      }
      const d = await dbGet('drafts', 'match');
      if (!d?.match || state.rendered || state.generating) return;
      state.rendered = d.match;
      state.jugadorId = d.jugadorId || null;
      state.script = d.script || null;
      state.scriptGame = d.script ? d.match.id : null;
      renderSlides(d.match);
      applyEdits(d.edits);
      const late = takePending(d.match.id, d.savedAt);
      if (late) {
        applyEdits(late);
        saveDraft();
      }
      afterRender(d.match);
      const savedVoice = await dbGet('drafts', 'voice');
      if (savedVoice?.blob && savedVoice.gameId === d.match.id) setVoice(savedVoice);
      const status = document.getElementById('draftStatus');
      status.textContent = `Recuperado del borrador · ${new Date(d.savedAt).toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`;
      status.hidden = false;
      showToast(`Recuperado tu último carrusel · ${d.match.home.short} – ${d.match.away.short}`);
    } catch (e) {
      // Un borrador de una versión vieja del Studio que ya no encaja: fuera.
      console.warn('Borrador descartado:', e);
      dbDel('drafts', 'match');
    }
  }

  // ----------------------------------------------------------
  // COMPARTIR · en el móvil, las PNG van directas a Instagram, Fotos, WhatsApp…
  // Dos toques: el primero prepara las imágenes y el segundo abre la hoja de compartir.
  // ----------------------------------------------------------
  let sharePrepared = null; // { files, rendered }
  const canShareFiles = (() => {
    try {
      return !!navigator.canShare && navigator.canShare({ files: [new File(['x'], 'x.png', { type: 'image/png' })] });
    } catch (e) {
      return false;
    }
  })();
  function updateShareBtn() {
    const btn = document.getElementById('shareCarouselBtn');
    btn.hidden = !canShareFiles;
    btn.disabled = !state.rendered;
  }
  function resetShareBtn() {
    const btn = document.getElementById('shareCarouselBtn');
    if (!btn) return;
    btn.classList.remove('ready');
    btn.querySelector('.label').textContent = 'Compartir';
  }

  async function shareCarousel() {
    const rendered = state.rendered;
    if (!rendered) return;
    const btn = document.getElementById('shareCarouselBtn');
    if (sharePrepared?.rendered === rendered) {
      try {
        await navigator.share({ files: sharePrepared.files });
      } catch (e) {
        if (e.name !== 'AbortError') showToast(`No se pudo compartir: ${e.message}`, 'error');
      }
      return;
    }
    if (!lockCapture()) return;
    navigator.clipboard?.writeText(generateCaption(rendered)).catch(() => {});
    btn.disabled = true;
    btn.classList.add('btn-loading');
    btn.querySelector('.label').textContent = 'Preparando…';
    try {
      const files = [];
      const defs = slideDefs();
      for (let i = 0; i < defs.length; i++) {
        const el = document.getElementById(`slide-${defs[i].id}`);
        if (!el) continue;
        const blob = await captureSlide(el);
        files.push(new File([blob], pngName(defs[i], i), { type: 'image/png' }));
      }
      if (state.rendered !== rendered) return;
      sharePrepared = { files, rendered };
      btn.classList.add('ready');
      btn.querySelector('.label').textContent = 'Toca para compartir';
      showToast('Listo: toca otra vez para mandarlo a Instagram · el pie de foto está copiado', 'success');
    } catch (e) {
      console.error(e);
      resetShareBtn();
      showToast(`No se pudieron preparar las imágenes: ${e.message}`, 'error');
    } finally {
      btn.disabled = false;
      btn.classList.remove('btn-loading');
      unlockCapture();
    }
  }

  // ----------------------------------------------------------
  // CAMBIAR FOTO · se toca al jugador y se sube una foto suya; el fondo se quita en el propio
  // navegador con @imgly/background-removal (la foto no sale del ordenador)
  // ----------------------------------------------------------
  const BG_REMOVAL_URL = 'https://cdn.jsdelivr.net/npm/@imgly/background-removal@1.7.0/+esm';
  let bgRemovalLib = null;
  let photoBusy = false;

  async function cutOutPlayer(file, onProgress) {
    bgRemovalLib ||= Promise.race([
      import(BG_REMOVAL_URL),
      new Promise((_, reject) => setTimeout(() => reject(new Error('no carga la herramienta de recorte; revisa la conexión')), 30000)),
    ]).catch((e) => { bgRemovalLib = null; throw e; });
    const { removeBackground } = await bgRemovalLib;
    const cut = await removeBackground(file, { model: 'isnet_quint8', output: { format: 'image/png' }, progress: onProgress });
    return fitLikeHeadshot(cut);
  }

  // Encaja el recorte en 1040×760, centrado y apoyado abajo, como las fotos de jugador.
  async function fitLikeHeadshot(blob) {
    const img = await createImageBitmap(blob);
    const k = Math.min(1, 1600 / Math.max(img.width, img.height));
    const w = Math.round(img.width * k), h = Math.round(img.height * k);
    const src = document.createElement('canvas');
    src.width = w; src.height = h;
    const sctx = src.getContext('2d', { willReadFrequently: true });
    sctx.drawImage(img, 0, 0, w, h);
    const { data } = sctx.getImageData(0, 0, w, h);
    let x0 = w, y0 = h, x1 = -1, y1 = -1;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (data[(y * w + x) * 4 + 3] < 24) continue;
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        y1 = y;
      }
    }
    if (x1 < 0) throw new Error('no se ha encontrado a nadie en la foto');
    const bw = x1 - x0 + 1, bh = y1 - y0 + 1;
    const s = Math.min(1040 / bw, 760 / bh);
    const out = document.createElement('canvas');
    out.width = 1040; out.height = 760;
    const octx = out.getContext('2d');
    octx.imageSmoothingQuality = 'high';
    octx.drawImage(src, x0, y0, bw, bh, (1040 - bw * s) / 2, 760 - bh * s, bw * s, bh * s);
    return new Promise((resolve, reject) =>
      out.toBlob(b => (b ? resolve(b) : reject(new Error('no se pudo guardar la foto'))), 'image/png'));
  }

  // Pone la foto (o vuelve a la de ESPN con url = null) en todas las slides de ese jugador,
  // también en lo que guarda «↺ original».
  function setPlayerPhoto(key, url) {
    sharePrepared = null;
    resetShareBtn();
    const old = state.photoOverrides[key];
    if (url) state.photoOverrides[key] = url;
    else delete state.photoOverrides[key];
    const swap = (root) => {
      root.querySelectorAll(`img[data-player="${key}"]`).forEach(img => {
        img.src = url || img.dataset.official;
        img.classList.toggle('blank', img.src === BLANK);
        img.style.display = '';
      });
      root.querySelectorAll(`.ph-photo[data-for="${key}"]`).forEach(el => { el.hidden = !!url || !!playerOfficial(key); });
    };
    document.querySelectorAll('.slide').forEach(slide => {
      swap(slide);
      if (!originalSlides.has(slide)) return;
      const tpl = document.createElement('template');
      tpl.innerHTML = originalSlides.get(slide);
      swap(tpl.content);
      originalSlides.set(slide, tpl.innerHTML);
    });
    if (old) URL.revokeObjectURL(old);
    contentChanged();
  }
  const playerOfficial = (id) => (state.rendered ? officialPhoto(playerById(state.rendered, id)) : '');

  async function uploadPlayerPhoto(key, file) {
    if (!file.type.startsWith('image/')) {
      showToast('Eso no es una imagen', 'error');
      return;
    }
    photoBusy = true;
    const busy = [...document.querySelectorAll(`.slide img[data-player="${key}"]`)].map(img => img.closest('.slide-wrap'));
    busy.forEach(w => w.classList.add('photo-busy'));
    showToast('Quitando el fondo…', '', true);
    const loads = {};
    try {
      const fitted = await cutOutPlayer(file, (step, done, total) => {
        if (step.startsWith('fetch:') && total) {
          loads[step] = [done, total];
          const [d, t] = Object.values(loads).reduce(([a, b], [c, e]) => [a + c, b + e], [0, 0]);
          showToast(`Preparando el recorte (solo la primera vez)… ${Math.round(d / t * 100)}%`, '', true);
        } else if (step === 'compute:inference') {
          showToast('Quitando el fondo…', '', true);
        }
      });
      setPlayerPhoto(key, URL.createObjectURL(fitted));
      dbPut('photos', key, fitted);
      showToast('Foto cambiada', 'success');
    } catch (e) {
      console.error('Cambiar foto:', e);
      showToast(`No se pudo quitar el fondo: ${e.message}`, 'error');
    } finally {
      photoBusy = false;
      busy.forEach(w => w.classList.remove('photo-busy'));
    }
  }

  function photoMenu(x, y, onUpload, onReset) {
    document.querySelector('.photo-menu')?.remove();
    const menu = document.createElement('div');
    menu.className = 'photo-menu';
    menu.innerHTML = '<button type="button" data-act="up">Subir otra foto</button><button type="button" data-act="reset">Quitar la foto que subí</button>';
    menu.style.left = `${Math.min(x, innerWidth - 240)}px`;
    menu.style.top = `${y + scrollY}px`;
    document.body.appendChild(menu);
    const close = () => { menu.remove(); document.removeEventListener('pointerdown', outside, true); };
    const outside = (e) => { if (!menu.contains(e.target)) close(); };
    document.addEventListener('pointerdown', outside, true);
    menu.addEventListener('click', (e) => {
      const act = e.target.closest('button')?.dataset.act;
      if (!act) return;
      close();
      act === 'up' ? onUpload() : onReset();
    });
  }

  function setupPhotoSwap(preview) {
    const input = Object.assign(document.createElement('input'), { type: 'file', accept: 'image/*', hidden: true });
    document.body.appendChild(input);
    let target = null;
    input.addEventListener('change', () => {
      const file = input.files[0];
      input.value = '';
      if (file && target) uploadPlayerPhoto(target, file);
    });
    const photoAt = (e) => {
      if (!e.target.closest?.('.slide') || e.target.closest('[contenteditable="true"], select, button')) return null;
      return document.elementsFromPoint(e.clientX, e.clientY)
        .find(el => el.matches('.slide img[data-player]') && preview.contains(el)) || null;
    };
    let hovered = null;
    const hover = (img) => {
      if (img === hovered) return;
      hovered?.classList.remove('photo-hover');
      img?.classList.add('photo-hover');
      hovered = img;
      preview.classList.toggle('over-photo', !!img);
    };
    preview.addEventListener('mousemove', (e) => hover(photoAt(e)));
    preview.addEventListener('mouseleave', () => hover(null));
    preview.addEventListener('click', (e) => {
      const img = photoAt(e);
      if (!img) return;
      if (photoBusy) {
        showToast('Espera, aún estoy con la otra foto');
        return;
      }
      target = img.dataset.player;
      if (!state.photoOverrides[target]) {
        input.click();
        return;
      }
      photoMenu(e.clientX, e.clientY, () => input.click(), () => {
        setPlayerPhoto(target, null);
        dbDel('photos', target);
      });
    });
  }

  // ----------------------------------------------------------
  // DESCARGAS — html2canvas + JSZip
  // ----------------------------------------------------------
  function waitForImages(rootEl) {
    return Promise.all([...rootEl.querySelectorAll('img')].map(img => {
      if (img.complete && img.naturalWidth > 0) return Promise.resolve();
      return new Promise(resolve => {
        img.addEventListener('load', resolve, { once: true });
        img.addEventListener('error', resolve, { once: true });
        setTimeout(resolve, 5000);
      });
    }));
  }

  let captureBusy = false;
  function lockCapture() {
    if (captureBusy) {
      showToast('Espera a que acabe la descarga que está en marcha');
      return false;
    }
    captureBusy = true;
    return true;
  }
  function unlockCapture() {
    captureBusy = false;
    scaleSlides();
  }

  async function captureCanvas(slideEl) {
    await waitForImages(slideEl);
    if (document.fonts) await document.fonts.ready;
    document.activeElement?.blur();
    const prevTransform = slideEl.style.transform;
    slideEl.style.transform = 'none';
    slideEl.classList.add('capturing');
    slideEl.querySelectorAll('.photo-hover').forEach(img => img.classList.remove('photo-hover'));
    try {
      return await html2canvas(slideEl, {
        width: 1080, height: 1350, scale: 1, backgroundColor: '#0B0B0B',
        useCORS: true, allowTaint: true, imageTimeout: 8000,
      });
    } finally {
      slideEl.style.transform = prevTransform;
      slideEl.classList.remove('capturing');
    }
  }
  async function captureSlide(slideEl) {
    const canvas = await captureCanvas(slideEl);
    return new Promise(r => canvas.toBlob(r, 'image/png'));
  }

  // 9:16 (TikTok, Reels, Stories): la slide en el centro y, arriba y abajo, su propio fondo
  // continuado, un poco más oscuro hacia fuera.
  function toVertical(slide) {
    const out = document.createElement('canvas');
    out.width = 1080; out.height = 1920;
    const ctx = out.getContext('2d');
    const pad = (1920 - 1350) / 2;
    const band = (sy, dy, fadeFrom, fadeTo) => {
      const row = document.createElement('canvas');
      row.width = 24; row.height = 1;
      row.getContext('2d').drawImage(slide, 0, sy, 1080, 1, 0, 0, 24, 1);
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(row, 0, 0, 24, 1, 0, dy, 1080, pad);
      const shade = ctx.createLinearGradient(0, fadeFrom, 0, fadeTo);
      shade.addColorStop(0, 'rgba(0,0,0,0)');
      shade.addColorStop(1, 'rgba(0,0,0,0.35)');
      ctx.fillStyle = shade;
      ctx.fillRect(0, dy, 1080, pad);
    };
    band(2, 0, pad, 0);
    band(1347, pad + 1350, pad + 1350, 1920);
    ctx.drawImage(slide, 0, pad);
    return out;
  }

  function triggerDownload(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000); // Safari en iPhone corta la descarga si se libera ya
  }

  const stamp = (m) => `${m.home.abbr}-${m.away.abbr}-${m.date.slice(0, 10)}`.toLowerCase();
  const pngName = (def, i) => `futbol-${stamp(state.rendered)}-${String(i + 1).padStart(2, '0')}-${def.id}.png`;

  async function downloadSingleSlide(slideId, btn) {
    const defs = slideDefs();
    const idx = defs.findIndex(d => d.id === slideId);
    const el = document.getElementById(`slide-${slideId}`);
    if (idx < 0 || !el || !lockCapture()) return;
    btn.disabled = true;
    btn.classList.add('btn-loading');
    try {
      triggerDownload(await captureSlide(el), pngName(defs[idx], idx));
      showToast(`Slide ${idx + 1} descargada · PNG`, 'success');
    } catch (e) {
      console.error(e);
      showToast(`Error descargando slide: ${e.message}`, 'error');
    } finally {
      btn.disabled = false;
      btn.classList.remove('btn-loading');
      unlockCapture();
    }
  }

  async function downloadCarousel(vertical = false) {
    const m = state.rendered;
    if (!m || !lockCapture()) return;
    const btn = document.getElementById(vertical ? 'downloadVerticalBtn' : 'downloadBtn');
    btn.disabled = true;
    btn.classList.add('btn-loading');
    showToast('Renderizando slides… (10-30s)');
    try {
      const zip = new JSZip();
      const defs = slideDefs();
      for (let i = 0; i < defs.length; i++) {
        const el = document.getElementById(`slide-${defs[i].id}`);
        if (!el) continue;
        const canvas = await captureCanvas(el);
        const blob = await new Promise(r => (vertical ? toVertical(canvas) : canvas).toBlob(r, 'image/png'));
        zip.file(pngName(defs[i], i), blob);
      }
      zip.file('caption.txt', generateCaption(m));
      triggerDownload(await zip.generateAsync({ type: 'blob' }), `futbol-${stamp(m)}${vertical ? '-9x16' : ''}.zip`);
      showToast(vertical ? 'Carrusel 9:16 descargado · listo para TikTok' : 'Carrusel descargado · sube las PNG a IG', 'success');
    } catch (e) {
      console.error(e);
      showToast(`Error descargando: ${e.message}`, 'error');
    } finally {
      btn.disabled = false;
      btn.classList.remove('btn-loading');
      unlockCapture();
    }
  }

  // El pie de foto para Instagram (va en el ZIP y se copia al compartir).
  function generateCaption(m) {
    const c = compOf(m.league);
    const pens = pensWon(m) ? ` (${m.home.shootout}-${m.away.shootout} pen.)` : '';
    const goals = ['home', 'away'].map(s => scorerList(m, s).filter(x => !x.red).map(x => x.text).join(', ')).filter(Boolean);
    const best = bestPlayer(m);
    const tag = (t) => `#${t.short.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]/g, '')}`;
    return `⚽ ${m.home.name.toUpperCase()} ${m.home.score}-${m.away.score} ${m.away.name.toUpperCase()}${pens}
${c.name}${m.phase ? ` · ${m.phase}` : ''} · ${fmtDateLong(m.date)}
${goals.length ? `\nGoles: ${goals.join(' · ')}` : ''}${best ? `\nJugador del partido: ${best.name}` : ''}

Desliza para ver el minuto a minuto, las estadísticas, el mapa de tiros y los onces.

#Futbol #${c.tag} ${tag(m.home)} ${tag(m.away)}`;
  }

  // ----------------------------------------------------------
  // INIT
  // ----------------------------------------------------------
  function init() {
    try {
      const saved = localStorage.getItem(LEAGUE_KEY);
      if (COMP[saved]) state.league = saved;
      state.sign = localStorage.getItem(SIGN_KEY) || '';
    } catch (e) { /* sin almacenamiento: los valores por defecto */ }
    renderCompPicker();
    const signInput = document.getElementById('signInput');
    signInput.value = state.sign;
    signInput.addEventListener('input', onSignInput);

    // Por defecto, hoy (en fútbol se juega de tarde y de noche en España).
    const today = localIso();
    const dateInput = document.getElementById('dateInput');
    dateInput.value = today;
    const markPreset = (iso) => document.querySelectorAll('.date-preset').forEach(b => b.classList.toggle('active', localIso(Number(b.dataset.offset)) === iso));
    markPreset(today);
    dateInput.addEventListener('change', () => {
      if (!dateInput.value) return;
      markPreset(dateInput.value);
      loadGames(dateInput.value);
    });
    document.querySelectorAll('.date-preset').forEach(btn => {
      btn.addEventListener('click', () => {
        const iso = localIso(Number(btn.dataset.offset));
        dateInput.value = iso;
        markPreset(iso);
        loadGames(iso);
      });
    });

    document.getElementById('generateBtn').addEventListener('click', generateCarousel);
    document.getElementById('downloadBtn').addEventListener('click', () => downloadCarousel());
    document.getElementById('downloadVerticalBtn').addEventListener('click', () => downloadCarousel(true));
    document.getElementById('shareCarouselBtn').addEventListener('click', shareCarousel);
    updateShareBtn();

    // El vídeo: guion, voz, volumen
    document.getElementById('videoBtn').addEventListener('click', makeVideo);
    document.getElementById('videoShareBtn').addEventListener('click', shareVideo);
    document.getElementById('scriptLines').addEventListener('input', onScriptInput);
    document.getElementById('scriptResetBtn').addEventListener('click', resetScript);
    document.getElementById('voiceRecBtn').addEventListener('click', recordVoice);
    document.getElementById('voiceDelBtn').addEventListener('click', dropVoice);
    document.getElementById('voiceSync').addEventListener('input', onSyncInput);
    document.getElementById('voiceSyncAuto').addEventListener('click', autoSync);
    ['musicVol', 'voiceVol', 'videoMusic', 'videoVoice', 'videoIntro'].forEach(id => document.getElementById(id).addEventListener('input', mixChanged));
    document.getElementById('mixResetBtn').addEventListener('click', resetMix);
    document.getElementById('mixPreviewBtn').addEventListener('click', previewMix);
    loadMix();
    updateVideoBtn();

    const preview = document.getElementById('slidesPreview');
    setupSlideEditing(preview);
    setupPhotoSwap(preview);
    setupZoom();

    loadGames(today);
    restoreDraft();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
