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
  const ESPN_TABLES = 'https://site.api.espn.com/apis/v2/sports/soccer'; // las clasificaciones
  const ESPN_WEB = 'https://site.web.api.espn.com/apis/common/v3/sports/soccer'; // los partidos de cada jugador
  const LOGO = (id) => `https://a.espncdn.com/i/teamlogos/soccer/500/${id}.png`;

  // [código de ESPN, nombre en el botón, nombre en las slides, hashtag, logo de ESPN]
  // El logo es el número de leaguelogos/soccer/500/<n>.png (y 500-dark/<n>.png, el de fondo oscuro).
  const COMPETITIONS = [
    { group: 'España', items: [
      ['esp.1', 'LaLiga', 'LaLiga', 'LaLiga', 15],
      ['esp.2', 'LaLiga Hypermotion', 'LaLiga Hypermotion', 'LaLigaHypermotion', 107],
      ['esp.copa_del_rey', 'Copa del Rey', 'Copa del Rey', 'CopaDelRey', 80],
      ['esp.super_cup', 'Supercopa', 'Supercopa de España', 'Supercopa', 431],
      ['esp.w.1', 'Liga F', 'Liga F', 'LigaF'],
    ] },
    { group: 'Europa', items: [
      ['uefa.champions', 'Champions', 'Champions League', 'ChampionsLeague', 2],
      ['uefa.europa', 'Europa League', 'Europa League', 'EuropaLeague', 2310],
      ['uefa.europa.conf', 'Conference', 'Conference League', 'ConferenceLeague', 20296],
      ['uefa.super_cup', 'Supercopa de Europa', 'Supercopa de Europa', 'SupercopaDeEuropa', 1272],
      ['uefa.wchampions', 'Champions femenina', 'Champions femenina', 'UWCL', 2408],
    ] },
    { group: 'Inglaterra', items: [
      ['eng.1', 'Premier League', 'Premier League', 'PremierLeague', 23],
      ['eng.2', 'Championship', 'Championship', 'Championship', 24],
      ['eng.fa', 'FA Cup', 'FA Cup', 'FACup', 40],
      ['eng.league_cup', 'Carabao Cup', 'Carabao Cup', 'CarabaoCup', 41],
    ] },
    { group: 'Italia', items: [
      ['ita.1', 'Serie A', 'Serie A', 'SerieA', 12],
      ['ita.2', 'Serie B', 'Serie B', 'SerieB', 99],
      ['ita.coppa_italia', 'Coppa Italia', 'Coppa Italia', 'CoppaItalia', 2192],
    ] },
    { group: 'Alemania', items: [
      ['ger.1', 'Bundesliga', 'Bundesliga', 'Bundesliga', 10],
      ['ger.2', '2. Bundesliga', '2. Bundesliga', 'Bundesliga2', 97],
      ['ger.dfb_pokal', 'Copa de Alemania', 'Copa de Alemania', 'DFBPokal', 2061],
    ] },
    { group: 'Francia', items: [
      ['fra.1', 'Ligue 1', 'Ligue 1', 'Ligue1', 9],
      ['fra.2', 'Ligue 2', 'Ligue 2', 'Ligue2', 96],
      ['fra.coupe_de_france', 'Copa de Francia', 'Copa de Francia', 'CoupeDeFrance', 182],
    ] },
    { group: 'Más ligas', items: [
      ['por.1', 'Portugal', 'Liga Portugal', 'LigaPortugal', 14],
      ['ned.1', 'Países Bajos', 'Eredivisie', 'Eredivisie', 11],
      ['sco.1', 'Escocia', 'Premiership escocesa', 'SPFL', 45],
      ['tur.1', 'Turquía', 'Superliga turca', 'SuperLig', 18],
      ['bel.1', 'Bélgica', 'Pro League belga', 'ProLeague', 6],
      ['ksa.1', 'Arabia Saudí', 'Liga Saudí', 'SaudiProLeague', 2488],
      ['usa.1', 'MLS', 'MLS', 'MLS', 19],
    ] },
    { group: 'Selecciones', national: true, items: [
      ['fifa.world', 'Mundial', 'Mundial', 'Mundial', 4],
      ['uefa.euro', 'Eurocopa', 'Eurocopa', 'Eurocopa', 74],
      ['uefa.nations', 'Nations League', 'Nations League', 'NationsLeague', 2395],
      ['conmebol.america', 'Copa América', 'Copa América', 'CopaAmerica', 83],
      ['fifa.worldq.uefa', 'Clasificación Mundial', 'Clasificación para el Mundial', 'Mundial', 67],
      ['uefa.euroq', 'Clasificación Eurocopa', 'Clasificación para la Eurocopa', 'Eurocopa', 56],
      ['fifa.friendly', 'Amistosos', 'Amistoso internacional', 'Selección', 53],
    ] },
    { group: 'América y mundo', items: [
      ['conmebol.libertadores', 'Libertadores', 'Copa Libertadores', 'Libertadores', 58],
      ['conmebol.sudamericana', 'Sudamericana', 'Copa Sudamericana', 'Sudamericana', 1208],
      ['mex.1', 'Liga MX', 'Liga MX', 'LigaMX', 22],
      ['arg.1', 'Argentina', 'Liga Profesional Argentina', 'LigaProfesional', 1],
      ['bra.1', 'Brasileirão', 'Brasileirão', 'Brasileirao', 85],
      ['fifa.cwc', 'Mundial de Clubes', 'Mundial de Clubes', 'MundialDeClubes', 1932],
    ] },
  ];
  const COMP = {};
  COMPETITIONS.forEach(g => g.items.forEach(([slug, chip, name, tag, logo]) => {
    COMP[slug] = { slug, chip, name, tag, logo: logo || null, national: !!g.national };
  }));
  const compOf = (slug) => COMP[slug] || { slug, chip: slug, name: slug, tag: 'Futbol', logo: null, national: false };
  // El logo de la competición: el normal, para fondo claro, o el de fondo oscuro (los que no lo
  // tienen llevan su propio fondo y sirven para los dos).
  // ----------------------------------------------------------
  // IDIOMA DE LO QUE SE PUBLICA · las slides, el vídeo, el guion y el pie de foto salen en español
  // o en inglés (británico, el del fútbol). La interfaz del Studio sigue en español.
  // ----------------------------------------------------------
  const LANG_KEY = 'fc-lang';
  const THEME_KEY = 'fc-theme';
  const isEn = () => state.lang === 'en';
  const L = (es, en) => (isEn() ? en : es);            // un texto en los dos idiomas
  const outLocale = () => (isEn() ? 'en-GB' : 'es-ES'); // fechas y horas de lo que se publica
  // Las competiciones, en inglés
  const COMP_EN = {
    'esp.super_cup': 'Spanish Super Cup', 'uefa.super_cup': 'UEFA Super Cup', 'uefa.wchampions': "Women's Champions League",
    'ger.dfb_pokal': 'DFB-Pokal', 'fra.coupe_de_france': 'Coupe de France', 'sco.1': 'Scottish Premiership',
    'tur.1': 'Süper Lig', 'bel.1': 'Belgian Pro League', 'ksa.1': 'Saudi Pro League', 'fifa.world': 'World Cup',
    'uefa.euro': 'Euro', 'fifa.worldq.uefa': 'World Cup qualifying', 'uefa.euroq': 'Euro qualifying',
    'fifa.friendly': 'International friendly', 'arg.1': 'Liga Profesional', 'fifa.cwc': 'Club World Cup',
  };
  const compName = (slug) => (isEn() && COMP_EN[slug]) || compOf(slug).name;
  // Las fases (la clave es el nombre en español, que es lo que guarda el partido)
  const PHASE_EN = {
    'Fase liga': 'League phase', 'Fase de grupos': 'Group stage', 'Playoff': 'Play-off round', 'Ronda previa': 'Qualifying round',
    'Ronda preliminar': 'Preliminary round', 'Treintaidosavos': 'Round of 64', 'Dieciseisavos': 'Round of 32', 'Octavos': 'Round of 16',
    'Cuartos': 'Quarter-finals', 'Semifinales': 'Semi-finals', 'Final': 'Final', 'Tercer puesto': 'Third-place play-off',
    'Primera ronda': 'First round', 'Segunda ronda': 'Second round', 'Tercera ronda': 'Third round', 'Cuarta ronda': 'Fourth round',
    'Quinta ronda': 'Fifth round', 'Sexta ronda': 'Sixth round',
  };
  const phaseOut = (phase) => (isEn() ? PHASE_EN[phase] || phase : phase);
  const NEXT_ROUND_EN = {
    'Playoff': 'the last 16', 'Treintaidosavos': 'the last 32', 'Dieciseisavos': 'the last 16', 'Octavos': 'the quarter-finals',
    'Cuartos': 'the semi-finals', 'Semifinales': 'the final',
  };
  // Los clubes en inglés: los nombres de ESPN, con los cortos de siempre
  const CLUB_NAMES_EN = {
    'Atlético Madrid': ['Atlético Madrid', 'Atlético'], 'Athletic Club': ['Athletic Club', 'Athletic'], 'Celta Vigo': ['Celta Vigo', 'Celta'],
    'Racing Santander': ['Racing Santander', 'Racing'], 'Rayo Vallecano': ['Rayo Vallecano', 'Rayo'], 'Real Betis': ['Real Betis', 'Betis'],
    'Deportivo': ['Deportivo La Coruña', 'Deportivo'], 'Internazionale': ['Inter', 'Inter'], 'AC Milan': ['AC Milan', 'Milan'],
    'AS Roma': ['Roma', 'Roma'], 'Paris Saint-Germain': ['Paris Saint-Germain', 'PSG'], 'Manchester City': ['Manchester City', 'Man City'],
    'Manchester United': ['Manchester United', 'Man Utd'], 'Tottenham Hotspur': ['Tottenham Hotspur', 'Spurs'],
    'Nottingham Forest': ['Nottingham Forest', 'Forest'], 'Brighton & Hove Albion': ['Brighton', 'Brighton'],
    'Wolverhampton Wanderers': ['Wolves', 'Wolves'], 'West Ham United': ['West Ham', 'West Ham'], 'Queens Park Rangers': ['QPR', 'QPR'],
    'Sheffield United': ['Sheffield United', 'Sheffield Utd'], 'Sheffield Wednesday': ['Sheffield Wednesday', 'Sheffield Wed'],
    'West Bromwich Albion': ['West Brom', 'West Brom'], 'Borussia Dortmund': ['Borussia Dortmund', 'Dortmund'],
    'Borussia Mönchengladbach': ["Borussia M'gladbach", 'Gladbach'], 'Bayer Leverkusen': ['Bayer Leverkusen', 'Leverkusen'],
    'FC Cologne': ['FC Cologne', 'Cologne'], 'Sporting CP': ['Sporting CP', 'Sporting'], 'LASK Linz': ['LASK', 'LASK'],
    'Feyenoord Rotterdam': ['Feyenoord', 'Feyenoord'], 'Ajax Amsterdam': ['Ajax', 'Ajax'], 'PSV Eindhoven': ['PSV Eindhoven', 'PSV'],
    'AZ Alkmaar': ['AZ Alkmaar', 'AZ'], 'Union St.-Gilloise': ['Union Saint-Gilloise', 'Union SG'], 'Bodo/Glimt': ['Bodø/Glimt', 'Bodø/Glimt'],
    'Fenerbahce': ['Fenerbahçe', 'Fenerbahçe'], 'Besiktas': ['Beşiktaş', 'Beşiktaş'], 'Caykur Rizespor': ['Rizespor', 'Rizespor'],
    'Istanbul Basaksehir': ['Başakşehir', 'Başakşehir'], 'Famalicao': ['Famalicão', 'Famalicão'], 'FC Famalicao': ['Famalicão', 'Famalicão'],
    'Atlético-MG': ['Atlético Mineiro', 'Atlético Mineiro'], 'Sarmiento (Junín)': ['Sarmiento', 'Sarmiento'],
    'RB Leipzig': ['RB Leipzig', 'Leipzig'], 'Hellas Verona': ['Hellas Verona', 'Verona'], 'Eintracht Frankfurt': ['Eintracht Frankfurt', 'Frankfurt'],
    'Crystal Palace': ['Crystal Palace', 'Palace'],
    'Slovan Bratislava': ['Slovan Bratislava', 'Slovan'],
  };
  const NO_DARK_LOGO = new Set([99, 431, 2192, 97]);
  const compLogo = (slug, dark = false) => {
    const n = compOf(slug).logo;
    if (!n) return '';
    return `https://a.espncdn.com/i/leaguelogos/soccer/${dark && !NO_DARK_LOGO.has(n) ? '500-dark' : '500'}/${n}.png`;
  };
  const DEFAULT_LEAGUE = 'esp.1';
  const LEAGUE_KEY = 'fc-league';
  const SIGN_KEY = 'fc-sign';
  // Jornada90: la firma y el logo de la cuenta, mientras no se pongan otros (o se quiten)
  const DEFAULT_SIGN = '@jornada90fc';
  const DEFAULT_BRAND = 'jornada90-logo.png';

  // La fase, en las copas (en las ligas ESPN pone el nombre de la temporada y no se usa).
  const PHASES = {
    'league-phase': 'Fase liga', 'group-stage': 'Fase de grupos', 'knockout-round-playoffs': 'Playoff',
    'playoff-round': 'Playoff', 'qualifying-round': 'Ronda previa', 'preliminary-round': 'Ronda preliminar',
    'round-of-64': 'Treintaidosavos', 'round-of-32': 'Dieciseisavos', 'round-of-16': 'Octavos', 'quarterfinals': 'Cuartos',
    'semifinals': 'Semifinales', 'final': 'Final', 'third-place': 'Tercer puesto',
    'torneo-apertura': 'Apertura', 'torneo-clausura': 'Clausura',
  };
  // «first-round», «second-round-proper»… → «Primera ronda», «Segunda ronda»…
  const ROUND_WORDS = { first: 'Primera', second: 'Segunda', third: 'Tercera', fourth: 'Cuarta', fifth: 'Quinta', sixth: 'Sexta' };
  const phaseName = (slug = '') => {
    const round = ROUND_WORDS[slug.match(/^([a-z]+)-round/)?.[1]];
    return PHASES[slug] || (round ? `${round} ronda` : '');
  };
  // Las fases de eliminatoria (sin clasificación que enseñar) y la ronda a la que se pasa
  const KNOCKOUT = /^(Playoff|Ronda|Treintaidosavos|Dieciseisavos|Octavos|Cuartos|Semifinales|Final|Tercer puesto|Primera|Segunda|Tercera|Cuarta|Quinta|Sexta)/;
  const NEXT_ROUND = {
    'Playoff': 'octavos', 'Treintaidosavos': 'dieciseisavos', 'Dieciseisavos': 'octavos', 'Octavos': 'cuartos',
    'Cuartos': 'semifinales', 'Semifinales': 'la final',
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
    // España
    'Sporting Gijón': ['Sporting de Gijón', 'Sporting'],
    'Real Valladolid': ['Real Valladolid', 'Valladolid'],
    'Real Zaragoza': ['Real Zaragoza', 'Zaragoza'],
    'Real Oviedo': ['Real Oviedo', 'Oviedo'],
    // Inglaterra
    'Wolverhampton Wanderers': ['Wolverhampton', 'Wolves'],
    'West Ham United': ['West Ham', 'West Ham'],
    'Queens Park Rangers': ['QPR', 'QPR'],
    'Sheffield United': ['Sheffield United', 'Sheffield Utd'],
    'Sheffield Wednesday': ['Sheffield Wednesday', 'Sheffield Wed'],
    'West Bromwich Albion': ['West Bromwich', 'West Brom'],
    'Crystal Palace': ['Crystal Palace', 'Crystal Palace'], 'Slovan Bratislava': ['Slovan Bratislava', 'Slovan'],
    // Italia
    'Napoli': ['Nápoles', 'Nápoles'],
    'Bologna': ['Bolonia', 'Bolonia'],
    'Venezia': ['Venecia', 'Venecia'],
    'Genoa': ['Génova', 'Génova'],
    'Hellas Verona': ['Hellas Verona', 'Verona'],
    // Alemania
    'VfL Wolfsburg': ['Wolfsburgo', 'Wolfsburgo'],
    'SC Freiburg': ['Friburgo', 'Friburgo'],
    'Hamburg SV': ['Hamburgo', 'Hamburgo'],
    'FC Augsburg': ['Augsburgo', 'Augsburgo'],
    'Eintracht Frankfurt': ['Eintracht de Fráncfort', 'Eintracht'],
    'RB Leipzig': ['RB Leipzig', 'Leipzig'],
    '1. FC Nürnberg': ['Núremberg', 'Núremberg'],
    // Francia
    'AS Monaco': ['Mónaco', 'Mónaco'],
    'Monaco': ['Mónaco', 'Mónaco'],
    'Marseille': ['Olympique de Marsella', 'Marsella'],
    'Olympique Lyonnais': ['Olympique de Lyon', 'Lyon'],
    'Lyon': ['Olympique de Lyon', 'Lyon'],
    'Nice': ['Niza', 'Niza'],
    'Strasbourg': ['Estrasburgo', 'Estrasburgo'],
    'Stade Rennais': ['Rennes', 'Rennes'],
    // Resto de Europa
    'FC Porto': ['Oporto', 'Oporto'],
    'Club Brugge': ['Brujas', 'Brujas'],
    'Standard Liege': ['Standard de Lieja', 'Standard'],
    'Royal Antwerp': ['Amberes', 'Amberes'],
    'PSV Eindhoven': ['PSV Eindhoven', 'PSV'],
    'AZ Alkmaar': ['AZ Alkmaar', 'AZ'],
    'Ajax Amsterdam': ['Ajax', 'Ajax'],
    'Feyenoord Rotterdam': ['Feyenoord', 'Feyenoord'],
    'Fenerbahce': ['Fenerbahçe', 'Fenerbahçe'],
    'Besiktas': ['Beşiktaş', 'Beşiktaş'],
    'Red Bull Salzburg': ['Salzburgo', 'Salzburgo'],
    'Dinamo Zagreb': ['Dinamo de Zagreb', 'Dinamo Zagreb'],
    'Crvena Zvezda': ['Estrella Roja', 'Estrella Roja'],
    'Red Star Belgrade': ['Estrella Roja', 'Estrella Roja'],
    'Shakhtar Donetsk': ['Shakhtar Donetsk', 'Shakhtar'],
    // América
    'Sarmiento (Junín)': ['Sarmiento', 'Sarmiento'],
    'Atlético-MG': ['Atlético Mineiro', 'Atlético Mineiro'],
    'Famalicao': ['Famalicão', 'Famalicão'],
    'FC Famalicao': ['Famalicão', 'Famalicão'],
    'Antwerp': ['Amberes', 'Amberes'],
    'RB Salzburg': ['Salzburgo', 'Salzburgo'],
    'Racing Genk': ['Genk', 'Genk'],
    'KAA Gent': ['Gante', 'Gante'],
    'Bodo/Glimt': ['Bodø/Glimt', 'Bodø/Glimt'],
    'Slavia Prague': ['Slavia de Praga', 'Slavia'],
    'Sparta Prague': ['Sparta de Praga', 'Sparta'],
    'Viktoria Plzen': ['Viktoria Plzeň', 'Plzeň'],
    'Ferencvaros': ['Ferencváros', 'Ferencváros'],
    'Union St.-Gilloise': ['Union Saint-Gilloise', 'Union SG'],
    'Lech Poznan': ['Lech Poznań', 'Lech'],
    'Jagiellonia Bialystok': ['Jagiellonia', 'Jagiellonia'],
    'Omonia Nicosia': ['Omonia', 'Omonia'],
    'VIKING FK': ['Viking', 'Viking'],
    "Hapoel Be'er": ["Hapoel Be'er Sheva", "Hapoel Be'er Sheva"],
    'Caykur Rizespor': ['Rizespor', 'Rizespor'],
    'Istanbul Basaksehir': ['Başakşehir', 'Başakşehir'],
    'Kasimpasa': ['Kasımpaşa', 'Kasımpaşa'],
    'Goztepe': ['Göztepe', 'Göztepe'],
    'Eyupspor': ['Eyüpspor', 'Eyüpspor'],
    'Genclerbirligi': ['Gençlerbirliği', 'Gençlerbirliği'],
  };
  // Lo que sobra en el nombre corto de un club: «FC Utrecht» → «Utrecht», «Mainz 05» → «Mainz»,
  // y en las inglesas, «Leeds United» → «Leeds» (en la MLS, «DC United» se queda como está).
  const CLUB_PREFIX = /^(?:1\.\s*)?(?:FC|CF|AFC|SC|CD|UD|AC|AS|SS|US|SV|VfB|VfL|TSG|FSV|RCD|SD|CA|FK|NK|SK|KV|KRC|RSC|PFC|GD|CS|OSC|RC|SL|HNK)\s+/;
  const CLUB_SUFFIX = /\s+(?:FC|CF|AFC|SC|SV|BSC|BK|FK|IF|\d{2,4})$/;
  const ENGLISH_SUFFIX = /\s+(?:City|United|Town|Rovers|Athletic|Albion|County|Wanderers|Hotspur)$/;
  function clubNames(espnName, espnShort, league = '') {
    const named = isEn() ? CLUB_NAMES_EN[espnName] : CLUB_NAMES[espnName];
    if (named) return named;
    let short = (espnShort || espnName).trim().replace(/\s*\([A-Z]{1,3}\)$/, ''); // «Sarmiento (J)»
    for (const re of [CLUB_PREFIX, CLUB_SUFFIX]) {
      const cut = short.replace(re, '');
      if (cut.length >= 4) short = cut;
    }
    if (/^(eng|sco)\./.test(league)) {
      const cut = short.replace(ENGLISH_SUFFIX, '');
      if (cut.length >= 4) short = cut;
    }
    return [espnName, short];
  }
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
    'Curaçao': 'Curazao', Iraq: 'Irak', 'United Arab Emirates': 'Emiratos Árabes', 'China PR': 'China', Bahrain: 'Baréin',
    Oman: 'Omán', Lebanon: 'Líbano', Syria: 'Siria', Palestine: 'Palestina', Thailand: 'Tailandia', Philippines: 'Filipinas',
    Russia: 'Rusia', 'Trinidad and Tobago': 'Trinidad y Tobago', Suriname: 'Surinam', 'Equatorial Guinea': 'Guinea Ecuatorial',
    Gabon: 'Gabón', Benin: 'Benín', Libya: 'Libia', Sudan: 'Sudán', Ethiopia: 'Etiopía', Kenya: 'Kenia',
    Zimbabwe: 'Zimbabue', 'Sierra Leone': 'Sierra Leona', Comoros: 'Comoras', Rwanda: 'Ruanda', Botswana: 'Botsuana',
    Malawi: 'Malaui', 'North Korea': 'Corea del Norte', 'Korea DPR': 'Corea del Norte', Tajikistan: 'Tayikistán',
    Kyrgyzstan: 'Kirguistán', Turkmenistan: 'Turkmenistán', Singapore: 'Singapur', Malaysia: 'Malasia', Fiji: 'Fiyi',
    'New Caledonia': 'Nueva Caledonia', 'Dominican Republic': 'República Dominicana',
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
    172: { bg: PAPER, acc: '#00418d', on: '#ffffff', fg: '#111111' },        // Auxerre
    175: { bg: '#fbe300', acc: '#e30613', on: '#ffffff', fg: '#111111' },    // Lens
    166: { bg: '#c2051b', acc: '#1b2d5a', on: '#ffffff' },                   // Lille
    273: { bg: '#f58113', acc: '#111111', on: '#ffffff' },                   // Lorient
    169: { bg: '#e13327', acc: '#111111', on: '#ffffff' },                   // Rennes
    180: { bg: '#009fe3', acc: '#ffffff', on: '#009fe3' },                   // Estrasburgo
    2502: { bg: '#c8102e', acc: '#111111', on: '#ffffff' },                  // Niza
    // Más Premier
    349: { bg: '#da291c', acc: '#111111', on: '#ffffff' },                   // Bournemouth
    337: { bg: '#e30613', acc: '#ffffff', on: '#e30613' },                   // Brentford
    331: { bg: '#0057b8', acc: '#ffffff', on: '#0057b8' },                   // Brighton
    384: { bg: '#1b458f', acc: '#c4122e', on: '#ffffff' },                   // Crystal Palace
    368: { bg: '#003399', acc: '#ffffff', on: '#003399' },                   // Everton
    370: { bg: PAPER, acc: '#111111', on: '#ffffff', fg: '#111111' },        // Fulham
    357: { bg: PAPER, acc: '#1d428a', on: '#ffcd00', fg: '#111111' },        // Leeds
    393: { bg: '#dd0000', acc: '#ffffff', on: '#dd0000' },                   // Nottingham Forest
    366: { bg: '#eb172b', acc: '#ffffff', on: '#eb172b' },                   // Sunderland
    371: { bg: '#7a263a', acc: '#1bb1e7', on: '#111111' },                   // West Ham
    // Más Serie A
    107: { bg: '#1a2f48', acc: '#a21c26', on: '#ffffff' },                   // Bolonia
    3263: { bg: '#a50021', acc: '#002350', on: '#ffffff' },                  // Génova
    3997: { bg: '#00a752', acc: '#111111', on: '#ffffff' },                  // Sassuolo
    17530: { bg: '#111111', acc: '#f47b20', on: '#111111' },                 // Venecia
    // Más Bundesliga
    268: { bg: '#1b1b1b', acc: '#00a650', on: '#ffffff' },                   // M'gladbach
    125: { bg: '#111111', acc: '#e1000f', on: '#ffffff' },                   // Eintracht
    122: { bg: '#ed1c24', acc: '#ffffff', on: '#ed1c24' },                   // Colonia
    127: { bg: '#0a3f86', acc: '#ffffff', on: '#0a3f86' },                   // Hamburgo
    133: { bg: '#004d9d', acc: '#ffffff', on: '#004d9d' },                   // Schalke
    7911: { bg: '#1961b5', acc: '#ffffff', on: '#1961b5' },                  // Hoffenheim
    // Portugal y Países Bajos
    1929: { bg: '#e20e0e', acc: '#ffffff', on: '#e20e0e' },                  // Benfica
    437: { bg: '#00428c', acc: '#ffffff', on: '#00428c' },                   // Oporto
    2250: { bg: '#008057', acc: '#ffffff', on: '#008057' },                  // Sporting
    2994: { bg: '#d71920', acc: '#ffffff', on: '#d71920' },                  // Braga
    139: { bg: PAPER, acc: '#d2122e', on: '#ffffff', fg: '#111111' },        // Ajax
    148: { bg: '#e2231a', acc: '#ffffff', on: '#e2231a' },                   // PSV
    142: { bg: '#e3001b', acc: '#111111', on: '#ffffff' },                   // Feyenoord
    140: { bg: '#d6001c', acc: '#ffffff', on: '#d6001c' },                   // AZ
    // Escocia y Turquía
    256: { bg: '#018749', acc: '#ffffff', on: '#018749' },                   // Celtic
    257: { bg: '#1b458f', acc: '#ffffff', on: '#1b458f' },                   // Rangers
    432: { bg: '#a90432', acc: '#fdb912', on: '#111111' },                   // Galatasaray
    436: { bg: '#163962', acc: '#ffed00', on: '#111111' },                   // Fenerbahçe
    1895: { bg: '#111111', acc: '#ffffff', on: '#111111' },                  // Beşiktaş
    997: { bg: '#7c1f3a', acc: '#5ba3e0', on: '#111111' },                   // Trabzonspor
    9078: { bg: '#f37021', acc: '#00843d', on: '#ffffff' },                  // Alanyaspor
    7656: { bg: '#00843d', acc: '#0057b8', on: '#ffffff' },                  // Rizespor
    789: { bg: '#ffd200', acc: '#e30613', on: '#ffffff', fg: '#111111' },    // Göztepe
    6870: { bg: '#003c8c', acc: '#ffffff', on: '#003c8c' },                  // Kasımpaşa
    995: { bg: '#00843d', acc: '#111111', on: '#ffffff' },                   // Kocaelispor
    20729: { bg: '#5c2d91', acc: '#ffd200', on: '#111111' },                 // Eyüpspor
    11429: { bg: '#e30613', acc: '#ffffff', on: '#e30613' },                 // Samsunspor
    20070: { bg: '#e30613', acc: '#111111', on: '#ffffff' },                 // Gaziantep
    996: { bg: '#e30613', acc: '#111111', on: '#ffffff' },                   // Gençlerbirliği
    7648: { bg: '#00843d', acc: '#ffffff', on: '#00843d' },                  // Konyaspor
    132334: { bg: '#e30613', acc: '#111111', on: '#ffffff' },                // Çorum
    // Arabia Saudí
    929: { bg: '#1e4fa3', acc: '#ffffff', on: '#1e4fa3' },                   // Al Hilal
    817: { bg: '#ffd100', acc: '#1c2b6f', on: '#ffffff', fg: '#111111' },    // Al Nassr
    2276: { bg: '#ffde00', acc: '#111111', on: '#ffde00', fg: '#111111' },   // Al Ittihad
    8346: { bg: '#078543', acc: '#ffffff', on: '#078543' },                  // Al Ahli
    // Argentina, Brasil, México y la MLS
    5: { bg: '#103f79', acc: '#f3b229', on: '#111111' },                     // Boca
    16: { bg: PAPER, acc: '#e2231a', on: '#ffffff', fg: '#111111' },         // River
    18: { bg: '#0b2e7a', acc: '#e30613', on: '#ffffff' },                    // San Lorenzo
    14: { bg: '#e30613', acc: '#111111', on: '#ffffff' },                    // Newell's
    17: { bg: '#003a8c', acc: '#ffd200', on: '#111111' },                    // Rosario Central
    819: { bg: '#c8102e', acc: '#111111', on: '#ffffff' },                   // Flamengo
    2029: { bg: '#006437', acc: '#ffffff', on: '#006437' },                  // Palmeiras
    874: { bg: PAPER, acc: '#111111', on: '#ffffff', fg: '#111111' },        // Corinthians
    2026: { bg: PAPER, acc: '#d0021b', on: '#ffffff', fg: '#111111' },       // São Paulo
    2022: { bg: '#0033a0', acc: '#ffffff', on: '#0033a0' },                  // Cruzeiro
    6273: { bg: '#0d80bf', acc: '#111111', on: '#ffffff' },                  // Grêmio
    227: { bg: '#fff200', acc: '#001c58', on: '#ffffff', fg: '#111111' },    // América
    218: { bg: '#0047bb', acc: '#ffffff', on: '#0047bb' },                   // Cruz Azul
    233: { bg: '#0b1f4a', acc: '#d4a54a', on: '#111111' },                   // Pumas
    232: { bg: '#fdb913', acc: '#0b3d91', on: '#ffffff', fg: '#111111' },    // Tigres
    20232: { bg: '#f7b5cd', acc: '#231f20', on: '#ffffff', fg: '#231f20' },  // Inter Miami
    18966: { bg: '#111111', acc: '#c39e6d', on: '#111111' },                 // LAFC
    187: { bg: '#00245d', acc: '#ffd200', on: '#111111' },                   // LA Galaxy
    // Resto de Europa (Champions y Europa League)
    887: { bg: '#ffd200', acc: '#111111', on: '#ffd200', fg: '#111111' },    // AEK
    2980: { bg: '#ffd200', acc: '#111111', on: '#ffd200', fg: '#111111' },   // Bodø/Glimt
    570: { bg: '#0b5cad', acc: '#111111', on: '#ffffff' },                   // Brujas
    493: { bg: '#f26522', acc: '#111111', on: '#ffffff' },                   // Shakhtar
    494: { bg: PAPER, acc: '#d71920', on: '#ffffff', fg: '#111111' },        // Slavia
    597: { bg: '#0047bb', acc: '#ffffff', on: '#0047bb' },                   // Dinamo Zagreb
    435: { bg: '#d01729', acc: '#ffffff', on: '#d01729' },                   // Olympiacos
    2790: { bg: PAPER, acc: '#d82c3a', on: '#ffffff', fg: '#111111' },       // Salzburgo
    5807: { bg: '#ffd200', acc: '#0047bb', on: '#ffffff', fg: '#111111' },   // Union SG
    622: { bg: '#00843d', acc: '#ffffff', on: '#00843d' },                   // Ferencváros
    11706: { bg: '#0047bb', acc: '#e30613', on: '#ffffff' },                 // Plzeň
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
    URU: { bg: '#5cb3e6', acc: '#111111', on: '#ffffff', fg: '#0b1f3a' },
    COL: { bg: '#fcd116', acc: '#003893', on: '#ffffff', fg: '#111111' },
    MEX: { bg: '#006847', acc: '#ce1126', on: '#ffffff' },
    USA: { bg: '#0a3161', acc: '#b31942', on: '#ffffff' },
    CAN: { bg: '#d80621', acc: '#ffffff', on: '#d80621' },
    JPN: { bg: '#0b1f5b', acc: '#ffffff', on: '#0b1f5b' },
    KOR: { bg: '#c60c30', acc: '#ffffff', on: '#c60c30' },
    MAR: { bg: '#c1272d', acc: '#006233', on: '#ffffff' },
    SEN: { bg: '#00853f', acc: '#fdef42', on: '#111111' },
    SUI: { bg: '#d52b1e', acc: '#ffffff', on: '#d52b1e' },
    DEN: { bg: '#c8102e', acc: '#ffffff', on: '#c8102e' },
    SWE: { bg: '#fecc02', acc: '#006aa7', on: '#ffffff', fg: '#0b2a4a' },
    NOR: { bg: '#ba0c2f', acc: '#00205b', on: '#ffffff' },
    POL: { bg: PAPER, acc: '#dc143c', on: '#ffffff', fg: '#111111' },
    SRB: { bg: '#c6363c', acc: '#0c4076', on: '#ffffff' },
    AUT: { bg: '#ed2939', acc: '#ffffff', on: '#ed2939' },
    SCO: { bg: '#0b2a6b', acc: '#ffffff', on: '#0b2a6b' },
    WAL: { bg: '#c8102e', acc: '#00b140', on: '#ffffff' },
    IRL: { bg: '#169b62', acc: '#ff883e', on: '#111111' },
    TUR: { bg: '#e30a17', acc: '#ffffff', on: '#e30a17' },
    UKR: { bg: '#ffd500', acc: '#005bbb', on: '#ffffff', fg: '#0b2a4a' },
    CZE: { bg: '#d7141a', acc: '#11457e', on: '#ffffff' },
    GRE: { bg: '#0d5eaf', acc: '#ffffff', on: '#0d5eaf' },
    HUN: { bg: '#ce2939', acc: '#477050', on: '#ffffff' },
    ROU: { bg: '#fcd116', acc: '#002b7f', on: '#ffffff', fg: '#111111' },
    ECU: { bg: '#ffdd00', acc: '#034ea2', on: '#ffffff', fg: '#111111' },
    CHI: { bg: '#d52b1e', acc: '#0039a6', on: '#ffffff' },
    PAR: { bg: '#d52b1e', acc: '#0038a8', on: '#ffffff' },
    PER: { bg: PAPER, acc: '#d91023', on: '#ffffff', fg: '#111111' },
    AUS: { bg: '#ffcd00', acc: '#00843d', on: '#ffffff', fg: '#111111' },
    EGY: { bg: '#ce1126', acc: '#111111', on: '#ffffff' },
    NGA: { bg: '#008751', acc: '#ffffff', on: '#008751' },
    KSA: { bg: '#006c35', acc: '#ffffff', on: '#006c35' },
    QAT: { bg: '#8a1538', acc: '#ffffff', on: '#8a1538' },
    ALB: { bg: '#e41e20', acc: '#111111', on: '#ffffff' },
    ISL: { bg: '#02529c', acc: '#dc1e35', on: '#ffffff' },
  };
  const DEFAULT_STYLE = { bg: '#1d2b44', acc: '#c8f53c', on: '#111111' };

  // ----------------------------------------------------------
  // Helpers de formato
  // ----------------------------------------------------------
  const asDate = (iso) => new Date(/^\d{4}-\d{2}-\d{2}$/.test(iso) ? `${iso}T12:00:00` : iso);
  const fmtDate = (iso) => asDate(iso).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
  const fmtDateLong = (iso) => asDate(iso).toLocaleDateString(outLocale(), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const fmtFooterDate = (iso) => {
    const d = asDate(iso);
    return `${String(d.getDate()).padStart(2, '0')} · ${String(d.getMonth() + 1).padStart(2, '0')} · ${d.getFullYear()}`;
  };
  const fmtTime = (iso) => new Date(iso).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  // El día de hoy (o con desfase) en la hora de este ordenador, como AAAA-MM-DD
  const localIso = (offset = 0, from = new Date()) => {
    const d = new Date(from);
    if (Number.isNaN(d.getTime())) return '';
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

  async function espnFetch(path, base = ESPN, wait = 15000) {
    let res;
    try {
      res = await fetch(`${base}${path}`, { signal: timeoutSignal(wait) });
    } catch (e) {
      throw new Error(e.name === 'TimeoutError' ? 'ESPN no responde, prueba en un momento' : `sin conexión con ESPN (${e.message})`);
    }
    if (!res.ok) throw new Error(`ESPN ${res.status}: ${res.statusText}`);
    return res.json();
  }

  function normalizeTeam(cmp, league) {
    const t = cmp?.team || {};
    const espnName = (t.displayName || t.name || '').trim();
    const national = compOf(league).national;
    const country = isEn() ? null : COUNTRY_NAMES[espnName];
    const [long, short] = national
      ? [country || espnName, country || (t.shortDisplayName || espnName).trim()]
      : clubNames(espnName, t.shortDisplayName, league);
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
        return `${name} ${min}${d.penaltyKick ? L(' (p)', ' (pen)') : d.ownGoal ? L(' (p.p.)', ' (og)') : ''}`.trim();
      });
  }

  // Eliminatoria a ida y vuelta: la ida o la vuelta, el global y quién pasa (cuando acaba).
  function tieOf(c, home, away) {
    const leg = c.series?.totalCompetitions > 1 ? c.leg?.value || null : null;
    const sc = c.series?.competitors || [];
    const of = (team) => sc.find(x => String(x.id) === team.id);
    const agg = sc.length === 2 && of(home)?.aggregateScore != null && of(away)?.aggregateScore != null && leg > 1
      ? [num(of(home).aggregateScore), num(of(away).aggregateScore)] : null;
    const through = c.series?.completed ? (of(home)?.winner ? 'home' : of(away)?.winner ? 'away' : null) : null;
    return { leg, agg, through };
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
      phase: phaseName(e.season?.slug),
      venue: c.venue?.fullName || e.venue?.displayName || '',
      home,
      away,
      ...tieOf(c, home, away),
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

  // El apellido. En los coreanos, ESPN pone el nombre de pila como apellido («Son Heung-Min» →
  // «Heung-Min»): el apellido es la primera palabra.
  const KOREAN = new Set(['Kim', 'Lee', 'Park', 'Choi', 'Jung', 'Jeong', 'Kang', 'Cho', 'Jo', 'Yoon', 'Jang', 'Lim', 'Han',
    'Oh', 'Seo', 'Shin', 'Kwon', 'Hwang', 'Ahn', 'Song', 'Yoo', 'Yu', 'Hong', 'Jeon', 'Ko', 'Moon', 'Yang', 'Son', 'Bae',
    'Baek', 'Paik', 'Heo', 'Hur', 'Nam', 'Noh', 'Ha', 'Kwak', 'Sung', 'Cha', 'Joo', 'Woo', 'Koo', 'Min', 'Ryu', 'Na',
    'Jin', 'Um', 'Byun', 'Chae', 'Won', 'Chun', 'Bang', 'Gong', 'Hyun', 'Seol', 'Ji']);
  function familyName(a) {
    const full = (a.displayName || '').trim();
    const last = (a.lastName || '').trim();
    const first = full.split(' ')[0];
    if (last && KOREAN.has(first) && /^[A-Z][a-z]+-[A-Za-z][a-z]+$/.test(last) && full.toLowerCase() === `${first} ${last}`.toLowerCase()) return first;
    return last || full;
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
      leg: game.leg || null,
      agg: game.agg || null,
      through: game.through || null,
      final: !!comp.isFinal || game.phase === 'Final',
      season: num(sum.header?.season?.year),
      lang: state.lang,
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
          last: familyName(a),
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
          long: /outside the box/i.test(k.text || ''),
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
    addStandings(m, sum.standings?.groups || []);
    resolveClash(m);
    return m;
  }

  // La clasificación del grupo con más de los equipos que se buscan (ids). groups: los del
  // resumen ({ header, standings }) o los de la clasificación de ESPN ({ name, standings }).
  function tableOf(groups, ids, league, logos = {}) {
    const idOf = (e) => String(e.id || e.team?.id || '');
    const hits = (g) => (g.standings?.entries || []).filter(e => ids.includes(idOf(e))).length;
    const group = [...groups].sort((a, b) => hits(b) - hits(a))[0];
    if (!group || !hits(group)) return null;
    const stat = (e, n) => num((e.stats || []).find(s => s.name === n || s.type === n)?.value);
    const national = compOf(league).national;
    const rows = group.standings.entries.map(e => {
      const id = idOf(e);
      const espnName = typeof e.team === 'string' ? e.team : e.team?.displayName || '';
      return {
        id,
        name: national ? (!isEn() && COUNTRY_NAMES[espnName]) || espnName : clubNames(espnName, e.team?.shortDisplayName, league)[1],
        logo: e.team?.logos?.[0]?.href || logos[id] || LOGO(id),
        zone: /^#[0-9a-f]{6}$/i.test(e.note?.color || '') ? e.note.color : '',
        rank: stat(e, 'rank'), gp: stat(e, 'gamesPlayed'), gd: stat(e, 'pointDifferential'), pts: stat(e, 'points'),
      };
    }).filter(r => r.rank != null).sort((a, b) => a.rank - b.rank);
    return rows.length ? { rows, name: (group.header || group.name || '').replace(/Standings$/i, '').trim() } : null;
  }
  function addStandings(m, groups) {
    const t = tableOf(groups, [m.home.id, m.away.id], m.league, { [m.home.id]: m.home.logo, [m.away.id]: m.away.logo });
    if (!t) return;
    m.standings = t.rows;
    m.standingsName = t.name;
  }

  async function fetchMatch(game) {
    const sum = await espnFetch(`/${game.league}/summary?event=${game.id}`);
    const m = parseMatch(sum, game);
    // Algunas competiciones (la Europa League, la Conference…) no traen la clasificación en el
    // resumen: se pide aparte, salvo en las eliminatorias.
    if (!m.standings && !KNOCKOUT.test(m.phase)) {
      try {
        const table = await espnFetch(`/${game.league}/standings`, ESPN_TABLES);
        addStandings(m, table.children || (table.standings ? [table] : []));
      } catch (e) { /* sin clasificación: la slide no sale */ }
    }
    return m;
  }

  // ----------------------------------------------------------
  // EL DATO · rachas, cara a cara y «primera vez desde…», sacados del historial de ESPN de los
  // dos equipos: todos los partidos oficiales desde 2003 (los amistosos de clubes y la
  // pretemporada no cuentan; en los penaltis, empate). Las temporadas acabadas se guardan en el
  // navegador: la segunda vez va al momento. Cada dato se guarda con sus números, no con el
  // texto, y así sale en los dos idiomas.
  // ----------------------------------------------------------
  const HIST_FROM = 2003;
  const DATO_MIN = 28;        // lo que tiene que pesar un dato para salir
  const YEAR_MS = 365.25 * 864e5;
  const resultOf = (g) => (g.gf > g.ga ? 'W' : g.gf < g.ga ? 'L' : 'D');
  const runBack = (rows, ok) => {
    let n = 0;
    for (let i = rows.length - 1; i >= 0 && ok(rows[i]); i--) n++;
    return n;
  };

  const DATO_FETCH = 8000;    // lo que se espera a cada petición del historial

  // Los partidos acabados de una temporada de un equipo, en pequeño. De las selecciones, ESPN
  // da siempre los últimos partidos, pida la temporada que se pida (y lo dice): esa temporada
  // cuenta como que no está.
  function seasonRows(data, teamId, season, national) {
    const served = num(data.requestedSeason?.year);
    if (served != null && served !== season) throw new Error(`ESPN no tiene la temporada ${season}`);
    return (data.events || []).flatMap(e => {
      const c = e.competitions?.[0] || {};
      const st = c.status?.type || e.status?.type || {};
      const me = (c.competitors || []).find(x => String(x.team?.id ?? x.id) === teamId);
      const op = (c.competitors || []).find(x => x !== me);
      const lg = e.league?.slug || '';
      if (!st.completed || !/FULL_TIME|FINAL/.test(st.name || '') || !me || !op) return [];
      if (!national && /friendly|^global\./.test(lg)) return [];
      const goals = (x) => num(x.score?.value ?? x.score?.displayValue ?? x.score);
      const gf = goals(me), ga = goals(op);
      if (gf == null || ga == null) return [];
      return [{ id: String(e.id), t: Date.parse(e.date), lg, s: num(e.season?.year) ?? season, home: me.homeAway === 'home',
        nt: !!c.neutralSite, venue: c.venue?.fullName || '', opp: String(op.team?.id ?? op.id ?? ''), gf, ga }];
    });
  }

  const histJobs = new Map(); // las temporadas acabadas ya pedidas en esta sesión
  function teamSeason(team, season, done) {
    const key = `${team.id}-${season}`;
    if (done && histJobs.has(key)) return histJobs.get(key);
    const job = (async () => {
      const saved = done ? await dbGet('hist', key) : null;
      if (saved) return saved;
      const data = await espnFetch(`/all/teams/${team.id}/schedule?season=${season}`, ESPN, DATO_FETCH);
      const rows = seasonRows(data, team.id, season, team.national);
      if (done) dbPut('hist', key, rows);
      return rows;
    })();
    if (done) {
      histJobs.set(key, job);
      job.catch(() => histJobs.delete(key));
    }
    return job;
  }

  async function inBatches(jobs, size = 6) {
    const out = new Array(jobs.length);
    let next = 0;
    const worker = async () => {
      while (next < jobs.length) {
        const i = next++;
        out[i] = await jobs[i]();
      }
    };
    await Promise.all(Array.from({ length: Math.min(size, jobs.length) }, worker));
    return out;
  }

  // Los partidos de un equipo hasta el de hoy (incluido), de la temporada del partido hacia
  // atrás. Si falla una temporada, se para ahí: con un hueco, «desde…» podría ser mentira.
  async function teamHistory(m, side, from) {
    if (m[side].national) from = m.season; // de las selecciones solo están los últimos partidos
    const seasons = [];
    for (let s = m.season; s >= from; s--) seasons.push(s);
    const got = await inBatches(seasons.map(s => () => teamSeason(m[side], s, s < m.season).catch(() => null)));
    const upTo = got.indexOf(null) < 0 ? got.length : got.indexOf(null);
    if (!upTo) return null;
    const rows = new Map();
    for (const r of got.slice(0, upTo).flat()) rows.set(r.id, r);
    // El de hoy, con el resultado del resumen (el calendario de ESPN a veces va por detrás)
    const me = m[side], op = m[side === 'home' ? 'away' : 'home'];
    rows.set(m.id, { id: m.id, t: Date.parse(m.date), lg: m.league, s: m.season, home: side === 'home', nt: !!rows.get(m.id)?.nt,
      venue: rows.get(m.id)?.venue || m.venue, opp: op.id, gf: me.score, ga: op.score });
    const until = Date.parse(m.date);
    return [...rows.values()].filter(r => r.t <= until).sort((a, b) => a.t - b.t);
  }

  // Las rachas de un equipo, en todas las competiciones y en la del partido, y su temporada
  function teamFacts(m, side, rows) {
    const facts = [];
    const add = (f) => facts.push({ side, ...f });
    const today = rows[rows.length - 1];
    if (today?.id !== m.id) return facts;
    const r = resultOf(today);
    const ground = homeGrounds(rows);
    const at = (g) => !m[side].national && g.home === today.home && (g.home ? ground(g) : !g.nt);
    for (const scope of ['all', 'comp']) {
      const G = scope === 'all' ? rows : rows.filter(g => g.lg === m.league);
      if (G.length < 2) continue;
      const before = G.slice(0, -1);
      const bonus = scope === 'all' ? 1 : 0; // a igual racha, mejor en todas las competiciones
      // La racha tiene que empezar dentro del historial; si no, el número se queda corto
      const run = (ok) => { const n = runBack(G, ok); return n < G.length ? n : 0; };
      const ended = (ok) => { const n = runBack(before, ok); return n < before.length ? n : 0; };
      const won = (g) => resultOf(g) === 'W', lost = (g) => resultOf(g) === 'L';
      const n = { win: run(won), unbeaten: run(g => !lost(g)), winless: run(g => !won(g)), loss: run(lost) };
      if (n.win >= 5) add({ kind: 'winRun', fam: 'run', scope, n: n.win, w: n.win * 10 + bonus });
      if (n.unbeaten >= 10 && n.unbeaten > n.win) add({ kind: 'unbeaten', fam: 'run', scope, n: n.unbeaten, w: n.unbeaten * 5 + bonus });
      if (n.winless >= 6 && n.winless > n.loss) add({ kind: 'winless', fam: 'run', scope, n: n.winless, w: n.winless * 6 + bonus });
      if (n.loss >= 4) add({ kind: 'lossRun', fam: 'run', scope, n: n.loss, w: n.loss * 8 + bonus });
      if (r === 'W') {
        const k = ended(g => !won(g));
        if (k >= 5) add({ kind: 'endWinless', fam: 'run', scope, n: k, w: k * 8 + bonus });
      }
      if (r === 'L') {
        const k = ended(g => !lost(g));
        if (k >= 10) add({ kind: 'endUnbeaten', fam: 'run', scope, n: k, w: k * 6 + bonus });
      }
      const cs = run(g => g.ga === 0), sc = run(g => g.gf > 0), bl = run(g => g.gf === 0);
      if (cs >= 5) add({ kind: 'cleanSheets', fam: 'goals', scope, n: cs, w: cs * 6 + bonus });
      if (sc >= 15) add({ kind: 'scoringRun', fam: 'goals', scope, n: sc, w: sc * 3 + bonus });
      if (bl >= 4) add({ kind: 'blankRun', fam: 'goals', scope, n: bl, w: bl * 7 + bonus });
      // En casa (en su campo) o fuera (sin los de campo neutral). Las selecciones, no: en los
      // torneos, local y visitante son solo un nombre.
      const where = G.filter(at);
      const hw = runBack(where, won);
      if (at(today) && hw < where.length && hw >= (today.home ? 8 : 6)) {
        add({ kind: today.home ? 'homeWins' : 'awayWins', fam: 'venue', scope, n: hw, w: hw * (today.home ? 5 : 7) + bonus });
      }
    }
    // La temporada en la competición del partido: pleno, invicto o la primera derrota
    const Gs = rows.filter(g => g.lg === m.league && g.s === today.s);
    const k = Gs.length;
    if (k >= 5 && Gs.every(g => resultOf(g) === 'W')) add({ kind: 'perfect', fam: 'run', n: k, w: k * 11 });
    else if (k >= 8 && Gs.every(g => resultOf(g) !== 'L')) add({ kind: 'unbeatenSeason', fam: 'run', n: k, w: k * 5 });
    else if (k >= 6 && r === 'L' && Gs.slice(0, -1).every(g => resultOf(g) !== 'L')) add({ kind: 'firstSeasonLoss', fam: 'run', n: k - 1, w: (k - 1) * 6 });
    // Desde cuándo no pasaba: la mayor victoria, la peor derrota, tantos goles a favor o en
    // contra, o ganar en esta competición
    const prev = rows.slice(0, -1);
    const years = (t) => Math.floor((today.t - t) / YEAR_MS);
    const lastBefore = (ok, list = prev) => list[list.map(ok).lastIndexOf(true)] || null;
    const since = (kind, g, n, w, min = 3) => {
      if (g && years(g.t) >= min) add({ kind, fam: 'since', n, since: g.t, years: years(g.t), w: w(years(g.t)) });
    };
    const d = today.gf - today.ga;
    if (d >= 4) since('bigWin', lastBefore(g => g.gf - g.ga >= d), d, y => y * 4 + d * 5);
    if (d <= -4) since('bigLoss', lastBefore(g => g.ga - g.gf >= -d), -d, y => y * 4 - d * 5);
    if (today.gf >= 5) since('mostScored', lastBefore(g => g.gf >= today.gf), today.gf, y => y * 3 + today.gf * 5);
    if (today.ga >= 5) since('mostConceded', lastBefore(g => g.ga >= today.ga), today.ga, y => y * 3 + today.ga * 5);
    if (r === 'W') since('compWinSince', lastBefore(g => g.lg === m.league && resultOf(g) === 'W'), 0, y => y * 5);
    return facts;
  }

  // El campo de cada temporada: donde el equipo juega en casa al menos 3 veces (contando la de
  // antes y la de después, para los primeros partidos de la temporada). Así una final en campo
  // neutral que ESPN da como «en casa» no cuenta como su campo.
  function homeGrounds(rows) {
    const count = new Map();
    for (const g of rows) {
      if (!g.home || !g.venue) continue;
      for (const s of [g.s - 1, g.s, g.s + 1]) {
        const key = `${s}\n${g.venue}`;
        count.set(key, (count.get(key) || 0) + 1);
      }
    }
    return (g) => (count.get(`${g.s}\n${g.venue}`) || 0) >= 3;
  }

  // El cara a cara, con el historial del local: primera victoria desde…, en este campo, rachas,
  // la mayor victoria y el partido con más goles desde…
  function h2hFacts(m, rows) {
    const facts = [];
    const add = (f) => facts.push(f);
    const M = rows.filter(g => g.opp === m.away.id);
    const today = M[M.length - 1];
    if (!today || today.id !== m.id || M.length < 2) return facts;
    const prev = M.slice(0, -1);
    const years = (t) => Math.floor((today.t - t) / YEAR_MS);
    const winBy = (side) => (g) => resultOf(g) === (side === 'home' ? 'W' : 'L');
    const r = resultOf(today);
    if (r !== 'D') {
      const side = r === 'W' ? 'home' : 'away';
      const won = winBy(side);
      const j = prev.map(won).lastIndexOf(true);
      if (j >= 0) {
        const k = prev.length - 1 - j, y = years(prev[j].t);
        if (k >= 4 || (y >= 3 && k >= 2)) add({ kind: 'h2hSince', fam: 'h2h', side, n: k, since: prev[j].t, years: y, w: k * 7 + y * 5 });
      } else if (prev.length >= 5) {
        add({ kind: 'h2hFirstIn', fam: 'h2h', side, n: M.length, w: prev.length * 7 });
      }
      const ground = homeGrounds(rows);
      if (today.home && ground(today)) {
        const Mg = M.filter(g => g.home && ground(g));
        const pg = Mg.slice(0, -1);
        const jg = pg.map(won).lastIndexOf(true);
        if (jg >= 0) {
          const k = pg.length - 1 - jg, y = years(pg[jg].t);
          if (k >= 1 && (k >= 3 || y >= 4)) add({ kind: 'groundSince', fam: 'ground', side, n: k, since: pg[jg].t, years: y, w: k * 8 + y * 6 });
        } else if (pg.length >= 4) {
          add({ kind: 'groundFirstIn', fam: 'ground', side, n: Mg.length, w: pg.length * 8 });
        }
      }
      const n = runBack(M, won);
      if (n >= 4) add({ kind: 'h2hRun', fam: 'h2hRun', side, n, w: n * 7 });
      const d = Math.abs(today.gf - today.ga);
      if (d >= 3) {
        const jb = prev.map(g => won(g) && Math.abs(g.gf - g.ga) >= d).lastIndexOf(true);
        if (jb >= 0 && years(prev[jb].t) >= 5) add({ kind: 'biggestWin', fam: 'margin', side, since: prev[jb].t, years: years(prev[jb].t), w: years(prev[jb].t) * 4 + d * 6 });
      }
    }
    for (const side of ['home', 'away']) {
      const n = runBack(M, g => resultOf(g) !== (side === 'home' ? 'L' : 'W'));
      if (n >= 8 && n > runBack(M, winBy(side)) + 2) add({ kind: 'h2hUnbeaten', fam: 'h2hRun', side, n, w: n * 4 });
    }
    const total = today.gf + today.ga;
    if (total >= 5) {
      const jt = prev.map(g => g.gf + g.ga >= total).lastIndexOf(true);
      if (jt >= 0 && years(prev[jt].t) >= 6) {
        add({ kind: 'mostGoals', fam: 'margin', side: r === 'L' ? 'away' : 'home', n: total, since: prev[jt].t, years: years(prev[jt].t), w: years(prev[jt].t) * 3 + total * 4 });
      }
    }
    return facts;
  }

  // Los goleadores de hoy en esta competición y temporada: si marcan partido tras partido o
  // cuántos llevan (con los partidos de cada jugador en ESPN)
  async function scorerFacts(m) {
    const tally = new Map();
    m.goals.filter(g => !g.own && g.scorer).forEach(g => tally.set(g.scorer, (tally.get(g.scorer) || 0) + 1));
    const ids = [...tally].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([id]) => id);
    const logs = await Promise.all(ids.map(id => espnFetch(`/athletes/${id}/gamelog?league=${m.league}&season=${m.season}`, ESPN_WEB, DATO_FETCH).catch(() => null)));
    const until = Date.parse(m.date);
    return logs.flatMap((log, i) => {
      const id = ids[i], side = playerById(m, id)?.side;
      const gi = (log?.names || []).indexOf('totalGoals');
      if (!side || gi < 0) return [];
      const games = new Map();
      for (const st of log.seasonTypes || []) {
        for (const c of st.categories || []) {
          for (const e of c.events || []) {
            const t = Date.parse(log.events?.[e.eventId]?.gameDate || '');
            if (Number.isFinite(t)) games.set(String(e.eventId), { t, goals: num(e.stats?.[gi]) || 0 });
          }
        }
      }
      games.set(m.id, { t: until, goals: tally.get(id) });
      const list = [...games.values()].filter(g => g.t <= until).sort((a, b) => a.t - b.t);
      const facts = [];
      const run = runBack(list, g => g.goals > 0);
      if (run >= 3) facts.push({ kind: 'pRun', fam: `p${id}`, side, player: id, n: run, all: run === list.length, w: run * 9 });
      const goals = list.reduce((sum, g) => sum + g.goals, 0);
      if (goals >= 6) facts.push({ kind: 'pGoals', fam: `p${id}`, side, player: id, n: goals, games: list.length, w: goals * 4 + (goals >= list.length ? 8 : 0) });
      return facts;
    });
  }

  // Los 3 mejores: el primero es «El dato»; como mucho, uno de cada tipo por equipo
  function pickFacts(facts) {
    const seen = new Set();
    const out = [];
    for (const f of [...facts].sort((a, b) => b.w - a.w)) {
      const key = `${f.fam}|${f.side}`;
      if (f.w < DATO_MIN || seen.has(key)) continue;
      seen.add(key);
      out.push(f);
      if (out.length === 3) break;
    }
    return out;
  }

  async function loadDato(m) {
    if (!m.season || m.status.state !== 'post' || !m.home.id || !m.away.id) return null;
    const [home, away, players] = await Promise.all([
      teamHistory(m, 'home', HIST_FROM),
      teamHistory(m, 'away', HIST_FROM),
      scorerFacts(m).catch(() => []),
    ]);
    return pickFacts([
      ...(home ? [...teamFacts(m, 'home', home), ...h2hFacts(m, home)] : []),
      ...(away ? teamFacts(m, 'away', away) : []),
      ...players,
    ]);
  }

  // ----------------------------------------------------------
  // API-FOOTBALL · la nota y la cara de cada jugador. Se piden desde este navegador con tu clave,
  // que se guarda solo aquí (en «Tu clave de API-Football»): no va en la página ni pasa por
  // Netlify, porque API-Football suspende las cuentas que llaman desde IPs compartidas (las
  // funciones de Netlify son AWS Lambda). Sin clave, todo sigue igual, sin notas.
  // ----------------------------------------------------------
  const AF_API = 'https://v3.football.api-sports.io';
  const AF_KEY = 'fc-af-key';
  // Lo que se guarda en memoria, para no gastar peticiones del plan (el gratis da 100 al día) si
  // se rehace el mismo partido: los partidos de un día, 10 minutos; los jugadores, 6 horas.
  const AF_TTL = { fixtures: 600e3, 'fixtures/players': 6 * 3600e3 };
  const afCache = new Map();
  const afKey = () => {
    try { return (localStorage.getItem(AF_KEY) || '').trim(); } catch (e) { return ''; }
  };
  const afOn = () => !!afKey();
  async function afGet(path, params) {
    const url = `${AF_API}/${path}?${new URLSearchParams(params)}`;
    const hit = afCache.get(url);
    if (hit && Date.now() - hit.at < (AF_TTL[path] || 0)) return hit.data;
    let res;
    try {
      res = await fetch(url, { headers: { 'x-apisports-key': afKey() }, signal: timeoutSignal(DATO_FETCH) });
    } catch (e) {
      // Con una clave que no vale, API-Football contesta sin dejar que la página lo lea: el navegador
      // solo ve un fallo de red
      if (e.name === 'TypeError') throw Object.assign(new Error('no contesta (¿la clave está bien copiada?)'), { api: true });
      throw e;
    }
    const data = await res.json().catch(() => ({}));
    const errors = data.errors && (Array.isArray(data.errors) ? data.errors : Object.values(data.errors));
    // Lo que dice API-Football (el plan no deja, se acabaron las peticiones…) se enseña tal cual
    if (errors?.length) throw Object.assign(new Error(errors.join(' · ')), { api: true });
    if (!res.ok) throw new Error(`API-Football ${res.status}`);
    afCache.set(url, { at: Date.now(), data: data.response || [] });
    return data.response || [];
  }

  // ¿Es el mismo equipo? Con los nombres de ESPN y de API-Football, que no siempre coinciden
  // («Internazionale» e «Inter», «Bayern Munich» y «Bayern München»)
  const TEAM_FILLER = new Set(['fc', 'cf', 'ac', 'as', 'sc', 'cd', 'ud', 'rc', 'sd', 'afc', 'club', 'the', 'real', 'sporting']);
  const teamWords = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .split(/[^a-z0-9]+/).filter(w => w.length >= 3 && !TEAM_FILLER.has(w));
  const sameTeam = (a, b) => teamWords(a).some(w => teamWords(b).some(v => v === w
    || (w.length >= 5 && v.length >= 5 && (w.startsWith(v) || v.startsWith(w)))));

  // El partido en API-Football: los del día a la misma hora (±30 min), con el mismo resultado y
  // al menos un equipo que coincida
  async function afFixture(m) {
    // La fecha en UTC (la de API-Football por defecto; con timezone=UTC da error)
    const list = await afGet('fixtures', { date: new Date(m.date).toISOString().slice(0, 10) });
    const t = Date.parse(m.date);
    const scored = list.map(f => {
      if (Math.abs((f.fixture?.timestamp || 0) * 1000 - t) > 30 * 60000) return null;
      const names = Number(sameTeam(m.home.espnName, f.teams?.home?.name)) + Number(sameTeam(m.away.espnName, f.teams?.away?.name));
      const score = f.goals?.home === m.home.score && f.goals?.away === m.away.score ? 1 : 0;
      return names && names + score >= 2 ? { f, w: names + score } : null;
    }).filter(Boolean).sort((a, b) => b.w - a.w);
    return scored.length && (scored.length === 1 || scored[0].w > scored[1].w) ? scored[0].f : null;
  }

  // La nota y la foto de cada jugador, por su id de ESPN. Se empareja por el dorsal y, si no,
  // por el apellido.
  async function loadRatings(m) {
    const fx = await afFixture(m);
    if (!fx) return null;
    const teams = await afGet('fixtures/players', { fixture: fx.fixture.id });
    const players = {};
    for (const t of teams) {
      const side = t.team?.id === fx.teams.home.id ? 'home' : t.team?.id === fx.teams.away.id ? 'away' : null;
      if (!side) continue;
      for (const p of t.players || []) {
        const g = p.statistics?.[0]?.games || {};
        const last = plain(String(p.player?.name || '').split(' ').pop());
        const espn = m[side].players.find(x => x.jersey && String(x.jersey) === String(g.number))
          || (last.length >= 3 && m[side].players.find(x => plain(x.name).endsWith(last)));
        // Los que no han jugado vienen con nota «0»: sin nota
        const st = p.statistics?.[0] || {};
        const n = (v) => num(v) || 0;
        if (espn) {
          players[espn.id] = {
            rating: num(g.rating) > 0 ? num(g.rating) : null, photo: p.player?.photo || '',
            s: { passes: n(st.passes?.total), keyPasses: n(st.passes?.key), dribbles: n(st.dribbles?.success), duels: n(st.duels?.won),
              tackles: n(st.tackles?.total), interceptions: n(st.tackles?.interceptions), shots: n(st.shots?.total), saves: n(st.goals?.saves), drawn: n(st.fouls?.drawn) },
          };
        }
      }
    }
    return Object.keys(players).length ? { fixture: fx.fixture.id, players } : null;
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
    brandLogo: '',        // tu logo (data URL), si lo has subido
    lang: 'es',           // el idioma de lo que se publica: 'es' o 'en'
    theme: 'claro',       // el fondo de las slides de datos y del vídeo: 'claro' u 'oscuro'
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

  const baseColors = (team) => (team?.national && NATIONAL_COLORS[team.abbr]) || CLUB_COLORS[team?.id] || (team ? autoColors(team.color, team.alt) : DEFAULT_STYLE);
  // El segundo color de un equipo (como la segunda equipación): el de su acento de fondo o, si el
  // acento es claro, papel con su color.
  function altColors(t) {
    if (t.fg) return { bg: t.acc, acc: contrast(t.on, t.acc) >= 3 ? t.on : '#ffffff', on: t.acc };
    if (contrast(t.acc, '#ffffff') >= 3) return { bg: t.acc, acc: '#ffffff', on: t.acc };
    return { bg: PAPER, acc: t.bg, on: contrast('#ffffff', t.bg) >= 4.5 ? '#ffffff' : '#111111', fg: '#111111' };
  }
  // ¿Se confunden los dos colores? (dos blancos, dos rojos, negro y azul marino…)
  const rgbDist = (a, b) => Math.hypot(...[16, 8, 0].map(s => ((parseInt(a.slice(1), 16) >> s) & 255) - ((parseInt(b.slice(1), 16) >> s) & 255)));
  const clash = (a, b) => rgbDist(a.bg, b.bg) < 90;
  // Si los dos equipos salen casi del mismo color, el visitante va con su segundo color (y si
  // aún se confunden, de negro).
  function resolveClash(m) {
    const home = baseColors(m.home);
    let away = baseColors(m.away);
    if (!clash(home, away)) return;
    away = altColors(away);
    if (clash(home, away)) {
      const acc = contrast(away.acc, '#161616') >= 3 ? away.acc : '#ffffff';
      away = { bg: '#161616', acc, on: contrast('#ffffff', acc) >= 4.5 ? '#ffffff' : '#111111' };
    }
    m.away.colors = away;
  }

  function teamStyle(team) {
    const t = team?.bg ? team : team?.colors || baseColors(team);
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
  const NO_ARTICLE = new Set(['Las Palmas']);
  const article = (t) => (t.national || NO_ARTICLE.has(t.short) ? '' : FEMININE.has(t.short) || FEMININE.has(t.name) ? 'la ' : 'el ');
  const theTeam = (t) => `${article(t)}${t.short}`;
  const ofTeam = (t) => (article(t) === 'el ' ? `del ${t.short}` : `de ${article(t)}${t.short}`);

  // ----------------------------------------------------------
  // LECTURAS DEL PARTIDO
  // ----------------------------------------------------------
  // Quién pasa la eliminatoria: el de la serie de ESPN (ida y vuelta) o, en un partido único que
  // acaba en empate, el que ESPN marca como ganador (por penaltis, aunque no dé su resultado).
  const throughOf = (m) => {
    if (m.through) return m.through;
    if (m.leg || m.status.state !== 'post' || m.home.score !== m.away.score) return null;
    return m.home.winner === true ? 'home' : m.away.winner === true ? 'away' : null;
  };
  // El que gana la tanda de penaltis
  const pensSide = (m) => (pensWon(m) && m.home.shootout !== m.away.shootout ? (m.home.shootout > m.away.shootout ? 'home' : 'away') : null);
  const sides = (m) => {
    const h = m.home.score, a = m.away.score;
    let winner = h > a ? 'home' : a > h ? 'away' : null;
    if (!winner) winner = pensSide(m) || (m.leg ? null : throughOf(m));
    return { winner, loser: winner && (winner === 'home' ? 'away' : 'home'), draw: h === a };
  };
  const live = (m) => m.status.state === 'in';
  const pensWon = (m) => m.home.shootout != null && m.away.shootout != null;
  const legLabel = (m) => (m.leg === 1 ? L('Ida', '1st leg') : m.leg === 2 ? L('Vuelta', '2nd leg') : '');
  const aggLabel = (agg) => `${L('Global', 'Agg.')} ${agg[0]}-${agg[1]}`;
  const champion = (t) => (t.national || article(t) === 'la ' ? 'campeona' : 'campeón');
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

  // Lo que ha pasado en el partido (para el titular): el campeón, quién pasa, la remontada…
  function story(m) {
    const { winner, draw } = sides(m);
    const h = m.home.score, a = m.away.score;
    if (live(m)) return { k: 'live' };
    // Las eliminatorias: el campeón, el que pasa en los penaltis o el que pasa en el global
    const pens = pensSide(m);
    const through = pens || throughOf(m);
    if (m.final && (through || (winner && !m.leg))) return { k: 'champion', side: through || winner };
    if (pens || (through && draw && !m.leg)) return { k: 'pens', side: through };
    if (through && m.leg) return { k: 'through', side: through };
    if (draw) {
      const last = m.goals[m.goals.length - 1];
      if (h === 0) return { k: 'nil' };
      if (m.goalsOk && last && last.min.base >= 85) return { k: 'lateDraw' };
      return { k: 'draw' };
    }
    const margin = Math.abs(h - a);
    const key = decisiveGoal(m);
    if (cameBack(m)) return { k: 'comeback', side: winner };
    if (key && key.min.base >= 85) return { k: 'late', side: winner, key };
    if (/AET|EXTRA/.test(m.status.name)) return { k: 'aet', side: winner };
    if (margin >= 4) return { k: 'rout', side: winner };
    if (margin === 3) return { k: 'masterclass', side: winner };
    if (h + a >= 6) return { k: 'fest' };
    if (margin === 1 && h + a <= 3) return { k: 'narrow', side: winner };
    return { k: 'win', side: winner };
  }
  const NUM_EN = ['nil', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];

  function headline(m) {
    const s = story(m);
    const t = s.side && m[s.side];
    const h = m.home.score;
    if (isEn()) {
      const n = Math.max(m.home.score, m.away.score);
      return {
        live: () => 'As it stands',
        champion: () => `${t.short} are champions`,
        pens: () => `${t.short} win on penalties`,
        through: () => (NEXT_ROUND_EN[m.phase] ? `${t.short} reach ${NEXT_ROUND_EN[m.phase]}` : `${t.short} go through`),
        nil: () => 'Goalless draw',
        lateDraw: () => 'Late equaliser',
        draw: () => `${h}-${h} draw`,
        comeback: () => `${t.short} complete the comeback`,
        late: () => (s.key.min.base >= 90 ? `${t.short} win it in stoppage time` : `${t.short} win it late on`),
        aet: () => `${t.short} win in extra time`,
        rout: () => `${t.short} hit ${NUM_EN[n] || n}`,
        masterclass: () => `Masterclass from ${t.short}`,
        fest: () => 'Goal fest',
        narrow: () => `${t.short} edge it`,
        win: () => `Victory for ${t.short}`,
      }[s.k]();
    }
    const the = () => cap(theTeam(t));
    return {
      live: () => 'Así va el partido',
      champion: () => `${the()}, ${champion(t)}`,
      pens: () => `${the()} pasa en los penaltis`,
      through: () => (NEXT_ROUND[m.phase] ? `${the()} pasa a ${NEXT_ROUND[m.phase]}` : `${the()} pasa la eliminatoria`),
      nil: () => 'Empate sin goles',
      lateDraw: () => 'Empate en el último suspiro',
      draw: () => `Empate a ${h}`,
      comeback: () => `Remontada ${ofTeam(t)}`,
      late: () => `${the()} lo gana en el ${s.key.min.label}`,
      aet: () => `${the()} gana en la prórroga`,
      rout: () => `Goleada ${ofTeam(t)}`,
      masterclass: () => `Exhibición ${ofTeam(t)}`,
      fest: () => 'Festival de goles',
      narrow: () => `${the()} gana por la mínima`,
      win: () => `Victoria ${ofTeam(t)}`,
    }[s.k]();
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

  // Nota del jugador (sin las de API-Football): goles y asistencias mandan; luego cómo marcó,
  // tiros, paradas y el resultado.
  function rating(m, p) {
    const s = p.s, v = (k) => s[k] || 0;
    const { winner, draw } = sides(m);
    let r = 6 * v('totalGoals') + 4 * v('goalAssists') + 1.2 * v('shotsOnTarget') + 0.4 * (v('totalShots') - v('shotsOnTarget'))
      + 0.3 * v('foulsSuffered') - 2.5 * v('redCards') - 0.6 * v('yellowCards') - 3 * v('ownGoals');
    if (p.pos === 'G') r += 0.9 * v('saves') + (v('goalsConceded') === 0 && p.starter ? 3 : 0);
    r += winner === p.side ? 1.5 : draw ? 0.5 : 0;
    r += p.starter ? 0.5 : 0;
    // Cómo marcó: el golazo desde fuera del área o de falta cuenta más (es el que se ve y se
    // recuerda); el de penalti, algo menos; y abrir el marcador, un poco más.
    m.goals.forEach((g, i) => {
      if (g.own || g.scorer !== p.id) return;
      r += (g.long ? 1.5 : 0) + (g.freeKick ? 1 : 0) - (g.pen ? 1 : 0) + (i === 0 ? 1 : 0);
    });
    return r;
  }
  const playedList = (m) => [...m.home.players, ...m.away.players].filter(p => p.starter || p.subIn);
  // La nota de API-Football (si la hay) y la cara pequeña de API-Football
  const afRating = (m, p) => m.af?.players?.[p.id]?.rating ?? null;
  const afPhoto = (m, p) => m.af?.players?.[p.id]?.photo || '';
  // A quien no tiene foto, API-Football le da una silueta gris (la única de sus caras con el fondo
  // transparente): se trata como si no cargara y se ve el dorsal. La llaman las caras al cargar.
  window.fsNoFace = (img) => {
    if (img.naturalWidth < 100) return;
    try {
      const c = document.createElement('canvas');
      c.width = img.naturalWidth; c.height = img.naturalHeight;
      const ctx = c.getContext('2d');
      ctx.drawImage(img, 0, 0);
      const px = (x, y) => ctx.getImageData(x, y, 1, 1).data;
      const corner = px(2, 2), mid = px(c.width >> 1, c.height >> 1);
      const grey = Math.abs(mid[0] - mid[1]) < 8 && Math.abs(mid[1] - mid[2]) < 8 && mid[0] > 110 && mid[0] < 180;
      if (corner[3] < 16 && grey) img.onerror?.();
    } catch (e) { /* sin permiso para leerla: se queda */ }
  };
  // La cara del retrato: API-Football la da de 150 px y en la slide mide 450. Se amplía con
  // enfoque (lo mismo que en el vídeo) para que no salga borrosa; la original queda en data-src.
  window.fsCrisp = (img) => {
    if (!img.isConnected || img.dataset.src || !window.StudioVideo?.crisp) return;
    const c = window.StudioVideo.crisp(img, 450);
    if (!(c instanceof HTMLCanvasElement)) return;
    img.dataset.src = img.src;
    img.src = c.toDataURL('image/png');
  };
  const fmtRating = (r) => L(r.toFixed(1).replace('.', ','), r.toFixed(1));
  // Con las notas de API-Football manda la nota; sin ellas, la cuenta del Studio
  const rankedPlayers = (m) => playedList(m).map(p => ({ p, a: afRating(m, p) ?? -1, r: rating(m, p) }))
    .sort((a, b) => b.a - a.a || b.r - a.r).map(x => x.p);
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

  // ----------------------------------------------------------
  // FONDOS CON PROFUNDIDAD · se pintan en un canvas (html2canvas no exporta filtros ni mezclas)
  // y van debajo de todo como una imagen más: la luz del equipo, unos haces en diagonal, una
  // trama de puntos que se apaga hacia el centro y la viñeta. Se guardan por colores y medida.
  // ----------------------------------------------------------
  const NIGHT = '#10141b'; // el fondo oscuro de las slides de datos
  const artCache = new Map();
  function paintArt(key, w, h, draw) {
    if (!artCache.has(key)) {
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      draw(c.getContext('2d'), w, h);
      artCache.set(key, c.toDataURL('image/jpeg', 0.9));
    }
    return artCache.get(key);
  }
  // Haces de luz que bajan en diagonal desde fuera de una esquina de arriba (fromRight)
  function artRays(ctx, w, h, fromRight, alpha) {
    const sx = fromRight ? w * 1.05 : -w * 0.05, sy = -h * 0.12, len = Math.hypot(w, h) * 1.25;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    // [ángulo desde la vertical, ancho, fuerza]
    for (const [a, wd, k] of [[0.18, 0.05, 1], [0.34, 0.022, 0.7], [0.47, 0.065, 0.9], [0.63, 0.03, 0.6], [0.8, 0.05, 0.5]]) {
      const th = Math.PI / 2 + (fromRight ? a : -a);
      const g = ctx.createLinearGradient(sx, sy, sx + Math.cos(th) * len, sy + Math.sin(th) * len);
      g.addColorStop(0, `rgba(255,255,255,${alpha * k})`);
      g.addColorStop(0.75, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx + Math.cos(th - wd) * len, sy + Math.sin(th - wd) * len);
      ctx.lineTo(sx + Math.cos(th + wd) * len, sy + Math.sin(th + wd) * len);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }
  // Trama de puntos de imprenta: grandes en (cx, cy) y cada vez más pequeños hasta radius
  function artDots(ctx, w, h, cx, cy, radius, color) {
    const step = 18;
    ctx.fillStyle = color;
    for (let y = 0, row = 0; y < h + step; y += step * 0.866, row++) {
      for (let x = (row % 2) * step / 2; x < w + step; x += step) {
        const t = 1 - Math.hypot(x - cx, y - cy) / radius;
        const r = t > 0 ? step * 0.48 * t ** 1.5 : 0;
        if (r < 0.7) continue;
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      }
    }
  }
  function artVignette(ctx, w, h, alpha) {
    const g = ctx.createRadialGradient(w / 2, h * 0.45, Math.min(w, h) * 0.28, w / 2, h * 0.5, Math.hypot(w, h) * 0.62);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, `rgba(0,0,0,${alpha})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }
  // El fondo de un equipo: su degradado con la luz en (lx, ly), los haces desde arriba a un
  // lado (rays: 'l' o 'r') y la trama en una esquina de abajo (dots: 'l' o 'r').
  function teamArt(st, { w = 1080, h = 1350, lx = 0.78, ly = 0.3, dots = 'l', rays = lx >= 0.5 ? 'r' : 'l' } = {}) {
    const lightBg = st.fg !== '#ffffff';
    return paintArt(`t|${st.bg}|${st.hi}|${st.lo}|${w}|${h}|${lx}|${ly}|${dots}|${rays}`, w, h, (ctx) => {
      const g = ctx.createRadialGradient(lx * w, ly * h, 0, lx * w, ly * h, Math.hypot(w, h) * 0.95);
      g.addColorStop(0, st.hi); g.addColorStop(0.42, st.bg); g.addColorStop(1, st.lo);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      artRays(ctx, w, h, rays === 'r', lightBg ? 0.08 : 0.07);
      artDots(ctx, w, h, dots === 'r' ? w : 0, h, Math.min(w, h) * 0.85, lightBg ? 'rgba(0,0,0,.07)' : 'rgba(255,255,255,.07)');
      artVignette(ctx, w, h, lightBg ? 0.16 : 0.38);
    });
  }
  // El color de un equipo que luce sobre el fondo oscuro: el suyo si tiene, si no el del acento;
  // blanco, negro o gris no tiñen (se queda en una luz blanca suave).
  const neutral = (c) => {
    const n = parseInt(c.slice(1), 16), ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    return Math.max(...ch) - Math.min(...ch) < 40;
  };
  function glowOf(st) {
    const c = [st.bg, st.acc].find(x => !neutral(x));
    if (!c) return { c: '#ffffff', a: 0.14 };
    return { c: luminance(c) < 0.05 ? mixHex(c, '#ffffff', 0.25) : c, a: 0.5 };
  }
  // El color de cada equipo para puntos y líneas sobre el fondo oscuro (crono, tiros)
  function nightInk(st) {
    const ok = (c) => contrast(c, NIGHT) >= 3;
    return [st.bg, st.acc, mixHex(st.bg, '#ffffff', 0.35), mixHex(st.acc, '#ffffff', 0.35)].find(c => !neutral(c) && ok(c))
      || [st.bg, st.acc].find(ok) || '#ffffff';
  }
  // El fondo oscuro de las slides de datos: la luz de cada equipo en su esquina de arriba
  // (sin equipos, la del acento del Studio).
  function nightArt(a, b) {
    const ga = a ? glowOf(teamStyle(a)) : { c: '#c8f53c', a: 0.16 };
    const gb = b ? glowOf(teamStyle(b)) : ga;
    return paintArt(`n|${ga.c}|${ga.a}|${gb.c}|${gb.a}`, 1080, 1350, (ctx, w, h) => {
      const base = ctx.createLinearGradient(0, 0, 0, h);
      base.addColorStop(0, '#171c26'); base.addColorStop(1, '#0a0d12');
      ctx.fillStyle = base;
      ctx.fillRect(0, 0, w, h);
      for (const [g, x] of [[ga, -0.12], [gb, 1.12]]) {
        const r = ctx.createRadialGradient(x * w, -0.08 * h, 0, x * w, -0.08 * h, w * 0.95);
        r.addColorStop(0, rgba(g.c, g.a)); r.addColorStop(0.55, rgba(g.c, g.a * 0.25)); r.addColorStop(1, rgba(g.c, 0));
        ctx.fillStyle = r;
        ctx.fillRect(0, 0, w, h);
      }
      artDots(ctx, w, h, w, h, w * 0.8, 'rgba(255,255,255,.045)');
      artVignette(ctx, w, h, 0.3);
    });
  }
  // El fondo claro de las slides de datos: papel con la luz de cada equipo en su esquina de
  // arriba, la trama abajo y, al pie, una franja con el color de cada uno (sin equipos, la del
  // acento del Studio).
  function paperArt(a, b) {
    const glow = (t) => {
      const g = glowOf(teamStyle(t));
      return g.c === '#ffffff' ? null : { c: g.c, a: 0.2 };
    };
    const ga = a ? glow(a) : { c: '#c8f53c', a: 0.25 };
    const gb = b ? glow(b) : ga;
    const [sa, sb] = a && b ? [teamStyle(a).ink, teamStyle(b).ink] : ['#c8f53c', '#c8f53c'];
    return paintArt(`p|${ga?.c}|${gb?.c}|${sa}|${sb}`, 1080, 1350, (ctx, w, h) => {
      const base = ctx.createLinearGradient(0, 0, 0, h);
      base.addColorStop(0, '#f6f4ef'); base.addColorStop(1, '#e9e5dc');
      ctx.fillStyle = base;
      ctx.fillRect(0, 0, w, h);
      for (const [g, x] of [[ga, -0.12], [gb, 1.12]]) {
        if (!g) continue;
        const r = ctx.createRadialGradient(x * w, -0.08 * h, 0, x * w, -0.08 * h, w * 0.85);
        r.addColorStop(0, rgba(g.c, g.a)); r.addColorStop(0.55, rgba(g.c, g.a * 0.25)); r.addColorStop(1, rgba(g.c, 0));
        ctx.fillStyle = r;
        ctx.fillRect(0, 0, w, h);
      }
      artDots(ctx, w, h, w, h, w * 0.8, 'rgba(0,0,0,.05)');
      artVignette(ctx, w, h, 0.08);
      ctx.fillStyle = sa; ctx.fillRect(0, h - 14, w / 2, 14);
      ctx.fillStyle = sb; ctx.fillRect(w / 2, h - 14, w / 2, 14);
    });
  }
  // Según el estilo elegido: claro (papel) u oscuro
  const dark = () => state.theme === 'oscuro';
  const sheetArt = (a, b) => (dark() ? nightArt(a, b) : paperArt(a, b));
  const sheetCls = () => `fc-in paper${dark() ? ' night' : ''}`;
  const sheetInk = (st) => (dark() ? nightInk(st) : st.ink);
  const artTag = (src) => `<img class="fc-art" src="${src}" alt="" data-noedit/>`;
  // Cada mitad (portada, estadísticas): los haces bajan desde el centro y la trama, por fuera
  const halfArt = (side) => (side === 'home' ? { rays: 'r', dots: 'l' } : { rays: 'l', dots: 'r' });

  const footLeft = (m) => `${compName(m.league)} · ${m.kind === 'jornada' ? fmtRange(m.from, m.to) : fmtFooterDate(m.date)}`;
  // Tu logo (si lo has subido): junto a la firma y, grande, en el cierre.
  const brandTag = (cls) => `<img class="${cls}" data-brand data-noedit src="${state.brandLogo || BLANK}" alt=""${state.brandLogo ? '' : ' hidden'}/>`;
  const foot = (m) => `<div class="fc-foot"><span>${esc(footLeft(m))}</span><span class="fc-mark">${brandTag('fc-brand')}<span class="fc-sign" data-noedit>${esc(state.sign)}</span></span></div>`;
  const fitSize = (text, base, steps) => {
    const len = String(text).length;
    for (const [max, size] of steps) if (len <= max) return size;
    return base;
  };

  function tplSinDatos(m, title) {
    return `
      <div class="fc-in" style="${styleVars(teamStyle(null))}">
        ${artTag(teamArt(teamStyle(null)))}
        <div class="fc-kick"><b>${title}</b></div>
        <div class="fc-empty">${L('ESPN aún no tiene estos datos del partido.<br>Prueba a generar de nuevo en unos minutos.', 'ESPN does not have this data yet.<br>Try again in a few minutes.')}</div>
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
      const who = g.own ? `${nameOf(m, g.scorer, g.scorerName)} ${L('(p.p.)', '(og)')}` : nameOf(m, g.scorer, g.scorerName);
      const min = `${g.min.label}${g.pen ? L(' (p)', ' (pen)') : ''}`;
      if (byName.has(who)) byName.get(who).push(min);
      else { byName.set(who, [min]); lines.push(who); }
    }
    const goals = lines.map(who => ({ text: `${who} ${byName.get(who).join(', ')}`, red: false }));
    const reds = m.cards.filter(c => c.red && c.side === side)
      .map(c => ({ text: `${nameOf(m, c.player, c.name)} ${c.min.label}`, red: true }));
    return [...goals, ...reds];
  }
  const scorerLines = (m, side) => scorerList(m, side).map(x => `<i class="${x.red ? 'card red' : 'ball'}"></i>${esc(x.text)}`);

  // Lo que invita a deslizar: «El dato» a medias o, si no hay, lo mejor de lo que hay dentro
  function portadaTease(m) {
    const dato = datoFacts(m)[0];
    if (dato) return { chip: L('El dato', 'The stat'), text: `${dato.big} ${dato.unit}` };
    const inside = insideList(['jugador', 'tiros', 'stats', 'onces', 'crono']).slice(0, 2);
    return inside.length ? { chip: L('Desliza', 'Swipe'), text: listEs(inside) } : null;
  }

  function tplPortada(m) {
    const { winner } = sides(m);
    const half = (team, side) => {
      const lines = scorerLines(m, side);
      const size = lines.length <= 3 ? 36 : lines.length <= 5 ? 30 : 25;
      return `
        <div class="half ${side === 'home' ? 'l' : 'r'}${winner === side ? ' won' : ''}" style="${styleVars(teamStyle(team))}">
          ${artTag(teamArt(teamStyle(team), { w: 540, lx: 0.5, ly: 0.3, ...halfArt(side) }))}
          ${logoTag(team, 'wm')}
          <div class="glow"></div>
          ${logoTag(team, 'crest')}
          ${team.shootout != null && pensWon(m) ? `<div class="pens">${team.shootout} ${L('en los penaltis', 'on penalties')}</div>` : ''}
          <div class="n">${team.score}</div>
          <div class="name" style="font-size:${fitSize(team.name, 34, [[10, 48], [14, 42], [18, 36]])}px">${esc(team.name)}</div>
          <div class="scorers" style="font-size:${size}px">${lines.slice(0, 7).map(l => `<div>${l}</div>`).join('')}</div>
        </div>`;
    };
    const c = compOf(m.league);
    const chip = [compName(m.league), phaseOut(m.phase), legLabel(m), live(m) ? `${L('En juego', 'Live')} · ${minuteText(m.status.clock)}` : ''].filter(Boolean).join(' · ');
    const logo = compLogo(m.league);
    const tease = portadaTease(m);
    // Entre los dos marcadores: «Final», el minuto o «Descanso»
    const seam = live(m) ? (/HALFTIME/.test(m.status.name) ? L('Descanso', 'Half-time') : minuteText(m.status.clock))
      : /AET|EXTRA/.test(m.status.name) && !pensWon(m) ? L('Prórroga', 'A.E.T.') : L('Final', 'Full time');
    return `
      ${half(m.home, 'home')}
      ${half(m.away, 'away')}
      <div class="seam${live(m) ? ' live' : ''}">${esc(seam)}</div>
      <div class="fade"></div>
      <div class="comp">${logo ? `<img src="${logo}" alt="" crossorigin="anonymous" onerror="this.remove()"/>` : ''}<span>${esc(chip)}</span></div>
      ${m.agg ? `<div class="agg">${aggLabel(m.agg)}</div>` : ''}
      <div class="head${tease ? ' up' : ''}"><h1>${esc(headline(m))}</h1></div>
      ${tease ? `<div class="tease"><span class="chip">${esc(tease.chip)}</span><span class="tx">${esc(tease.text)}</span><span class="go"></span></div>` : ''}
      ${foot(m)}${grain}`;
  }

  // ----------------------------------------------------------
  // 2 · MINUTO A MINUTO · la línea del partido: goles, rojas y penaltis fallados
  // ----------------------------------------------------------
  const CRONO = { top: 320, bottom: 1150, axis: 540 };

  // all: también las amarillas y los cambios (en la slide, en pequeño; el vídeo solo cuenta los
  // goles, las rojas y los penaltis fallados)
  function cronoEvents(m, all = false) {
    const evs = [];
    m.goals.forEach(g => {
      if (!g.side) return;
      const how = [g.own ? L('En propia puerta', 'Own goal') : g.pen ? L('De penalti', 'Penalty') : g.header ? L('De cabeza', 'Header')
        : g.freeKick ? L('De falta', 'Free kick') : g.volley ? L('De volea', 'Volley') : '',
      g.assist ? `${L('Asist.', 'Assist:')} ${nameOf(m, g.assist, g.assistName)}` : ''].filter(Boolean).join(' · ');
      evs.push({ side: g.side, min: g.min, kind: 'goal', name: nameOf(m, g.scorer, g.scorerName), how, score: m.goalsOk ? g.score : null });
    });
    m.cards.filter(c => c.red && c.side).forEach(c => evs.push({ side: c.side, min: c.min, kind: 'red', name: nameOf(m, c.player, c.name), how: L('Tarjeta roja', 'Red card') }));
    m.pens.filter(p => p.side).forEach(p => evs.push({ side: p.side, min: p.min, kind: 'pen', name: nameOf(m, p.player, p.name), how: p.saved ? L('Penalti parado', 'Penalty saved') : L('Penalti fallado', 'Penalty missed') }));
    if (all) {
      m.cards.filter(c => !c.red && c.side).forEach(c => evs.push({ side: c.side, min: c.min, kind: 'yellow', tiny: true, name: nameOf(m, c.player, c.name) }));
      m.subs.filter(x => x.side && x.in).forEach(x => evs.push({ side: x.side, min: x.min, kind: 'sub', tiny: true, name: nameOf(m, x.in), out: x.out ? nameOf(m, x.out) : '' }));
    }
    return evs.sort((a, b) => a.min.t - b.min.t);
  }

  // Coloca las tarjetas de cada lado lo más cerca posible de su minuto, sin pisarse entre
  // ellas ni tapar las marcas de la línea (el descanso, la prórroga, «ahora»): bands.
  const evHeight = (e) => (e.kind === 'goal' ? 84 : e.tiny ? 40 : 62);
  function placeEvents(evs, yOf, bands) {
    const gap = 8;
    const clear = (y, h, down) => {
      for (const b of bands) if (y < b.y1 && y + h > b.y0) y = down ? b.y1 + gap : b.y0 - gap - h;
      return y;
    };
    for (const side of ['home', 'away']) {
      const list = evs.filter(e => e.side === side);
      list.forEach((e, i) => {
        e.h = evHeight(e);
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
    const line = dark() ? 'rgba(255,255,255,.9)' : '#111111';
    ctx.strokeStyle = line; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.moveTo(X, CRONO.top); ctx.lineTo(X, now); ctx.stroke();
    if (now < CRONO.bottom) {
      ctx.strokeStyle = dark() ? 'rgba(255,255,255,.3)' : 'rgba(17,17,17,.3)'; ctx.setLineDash([10, 12]);
      ctx.beginPath(); ctx.moveTo(X, now); ctx.lineTo(X, CRONO.bottom); ctx.stroke();
      ctx.setLineDash([]); ctx.strokeStyle = line;
    }
    ctx.lineWidth = 4;
    for (let t = 15; t < total; t += 15) {
      if (t === 45 || t === 90) continue;
      ctx.beginPath(); ctx.moveTo(X - 12, yOf(t)); ctx.lineTo(X + 12, yOf(t)); ctx.stroke();
    }
    // Cada suceso: un punto en su minuto y una línea hasta su tarjeta
    for (const e of evs) {
      const ink = sheetInk(teamStyle(m[e.side]));
      const dir = e.side === 'home' ? -1 : 1;
      const ty = yOf(e.min.t), cy = e.y + e.h / 2;
      ctx.strokeStyle = rgba(ink, e.tiny ? 0.35 : 0.7); ctx.lineWidth = e.tiny ? 2 : 3;
      ctx.beginPath(); ctx.moveTo(X, ty); ctx.lineTo(X + dir * 22, cy); ctx.lineTo(X + dir * 36, cy); ctx.stroke();
      ctx.beginPath(); ctx.arc(X, ty, e.kind === 'goal' ? 14 : e.tiny ? 7 : 10, 0, Math.PI * 2);
      ctx.fillStyle = e.kind === 'red' ? '#e3172d' : e.kind === 'yellow' ? '#f5c400' : e.kind === 'sub' ? (dark() ? '#7d8594' : '#8a8a8a') : ink; ctx.fill();
      ctx.lineWidth = e.tiny ? 3 : 4; ctx.strokeStyle = dark() ? NIGHT : '#ece9e2'; ctx.stroke();
    }
    return c.toDataURL('image/png');
  }

  function tplCrono(m) {
    let evs = cronoEvents(m, true);
    const et = m.status.period > 2 || /AET|EXTRA|PEN/.test(m.status.name) || evs.some(e => e.min.period > 2);
    const total = et ? 120 : 90;
    const yOf = (t) => CRONO.top + (Math.min(Math.max(t, 0), total + 1) / (total + 1)) * (CRONO.bottom - CRONO.top);
    // Las marcas de la línea: el descanso, la prórroga y, en juego, el minuto de ahora.
    const ht = L('Descanso', 'Half-time');
    const marks = [{ y: Math.round(yOf(45.5)), text: m.halftime ? `${ht} · ${m.halftime[0]}-${m.halftime[1]}` : ht }];
    if (et) marks.push({ y: Math.round(yOf(90.5)), text: L('Prórroga', 'Extra time') });
    if (live(m)) marks.push({ y: Math.round(yOf(clockMinute(m))), text: `${L('Ahora', 'Now')} · ${minuteText(m.status.clock)}` });
    if (live(m) && clockMinute(m) < 46) marks.shift(); // aún no ha llegado el descanso
    // «Sin goles», en un hueco de la línea sin marcas: la primera parte o, en juego antes del
    // descanso, lo que queda por jugar.
    const noneY = (live(m) && clockMinute(m) < 46 ? (yOf(clockMinute(m)) + CRONO.bottom) / 2 : (CRONO.top + yOf(45.5)) / 2) - 64;
    // Cada tramo de la línea (entre el 0', el descanso, la prórroga y el final) tiene su sitio:
    // si en un lado no cabe todo, fuera primero los cambios y luego las amarillas de ese tramo
    // (los últimos primero). Así nada de la segunda parte acaba antes del descanso.
    const cuts = marks.map(k => k.y).sort((a, b) => a - b);
    const edges = [CRONO.top - 20, ...cuts, CRONO.bottom + 16];
    const need = (list) => list.reduce((sum, e) => sum + evHeight(e) + 8, 0) - 8;
    for (const side of ['home', 'away']) {
      for (let i = 0; i < edges.length - 1; i++) {
        const top = edges[i] + (i ? 34 : 0), bottom = edges[i + 1] - (i < cuts.length ? 34 : 0);
        const inSeg = () => evs.filter(e => e.side === side && yOf(e.min.t) >= edges[i] && yOf(e.min.t) < edges[i + 1]);
        for (const drop of ['sub', 'yellow']) {
          let extra;
          while (need(inSeg()) > bottom - top && (extra = inSeg().filter(e => e.kind === drop).pop())) evs = evs.filter(e => e !== extra);
        }
      }
    }
    placeEvents(evs, yOf, marks.map(k => ({ y0: k.y - 26, y1: k.y + 26 })));
    const ev = (e) => {
      const st = teamStyle(m[e.side]);
      if (e.tiny) {
        const what = e.kind === 'yellow' ? `<i class="card"></i>${esc(e.name)}`
          : `<i class="arr in"></i>${esc(e.name)}${e.out ? ` <i class="arr out"></i>${esc(e.out)}` : ''}`;
        return `
        <div class="ev ${e.side === 'home' ? 'l' : 'r'} tiny" style="top:${Math.round(e.y)}px;height:${e.h}px;${styleVars(st)}">
          <span class="min">${e.min.label}</span><span class="name">${what}</span>
        </div>`;
      }
      const icon = e.kind === 'red' ? '<i class="card red"></i>' : '';
      return `
        <div class="ev ${e.side === 'home' ? 'l' : 'r'}${e.kind === 'goal' ? '' : ' minor'}" style="top:${Math.round(e.y)}px;height:${e.h}px;${styleVars(st)}">
          <span class="min">${e.min.label}</span>
          <div class="who"><span class="name">${icon}${esc(e.name)}</span>${e.how ? `<span class="how">${esc(e.how)}</span>` : ''}</div>
          ${e.score ? `<span class="sc">${e.score[0]}-${e.score[1]}</span>` : ''}
        </div>`;
    };
    return `
      <div class="${sheetCls()}">
        ${artTag(sheetArt(m.home, m.away))}
        <h1 class="title">${L('Minuto a minuto', 'Minute by minute')}</h1>
        <div class="teams"><span>${logoTag(m.home, 'lg')}${esc(m.home.short)}</span><span>${esc(m.away.short)}${logoTag(m.away, 'lg')}</span></div>
        <img class="axis" src="${cronoAxis(m, evs, yOf, total)}" alt=""/>
        <div class="ht" style="top:${CRONO.top - 6}px">0'</div>
        ${marks.map(k => `<div class="ht" style="top:${k.y}px">${k.text}</div>`).join('')}
        ${live(m) ? '' : `<div class="ht" style="top:${CRONO.bottom + 44}px">${L('Final', 'Full time')} · ${m.home.score}-${m.away.score}</div>`}
        ${evs.map(ev).join('')}
        ${evs.length ? '' : `<div class="none" style="top:${Math.round(noneY)}px">${L('Sin goles', 'No goals')}</div>`}
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
    if (both('possessionPct')) rows.push({ label: L('Posesión', 'Possession'), v: [H.possessionPct, A.possessionPct], fmt: (x) => `${Math.round(x)}<small>%</small>`, more: true });
    if (both('totalShots')) rows.push({ label: L('Tiros', 'Shots'), v: [H.totalShots, A.totalShots], more: true });
    if (both('shotsOnTarget')) rows.push({ label: L('A puerta', 'On target'), v: [H.shotsOnTarget, A.shotsOnTarget], more: true });
    if (both('totalPasses')) {
      const pct = (s) => (s.accuratePasses != null && s.totalPasses ? Math.round(s.accuratePasses / s.totalPasses * 100) : null);
      rows.push({ label: L('Pases', 'Passes'), v: [H.totalPasses, A.totalPasses], pct: [pct(H), pct(A)], more: true });
    }
    if (both('wonCorners')) rows.push({ label: L('Córners', 'Corners'), v: [H.wonCorners, A.wonCorners], more: true });
    const reds = both('redCards') && (H.redCards || A.redCards);
    if (both('saves') && !reds) rows.push({ label: L('Paradas', 'Saves'), v: [H.saves, A.saves], more: true });
    if (both('foulsCommitted')) rows.push({ label: L('Faltas', 'Fouls'), v: [H.foulsCommitted, A.foulsCommitted], more: false });
    if (both('yellowCards')) rows.push({ label: L('Amarillas', 'Yellow cards'), v: [H.yellowCards, A.yellowCards], more: false });
    if (reds) rows.push({ label: L('Rojas', 'Red cards'), v: [H.redCards, A.redCards], more: false });
    return rows.slice(0, 8);
  }

  function tplStats(m) {
    const rows = statRows(m);
    if (rows.length < 3) return tplSinDatos(m, L('Estadísticas', 'Stats'));
    const cell = (r, i) => {
      const [a, b] = r.v;
      const worse = a === b ? false : r.more ? r.v[i] < r.v[1 - i] : r.v[i] > r.v[1 - i];
      const val = r.fmt ? r.fmt(r.v[i]) : r.v[i];
      const extra = r.pct && r.pct[i] != null ? `<small> · ${r.pct[i]}%</small>` : '';
      return `<div class="n${worse ? ' lose' : ''}">${val}${extra}</div>`;
    };
    const half = (team, i) => `
      <div class="half ${i ? 'r' : 'l'}" style="${styleVars(teamStyle(team))}">
        ${artTag(teamArt(teamStyle(team), { w: 540, lx: 0.5, ly: 0.2, ...halfArt(i ? 'away' : 'home') }))}
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
    const turf = dark() ? ['#1a202b', '#1d2430', 'rgba(255,255,255,.28)'] : ['#e1ddd3', '#dcd8cd', 'rgba(17,17,17,.35)'];
    ctx.fillStyle = turf[0]; ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 10; i += 2) { ctx.fillStyle = turf[1]; ctx.fillRect((i * W) / 10, 0, W / 10, H); }
    ctx.strokeStyle = turf[2]; ctx.lineWidth = 3;
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
      ctx.fillStyle = turf[2];
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
      const ink = sheetInk(teamStyle(m[s.side]));
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
        ctx.fillStyle = dark() ? turf[0] : '#ece9e2'; ctx.fill();
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
        <div><span class="n">${total(s)}</span><span class="l">${L(`tiros · ${onT(s)} a puerta`, `shots · ${onT(s)} on target`)}</span></div>
      </div>`;
    return `
      <div class="${sheetCls()}">
        ${artTag(sheetArt(m.home, m.away))}
        <h1 class="title">${L('Mapa de tiros', 'Shot map')}</h1>
        <div class="sides">${side(m.home, 'home')}${side(m.away, 'away')}</div>
        <img class="pitch" src="${pitchChart(m)}" alt=""/>
        <div class="arrows"><span>${esc(L(`Tiros ${ofTeam(m.home)}`, `${m.home.short} shots`))}</span><span>${esc(L(`Tiros ${ofTeam(m.away)}`, `${m.away.short} shots`))}</span></div>
        <div class="key"><span><i class="goal"></i>${L('Gol', 'Goal')}</span><span><i class="on"></i>${L('A puerta', 'On target')}</span><span><i class="off"></i>${L('Fuera o bloqueado', 'Off target or blocked')}</span></div>
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
  // El apellido en el campo: de los compuestos largos, el primero («Pacheco Ruiz» → «Pacheco»),
  // salvo si empieza por partícula («De la Fuente», «Van Dijk», «San Bartolo»).
  const PARTICLE = /^(de|del|da|das|do|dos|di|van|von|der|den|ter|ten|le|la|el|al|ben|mac|mc|st\.?|san|santa|dal|della|dalla)$/i;
  const lineupName = (p) => {
    const last = surname(p);
    const words = last.split(' ');
    return last.length > 11 && words.length > 1 && !PARTICLE.test(words[0]) ? words[0] : last;
  };
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
  const PITCH_STYLE = { bg: '#155232', hi: '#1f6b3f', lo: '#0a2c1a', fg: '#ffffff' }; // el césped

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
        // En una línea de 5 los nombres tienen menos sitio: más pequeños y más estrechos. Los
        // apellidos largos, más pequeños aún, para que no se toquen con el de al lado.
        const nameW = Math.min(170, Math.floor(W / (n + 1)) - 12);
        const nm = lineupName(p);
        const nameSize = Math.max(17, Math.min(n >= 5 ? 23 : 27, Math.floor(nameW / (nm.length * 0.5))));
        // El local abajo, atacando hacia arriba; el visitante arriba y girado.
        const px = left + (side === 'home' ? x : 1 - x) * W;
        const py = top + (side === 'home' ? H - y * half : y * half);
        const goals = m.goals.filter(g => g.scorer === p.id && !g.own).length;
        const yellow = m.cards.some(c => !c.red && c.player === p.id);
        const red = m.cards.some(c => c.red && c.player === p.id);
        const off = m.subs.find(s => s.out === p.id);
        const tags = '<b class="ball"></b>'.repeat(Math.min(goals, 3)) + (red ? '<i class="red"></i>' : yellow ? '<i></i>' : '');
        // Con API-Football, su cara en el círculo y el dorsal al lado (si la foto no carga, el dorsal)
        const face = afPhoto(m, p);
        players.push(`
          <div class="pl${p === gk ? ' gk' : ''}" style="left:${Math.round(px)}px;top:${Math.round(py - 41)}px;${styleVars(st)}">
            <div class="dot${face ? ' has-face' : ''}">${esc(p.jersey)}${face ? `<img class="face" src="${esc(face)}" alt="" crossorigin="anonymous" onload="fsNoFace(this)" onerror="this.parentNode.classList.remove('has-face');this.remove()"/><span class="num">${esc(p.jersey)}</span>` : ''}</div>
            <div class="nm" style="max-width:${nameW}px;font-size:${nameSize}px">${esc(nm)}</div>
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
        ${artTag(teamArt(PITCH_STYLE, { lx: 0.55, ly: 0.46, dots: 'l', rays: 'r' }))}
        <h1 class="title" style="font-size:70px;width:190px;left:40px">${L('Los<br>onces', 'Line-<br>ups')}</h1>
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
    const nota = afRating(m, p);
    const cands = [
      { v: nota != null ? fmtRating(nota) : '', label: L('Nota', 'Rating'), rating: true, w: 1000, ok: nota != null },
      { v: v('totalGoals'), label: plural(v('totalGoals'), L('Gol', 'Goal'), L('Goles', 'Goals')), w: 10 * v('totalGoals'), ok: v('totalGoals') > 0 },
      { v: v('goalAssists'), label: plural(v('goalAssists'), L('Asistencia', 'Assist'), L('Asistencias', 'Assists')), w: 8 * v('goalAssists'), ok: v('goalAssists') > 0 },
      { v: v('saves'), label: plural(v('saves'), L('Parada', 'Save'), L('Paradas', 'Saves')), w: 3 * v('saves'), ok: gk && v('saves') > 0 },
      { v: 0, label: L('Portería a cero', 'Clean sheet'), clean: true, w: 9, ok: gk && v('goalsConceded') === 0 && p.starter, text: '0' },
      { v: `${v('shotsOnTarget')}/${v('totalShots')}`, label: L('Tiros a puerta', 'Shots on target'), w: 2 * v('shotsOnTarget'), ok: v('totalShots') > 0 },
      { v: v('foulsSuffered'), label: plural(v('foulsSuffered'), L('Falta recibida', 'Foul won'), L('Faltas recibidas', 'Fouls won')), w: v('foulsSuffered'), ok: v('foulsSuffered') >= 2 },
      { v: minutesPlayed(m, p), label: L('Minutos', 'Minutes'), w: 0.1, ok: true },
    ];
    return cands.filter(c => c.ok).sort((a, b) => b.w - a.w).slice(0, 3);
  }
  const bigNumSize = (v, base) => {
    const len = String(v).length;
    return len <= 2 ? base : len === 3 ? Math.round(base * 0.92) : len === 4 ? Math.round(base * 0.84) : Math.round(base * 0.7);
  };
  const scoreLine = (m) => `${m.home.short} ${m.home.score} — ${m.away.score} ${m.away.short}`;
  // Lo que más destaca de su partido en API-Football (pases, duelos, regates…), para debajo de
  // su cara: [{ v, label }] por lo que pasa de lo normal en cada cosa.
  const AF_EXTRA = [
    { k: 'passes', es: 'Pases', en: 'Passes', base: 30 },
    { k: 'keyPasses', es: 'Pases clave', en: 'Key passes', base: 1.5 },
    { k: 'dribbles', es: 'Regates', en: 'Dribbles', base: 1.5 },
    { k: 'duels', es: 'Duelos ganados', en: 'Duels won', base: 5 },
    { k: 'tackles', es: 'Entradas', en: 'Tackles', base: 2 },
    { k: 'interceptions', es: 'Intercepciones', en: 'Interceptions', base: 1.5 },
    { k: 'saves', es: 'Paradas', en: 'Saves', base: 2 },
    { k: 'drawn', es: 'Faltas recibidas', en: 'Fouls won', base: 2 },
  ];
  function extraNumbers(m, p) {
    const s = m.af?.players?.[p.id]?.s;
    if (!s) return [];
    return AF_EXTRA.filter(x => (s[x.k] || 0) >= x.base).sort((a, b) => s[b.k] / b.base - s[a.k] / a.base)
      .slice(0, 3).map(x => ({ v: s[x.k], label: L(x.es, x.en) }));
  }

  function tplJugador(m) {
    const p = bestPlayer(m);
    if (!p) return tplSinDatos(m, L('Jugador del partido', 'Player of the match'));
    const team = m[p.side];
    const st = teamStyle(team);
    const nums = keyNumbers(m, p);
    const line = scoreLine(m);
    // Sin foto grande, su cara de API-Football en un retrato redondo y, debajo, lo que más
    // destaca de su partido.
    const face = hasPhoto(p) ? '' : afPhoto(m, p);
    const extra = face ? extraNumbers(m, p) : [];
    return `
      <div class="fc-in${face ? ' has-face' : ''}" style="${styleVars(st)}">
        ${artTag(teamArt(st))}
        ${logoTag(team, 'wm')}
        ${p.jersey ? `<div class="dorsal">${esc(p.jersey)}</div>` : ''}
        ${face ? `
        <div class="portrait">
          <img src="${esc(face)}" alt="" crossorigin="anonymous" onload="fsNoFace(this);fsCrisp(this)" onerror="this.closest('.fc-in').classList.remove('has-face');this.parentNode.remove()"/>
          ${team.logo ? `<span class="badge">${logoTag(team, '')}</span>` : ''}
        </div>
        ${extra.length ? `<div class="extra">${extra.map(x => `<div><b>${x.v}</b><span>${esc(x.label)}</span></div>`).join('')}</div>` : ''}` : ''}
        ${photoTag(p, 'photo')}
        <div class="ph-photo" data-noedit data-for="${p.id}"${hasPhoto(p) ? ' hidden' : ''}>Toca aquí para poner su foto</div>
        <div class="fade"></div>
        <div class="bar"><span>${esc(p.name)}</span></div>
        <div class="fc-kick">${L('<b>Jugador</b> del partido', '<b>Player</b> of the match')}</div>
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
  // LAS NOTAS · la nota de API-Football de cada jugador que ha jugado, con su cara, de mejor a
  // peor y cada equipo en su columna (solo en la web, con las notas)
  // ----------------------------------------------------------
  const ratedPlayers = (m, side) => m[side].players.filter(p => afRating(m, p) != null).sort((a, b) => afRating(m, b) - afRating(m, a));
  const NOTAS_ROWS = 15;
  const ratingColor = (r) => (r >= 8 ? '#0e8a3e' : r >= 7 ? '#4fa82b' : r >= 6.5 ? '#e3b400' : r >= 6 ? '#ef7d00' : '#d8263a');
  function tplNotas(m) {
    const top = bestPlayer(m);
    const col = (side) => `
      <div class="col">
        <div class="team">${logoTag(m[side], 'lg')}<span>${esc(m[side].short)}</span></div>
        ${ratedPlayers(m, side).slice(0, NOTAS_ROWS).map(p => {
          const r = afRating(m, p);
          const face = afPhoto(m, p);
          return `
          <div class="row${top?.id === p.id ? ' mvp' : ''}">
            <span class="face" style="${styleVars(teamStyle(m[side]))}"><b>${esc(p.jersey)}</b>${face ? `<img src="${esc(face)}" alt="" crossorigin="anonymous" onload="fsNoFace(this)" onerror="this.remove()"/>` : ''}</span>
            <span class="nm">${esc(lineupName(p))}</span>
            <span class="rt" style="background:${ratingColor(r)};color:${r >= 6.5 && r < 7 ? '#111' : '#fff'}">${fmtRating(r)}</span>
          </div>`;
        }).join('')}
      </div>`;
    return `
      <div class="${sheetCls()}">
        ${artTag(sheetArt(m.home, m.away))}
        <h1 class="title">${L('Las notas', 'Player ratings')}</h1>
        <div class="cols">${col('home')}${col('away')}</div>
        <div class="src">${L('Notas', 'Ratings')}: API-Football</div>
        ${foot(m)}${grain}
      </div>`;
  }

  // ----------------------------------------------------------
  // LÍDERES DEL PARTIDO · el mejor en cada cosa (más pases, regates, duelos ganados…), con su
  // cara, su escudo y el número en grande. Con los datos de API-Football (solo en la web)
  // ----------------------------------------------------------
  const LEADERS = [
    { k: 'passes', es: 'Más pases', en: 'Most passes', min: 30 },
    { k: 'keyPasses', es: 'Pases clave', en: 'Key passes', min: 2 },
    { k: 'dribbles', es: 'Regates completados', en: 'Successful dribbles', min: 2 },
    { k: 'duels', es: 'Duelos ganados', en: 'Duels won', min: 5 },
    { k: 'tackles', es: 'Entradas', en: 'Tackles', min: 2 },
    { k: 'interceptions', es: 'Intercepciones', en: 'Interceptions', min: 2 },
    { k: 'shots', es: 'Tiros', en: 'Shots', min: 3 },
    { k: 'saves', es: 'Paradas', en: 'Saves', min: 3 },
    { k: 'drawn', es: 'Faltas recibidas', en: 'Fouls won', min: 3 },
  ];
  function matchLeaders(m) {
    const all = playedList(m).filter(p => m.af?.players?.[p.id]?.s);
    return LEADERS.map(c => {
      const val = (p) => m.af.players[p.id].s[c.k] || 0;
      const top = [...all].sort((a, b) => val(b) - val(a) || (afRating(m, b) ?? 0) - (afRating(m, a) ?? 0))[0];
      return top && val(top) >= c.min ? { label: L(c.es, c.en), p: top, v: val(top) } : null;
    }).filter(Boolean).slice(0, 8);
  }
  function tplLideres(m) {
    const rows = matchLeaders(m);
    const lead = m[sides(m).winner || 'home'];
    return `
      <div class="fc-in" style="${styleVars(teamStyle(JORNADA_STYLE))}">
        ${artTag(nightArt(m.home, m.away))}
        ${logoTag(lead, 'wm')}
        <h1 class="title">${L('Líderes<br>del partido', 'Match<br>leaders')}</h1>
        <div class="rows">${rows.map(r => {
          const face = afPhoto(m, r.p);
          const team = m[r.p.side];
          return `
          <div class="row">
            <span class="face" style="${styleVars(teamStyle(team))}"><b>${esc(r.p.jersey)}</b>${face ? `<img src="${esc(face)}" alt="" crossorigin="anonymous" onload="fsNoFace(this)" onerror="this.remove()"/>` : ''}</span>
            <div class="who"><span class="lb">${esc(r.label)}</span><span class="nm">${logoTag(team, 'lg')}${esc(surname(r.p))}</span></div>
            <span class="v">${r.v}</span>
          </div>`;
        }).join('')}</div>
        <div class="src">${L('Datos', 'Data')}: API-Football</div>
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
    'eng.2': 'la Championship', 'ita.2': 'la Serie B', 'ger.2': 'la 2. Bundesliga', 'fra.2': 'la Ligue 2',
    'sco.1': 'la liga escocesa', 'tur.1': 'la liga turca', 'bel.1': 'la liga belga', 'uefa.wchampions': 'la Champions',
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
    if (isEn()) return group ? `Group ${group}` : compName(m.league);
    return group ? `el grupo ${group}` : TABLE_NAMES[m.league] || compOf(m.league).name;
  }
  // «Así va LaLiga» (o «Así queda», al final de la jornada) · «Premier League table»
  const tableTitle = (what, after = false) => (isEn() ? `${esc(what)}<br>table` : `${after ? 'Así queda' : 'Así va'}<br>${esc(what)}`);

  function tplTabla(m) {
    const rows = tableRows(m);
    const mine = { [m.home.id]: m.home, [m.away.id]: m.away };
    // La fila de cada equipo del partido, con su color (si no se vería sobre el fondo, el blanco
    // en el claro o el negro en el oscuro, con el del acento).
    const meStyle = (team) => {
      const st = teamStyle(team);
      return contrast(st.bg, dark() ? NIGHT : '#ece9e2') < (dark() ? 1.4 : 1.3) ? `background:${st.acc};color:${st.on}` : `background:${st.bg};color:${st.fg}`;
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
      <div class="${sheetCls()}">
        ${artTag(sheetArt(m.home, m.away))}
        <h1 class="title" style="font-size:${what.length > 16 ? 88 : 104}px">${tableTitle(what)}</h1>
        <div class="tbl">
          <div class="row head"><span class="rk">#</span><span></span><span>${L('Equipo', 'Team')}</span><span class="c">${L('PJ', 'P')}</span><span class="c">${L('DG', 'GD')}</span><span class="pts">Pts</span></div>
          ${rows.map(row).join('')}
        </div>
        ${foot(m)}${grain}
      </div>`;
  }

  // ----------------------------------------------------------
  // 8 · CIERRE · la pregunta para los comentarios y tu firma
  // ----------------------------------------------------------
  const closingQuestion = (m) => (live(m) ? L('¿Cómo acaba?', 'How will it end?')
    : sides(m).draw && !pensWon(m) ? L('¿Quién mereció ganar?', 'Who deserved to win?') : L('¿Quién fue el mejor del partido?', 'Who was your player of the match?'));

  function tplCierre(m) {
    const { winner } = sides(m);
    const team = m[winner || 'home'];
    const p = bestPlayer(m);
    return `
      <div class="fc-in" style="${styleVars(teamStyle(team))}">
        ${artTag(teamArt(teamStyle(team), { lx: 0.7, ly: 0.75, dots: 'l', rays: 'r' }))}
        ${p && hasPhoto(p) ? photoTag(p, 'photo') : logoTag(team, 'wm')}
        <div class="fade"></div>
        <div class="qwrap"><h1 class="q">${closingQuestion(m)}</h1><div class="sub">${L('Te leo en comentarios', 'Let me know in the comments')}</div></div>
        <div class="handle">
          ${brandTag('brand-big')}
          <span class="fc-chip">${L('Sígueme para más fútbol', 'Follow for more football')}</span>
          <div class="h fc-sign" data-noedit>${esc(state.sign)}</div>
        </div>
        ${grain}
      </div>`;
  }

  // ----------------------------------------------------------
  // EL DATO · la slide: el número grande, lo que significa y la frase entera; debajo, los
  // otros dos datos (si hay)
  // ----------------------------------------------------------
  // «en LaLiga», «en la Premier League», «at the World Cup»…
  const IN_COMP_ES = {
    'esp.1': 'en LaLiga', 'esp.2': 'en LaLiga Hypermotion', 'eng.2': 'en el Championship', 'bra.1': 'en el Brasileirão',
    'fifa.world': 'en el Mundial', 'fifa.cwc': 'en el Mundial de Clubes', 'fifa.friendly': 'en amistosos',
    'fifa.worldq.uefa': 'en la clasificación para el Mundial', 'uefa.euroq': 'en la clasificación para la Eurocopa',
  };
  const IN_COMP_EN = {
    'esp.1': 'in LaLiga', 'esp.2': 'in LaLiga Hypermotion', 'ita.1': 'in Serie A', 'ita.2': 'in Serie B', 'fra.1': 'in Ligue 1',
    'fra.2': 'in Ligue 2', 'usa.1': 'in MLS', 'mex.1': 'in Liga MX', 'fifa.world': 'at the World Cup', 'uefa.euro': 'at the Euros',
    'conmebol.america': 'at the Copa América', 'fifa.cwc': 'at the Club World Cup', 'fifa.friendly': 'in friendlies',
    'fifa.worldq.uefa': 'in World Cup qualifying', 'uefa.euroq': 'in Euro qualifying',
  };
  const inComp = (slug) => (isEn() ? IN_COMP_EN[slug] || `in the ${compName(slug)}` : IN_COMP_ES[slug] || `en la ${compName(slug)}`);
  // «en LaLiga esta temporada» · en los torneos, «en este Mundial» («at this World Cup»)
  const THIS_ES = { 'fifa.world': 'en este Mundial', 'uefa.euro': 'en esta Eurocopa', 'conmebol.america': 'en esta Copa América', 'fifa.cwc': 'en este Mundial de Clubes' };
  const THIS_EN = { 'fifa.world': 'at this World Cup', 'uefa.euro': 'at this Euros', 'conmebol.america': 'at this Copa América', 'fifa.cwc': 'at this Club World Cup' };
  const thisSeason = (slug) => (isEn() ? THIS_EN[slug] || `${inComp(slug)} this season` : THIS_ES[slug] || `${inComp(slug)} esta temporada`);
  const monthYear = (t) => new Date(t).toLocaleDateString(outLocale(), { month: 'long', year: 'numeric' });
  const fem = (t) => t.national || article(t) === 'la ';
  const poss = (name) => (/s$/i.test(name) ? `${name}'` : `${name}'s`); // «Rennes'», «Roma's»

  // Un dato en palabras: { big, unit, sentence }. spoken: para el vídeo, sin «en todas las
  // competiciones» (la frase dicha, más corta)
  function datoText(m, f, spoken = false) {
    const T = m[f.side], O = m[f.side === 'home' ? 'away' : 'home'];
    const The = cap(theTeam(T));
    const sc = f.scope !== 'all' ? inComp(m.league) : spoken ? '' : L('en todas las competiciones', 'in all competitions');
    const comp = inComp(m.league), season = thisSeason(m.league);
    const since = f.since ? monthYear(f.since) : '';
    const later = f.years >= 2 ? { big: f.years, unit: L('años después', 'years later') } : { big: f.n, unit: L('partidos después', 'games later') };
    const who = f.player ? surname(playerById(m, f.player)) : '';
    const away = f.side === 'away';
    switch (f.kind) {
      case 'winRun': return { big: f.n, unit: L('victorias seguidas', 'wins in a row'),
        sentence: L(`${The} encadena ${f.n} victorias seguidas ${sc}.`, `${T.short} have won ${f.n} in a row ${sc}.`) };
      case 'unbeaten': return { big: f.n, unit: L('partidos sin perder', 'games unbeaten'),
        sentence: L(`${The} suma ${f.n} partidos seguidos sin perder ${sc}.`, `${T.short} are unbeaten in ${f.n} games ${sc}.`) };
      case 'winless': return { big: f.n, unit: L('partidos sin ganar', 'games without a win'),
        sentence: L(`${The} lleva ${f.n} partidos sin ganar ${sc}.`, `${T.short} are without a win in ${f.n} games ${sc}.`) };
      case 'lossRun': return { big: f.n, unit: L('derrotas seguidas', 'defeats in a row'),
        sentence: L(`${The} encadena ${f.n} derrotas seguidas ${sc}.`, `${T.short} have lost ${f.n} in a row ${sc}.`) };
      case 'endWinless': return { big: f.n, unit: L('partidos sin ganar… hasta hoy', 'games without a win… until today'),
        sentence: L(`${The} rompe una racha de ${f.n} partidos sin ganar ${sc}.`, `${T.short} end a ${f.n}-game winless run ${sc}.`) };
      case 'endUnbeaten': return { big: f.n, unit: L('partidos sin perder… hasta hoy', 'games unbeaten… until today'),
        sentence: L(`Se acaba la racha ${ofTeam(T)}: ${f.n} partidos sin perder ${sc}.`, `${poss(T.short)} ${f.n}-game unbeaten run ${sc} is over.`) };
      case 'cleanSheets': return { big: f.n, unit: L('partidos seguidos sin encajar', 'clean sheets in a row'),
        sentence: L(`${The} encadena ${f.n} partidos sin encajar ${sc}.`, `${T.short} have kept ${f.n} clean sheets in a row ${sc}.`) };
      case 'scoringRun': return { big: f.n, unit: L('partidos seguidos marcando', 'games in a row scoring'),
        sentence: L(`${The} marca en ${f.n} partidos seguidos ${sc}.`, `${T.short} have scored in ${f.n} games in a row ${sc}.`) };
      case 'blankRun': return { big: f.n, unit: L('partidos seguidos sin marcar', 'games in a row without scoring'),
        sentence: L(`${The} lleva ${f.n} partidos seguidos sin marcar ${sc}.`, `${T.short} have failed to score in ${f.n} games in a row ${sc}.`) };
      case 'homeWins': return { big: f.n, unit: L('victorias seguidas en casa', 'home wins in a row'),
        sentence: L(`${The} gana sus últimos ${f.n} partidos en casa ${sc}.`, `${T.short} have won their last ${f.n} home games ${sc}.`) };
      case 'awayWins': return { big: f.n, unit: L('victorias seguidas fuera', 'away wins in a row'),
        sentence: L(`${The} gana sus últimos ${f.n} partidos fuera de casa ${sc}.`, `${T.short} have won their last ${f.n} away games ${sc}.`) };
      case 'perfect': return { big: `${f.n}/${f.n}`, unit: L('pleno de victorias', 'perfect record'),
        sentence: L(`Pleno ${ofTeam(T)} ${season}: ${f.n} victorias en ${f.n} partidos.`, `${T.short} have won all ${f.n} of their games ${season}.`) };
      case 'unbeatenSeason': return { big: f.n, unit: L('partidos sin perder', 'games unbeaten'),
        sentence: L(`${The} sigue ${fem(T) ? 'invicta' : 'invicto'} ${season}: ${f.n} partidos sin perder.`, `${T.short} are still unbeaten ${season}, after ${f.n} games.`) };
      case 'firstSeasonLoss': return { big: f.n, unit: L('partidos sin perder… hasta hoy', 'games unbeaten… until today'),
        sentence: L(`Primera derrota ${ofTeam(T)} ${season}, tras ${f.n} partidos sin perder.`, `${poss(T.short)} first defeat ${season}, after ${f.n} games unbeaten.`) };
      case 'h2hSince': return { ...later,
        hook: L(`${The} vuelve a ganar ${toTeam(O)} ${later.big} ${later.unit}`, `${T.short} beat ${O.short} again, ${later.big} ${later.unit}`),
        sentence: L(`Primera victoria ${ofTeam(T)} ante ${theTeam(O)} desde ${since}.`, `${poss(T.short)} first win over ${O.short} since ${since}.`) };
      case 'h2hFirstIn': return { big: L('1.ª', '1st'), unit: L(`victoria en ${f.n} partidos`, `win in ${f.n} meetings`),
        sentence: L(`${The} gana ${toTeam(O)} por primera vez en ${f.n} partidos.`, `${T.short} beat ${O.short} for the first time in ${f.n} meetings.`) };
      case 'groundSince': return { ...later,
        hook: away ? L(`${The} vuelve a ganar en casa ${ofTeam(O)} ${later.big} ${later.unit}`, `${T.short} win away at ${O.short} again, ${later.big} ${later.unit}`)
          : L(`${The} vuelve a ganar en casa ${toTeam(O)} ${later.big} ${later.unit}`, `${T.short} beat ${O.short} at home again, ${later.big} ${later.unit}`),
        sentence: away ? L(`Primera victoria ${ofTeam(T)} en casa ${ofTeam(O)} desde ${since}.`, `${poss(T.short)} first win away at ${O.short} since ${since}.`)
          : L(`Primera victoria ${ofTeam(T)} en casa ante ${theTeam(O)} desde ${since}.`, `${poss(T.short)} first home win over ${O.short} since ${since}.`) };
      case 'groundFirstIn': return { big: L('1.ª', '1st'),
        unit: away ? L(`victoria en ${f.n} visitas`, `win in ${f.n} visits`) : L(`victoria en casa en ${f.n} partidos`, `home win in ${f.n} meetings`),
        sentence: away ? L(`${The} gana en casa ${ofTeam(O)} por primera vez en ${f.n} visitas.`, `${T.short} win away at ${O.short} for the first time in ${f.n} visits.`)
          : L(`${The} gana en casa ${toTeam(O)} por primera vez en ${f.n} partidos.`, `${T.short} beat ${O.short} at home for the first time in ${f.n} meetings.`) };
      case 'h2hRun': return { big: f.n, unit: L(`victorias seguidas ante ${theTeam(O)}`, `wins in a row against ${O.short}`),
        sentence: L(`${The} gana sus últimos ${f.n} partidos ante ${theTeam(O)}.`, `${T.short} have won their last ${f.n} games against ${O.short}.`) };
      case 'h2hUnbeaten': return { big: f.n, unit: L(`partidos sin perder ante ${theTeam(O)}`, `games unbeaten against ${O.short}`),
        sentence: L(`${The} no pierde ante ${theTeam(O)} en sus últimos ${f.n} partidos.`, `${T.short} are unbeaten in their last ${f.n} games against ${O.short}.`) };
      case 'biggestWin': return { big: `${T.score}-${O.score}`, unit: L(`su mayor victoria ante ${theTeam(O)} desde ${new Date(f.since).getFullYear()}`, `biggest win over ${O.short} since ${new Date(f.since).getFullYear()}`),
        sentence: L(`La mayor victoria ${ofTeam(T)} ante ${theTeam(O)} desde ${since}.`, `${poss(T.short)} biggest win over ${O.short} since ${since}.`) };
      case 'mostGoals': return { big: f.n, unit: L(`goles: el récord entre los dos desde ${new Date(f.since).getFullYear()}`, `goals: the most between them since ${new Date(f.since).getFullYear()}`),
        sentence: L(`El partido con más goles entre ${theTeam(m.home)} y ${theTeam(m.away)} desde ${since}.`, `The highest-scoring game between ${m.home.short} and ${m.away.short} since ${since}.`) };
      case 'bigWin': return { big: `${T.score}-${O.score}`, unit: L(`su mayor victoria desde ${new Date(f.since).getFullYear()}`, `biggest win since ${new Date(f.since).getFullYear()}`),
        sentence: L(`La mayor victoria ${ofTeam(T)} desde ${since}.`, `${poss(T.short)} biggest win since ${since}.`) };
      case 'bigLoss': return { big: `${T.score}-${O.score}`, unit: L(`su peor derrota desde ${new Date(f.since).getFullYear()}`, `heaviest defeat since ${new Date(f.since).getFullYear()}`),
        sentence: L(`La peor derrota ${ofTeam(T)} desde ${since}.`, `${poss(T.short)} heaviest defeat since ${since}.`) };
      case 'mostScored': return { big: f.n, unit: L(`goles: no marcaba tantos desde ${new Date(f.since).getFullYear()}`, `goals: the most since ${new Date(f.since).getFullYear()}`),
        sentence: L(`${The} no marcaba ${f.n} goles en un partido desde ${since}.`, `${poss(T.short)} most goals in a game since ${since}.`) };
      case 'mostConceded': return { big: f.n, unit: L(`goles en contra: no le pasaba desde ${new Date(f.since).getFullYear()}`, `goals conceded: the most since ${new Date(f.since).getFullYear()}`),
        sentence: L(`${The} no encajaba ${f.n} goles en un partido desde ${since}.`, `${T.short} conceded ${f.n} in a game for the first time since ${since}.`) };
      case 'compWinSince': return { ...later,
        hook: L(`${The} vuelve a ganar ${comp} ${later.big} ${later.unit}`, `${T.short} win ${comp} again, ${later.big} ${later.unit}`),
        sentence: L(`Primera victoria ${ofTeam(T)} ${comp} desde ${since}.`, `${poss(T.short)} first win ${comp} since ${since}.`) };
      case 'pRun': return { big: f.n, unit: L('partidos seguidos marcando', 'games in a row scoring'),
        sentence: f.all ? L(`${who} ha marcado en todos sus partidos ${season} (${f.n}).`, `${who} has scored in every game ${season} (${f.n}).`)
          : L(`${who} marca en ${f.n} partidos seguidos ${comp}.`, `${who} has scored in ${f.n} games in a row ${comp}.`) };
      case 'pGoals': return { big: f.n, unit: L(`goles en ${f.games} partidos`, `goals in ${f.games} games`),
        sentence: L(`${who} lleva ${f.n} goles en ${f.games} partidos ${season}.`, `${who} has ${f.n} goals in ${f.games} games ${season}.`) };
      default: return null;
    }
  }
  // Los datos del partido, ya en palabras (el primero es «El dato»)
  const datoFacts = (m) => (m.dato || []).map(f => {
    const t = datoText(m, f);
    const said = datoText(m, f, true);
    return t && { ...f, ...t, big: String(t.big), spoken: said.sentence.replace(/\s+([.,:])/g, '$1').replace(/\s{2,}/g, ' ') };
  }).filter(Boolean);

  function tplDato(m) {
    const [main, ...more] = datoFacts(m);
    if (!main) return tplSinDatos(m, L('El dato', 'The stat'));
    const team = m[main.side];
    const p = main.player ? playerById(m, main.player) : null;
    return `
      <div class="fc-in" style="${styleVars(teamStyle(team))}">
        ${artTag(teamArt(teamStyle(team), { lx: 0.8, ly: 0.35, dots: 'l' }))}
        ${logoTag(team, 'wm')}
        <div class="fc-kick">${L('<b>El</b> dato', '<b>The</b> stat')}</div>
        <div class="dt-body">
          ${p ? `<div class="dt-who">${esc(p.name)}</div>` : ''}
          <div class="dt-big" style="font-size:${main.big.length <= 2 ? 540 : main.big.length <= 3 ? 440 : main.big.length <= 4 ? 360 : 280}px">${esc(main.big)}</div>
          <div class="dt-unit">${esc(main.unit)}</div>
          <div class="dt-line">${esc(main.sentence)}</div>
          ${more.length ? `<div class="dt-more">${more.map(f => `<div>${esc(f.sentence)}</div>`).join('')}</div>` : ''}
        </div>
        ${foot(m)}${grain}
      </div>`;
  }

  // ----------------------------------------------------------
  // LAS SLIDES DEL CARRUSEL · las que no tienen datos (un amistoso sin alineaciones, una copa
  // sin clasificación) no salen
  // ----------------------------------------------------------
  const SLIDE_DEFS = [
    { id: 'portada', name: 'Portada', cls: 'fc fc-portada', tpl: tplPortada },
    { id: 'dato', name: 'El dato', cls: 'fc fc-dato', tpl: tplDato, show: (m) => datoFacts(m).length > 0 },
    // Sin los goles (ESPN no los tiene de algunos partidos de copa), no sale: diría «Sin goles».
    { id: 'crono', name: 'Minuto a minuto', cls: 'fc fc-crono', tpl: tplCrono, show: (m) => m.goals.length > 0 || m.home.score + m.away.score === 0 },
    { id: 'stats', name: 'Estadísticas', cls: 'fc fc-stats', tpl: tplStats, show: (m) => statRows(m).length >= 3 },
    { id: 'tiros', name: 'Mapa de tiros', cls: 'fc fc-tiros', tpl: tplTiros, show: (m) => m.shots.length >= 4 },
    { id: 'onces', name: 'Los onces', cls: 'fc fc-onces', tpl: tplOnces, show: (m) => lineupOk(m.home) && lineupOk(m.away) },
    { id: 'jugador', name: 'Jugador del partido', cls: 'fc fc-jugador', tpl: tplJugador, show: (m) => !!bestPlayer(m),
      pick: (m) => rankedPlayers(m).slice(0, 16).map(p => ({ value: p.id, label: `${surname(p)} · ${m[p.side].abbr}` })),
      pickValue: (m) => bestPlayer(m)?.id || '',
      onPick: (value) => { state.jugadorId = value; } },
    { id: 'notas', name: 'Las notas', cls: 'fc fc-notas', tpl: tplNotas, show: (m) => ratedPlayers(m, 'home').length >= 8 && ratedPlayers(m, 'away').length >= 8 },
    { id: 'lideres', name: 'Líderes del partido', cls: 'fc fc-lideres', tpl: tplLideres, show: (m) => matchLeaders(m).length >= 4 },
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
          ${g.items.map(([slug, chip]) => `<button class="comp-chip" type="button" role="radio" data-league="${slug}" aria-checked="${slug === state.league}">${compLogo(slug, true) ? `<img src="${compLogo(slug, true)}" alt="" loading="lazy" onerror="this.remove()"/>` : ''}${chip}</button>`).join('')}
        </div>
      </div>`).join('');
    wrap.addEventListener('click', (e) => {
      const btn = e.target.closest('.comp-chip');
      if (btn) setLeague(btn.dataset.league);
    });
    // En el móvil cada grupo se desliza de lado: que se vea la elegida aunque esté al final.
    const on = wrap.querySelector('.comp-chip[aria-checked="true"]');
    if (on) on.parentElement.scrollLeft = on.offsetLeft - on.parentElement.offsetLeft - 16;
  }

  function markLeague(slug) {
    state.league = slug;
    try { localStorage.setItem(LEAGUE_KEY, slug); } catch (e) { /* sin almacenamiento: no se recuerda */ }
    document.querySelectorAll('.comp-chip').forEach(b => b.setAttribute('aria-checked', String(b.dataset.league === slug)));
  }
  function setLeague(slug) {
    if (!COMP[slug]) return;
    markLeague(slug);
    loadGames(state.selectedDate || localIso());
  }

  // Los días con partidos de una competición, para no ir probando fechas a ciegas: los del
  // calendario de ESPN (en las ligas) y los de la jornada o ronda de ahora (en las copas).
  const matchDaysCache = {};
  async function matchDays(league) {
    if (!matchDaysCache[league]) {
      matchDaysCache[league] = espnFetch(`/${league}/scoreboard`).then(data => {
        const day = (iso) => localIso(0, new Date(iso));
        const days = new Set((data.events || []).map(e => day(e.date)));
        (data.leagues?.[0]?.calendar || []).forEach(c => { if (typeof c === 'string') days.add(day(c)); });
        return [...days].filter(Boolean).sort();
      }).catch(() => { delete matchDaysCache[league]; return []; });
    }
    return matchDaysCache[league];
  }
  // «dom 19 jul» (y el año, si no es este)
  const fmtDay = (iso) => {
    const d = asDate(iso);
    const part = (o) => d.toLocaleDateString('es-ES', o).replace('.', '');
    return [part({ weekday: 'short' }), d.getDate(), part({ month: 'short' }), iso.slice(0, 4) !== localIso().slice(0, 4) ? d.getFullYear() : ''].filter(Boolean).join(' ');
  };

  async function showNearbyDays(iso, seq) {
    const days = await matchDays(state.league);
    if (seq !== gamesSeq) return;
    const prev = days.filter(d => d < iso).pop();
    const next = days.find(d => d > iso);
    const box = document.querySelector('#gamesList .games-empty');
    if (!box) return;
    const btn = (d, text) => `<button class="day-jump" type="button" data-day="${d}">${text}</button>`;
    box.insertAdjacentHTML('beforeend', prev || next
      ? `<div class="day-jumps">${prev ? btn(prev, `← ${esc(fmtDay(prev))}`) : ''}${next ? btn(next, `${esc(fmtDay(next))} →`) : ''}</div>`
      : '');
    box.querySelectorAll('.day-jump').forEach(b => b.addEventListener('click', () => goToDate(b.dataset.day)));
  }

  // «Octavos · Vuelta · Global 3-1» en la tarjeta del partido
  const tieNote = (g) => [g.phase, legLabel(g), g.agg && gamePhase(g) === 'final' ? `Global ${g.agg[0]}-${g.agg[1]}` : ''].filter(Boolean).join(' · ');

  function renderGamesList(games) {
    const wrap = document.getElementById('gamesList');
    document.getElementById('jornadaBar').hidden = !games.some(g => ['final', 'live'].includes(gamePhase(g)));
    if (!games.length) {
      wrap.innerHTML = `<div class="games-empty"><span>No hay partidos de ${esc(compOf(state.league).name)} este día.</span></div>`;
      showNearbyDays(state.selectedDate, gamesSeq);
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
          ${tieNote(g) ? `<span class="game-tie">${esc(tieNote(g))}</span>` : ''}
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
    document.getElementById('jornadaBar').hidden = true;
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

  const markPreset = (iso) => document.querySelectorAll('.date-preset').forEach(b => b.classList.toggle('active', localIso(Number(b.dataset.offset)) === iso));
  function goToDate(iso) {
    document.getElementById('dateInput').value = iso;
    markPreset(iso);
    return loadGames(iso);
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
      const [dato, af] = await Promise.all([findDato(match), findRatings(match)]);
      match.dato = dato;
      match.af = af.data;
      if (seq !== genSeq) return;
      state.rendered = match;
      state.jugadorId = null;
      renderSlides(match);
      resetVideo();
      afterRender(match);
      contentChanged(true);
      showToast(af.problem ? `Carrusel generado, sin las notas · API-Football: ${af.problem}` : 'Carrusel generado · revisa el preview', af.problem ? 'error' : 'success');
    } catch (e) {
      console.error(e);
      showToast(`No se pudo generar: ${e.message}`, 'error');
    } finally {
      state.generating = false;
      btn.classList.remove('btn-loading');
      updateGenerateBtn();
    }
  }

  // «El dato», con un tope: si ESPN tarda, el carrusel sale sin él. La primera vez de un equipo
  // baja su historial (unos segundos); luego, las temporadas acabadas ya están guardadas.
  const DATO_WAIT = 15000;
  async function findDato(m) {
    const slow = setTimeout(() => showToast('Buscando el dato en el historial de los dos equipos…', '', true), 1200);
    try {
      return await Promise.race([loadDato(m), new Promise(resolve => setTimeout(() => resolve(null), DATO_WAIT))]);
    } catch (e) {
      console.warn('El dato:', e);
      return null;
    } finally {
      clearTimeout(slow);
    }
  }

  // Las notas de API-Football (con tu clave y el partido acabado). problem: lo que ha dicho
  // API-Football si no ha dejado (el plan, el límite del día…), para enseñarlo.
  async function findRatings(m) {
    if (!afOn() || m.status.state !== 'post') return { data: null };
    try {
      return { data: await Promise.race([loadRatings(m), new Promise(resolve => setTimeout(() => resolve(null), DATO_WAIT))]) };
    } catch (e) {
      console.warn('API-Football:', e.message);
      return { data: null, problem: e.api ? e.message : '' };
    }
  }

  function afterRender(m) {
    document.getElementById('downloadBtn').disabled = false;
    document.getElementById('downloadVerticalBtn').disabled = false;
    updateShareBtn();
    updateCaption(true);
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
  function applyBrand(root = document) {
    root.querySelectorAll('[data-brand]').forEach(img => {
      img.src = state.brandLogo || BLANK;
      img.hidden = !state.brandLogo;
    });
  }
  // También en lo que guarda «↺ original»: la firma y el logo no son retoques de la slide.
  function refreshOriginals(apply) {
    document.querySelectorAll('#slidesPreview .slide').forEach(slide => {
      if (!originalSlides.has(slide)) return;
      const tpl = document.createElement('template');
      tpl.innerHTML = originalSlides.get(slide);
      apply(tpl.content);
      originalSlides.set(slide, tpl.innerHTML);
    });
  }
  function onSignInput(e) {
    state.sign = e.target.value.trim();
    try { localStorage.setItem(SIGN_KEY, state.sign); } catch (err) { /* sin almacenamiento */ }
    applySign();
    refreshOriginals(applySign);
    if (state.rendered) contentChanged();
  }

  // El idioma de lo que se publica. Al cambiarlo se vuelve a generar lo que hay (el partido y la
  // jornada), porque los nombres de los equipos también cambian.
  function updateLangUi() {
    document.querySelectorAll('.lang-opt[data-lang]').forEach(b => b.setAttribute('aria-checked', String(b.dataset.lang === state.lang)));
  }
  async function setLang(lang) {
    if (lang === state.lang || !['es', 'en'].includes(lang) || state.generating) return;
    if (!canDiscardEdits()) return;
    state.lang = lang;
    try { localStorage.setItem(LANG_KEY, lang); } catch (e) { /* sin almacenamiento: no se recuerda */ }
    updateLangUi();
    const m = state.rendered;
    const keep = m && { league: m.league, id: m.id, day: localIso(0, new Date(m.date)) };
    const jKeep = jornada.data && { league: jornada.data.league, day: jornada.data.day };
    // El guion era del otro idioma: se escribe otra vez. Los retoques ya se han descartado.
    state.script = null;
    state.scriptGame = null;
    document.querySelectorAll('#slidesPreview .slide-wrap.edited').forEach(w => w.classList.remove('edited'));
    await loadGames(state.selectedDate || localIso());
    if (keep) {
      const g = (keep.league === state.league && state.games.find(x => x.id === keep.id))
        || (await fetchGames(keep.league, keep.day).catch(() => [])).find(x => x.id === keep.id);
      if (g) {
        if (state.games.includes(g)) selectGame(g.id);
        else state.selectedGame = g;
        await generateCarousel();
      }
    }
    if (jKeep) {
      try {
        jornada.data = await fetchJornada(jKeep.league, jKeep.day);
        renderJornada();
      } catch (e) { console.error(e); }
    }
    showToast(lang === 'en' ? 'Ahora en inglés: slides, vídeo, guion y pie de foto' : 'Ahora en español', 'success');
  }

  // El estilo de las slides de datos y del vídeo (claro u oscuro). Al cambiarlo se rehacen las
  // slides con los mismos datos (sin volver a pedirlos); los retoques se descartan, como al
  // cambiar de idioma.
  function updateThemeUi() {
    document.querySelectorAll('.lang-opt[data-theme]').forEach(b => b.setAttribute('aria-checked', String(b.dataset.theme === state.theme)));
  }
  function setTheme(theme) {
    if (theme === state.theme || !['claro', 'oscuro'].includes(theme) || state.generating) return;
    if (!canDiscardEdits()) return;
    state.theme = theme;
    try { localStorage.setItem(THEME_KEY, theme); } catch (e) { /* sin almacenamiento: no se recuerda */ }
    updateThemeUi();
    if (state.rendered) {
      renderSlides(state.rendered);
      resetVideo();
      afterRender(state.rendered);
      contentChanged(true);
    }
    if (jornada.data) renderJornada();
    showToast(theme === 'oscuro' ? 'Estilo oscuro' : 'Estilo claro', 'success');
  }

  // Tu logo: se guarda en este navegador, reducido a 480 px como mucho (en PNG, con su
  // transparencia), y sale en las slides y en el vídeo.
  const BRAND_KEY = 'fc-logo';
  function setBrand(url) {
    state.brandLogo = url || '';
    try {
      // Quitarlo se recuerda (vacío): si no, al volver saldría el de Jornada90
      localStorage.setItem(BRAND_KEY, url || '');
    } catch (e) { showToast('No se pudo guardar el logo en este navegador: sale ahora, pero no se recordará', 'error'); }
    applyBrand();
    refreshOriginals(applyBrand);
    updateBrandUi();
    if (state.rendered) contentChanged();
  }
  // El logo de Jornada90 (en la web; abierto como archivo no se puede leer y no sale). Va como
  // data: URL, igual que uno subido, para que el canvas no se «manche» al descargar.
  async function loadDefaultBrand() {
    if (location.protocol === 'file:') return;
    try {
      const res = await fetch(DEFAULT_BRAND);
      if (!res.ok) return;
      const blob = await res.blob();
      const url = await new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result);
        r.onerror = () => reject(r.error);
        r.readAsDataURL(blob);
      });
      if (state.brandLogo) return; // mientras tanto se ha subido otro
      state.brandLogo = url;
      applyBrand();
      refreshOriginals(applyBrand);
      updateBrandUi();
    } catch (e) { /* sin red o abierto como archivo: sin logo */ }
  }
  function updateBrandUi() {
    const prev = document.getElementById('brandPreview');
    prev.hidden = !state.brandLogo;
    if (state.brandLogo) prev.src = state.brandLogo;
    document.getElementById('brandDel').hidden = !state.brandLogo;
    document.getElementById('brandBtnText').textContent = state.brandLogo ? 'Cambiar logo' : 'Subir logo';
  }
  async function onBrandFile(file) {
    if (!file) return;
    try {
      const url = await new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result);
        r.onerror = () => reject(r.error);
        r.readAsDataURL(file);
      });
      const img = new Image();
      img.src = url;
      await img.decode();
      const w0 = img.naturalWidth || 480, h0 = img.naturalHeight || 480; // un SVG sin tamaño
      const k = Math.min(1, 480 / Math.max(w0, h0));
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(w0 * k));
      c.height = Math.max(1, Math.round(h0 * k));
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      setBrand(c.toDataURL('image/png'));
      showToast('Logo puesto: sale en las slides y en el vídeo', 'success');
    } catch (e) {
      console.error(e);
      showToast('No se pudo leer esa imagen: prueba con un PNG o un SVG', 'error');
    }
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
  // El texto de la slide tal como está escrito (el CSS lo pone en mayúsculas y los saltos son <br>).
  function writtenText(sel) {
    const el = document.querySelector(sel);
    if (!el) return '';
    const copy = el.cloneNode(true);
    copy.querySelectorAll('br').forEach(br => br.replaceWith(' '));
    return copy.textContent.replace(/\s+/g, ' ').trim();
  }
  const slideEdited = (id) => !!document.querySelector(`#slidesPreview .slide-wrap.edited[data-slide-id="${id}"]`);
  // «A, B y C» (en inglés, «A, B and C»)
  const listEs = (xs) => (xs.length > 1 ? `${xs.slice(0, -1).join(', ')} ${L('y', 'and')} ${xs[xs.length - 1]}` : xs[0] || '');
  // «al Real Madrid», «a la Roma», «a España»
  const toTeam = (t) => (article(t) === 'el ' ? `al ${t.short}` : `a ${article(t)}${t.short}`);
  const extraTime = (m, evs) => m.status.period > 2 || /AET|EXTRA|PEN/.test(m.status.name) || evs.some(e => e.min.period > 2);

  // Los colores de un equipo para el vídeo, con los del fondo oscuro: night (puntos y líneas)
  // y glow (la luz de su esquina)
  const videoStyle = (t) => {
    const st = teamStyle(t);
    return { ...st, night: nightInk(st), glow: glowOf(st) };
  };

  function videoData(m) {
    const { winner } = sides(m);
    const team = (side) => {
      const t = m[side];
      return {
        name: t.name, short: t.short, abbr: t.abbr, score: t.score, shootout: pensWon(m) ? t.shootout : null,
        logo: t.logo, style: videoStyle(t), won: winner === side, lost: !!winner && winner !== side,
        the: theTeam(t), to: toTeam(t),
        lines: scorerList(m, side).map(x => (x.red ? `${x.text} · ${L('roja', 'red card')}` : x.text)),
      };
    };
    const evs = cronoEvents(m);
    // El minuto a minuto del vídeo, como el de la slide: también las amarillas y los cambios
    const timeline = cronoEvents(m, true);
    const p = bestPlayer(m);
    const keys = p ? keyNumbers(m, p) : [];
    const rows = statRows(m);
    const tbl = (m.standings?.length || 0) >= 4 ? tableRows(m, 11) : null;
    const closingSide = winner || 'home';
    const dato = slideDefs().some(x => x.id === 'dato') ? datoFacts(m)[0] : null;
    return {
      home: team('home'),
      away: team('away'),
      live: live(m),
      clock: minuteText(m.status.clock),
      lang: state.lang,
      dark: dark(), // el estilo elegido: las escenas de datos en claro u oscuro, como el carrusel
      comp: [compName(m.league), phaseOut(m.phase), legLabel(m)].filter(Boolean).join(' · '),
      through: live(m) ? null : pensSide(m) || throughOf(m),
      agg: m.agg,
      date: asDate(m.date).toLocaleDateString(outLocale(), { day: 'numeric', month: 'long', year: 'numeric' }),
      headline: writtenText('#slide-portada .head h1') || headline(m),
      // El gancho de los primeros segundos (es también la portada del vídeo): «El dato» a medias,
      // como en la portada del carrusel, o el titular
      hook: dato
        ? { tag: L('El dato', 'The stat'), text: `${writtenText('#slide-dato .dt-big') || dato.big} ${writtenText('#slide-dato .dt-unit') || dato.unit}` }
        : { tag: live(m) ? L('En juego', 'Live') : L('Final', 'Full time'), text: writtenText('#slide-portada .head h1') || headline(m) },
      goals: timeline.map(e => ({
        side: e.side, min: e.min.label, t: e.min.t, kind: e.kind, name: e.name, how: e.how, score: e.score || null,
        tiny: !!e.tiny, out: e.out || '', style: videoStyle(m[e.side]),
      })),
      goalsTitle: timeline.every(e => e.kind === 'goal') ? L('LOS GOLES', 'THE GOALS') : L('MINUTO A MINUTO', 'MINUTE BY MINUTE'),
      halftime: m.halftime,
      extraTime: extraTime(m, timeline),
      shots: m.shots.length >= 4 ? {
        home: shotTotals(m, 'home'), away: shotTotals(m, 'away'),
        list: m.shots.map(s => ({ side: s.side, kind: s.kind, x: s.x, y: s.y, x2: s.x2, y2: s.y2 })),
      } : null,
      jugador: p && {
        first: p.name.endsWith(surname(p)) ? p.name.slice(0, -surname(p).length).trim() : '',
        last: surname(p), number: p.jersey,
        photo: hasPhoto(p) ? [photoSrc(p)] : null,
        // La cara del retrato de la slide, si se ha quedado (no era la silueta de API-Football)
        face: document.querySelector('#slide-jugador .has-face .portrait img')?.src || null,
        logo: m[p.side].logo, style: teamStyle(m[p.side]),
        stats: keys.map(s => ({ v: s.text ?? s.v, label: s.label, clean: !!s.clean, rating: !!s.rating })),
        scoreLine: scoreLine(m),
      },
      dato: dato && {
        big: writtenText('#slide-dato .dt-big') || dato.big,
        unit: writtenText('#slide-dato .dt-unit') || dato.unit,
        sentence: (slideEdited('dato') && writtenText('#slide-dato .dt-line')) || dato.spoken,
        who: dato.player ? playerById(m, dato.player)?.name || '' : '',
        side: dato.side, style: teamStyle(m[dato.side]),
      },
      stats: rows.length >= 3 ? rows.slice(0, 5).map(r => ({ label: r.label, v: r.v, more: r.more, pct: !!r.fmt })) : null,
      table: tbl && {
        title: L(`Así va ${tableName(m)}`, `${tableName(m)} table`),
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
      brand: state.brandLogo || null,
      // Los textos fijos del vídeo, en el idioma de lo que se publica
      t: {
        shotMap: L('MAPA DE TIROS', 'SHOT MAP'),
        shotCount: L('{t} TIROS · {o} A PUERTA', '{t} SHOTS · {o} ON TARGET'),
        goal: L('GOL', 'GOAL'), onTarget: L('A PUERTA', 'ON TARGET'), offTarget: L('FUERA O BLOQUEADO', 'OFF TARGET OR BLOCKED'),
        player: L('JUGADOR', 'PLAYER'), ofMatch: L(' DEL PARTIDO', ' OF THE MATCH'),
        stats: L('ESTADÍSTICAS', 'STATS'),
        dato: L('EL DATO', 'THE STAT'),
        halftime: L('DESCANSO', 'HALF-TIME'), extraTime: L('PRÓRROGA', 'EXTRA TIME'), now: L('AHORA', 'NOW'), fullTime: L('FINAL', 'FULL TIME'),
        onPens: L('EN LOS PENALTIS', 'ON PENALTIES'),
        comments: L('TE LEO EN COMENTARIOS', 'LET ME KNOW IN THE COMMENTS'),
        follow: L('Sígueme para más fútbol', 'Follow for more football'),
      },
    };
  }

  let videoUrl = null;
  let audioUrl = null;
  let videoFile = null;
  let videoBusy = false;
  function updateVideoBtn() {
    document.getElementById('videoBtn').disabled = videoBusy || !state.rendered;
    document.getElementById('mixPreviewBtn').disabled = videoBusy || mixBusy || !state.rendered;
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
  // video.js sabe mezclar una voz (voice, voiceLead, voiceShift): queda para cuando llegue la
  // de ElevenLabs.
  const videoOptions = () => ({
    music: document.getElementById('videoMusic').checked,
    script: state.script, ...mixLevels(), intro: document.getElementById('videoIntro').checked,
    musicStyle: musicStyle(),
  });

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
      const opts = { ...videoOptions(), captions: document.getElementById('videoSubs').checked };
      const out = await window.StudioVideo.render(videoData(m), (p, stage) => {
        label.textContent = stage || `Creando el vídeo… ${Math.round(p * 100)}%`;
      }, opts);
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
      const parts = [out.mix?.voice && 'tu voz', out.mix?.music && `música ${MUSIC_STYLES[opts.musicStyle]}`, out.mix?.captions && 'subtítulos', out.mix?.intro && 'la apertura con los escudos'].filter(Boolean);
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
    navigator.clipboard?.writeText(captionNow()).catch(() => {});
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
    score: 'Marcador', dato: 'El dato', goals: 'Los goles', tiros: 'Mapa de tiros', jugador: 'Jugador del partido',
    stats: 'Estadísticas', tabla: 'Clasificación', outro: 'Cierre',
  };
  const NUM_WORDS = ['cero', 'uno', 'dos', 'tres', 'cuatro', 'cinco'];
  const ORDINALS = ['', 'primero', 'segundo', 'tercero', 'cuarto', 'quinto', 'sexto', 'séptimo', 'octavo', 'noveno', 'décimo'];
  const ordinal = (n) => ORDINALS[n] || `${n}.º`;

  // El guion en inglés: lo mismo, dicho como en la Premier.
  const ORDINALS_EN = ['', 'first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth'];
  const ordinalEn = (n) => ORDINALS_EN[n] || `${n}${[11, 12, 13].includes(n % 100) ? 'th' : { 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] || 'th'}`;
  const TIMES_EN = ['', 'once', 'twice', 'three times', 'four times', 'five times'];
  function autoScriptEn(d) {
    const end = (str) => (/[.!?…]$/.test(str) ? str : `${str}.`);
    const H = d.home, A = d.away;
    const hl = end(d.headline);
    const bare = hl.replace(/[.!?…]$/, '');
    const says = (t) => plain(hl).includes(plain(t.short));
    const T = d.through ? d[d.through] : null, O = T === H ? A : H;
    let score;
    if (d.live) {
      score = `${hl} Right now, it's ${H.score}-${A.score}.`;
    } else if (T && T.shootout != null) {
      score = says(T) ? `${bare}: ${T.shootout}-${O.shootout}.` : `${hl} ${T.short} win ${T.shootout}-${O.shootout} on penalties.`;
    } else if (T && d.agg) {
      const [x, y] = T === H ? d.agg : [d.agg[1], d.agg[0]];
      score = says(T) ? `${bare}: ${x}-${y} on aggregate.` : `${hl} ${T.short} go through ${x}-${y} on aggregate.`;
    } else if (H.score === A.score) {
      score = /^(Goalless|\d+-\d+) draw$/.test(bare) ? `${bare} between ${H.short} and ${A.short}.`
        : `${hl} ${H.short} and ${A.short} draw ${H.score}-${A.score}.`;
    } else {
      const W = H.score > A.score ? H : A, Lo = W === H ? A : H;
      score = says(W) ? `${bare}: ${W.score}-${Lo.score} against ${Lo.short}.` : `${hl} ${W.short} beat ${Lo.short} ${W.score}-${Lo.score}.`;
    }
    const script = { score, outro: d.closing.question };
    if (d.dato) script.dato = d.dato.sentence;
    const goals = d.goals.filter(e => e.kind === 'goal');
    if (d.goals.length) {
      const tally = new Map();
      goals.forEach(e => tally.set(e.name, (tally.get(e.name) || 0) + 1));
      const top = [...tally].sort((a, b) => b[1] - a[1])[0];
      const reds = d.goals.filter(e => e.kind === 'red').map(e => e.name);
      const parts = [];
      if (top && top[1] > 1) {
        const others = [...tally.keys()].filter(n => n !== top[0]);
        parts.push(top[1] === 3 ? `Hat-trick for ${top[0]}.` : `${top[0]} scores ${TIMES_EN[top[1]] || `${top[1]} times`}.`);
        if (others.length) parts.push(`${listEs(others)} ${others.length > 1 ? 'also score' : 'also scores'}.`);
      } else if (tally.size) {
        parts.push(`${tally.size > 1 ? 'Goals from' : 'The goal from'} ${listEs([...tally.keys()])}.`);
      }
      if (reds.length) parts.push(`Red card for ${listEs(reds)}.`);
      script.goals = parts.join(' ') || 'Here is the game, minute by minute.';
    }
    if (d.shots) {
      script.tiros = `${H.short}: ${d.shots.home.total} shots, ${d.shots.home.on} on target. ${A.short}: ${d.shots.away.total} and ${d.shots.away.on}.`;
    }
    if (d.jugador) {
      const say = (s) => (s.clean ? 'a clean sheet' : s.rating ? `rated ${s.v}` : `${String(s.v).replace('/', ' of ')} ${s.label.toLowerCase()}`);
      const [a, b] = d.jugador.stats;
      script.jugador = `${d.jugador.last}, player of the match${a ? `: ${say(a)}${b ? ` and ${say(b)}` : ''}` : ''}.`;
    }
    if (d.stats) {
      const pos = d.stats.find(r => r.pct);
      if (pos && pos.v[0] !== pos.v[1]) {
        const i = pos.v[0] > pos.v[1] ? 0 : 1;
        script.stats = `${(i ? A : H).short} had the ball: ${Math.round(pos.v[i])}% possession.`;
      } else {
        script.stats = 'Here are the stats.';
      }
    }
    if (d.table) {
      const rank = (side) => d.table.rows.find(r => r?.me === side)?.rank;
      const [rh, ra] = [rank('home'), rank('away')];
      script.tabla = rh && ra ? `${H.short}, ${ordinalEn(rh)}; ${A.short}, ${ordinalEn(ra)}.`
        : rh ? `${H.short} sit ${ordinalEn(rh)}.` : ra ? `${A.short} sit ${ordinalEn(ra)}.` : 'Here is the table.';
    }
    return script;
  }

  function autoScript(d) {
    if (d.lang === 'en') return autoScriptEn(d);
    const end = (str) => (/[.!?…]$/.test(str) ? str : `${str}.`);
    const H = d.home, A = d.away;
    const hl = end(d.headline);
    const bare = hl.replace(/[.!?…]$/, '');
    const says = (t) => plain(hl).includes(plain(t.short)); // el titular ya dice quién gana o pasa
    const T = d.through ? d[d.through] : null, O = T === H ? A : H; // el que pasa la eliminatoria
    let score;
    if (d.live) {
      score = `${hl} De momento, ${H.score}-${A.score}.`;
    } else if (T && T.shootout != null) {
      score = says(T) ? `${bare}: ${T.shootout}-${O.shootout}.` : `${hl} ${cap(T.the)} gana ${T.shootout}-${O.shootout} en los penaltis.`;
    } else if (T && d.agg) {
      const [x, y] = T === H ? d.agg : [d.agg[1], d.agg[0]];
      score = says(T) ? `${bare}: ${x}-${y} en el global.` : `${hl} ${cap(T.the)} pasa con un ${x}-${y} en el global.`;
    } else if (H.score === A.score) {
      score = /^Empate (a|sin)/.test(bare) ? `${bare} entre ${H.the} y ${A.the}.`
        : `${hl} ${H.score ? `${cap(H.the)} y ${A.the} empatan a ${H.score}.` : `${cap(H.the)} y ${A.the} no pasan del 0-0.`}`;
    } else {
      const W = H.score > A.score ? H : A, L = W === H ? A : H;
      score = says(W) ? `${bare}: ${W.score}-${L.score} ${L.to}.` : `${hl} ${cap(W.the)} gana ${W.score}-${L.score} ${L.to}.`;
    }
    const script = { score, outro: d.closing.question };
    if (d.dato) script.dato = d.dato.sentence;

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
      const say = (s) => (s.clean ? 'portería a cero' : s.rating ? `un ${s.v} de nota` : `${String(s.v).replace('/', ' de ')} ${s.label.toLocaleLowerCase('es')}`);
      const [a, b] = d.jugador.stats;
      script.jugador = `${d.jugador.last}, el mejor del partido${a ? `: ${say(a)}${b ? ` y ${say(b)}` : ''}` : ''}.`;
    }
    if (d.stats) {
      const pos = d.stats.find(r => r.pct);
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

  // ─── Volumen · por defecto, la música como suena siempre (100 %). La barra se recuerda en
  // este navegador y «Escuchar la mezcla» crea solo el sonido para ajustarla. ───
  const MIX_KEY = 'fc-mix';
  let mixBusy = false;
  let mixUrl = null;
  // El estilo de la música: «urbana» (por defecto: el trap que va con los cortes) o «épica».
  // Los subtítulos, apagados por defecto; las dos cosas se recuerdan en este navegador.
  const MUSIC_STYLES = { epica: 'épica', trap: 'urbana' };
  const musicStyle = () => document.querySelector('.lang-opt[data-music][aria-checked="true"]')?.dataset.music || 'trap';
  const setMusicStyle = (style) => document.querySelectorAll('.lang-opt[data-music]')
    .forEach(b => b.setAttribute('aria-checked', String(b.dataset.music === style)));
  const mixLevels = () => ({ musicVolume: Number(document.getElementById('musicVol').value) / 100 });
  function showMix() {
    const music = document.getElementById('musicVol');
    const on = document.getElementById('videoMusic').checked;
    document.getElementById('musicVolOut').textContent = `${music.value}%`;
    music.disabled = !on;
    document.querySelectorAll('.lang-opt[data-music]').forEach(b => { b.disabled = !on; });
    document.getElementById('mixResetBtn').hidden = music.value === '100' && musicStyle() === 'trap';
  }
  function loadMix() {
    try {
      const saved = JSON.parse(localStorage.getItem(MIX_KEY) || '{}');
      if (Number.isFinite(saved.music)) document.getElementById('musicVol').value = saved.music;
      // El estilo guardado antes de la urbana nueva (v < 2) era la épica por defecto: no cuenta.
      if (saved.v >= 2 && MUSIC_STYLES[saved.style]) setMusicStyle(saved.style);
      if (typeof saved.subs === 'boolean') document.getElementById('videoSubs').checked = saved.subs;
      // Sin música por defecto (en TikTok se pone un sonido en tendencia); si la activas, se recuerda.
      if (typeof saved.musicOn === 'boolean') document.getElementById('videoMusic').checked = saved.musicOn;
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
        v: 2, music: Number(document.getElementById('musicVol').value), style: musicStyle(),
        subs: document.getElementById('videoSubs').checked, musicOn: document.getElementById('videoMusic').checked,
      }));
    } catch (e) { /* sin localStorage: vale para esta vez */ }
  }
  function resetMix() {
    document.getElementById('musicVol').value = 100;
    setMusicStyle('trap');
    mixChanged();
  }
  async function previewMix() {
    const m = state.rendered;
    if (!m || mixBusy || videoBusy || !window.StudioVideo?.audio) return;
    const opts = videoOptions();
    if (!opts.music) {
      showToast('No hay nada que escuchar: activa la música');
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

  // ----------------------------------------------------------
  // PARA TU IA · un texto que se copia con qué es el Studio, cómo ayudarte y lo que hay ahora
  // en pantalla. Lo pegas en Claude (o en tu IA) y «Pegar de tu IA» coloca solo lo que te
  // proponga: el titular, la pregunta del cierre y las frases del guion. Es copiar y pegar: el
  // Studio no llama a ninguna IA.
  // ----------------------------------------------------------
  const AI_SLIDE_TARGETS = {
    titular: '#slide-portada .head h1',
    pregunta: '#slide-cierre .q',
  };

  function aiBrief() {
    const lines = [
      '# Studio Fútbol · contexto para tu IA',
      '',
      `Ayudas a Toni${state.sign ? ` (${state.sign})` : ''}, que hace contenido de fútbol en español para Instagram y TikTok. Toni usa su Studio Fútbol, una herramienta en su ordenador que convierte un partido (con los datos de ESPN) en un carrusel de Instagram y un vídeo short. Tú no ves el Studio: Toni te pega aquí lo que hay y después copia tus propuestas de vuelta.`,
      '',
      '## Qué hace el Studio',
      '- Pasos 1 y 2: elige competición (LaLiga, Champions, Premier, Serie A, Mundial, Libertadores…), día y partido.',
      '- Paso 3: el carrusel (1080×1350): portada con titular, «El dato» (una racha, un cara a cara o un «primera vez desde…» sacado del historial de ESPN, si hay alguno que merezca la pena), minuto a minuto, estadísticas, mapa de tiros, los onces, jugador del partido, clasificación y cierre con una pregunta para comentarios. Los textos se retocan a mano.',
      '- Paso 4: el vídeo short (1080×1920, unos 30 s): una escena por slide. Lleva un guion, una frase por escena, que sale en los subtítulos y que Toni lee si graba su voz.',
      '',
      '## Cómo ayudar',
      isEn() ? '- **Idioma: inglés.** Esta vez las slides y el vídeo van en inglés: escribe el titular, la pregunta y el guion en inglés británico (el del fútbol), cercano, con gancho y sin exagerar.'
        : '- Español de España: cercano, con gancho y sin exagerar.',
      '- No te inventes datos: usa los de abajo.',
      '- Guion: una frase por escena que quepa en su tiempo (unas 2,8 palabras por segundo; las cifras cuentan casi el doble). Escríbelo como se dice en voz alta.',
      '- Titular de portada: de 2 a 5 palabras, que enganche.',
      '- Pregunta del cierre: corta y que invite a comentar.',
      '',
      '## Cómo responder para pegarlo en el Studio',
      'Además de lo que expliques, deja un bloque con una línea por cambio, solo las que cambies, con estas etiquetas exactas:',
      '',
      '```',
      'TITULAR: …',
      'PREGUNTA: …',
      ...Object.values(SCENE_NAMES).map(n => `${n}: …`),
      '```',
      '',
      'Toni lo copia y en el Studio pulsa «Pegar de tu IA»: cada línea va a su sitio.',
      '',
      '## Lo que hay ahora en el Studio',
    ];
    const m = state.rendered;
    if (!m) {
      lines.push('', 'Aún no hay ningún partido generado.');
      return lines.join('\n');
    }
    const d = videoData(m);
    const plan = window.StudioVideo?.plan ? window.StudioVideo.plan(d, state.script) : [];
    const pens = d.home.shootout != null ? ` (${d.home.shootout}-${d.away.shootout} en los penaltis)` : '';
    lines.push('', `**Partido:** ${d.home.name} ${d.home.score} – ${d.away.score} ${d.away.name}${pens} · ${d.comp} · ${d.date}${d.live ? ` · en juego, ${d.clock}` : ''}`);
    if (d.agg || d.through) {
      const who = d.through ? `pasa ${theTeam(m[d.through])}` : '';
      lines.push(`**Eliminatoria:** ${[d.agg ? `global ${d.agg[0]}-${d.agg[1]} (${d.home.short} – ${d.away.short})` : '', who].filter(Boolean).join(' · ')}`);
    }
    const goals = (side) => scorerList(m, side).filter(x => !x.red).map(x => x.text);
    if (m.goals.length) lines.push(`**Goles:** ${d.home.short}: ${goals('home').join(', ') || '—'} · ${d.away.short}: ${goals('away').join(', ') || '—'}`);
    const reds = m.cards.filter(c => c.red).map(c => `${nameOf(m, c.player, c.name)} (${m[c.side]?.short || ''}, ${c.min.label})`);
    if (reds.length) lines.push(`**Rojas:** ${reds.join(', ')}`);
    if (d.stats) lines.push(`**Estadísticas (${d.home.short} – ${d.away.short}):** ${d.stats.map(r => `${r.label} ${r.pct ? `${Math.round(r.v[0])}%-${Math.round(r.v[1])}%` : `${r.v[0]}-${r.v[1]}`}`).join(', ')}`);
    if (d.shots) lines.push(`**Tiros:** ${d.home.short} ${d.shots.home.total} (${d.shots.home.on} a puerta) · ${d.away.short} ${d.shots.away.total} (${d.shots.away.on} a puerta)`);
    const notas = ['home', 'away'].map(side => ratedPlayers(m, side).slice(0, 5).map(p => `${surname(p)} ${fmtRating(afRating(m, p))}`).join(', ')).filter(Boolean);
    if (notas.length === 2) lines.push(`**Notas de API-Football (las 5 mejores):** ${d.home.short}: ${notas[0]} · ${d.away.short}: ${notas[1]}`);
    if (d.jugador) lines.push(`**Jugador del partido:** ${[d.jugador.first, d.jugador.last].filter(Boolean).join(' ')}: ${d.jugador.stats.map(x => (x.clean ? L('portería a cero', 'clean sheet') : `${x.v} ${x.label.toLocaleLowerCase('es')}`)).join(', ')}`);
    const datos = datoFacts(m).filter(() => d.dato);
    if (datos.length) lines.push(`**El dato** (del historial de ESPN, el primero es el de la slide):`, ...datos.map(f => `- ${f.sentence}`));
    if (d.table) {
      const mine = d.table.rows.filter(r => r?.me).map(r => `${r.name} ${r.rank}.º (${r.pts} pts)`);
      if (mine.length) lines.push(`**Clasificación (${tableName(m)}):** ${mine.join(' · ')}`);
    }
    lines.push('', `**Titular de la portada:** ${writtenText(AI_SLIDE_TARGETS.titular) || '—'}`);
    lines.push(`**Pregunta del cierre:** ${writtenText(AI_SLIDE_TARGETS.pregunta) || '—'}`);
    if (plan.length) {
      lines.push('', '**Guion del vídeo** (escena, lo que dura y la frase de ahora):');
      plan.forEach(sc => {
        const speed = !sc.words ? '' : sc.speed <= 1.1 ? '' : ' — va deprisa, sobran palabras';
        lines.push(`- ${SCENE_NAMES[sc.id] || sc.id} (${sc.dur.toLocaleString('es-ES', { maximumFractionDigits: 1 })} s): ${state.script?.[sc.id] || '(sin frase)'}${speed}`);
      });
    }
    return lines.join('\n');
  }

  async function copyText(textValue) {
    try {
      await navigator.clipboard.writeText(textValue);
      return true;
    } catch (e) {
      // Sin permiso para el portapapeles: a la antigua.
      const area = Object.assign(document.createElement('textarea'), { value: textValue });
      area.style.cssText = 'position:fixed;opacity:0;top:0;left:0';
      document.body.appendChild(area);
      area.select();
      const ok = document.execCommand('copy');
      area.remove();
      return ok;
    }
  }

  async function copyAiBrief() {
    document.activeElement?.blur();
    const ok = await copyText(aiBrief());
    showToast(ok ? 'Copiado · pégalo en Claude (o en tu IA) y pídele lo que necesites' : 'No se pudo copiar', ok ? 'success' : 'error');
  }

  // Lo que devuelve la IA: «TITULAR: …», «PREGUNTA: …» y una línea por escena del guion
  // («Marcador: …»). Acepta viñetas, números, negritas y comillas alrededor.
  function parseAiReply(textValue) {
    const scenes = Object.fromEntries(Object.entries(SCENE_NAMES).map(([id, name]) => [plain(name), id]));
    const out = { slides: {}, script: {} };
    for (const raw of String(textValue).split(/\r?\n/)) {
      const line = raw.replace(/\*\*/g, '').replace(/^[\s>*\-•]+/, '').replace(/^\d+\s*[·.)\-]\s*/, '').trim();
      const mm = line.match(/^([^:：]{2,40}?)\s*[:：]\s*(.+)$/);
      if (!mm) continue;
      const label = plain(mm[1].replace(/\(.*?\)/g, ''));
      const value = mm[2].trim().replace(/^[«"“']+|[»"”']+$/g, '').trim();
      if (!value || value === '…') continue;
      if (label === 'titular') out.slides.titular = value;
      else if (label === 'pregunta' || label === 'preguntadelcierre') out.slides.pregunta = value;
      else if (scenes[label]) out.script[scenes[label]] = value;
    }
    return out;
  }

  function applyAiReply(textValue) {
    if (!state.rendered) {
      showToast('Primero genera un partido', 'error');
      return;
    }
    const { slides, script } = parseAiReply(textValue);
    const done = [];
    for (const [key, value] of Object.entries(slides)) {
      const el = document.querySelector(AI_SLIDE_TARGETS[key]);
      if (!el) continue;
      el.textContent = value;
      el.closest('.slide-wrap')?.classList.add('edited');
      done.push(key === 'titular' ? 'el titular' : 'la pregunta del cierre');
    }
    if (done.length) contentChanged();
    const fresh = Object.entries(script).filter(([id]) => id in (state.script || {}));
    if (fresh.length) {
      state.script = { ...state.script, ...Object.fromEntries(fresh) };
      renderScript();
      saveDraft();
      done.push(fresh.length === 1 ? '1 frase del guion' : `${fresh.length} frases del guion`);
    }
    showToast(done.length ? `Colocado: ${listEs(done)}` : 'No he encontrado líneas «TITULAR:», «PREGUNTA:» ni del guion («Marcador: …»)', done.length ? 'success' : 'error');
  }

  async function openAiPaste() {
    const dialog = document.getElementById('aiPasteDialog');
    const area = document.getElementById('aiPasteText');
    area.value = '';
    try { area.value = await navigator.clipboard.readText(); } catch (e) { /* sin permiso: lo pegas tú */ }
    dialog.showModal();
    area.focus();
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
        const req = indexedDB.open('futbol-studio', 2);
        req.onupgradeneeded = () => {
          // 1: los borradores y las fotos · 2: el historial de cada equipo (para «El dato»)
          for (const store of ['drafts', 'photos', 'hist']) {
            if (!req.result.objectStoreNames.contains(store)) req.result.createObjectStore(store);
          }
        };
        req.onsuccess = () => {
          req.result.onversionchange = () => req.result.close(); // que una versión nueva del Studio pueda actualizarla
          resolve(req.result);
        };
        req.onerror = () => resolve(null); // modo privado o sin espacio: sin borradores
        // Otra pestaña con un Studio de antes la tiene abierta: esta vez, sin guardar nada
        req.onblocked = () => {
          showToast('Hay otra pestaña con el Studio abierta: ciérrala y recarga esta para guardar los borradores', 'error', true);
          resolve(null);
        };
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

  // Sin los fondos pintados (pesan y se pueden volver a pintar): al aplicar los retoques, cada
  // slide se queda con los de la slide recién generada.
  function slideEdits() {
    const edits = {};
    document.querySelectorAll('#slidesPreview .slide-wrap.edited').forEach(w => {
      const copy = w.querySelector('.slide').cloneNode(true);
      copy.querySelectorAll('.fc-art').forEach(img => img.setAttribute('src', ''));
      edits[w.dataset.slideId] = copy.innerHTML;
    });
    return edits;
  }
  function applyEdits(edits = {}) {
    Object.entries(edits).forEach(([id, html]) => {
      const wrap = document.querySelector(`#slidesPreview .slide-wrap[data-slide-id="${id}"]`);
      if (!wrap) return;
      const slide = wrap.querySelector('.slide');
      const art = [...slide.querySelectorAll('.fc-art')].map(img => img.src);
      slide.innerHTML = html;
      slide.querySelectorAll('.fc-art').forEach((img, i) => { if (!img.getAttribute('src') && art[i]) img.src = art[i]; });
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
    updateCaption();
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
      if (d.match.lang && d.match.lang !== state.lang) {
        state.lang = d.match.lang;
        updateLangUi();
      }
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
      dbDel('drafts', 'voice'); // la grabación de las versiones con «Grabar mi voz»: ya no se usa
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
    navigator.clipboard?.writeText(captionNow()).catch(() => {});
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

  const LONG_UPPER = /[ßŉǰﬀ-ﬆ]/;
  const LONG_UPPER_ALL = /[ßŉǰﬀ-ﬆ]/g;
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
        // html2canvas se rompe con las letras que cambian de largo al pasar a mayúsculas
        // («Meißner» → «MEISSNER»): en la copia que dibuja, ya separadas («Meissner»).
        onclone: (doc) => {
          const walk = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
          for (let n = walk.nextNode(); n; n = walk.nextNode()) {
            if (LONG_UPPER.test(n.nodeValue)) n.nodeValue = n.nodeValue.replace(LONG_UPPER_ALL, (c) => c.toUpperCase().toLowerCase());
          }
        },
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
      zip.file('descripcion-tiktok.txt', captionNow());
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

  // Lo que hay dentro del carrusel (de las slides que han salido, en el orden pedido)
  function insideList(order) {
    const INSIDE = isEn()
      ? { crono: 'the minute by minute', stats: 'the stats', tiros: 'the shot map', onces: 'the line-ups', jugador: 'the player of the match', tabla: 'the table' }
      : { crono: 'el minuto a minuto', stats: 'las estadísticas', tiros: 'el mapa de tiros', onces: 'los onces', jugador: 'el mejor del partido', tabla: 'la clasificación' };
    const shown = new Set(slideDefs().map(d => d.id));
    return order.filter(id => shown.has(id)).map(id => INSIDE[id]);
  }

  // El pie de foto para Instagram (va en el ZIP y se copia al compartir).
  function generateCaption(m) {
    const c = compOf(m.league);
    const pens = pensWon(m) ? ` (${m.home.shootout}-${m.away.shootout} ${L('pen.', 'pens')})` : '';
    const goals = ['home', 'away'].map(s => scorerList(m, s).filter(x => !x.red).map(x => x.text).join(', ')).filter(Boolean);
    const best = bestPlayer(m);
    const dato = slideDefs().some(d => d.id === 'dato') && (writtenText('#slide-dato .dt-line') || datoFacts(m)[0]?.sentence);
    const tag = (t) => `#${t.short.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]/g, '')}`;
    const inside = insideList(['crono', 'stats', 'tiros', 'onces', 'tabla']);
    return `⚽ ${m.home.name.toUpperCase()} ${m.home.score}-${m.away.score} ${m.away.name.toUpperCase()}${pens}
${[compName(m.league), phaseOut(m.phase), legLabel(m), m.agg ? aggLabel(m.agg) : ''].filter(Boolean).join(' · ')} · ${fmtDateLong(m.date)}
${dato ? `\n📊 ${dato}` : ''}${goals.length ? `\n${L('Goles', 'Goals')}: ${goals.join(' · ')}` : ''}${best ? `\n${L('Jugador del partido', 'Player of the match')}: ${best.name}${afRating(m, best) != null ? ` (${fmtRating(afRating(m, best))})` : ''}` : ''}
${inside.length ? `\n${L('Desliza para ver', 'Swipe for')} ${listEs(inside)}.\n` : ''}
#${L('Futbol', 'Football')} #${c.tag} ${tag(m.home)} ${tag(m.away)}`;
  }

  // ----------------------------------------------------------
  // DESCRIPCIÓN PARA TIKTOK · corta, como la ponen las cuentas de fútbol en español que más
  // crecen: el gancho (el dato o el titular) con el resultado, el mejor del partido, la pregunta
  // del cierre (para que comenten) y 7 hashtags: los de fútbol en TikTok, la competición y los
  // dos equipos. Usa lo que esté escrito en las slides (los retoques).
  // ----------------------------------------------------------
  const TT_COMP = {
    'esp.1': 'laliga', 'esp.2': 'laligahypermotion', 'esp.copa_del_rey': 'copadelrey', 'esp.w.1': 'ligaf',
    'uefa.champions': 'championsleague', 'uefa.europa': 'europaleague', 'uefa.europa.conf': 'conferenceleague',
    'eng.1': 'premierleague', 'ita.1': 'seriea', 'ger.1': 'bundesliga', 'fra.1': 'ligue1',
    'fifa.world': 'mundial', 'uefa.euro': 'eurocopa', 'conmebol.libertadores': 'libertadores', 'mex.1': 'ligamx',
  };
  // Los clubes cuyo hashtag de siempre no es su nombre; el resto, su nombre sin espacios.
  const TT_TEAM = { 83: 'fcbarcelona', 1068: 'atleticodemadrid', 110: 'inter', 132: 'fcbayern', 160: 'psg' };
  const hashtag = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9]/g, '').toLowerCase();
  function tiktokCaption(m) {
    const dato = slideDefs().some(d => d.id === 'dato') ? datoFacts(m)[0] : null;
    const score = `${m.home.short} ${m.home.score}-${m.away.score} ${m.away.short}${pensWon(m) ? ` (${m.home.shootout}-${m.away.shootout} ${L('pen.', 'pens')})` : ''}`;
    // «4 años después» solo no dice de qué: esos datos llevan su frase corta, con quién y dónde (si
    // no has retocado la slide)
    const hook = dato
      ? `🤯 ${cap(dato.hook && !slideEdited('dato') ? dato.hook : `${writtenText('#slide-dato .dt-big') || dato.big} ${writtenText('#slide-dato .dt-unit') || dato.unit}`)}`
      : `⚽ ${writtenText('#slide-portada .head h1') || headline(m)}`;
    const best = bestPlayer(m);
    const rating = best ? afRating(m, best) : null;
    const star = best ? `⭐ ${best.name}${rating != null ? L(`, un ${fmtRating(rating)}`, `, rated ${fmtRating(rating)}`) : ''}` : '';
    const question = writtenText('#slide-cierre .q') || closingQuestion(m);
    const tags = [L('futbol', 'football'), TT_COMP[m.league] || hashtag(compOf(m.league).tag),
      ...[m.home, m.away].map(t => TT_TEAM[t.id] || hashtag(t.name)),
      ...(isEn() ? ['soccer', 'sportsontiktok', 'fyp'] : ['deportesentiktok', 'tiktokfootballacademy', 'parati'])];
    return [`${hook} · ${score}`, star, `${question} 👇`, [...new Set(tags)].map(t => `#${t}`).join(' ')].filter(Boolean).join('\n');
  }
  // El cuadro de la descripción: se rehace con cada cambio salvo que la hayas retocado tú.
  let captionEdited = false;
  function updateCaption(force = false) {
    const box = document.getElementById('captionBox');
    const m = state.rendered;
    box.hidden = !m;
    if (!m || (captionEdited && !force)) return;
    document.getElementById('captionText').value = tiktokCaption(m);
    captionEdited = false;
  }
  const captionNow = () => (state.rendered ? document.getElementById('captionText').value || tiktokCaption(state.rendered) : '');
  async function copyCaption() {
    try {
      await navigator.clipboard.writeText(captionNow());
      showToast('Descripción copiada: pégala en TikTok', 'success');
    } catch (e) {
      document.getElementById('captionText').select();
      showToast('Selecciónala y cópiala a mano: este navegador no deja copiar solo', 'error');
    }
  }

  // ----------------------------------------------------------
  // RESUMEN DE LA JORNADA · todos los resultados con sus goleadores, lo más destacado y la
  // clasificación, en un carrusel aparte (no toca el del partido).
  // ----------------------------------------------------------
  const JORNADA_STYLE = { bg: '#12151c', acc: '#c8f53c', on: '#111111' };
  const JORNADA_PER_SLIDE = 5;
  const jornada = { data: null, defs: [], seq: 0 };

  // La jornada del día elegido: sus partidos y los de los días de alrededor (hasta 4 días antes o
  // después) mientras ningún equipo repita, que es lo que separa una jornada de la siguiente
  // (ESPN no da el número de jornada).
  async function fetchJornada(league, iso) {
    const games = new Map(), teams = new Set();
    const add = (gs) => gs.forEach(g => { games.set(g.id, g); teams.add(g.home.id); teams.add(g.away.id); });
    // Los 4 días de antes y los 4 de después, a la vez; luego, hacia fuera desde el día elegido.
    const around = [-1, 1].map(dir => [1, 2, 3, 4].map(k => localIso(dir * k, asDate(iso))));
    const [mine, ...near] = await Promise.all([fetchGames(league, iso), ...around.flat().map(d => fetchGames(league, d).catch(() => []))]);
    add(mine);
    [near.slice(0, 4), near.slice(4)].forEach(side => {
      for (const gs of side) {
        if (gs.some(g => teams.has(g.home.id) || teams.has(g.away.id))) break;
        add(gs);
      }
    });
    const list = [...games.values()].filter(g => gamePhase(g) !== 'off').sort((a, b) => new Date(a.date) - new Date(b.date));
    const isos = list.map(g => localIso(0, new Date(g.date))).filter(Boolean).sort();
    let table = null;
    if (!KNOCKOUT.test(list[0]?.phase || '')) {
      try {
        const data = await espnFetch(`/${league}/standings`, ESPN_TABLES);
        const logos = Object.fromEntries(list.flatMap(g => [[g.home.id, g.home.logo], [g.away.id, g.away.logo]]));
        table = tableOf(data.children || (data.standings ? [data] : []), [...teams], league, logos);
      } catch (e) { /* sin clasificación: la slide no sale */ }
    }
    return { kind: 'jornada', league, lang: state.lang, day: iso, date: list[0]?.date || iso, from: isos[0] || iso, to: isos[isos.length - 1] || iso, games: list, table };
  }

  // «17 oct 2026», «17-20 oct 2026», «30 sep-2 oct 2026»
  function fmtRange(from, to) {
    const a = asDate(from), b = asDate(to);
    const mon = (d) => d.toLocaleDateString(outLocale(), { month: 'short' }).replace('.', '');
    if (from === to) return `${a.getDate()} ${mon(a)} ${a.getFullYear()}`;
    return a.getMonth() === b.getMonth()
      ? `${a.getDate()}-${b.getDate()} ${mon(b)} ${b.getFullYear()}`
      : `${a.getDate()} ${mon(a)}-${b.getDate()} ${mon(b)} ${b.getFullYear()}`;
  }
  // «A. Grimaldo 53' (p)» → «Grimaldo 53' (p)»
  const scorerShort = (txt) => txt.replace(/^[A-ZÀ-Ý]\.\s+/, '');

  // Lo más destacado: los goles, la mayor goleada, los dobletes y hat-tricks, el partido con más
  // goles y cómo han ido los locales y los visitantes.
  function jornadaFacts(j) {
    const done = j.games.filter(g => gamePhase(g) === 'final');
    const total = (g) => g.home.score + g.away.score;
    const margin = (g) => Math.abs(g.home.score - g.away.score);
    const goals = done.reduce((sum, g) => sum + total(g), 0);
    const line = (g) => `${g.home.short} ${g.home.score}-${g.away.score} ${g.away.short}`;
    const facts = [];
    const big = [...done].sort((a, b) => margin(b) - margin(a) || total(b) - total(a))[0];
    if (big && margin(big) >= 3) facts.push(`${L('La mayor goleada', 'Biggest win')}: ${line(big)}`);
    const multi = [];
    done.forEach(g => ['home', 'away'].forEach(side => {
      const count = new Map();
      g.scorers[side].filter(t => !/\((p\.p\.|og)\)/.test(t)).forEach(t => {
        const who = scorerShort(t).replace(/\s+\d.*$/, '').trim();
        count.set(who, (count.get(who) || 0) + 1);
      });
      count.forEach((n, who) => { if (n >= 2) multi.push({ who, n, team: g[side] }); });
    }));
    multi.sort((a, b) => b.n - a.n);
    const hat = multi.filter(x => x.n >= 3), dbl = multi.filter(x => x.n === 2);
    if (hat.length) facts.push(`${hat.length > 1 ? 'Hat-tricks' : 'Hat-trick'} ${L('de', 'for')} ${listEs(hat.map(x => `${x.who} (${x.team.short})`))}`);
    if (dbl.length && facts.length < 3) facts.push(`${dbl.length > 1 ? L('Dobletes', 'Braces') : L('Doblete', 'Brace')} ${L('de', 'for')} ${listEs(dbl.slice(0, 3).map(x => x.who))}`);
    const most = [...done].sort((a, b) => total(b) - total(a))[0];
    if (most && total(most) >= 5 && most !== big && facts.length < 3) facts.push(`${L('El partido con más goles', 'Highest-scoring game')}: ${line(most)}`);
    if (facts.length < 3 && done.length >= 3) {
      const h = done.filter(g => g.home.score > g.away.score).length, a = done.filter(g => g.away.score > g.home.score).length, d = done.length - h - a;
      facts.push(L(`${h} ${h === 1 ? 'victoria' : 'victorias'} en casa, ${d} ${d === 1 ? 'empate' : 'empates'} y ${a} fuera`,
        `${h} home ${h === 1 ? 'win' : 'wins'}, ${d} ${d === 1 ? 'draw' : 'draws'} and ${a} away ${a === 1 ? 'win' : 'wins'}`));
    }
    const pending = j.games.length - done.length;
    if (pending) facts.push(L(`${pending === 1 ? 'Queda 1 partido' : `Quedan ${pending} partidos`} por jugar`, `${pending === 1 ? '1 game' : `${pending} games`} still to play`));
    return { done, goals, facts: facts.slice(0, 4) };
  }

  // «31 goles en 9 partidos» · «31 goals in 9 games»
  const goalsIn = (f) => L(`${f.goals === 1 ? 'gol' : 'goles'} en ${f.done.length} ${f.done.length === 1 ? 'partido' : 'partidos'}`,
    `${f.goals === 1 ? 'goal' : 'goals'} in ${f.done.length} ${f.done.length === 1 ? 'game' : 'games'}`);
  const jWatermark = (j) => (compLogo(j.league, true) ? `<img class="jwm" src="${compLogo(j.league, true)}" alt="" crossorigin="anonymous" onerror="this.remove()"/>` : '');

  function tplJornadaPortada(j) {
    const f = jornadaFacts(j);
    const c = compOf(j.league);
    return `
      <div class="fc-in" style="${styleVars(teamStyle(JORNADA_STYLE))}">
        ${artTag(nightArt(null, null))}
        ${jWatermark(j)}
        <div class="jt-comp">${compLogo(j.league, true) ? `<img src="${compLogo(j.league, true)}" alt="" crossorigin="anonymous" onerror="this.remove()"/>` : ''}<span>${esc(compName(j.league))}</span></div>
        <h1 class="jt-title">${L('Así fue<br>la jornada', 'Matchday<br>round-up')}</h1>
        <div class="jt-dates">${esc(fmtRange(j.from, j.to))}</div>
        <div class="jt-big"><span class="n">${f.goals}</span><span class="l">${goalsIn(f)}</span></div>
        <div class="jt-facts">${f.facts.map(x => `<div>${esc(x)}</div>`).join('')}</div>
        ${foot(j)}${grain}
      </div>`;
  }

  function tplJornadaResultados(j, games, page, pages) {
    const cell = (g) => {
      const ph = gamePhase(g);
      if (ph === 'pre') return `<div class="jr-score pre">${esc(cap(asDate(g.date).toLocaleDateString(outLocale(), { weekday: 'short' }).replace('.', '')))} ${fmtTime(g.date)}</div>`;
      const pens = g.home.shootout != null && g.away.shootout != null ? `<small>${g.home.shootout}-${g.away.shootout} ${L('pen.', 'pens')}</small>` : '';
      const now = ph === 'live' ? `<small class="now">${esc(minuteText(g.status.clock))}</small>` : '';
      return `<div class="jr-score ${ph}"><b>${g.home.score}-${g.away.score}</b>${pens}${now}</div>`;
    };
    const team = (g, side) => {
      const t = g[side], o = g[side === 'home' ? 'away' : 'home'];
      const lost = gamePhase(g) === 'final' && (t.score < o.score || (t.score === o.score && t.shootout != null && t.shootout < o.shootout));
      return `<div class="jr-team ${side === 'home' ? 'l' : 'r'}${lost ? ' lost' : ''}">${logoTag(t, 'lg')}<span class="nm">${esc(t.short)}</span></div>`;
    };
    return `
      <div class="${sheetCls()}">
        ${artTag(sheetArt(null, null))}
        <h1 class="title">${L('Resultados', 'Results')}</h1>
        <div class="jr-sub">${esc(compName(j.league))} · ${esc(fmtRange(j.from, j.to))}${pages > 1 ? ` · ${page + 1}/${pages}` : ''}</div>
        <div class="jr-list">
          ${games.map(g => `
            <div class="jr-row">
              ${team(g, 'home')}${cell(g)}${team(g, 'away')}
              <div class="jr-sc l">${esc(g.scorers.home.map(scorerShort).join(', '))}</div>
              <div class="jr-sc r">${esc(g.scorers.away.map(scorerShort).join(', '))}</div>
            </div>`).join('')}
        </div>
        ${foot(j)}${grain}
      </div>`;
  }

  function tplJornadaTabla(j, rows, page, pages) {
    const what = isEn() ? compName(j.league) : TABLE_NAMES[j.league] || compOf(j.league).name;
    const playing = new Set(j.games.flatMap(g => [g.home.id, g.away.id]));
    const h = Math.min(66, Math.floor(930 / (rows.length + 1)));
    return `
      <div class="${sheetCls()}">
        ${artTag(sheetArt(null, null))}
        <h1 class="title" style="font-size:${what.length > 16 ? 76 : 88}px">${tableTitle(what, true)}</h1>
        <div class="jt-tbl" style="--rh:${h}px">
          <div class="row head"><span class="rk">#</span><span></span><span>${L('Equipo', 'Team')}${pages > 1 ? ` · ${page + 1}/${pages}` : ''}</span><span class="c">${L('PJ', 'P')}</span><span class="c">${L('DG', 'GD')}</span><span class="pts">Pts</span></div>
          ${rows.map(r => {
            const gd = r.gd == null ? '' : r.gd > 0 ? `+${r.gd}` : `${r.gd}`;
            return `
            <div class="row${playing.has(r.id) ? '' : ' rest'}" style="--z:${r.zone || 'transparent'}">
              <span class="rk">${r.rank}</span>
              <img class="lg" src="${r.logo}" alt="" crossorigin="anonymous" onerror="this.style.visibility='hidden'"/>
              <span class="tn">${esc(r.name)}</span>
              <span class="c">${r.gp ?? ''}</span>
              <span class="c">${gd}</span>
              <span class="pts">${r.pts ?? ''}</span>
            </div>`;
          }).join('')}
        </div>
        ${foot(j)}${grain}
      </div>`;
  }

  function tplJornadaCierre(j) {
    return `
      <div class="fc-in" style="${styleVars(teamStyle(JORNADA_STYLE))}">
        ${artTag(nightArt(null, null))}
        ${jWatermark(j)}
        <div class="fade"></div>
        <div class="qwrap"><h1 class="q">${L('¿Cuál fue el partido de la jornada?', 'What was your game of the round?')}</h1><div class="sub">${L('Te leo en comentarios', 'Let me know in the comments')}</div></div>
        <div class="handle">
          ${brandTag('brand-big')}
          <span class="fc-chip">${L('Sígueme para más fútbol', 'Follow for more football')}</span>
          <div class="h fc-sign" data-noedit>${esc(state.sign)}</div>
        </div>
        ${grain}
      </div>`;
  }

  function jornadaDefs(j) {
    const pages = [];
    for (let i = 0; i < j.games.length; i += JORNADA_PER_SLIDE) pages.push(j.games.slice(i, i + JORNADA_PER_SLIDE));
    const rows = j.table?.rows || [];
    const half = Math.ceil(rows.length / 2);
    const tables = rows.length < 4 ? [] : rows.length > 20 ? [rows.slice(0, half), rows.slice(half)] : [rows];
    return [
      { id: 'j-portada', name: 'Portada', cls: 'fc fc-jportada', html: () => tplJornadaPortada(j) },
      ...pages.map((p, i) => ({ id: `j-resultados-${i + 1}`, name: pages.length > 1 ? `Resultados ${i + 1}/${pages.length}` : 'Resultados', cls: 'fc fc-jresultados', html: () => tplJornadaResultados(j, p, i, pages.length) })),
      ...tables.map((r, i) => ({ id: `j-tabla-${i + 1}`, name: tables.length > 1 ? `Clasificación ${i + 1}/${tables.length}` : 'Clasificación', cls: 'fc fc-jtabla', html: () => tplJornadaTabla(j, r, i, tables.length) })),
      { id: 'j-cierre', name: 'Cierre', cls: 'fc fc-cierre', html: () => tplJornadaCierre(j) },
    ];
  }

  const jornadaStamp = (j) => `jornada-${j.league.replace(/\./g, '-')}-${j.from}`;
  const jornadaPng = (def, i) => `futbol-${jornadaStamp(jornada.data)}-${String(i + 1).padStart(2, '0')}-${def.id.replace(/^j-/, '')}.png`;

  function renderJornada() {
    const j = jornada.data;
    const preview = document.getElementById('jornadaPreview');
    jornada.defs = jornadaDefs(j);
    preview.innerHTML = jornada.defs.map((def, i) => `
      <div class="slide-wrap" data-slide-id="${def.id}">
        <div class="slide-label">
          <span class="slide-label-name">${i + 1} · ${def.name}</span>
          <button class="slide-reset-btn" type="button" title="Deshacer los cambios de esta slide">↺ original</button>
        </div>
        <div class="slide-preview-wrap">
          <div class="ab slide ${def.cls}" id="slide-${def.id}">${def.html()}</div>
          ${ZOOM_BTN}
        </div>
        <div class="slide-foot">
          <button class="slide-dl-btn" data-jornada-dl="${i}" aria-label="Descargar ${def.name} como PNG">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/>
            </svg>
            descargar PNG
          </button>
        </div>
      </div>`).join('');
    preview.querySelectorAll('.slide').forEach(makeSlideEditable);
    const f = jornadaFacts(j);
    document.getElementById('jornadaInfo').textContent = `${compOf(j.league).name} · ${fmtRange(j.from, j.to)} · ${j.games.length} partidos${f.done.length < j.games.length ? ` (${f.done.length} acabados)` : ''}${j.table ? '' : ' · sin clasificación'}`;
    const section = document.getElementById('jornadaSection');
    section.hidden = false;
    setTimeout(scaleSlides, 50);
  }

  async function generateJornada() {
    const btn = document.getElementById('jornadaBtn');
    const seq = ++jornada.seq;
    btn.disabled = true;
    btn.classList.add('btn-loading');
    try {
      const j = await fetchJornada(state.league, state.selectedDate || localIso());
      if (seq !== jornada.seq) return;
      if (!j.games.length) return showToast('No hay partidos en esta jornada', 'error');
      jornada.data = j;
      renderJornada();
      document.getElementById('jornadaSection').scrollIntoView({ behavior: 'smooth', block: 'start' });
      showToast('Resumen de la jornada listo · revísalo y descárgalo', 'success');
    } catch (e) {
      console.error(e);
      showToast(`No se pudo hacer el resumen: ${e.message}`, 'error');
    } finally {
      btn.disabled = false;
      btn.classList.remove('btn-loading');
    }
  }

  // El pie de foto: los resultados uno por línea, los goles y los hashtags.
  function jornadaCaption(j) {
    const c = compOf(j.league);
    const f = jornadaFacts(j);
    const res = j.games.map(g => (gamePhase(g) === 'pre'
      ? `${g.home.short} - ${g.away.short} (${cap(asDate(g.date).toLocaleDateString(outLocale(), { weekday: 'long' }))}, ${fmtTime(g.date)})`
      : `${g.home.short} ${g.home.score}-${g.away.score} ${g.away.short}`));
    return `⚽ ${L('RESULTADOS', 'RESULTS')} · ${compName(j.league).toUpperCase()} · ${fmtRange(j.from, j.to)}

${res.join('\n')}

${f.goals} ${goalsIn(f)}.${f.facts.length ? `\n${f.facts.join('.\n')}.` : ''}

${L('¿Cuál fue el partido de la jornada?', 'What was your game of the round?')} 👇

#${L('Futbol', 'Football')} #${c.tag}`;
  }

  async function downloadJornada(vertical = false) {
    const j = jornada.data;
    if (!j || !lockCapture()) return;
    const btn = document.getElementById(vertical ? 'jornadaZipVBtn' : 'jornadaZipBtn');
    btn.disabled = true;
    btn.classList.add('btn-loading');
    showToast('Renderizando slides… (10-30s)');
    try {
      const zip = new JSZip();
      for (let i = 0; i < jornada.defs.length; i++) {
        const el = document.getElementById(`slide-${jornada.defs[i].id}`);
        if (!el) continue;
        const canvas = await captureCanvas(el);
        zip.file(jornadaPng(jornada.defs[i], i), await new Promise(r => (vertical ? toVertical(canvas) : canvas).toBlob(r, 'image/png')));
      }
      zip.file('caption.txt', jornadaCaption(j));
      triggerDownload(await zip.generateAsync({ type: 'blob' }), `futbol-${jornadaStamp(j)}${vertical ? '-9x16' : ''}.zip`);
      showToast(vertical ? 'Jornada 9:16 descargada · lista para TikTok' : 'Jornada descargada · sube las PNG a IG', 'success');
    } catch (e) {
      console.error(e);
      showToast(`Error descargando: ${e.message}`, 'error');
    } finally {
      btn.disabled = false;
      btn.classList.remove('btn-loading');
      unlockCapture();
    }
  }

  async function downloadJornadaSlide(i, btn) {
    const def = jornada.defs[i];
    const el = def && document.getElementById(`slide-${def.id}`);
    if (!el || !lockCapture()) return;
    btn.disabled = true;
    try {
      triggerDownload(await captureSlide(el), jornadaPng(def, i));
    } catch (e) {
      console.error(e);
      showToast(`Error: ${e.message}`, 'error');
    } finally {
      btn.disabled = false;
      unlockCapture();
    }
  }

  function setupJornada() {
    document.getElementById('jornadaBtn').addEventListener('click', generateJornada);
    document.getElementById('jornadaZipBtn').addEventListener('click', () => downloadJornada());
    document.getElementById('jornadaZipVBtn').addEventListener('click', () => downloadJornada(true));
    document.getElementById('jornadaCloseBtn').addEventListener('click', () => {
      document.getElementById('jornadaSection').hidden = true;
      document.getElementById('jornadaPreview').innerHTML = '';
      jornada.data = null;
    });
    const preview = document.getElementById('jornadaPreview');
    preview.addEventListener('click', (e) => {
      const dl = e.target.closest('[data-jornada-dl]');
      if (dl) downloadJornadaSlide(Number(dl.dataset.jornadaDl), dl);
      const reset = e.target.closest('.slide-reset-btn');
      if (reset) {
        const wrap = reset.closest('.slide-wrap');
        const slide = wrap.querySelector('.slide');
        slide.innerHTML = originalSlides.get(slide);
        applySign(slide);
        applyBrand(slide);
        wrap.classList.remove('edited');
      }
    });
    preview.addEventListener('input', (e) => { if (e.target.isContentEditable) e.target.closest('.slide-wrap')?.classList.add('edited'); });
    preview.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && e.target.isContentEditable) {
        e.preventDefault();
        document.execCommand('insertLineBreak');
      }
    });
  }

  // ----------------------------------------------------------
  // EN DIRECTO · vigila las competiciones que elijas: los partidos de hoy y cómo van. Cuando
  // acaba uno, avisa (en la pestaña, con un sonido y, si el navegador deja, una notificación)
  // y queda a un clic de generarlo.
  // ----------------------------------------------------------
  const LIVE_KEY = 'fc-live';
  const LIVE_EVERY = 60000; // cada minuto (con la pestaña en segundo plano, Chrome no deja menos)
  const LIVE_SHOWN = 8;     // los que se ven sin pulsar «Ver los N partidos»
  const directo = {
    on: false,
    leagues: ['esp.1', 'uefa.champions', 'eng.1'],
    games: [],
    phases: new Map(),   // id → final · live · pre · off, de la última vuelta
    fresh: new Set(),    // los que acaban de terminar y aún no has abierto
    all: false,          // ver todos los partidos o solo los primeros
    checked: null,       // cuándo se miró ESPN por última vez
    failed: false,
    timer: null,
    seq: 0,
    audio: null,
    title: '',
  };

  function loadDirecto() {
    try {
      const saved = JSON.parse(localStorage.getItem(LIVE_KEY) || 'null');
      if (saved) {
        directo.on = !!saved.on;
        directo.leagues = (saved.leagues || []).filter(l => COMP[l]);
      }
    } catch (e) { /* sin almacenamiento: lo de por defecto */ }
  }
  function saveDirecto() {
    try { localStorage.setItem(LIVE_KEY, JSON.stringify({ on: directo.on, leagues: directo.leagues })); } catch (e) { /* no se recuerda */ }
  }

  // Los días que mirar: hoy y, de madrugada, también ayer (los partidos de América acaban pasada
  // la medianoche en España y ESPN los cuenta en el día anterior).
  const directoDays = () => (new Date().getHours() < 10 ? [localIso(-1), localIso()] : [localIso()]);

  async function pollDirecto() {
    if (!directo.on) return;
    const seq = ++directo.seq;
    const jobs = directo.leagues.flatMap(league => directoDays().map(day =>
      fetchGames(league, day).then(gs => gs.map(g => ({ ...g, day }))).catch(() => null)));
    const results = await Promise.all(jobs);
    if (seq !== directo.seq || !directo.on) return;
    const byId = new Map();
    results.filter(Boolean).flat().forEach(g => byId.set(g.id, g));
    const games = [...byId.values()];
    // En la primera vuelta no se avisa de nada: lo que ya había acabado, ya estaba.
    const first = directo.checked === null;
    const ended = [];
    for (const g of games) {
      const ph = gamePhase(g);
      const before = directo.phases.get(g.id);
      if (!first && ph === 'final' && before && before !== 'final') ended.push(g);
      directo.phases.set(g.id, ph);
    }
    ended.forEach(g => directo.fresh.add(g.id));
    directo.games = games;
    directo.failed = results.some(r => r === null);
    directo.checked = new Date();
    renderDirecto();
    if (ended.length) announceEnded(ended);
  }

  const scoreText = (g) => `${g.home.short} ${g.home.score}-${g.away.score} ${g.away.short}`;

  // Dos notas cortas (el sonido se prepara al activar «Vigilar», que es un toque tuyo).
  function chime() {
    const ac = directo.audio;
    if (!ac) return;
    ac.resume?.().catch(() => {});
    [[880, 0], [1320, 0.16]].forEach(([f, at]) => {
      const o = ac.createOscillator(), gn = ac.createGain();
      o.frequency.value = f;
      gn.gain.setValueAtTime(0.0001, ac.currentTime + at);
      gn.gain.exponentialRampToValueAtTime(0.18, ac.currentTime + at + 0.02);
      gn.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + at + 0.22);
      o.connect(gn).connect(ac.destination);
      o.start(ac.currentTime + at);
      o.stop(ac.currentTime + at + 0.25);
    });
  }

  function announceEnded(ended) {
    showToast(`Final: ${ended.map(scoreText).join(' · ')}. Listo para generar.`, 'success', true);
    document.title = `(${directo.fresh.size}) Final · ${scoreText(ended[0])}`;
    chime();
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      ended.forEach(g => {
        try {
          const n = new Notification(`Final: ${scoreText(g)}`, { body: `${compOf(g.league).name} · listo para generar`, icon: 'favicon.svg', tag: g.id });
          n.onclick = () => { window.focus(); n.close(); openFromDirecto(g.id); };
        } catch (e) { /* sin notificaciones: queda el aviso de la pestaña */ }
      });
    }
  }

  // Del panel al carrusel: la competición, el día, el partido y generar.
  async function openFromDirecto(id) {
    const g = directo.games.find(x => x.id === id);
    if (!g || state.generating) return;
    directo.fresh.delete(id);
    if (!directo.fresh.size) document.title = directo.title;
    renderDirecto();
    markLeague(g.league);
    await goToDate(g.day);
    if (!state.games.some(x => x.id === id)) return showToast('ESPN ya no da ese partido en la lista de su día', 'error');
    await generateAll(id);
  }

  // Todo de una vez: el carrusel y, en cuanto está, el vídeo (con la descripción para TikTok
  // ya escrita). Lo usan «Generar →» del directo y el enlace del pitido final.
  async function generateAll(id) {
    selectGame(id);
    await generateCarousel();
    if (state.rendered?.id !== id) return;
    document.getElementById('slidesPreview').scrollIntoView({ behavior: 'smooth', block: 'start' });
    await makeVideo();
    if (state.rendered?.id === id && !document.getElementById('videoOut').hidden) {
      document.getElementById('videoOut').scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  // ─── Al pitido final: un enlace que lo hace todo solo ───
  // ?partido=esp.1/401882846 (y &dia=2026-10-17 si no es de hoy ni de ayer): elige la
  // competición, busca el partido, genera el carrusel y crea el vídeo. Es el enlace del aviso
  // al móvil cuando acaba un partido.
  async function openFromLink(params) {
    const [league, id] = (params.get('partido') || '').split('/');
    if (!COMP[league] || !/^\d+$/.test(id || '')) return false;
    // Que al recargar (o volver a abrir la pestaña) no lo repita.
    history.replaceState(null, '', location.pathname);
    const day = /^\d{4}-\d{2}-\d{2}$/.test(params.get('dia') || '') ? params.get('dia') : null;
    markLeague(league);
    for (const iso of day ? [day] : [localIso(), localIso(-1)]) {
      await goToDate(iso);
      if (state.games.some(g => g.id === id)) break;
    }
    if (!state.games.some(g => g.id === id)) {
      showToast('ESPN no da ese partido ni hoy ni ayer', 'error');
      return true;
    }
    await generateAll(id);
    return true;
  }

  function renderDirecto() {
    const sub = document.getElementById('liveSub');
    const leaguesBox = document.getElementById('liveLeagues');
    const list = document.getElementById('liveList');
    document.getElementById('liveToggle').checked = directo.on;
    document.getElementById('liveRefresh').hidden = !directo.on;

    // Las competiciones que se vigilan (con × para quitarlas) y un desplegable para añadir
    const others = COMPETITIONS.map(g => ({ ...g, items: g.items.filter(([slug]) => !directo.leagues.includes(slug)) })).filter(g => g.items.length);
    leaguesBox.innerHTML = `
      ${directo.leagues.map(slug => `
        <span class="live-league">${compLogo(slug, true) ? `<img src="${compLogo(slug, true)}" alt="" onerror="this.remove()"/>` : ''}${esc(compOf(slug).chip)}
          <button type="button" data-drop="${slug}" aria-label="Dejar de vigilar ${esc(compOf(slug).name)}">×</button></span>`).join('')}
      ${others.length ? `<select class="live-add" aria-label="Vigilar otra competición">
        <option value="">+ Añadir competición</option>
        ${others.map(g => `<optgroup label="${esc(g.group)}">${g.items.map(([slug, chip]) => `<option value="${slug}">${esc(chip)}</option>`).join('')}</optgroup>`).join('')}
      </select>` : ''}`;

    const hhmm = (d) => d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    if (!directo.on) {
      sub.textContent = 'Elige qué competiciones vigilar y activa «Vigilar»: el Studio mira ESPN cada minuto y, cuando acaba un partido, te avisa y lo tienes a un clic. Deja la pestaña abierta.';
      list.innerHTML = '';
      return;
    }
    sub.textContent = !directo.checked ? 'Mirando ESPN…'
      : `Vigilando: mira ESPN cada minuto (última vez, a las ${hhmm(directo.checked)})${directo.failed ? '. ESPN no ha respondido en alguna competición: se reintenta solo' : ''}.`;
    if (!directo.leagues.length) {
      list.innerHTML = '<div class="games-empty">Añade alguna competición para vigilarla.</div>';
      return;
    }
    if (!directo.checked) {
      list.innerHTML = '<div class="games-empty"><span class="loader"></span> Cargando los partidos de hoy…</div>';
      return;
    }
    if (!directo.games.length) {
      list.innerHTML = '<div class="games-empty">Hoy no juega ninguna de las competiciones que vigilas.</div>';
      return;
    }
    // Primero lo que se juega, luego lo que acaba de terminar, lo que falta y lo ya acabado.
    const rank = (g) => (directo.fresh.has(g.id) ? 0 : { live: 1, pre: 2, final: 3, off: 4 }[gamePhase(g)]);
    const sorted = [...directo.games].sort((a, b) => rank(a) - rank(b) || (rank(a) === 3 ? new Date(b.date) - new Date(a.date) : new Date(a.date) - new Date(b.date)));
    // Con muchos partidos, los 8 primeros (lo que se juega y lo recién acabado van siempre delante)
    const games = directo.all ? sorted : sorted.slice(0, LIVE_SHOWN);
    const more = sorted.length > LIVE_SHOWN
      ? `<button class="slide-reset-btn live-more" type="button" data-more>${directo.all ? 'Ver menos' : `Ver los ${sorted.length} partidos`}</button>` : '';
    list.innerHTML = games.map(g => {
      const ph = gamePhase(g);
      const started = ph === 'final' || ph === 'live';
      const row = (t, o) => `
        <div class="live-team${ph === 'final' && t.score < o.score ? ' lost' : ''}">
          <img src="${t.logo}" alt="" onerror="this.style.opacity=0"/><span>${esc(t.short)}</span><b>${started ? t.score : ''}</b>
        </div>`;
      const fresh = directo.fresh.has(g.id);
      const btn = ph === 'final' ? `<button class="btn btn-primary live-go" type="button" data-open="${g.id}">Generar →</button>`
        : ph === 'live' ? `<button class="btn btn-ghost live-go" type="button" data-open="${g.id}">Generar ya</button>` : '';
      return `
        <div class="live-card ${ph}${fresh ? ' fresh' : ''}" data-game-id="${g.id}">
          <div class="live-top">
            ${compLogo(g.league, true) ? `<img src="${compLogo(g.league, true)}" alt="" onerror="this.remove()"/>` : ''}
            <span class="live-comp">${esc(compOf(g.league).chip)}</span>
            ${fresh ? '<span class="live-new">Nuevo</span>' : ''}
            <span class="game-status ${ph}">${statusLabel(g)}</span>
          </div>
          ${row(g.home, g.away)}${row(g.away, g.home)}
          ${btn}
        </div>`;
    }).join('') + more;
  }

  function startDirecto() {
    clearInterval(directo.timer);
    directo.timer = null;
    if (!directo.on) return;
    directo.timer = setInterval(pollDirecto, LIVE_EVERY);
    pollDirecto();
  }

  function setupDirecto() {
    directo.title = document.title;
    loadDirecto();
    const toggle = document.getElementById('liveToggle');
    toggle.addEventListener('change', () => {
      directo.on = toggle.checked;
      if (directo.on) {
        // Al activarlo (un toque tuyo) se prepara el sonido y se pide permiso para avisar.
        try { directo.audio ||= new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { /* sin sonido */ }
        if (typeof Notification !== 'undefined' && Notification.permission === 'default') Notification.requestPermission().catch(() => {});
      } else {
        directo.checked = null;
        directo.phases.clear();
        directo.fresh.clear();
        document.title = directo.title;
      }
      saveDirecto();
      renderDirecto();
      startDirecto();
    });
    document.getElementById('liveRefresh').addEventListener('click', pollDirecto);
    const box = document.getElementById('liveLeagues');
    box.addEventListener('click', (e) => {
      const drop = e.target.closest('[data-drop]')?.dataset.drop;
      if (!drop) return;
      directo.leagues = directo.leagues.filter(l => l !== drop);
      directo.games = directo.games.filter(g => g.league !== drop);
      saveDirecto();
      renderDirecto();
    });
    box.addEventListener('change', (e) => {
      const add = e.target.closest('.live-add')?.value;
      if (!add || directo.leagues.includes(add)) return;
      directo.leagues.push(add);
      saveDirecto();
      renderDirecto();
      pollDirecto();
    });
    document.getElementById('liveList').addEventListener('click', (e) => {
      if (e.target.closest('[data-more]')) {
        directo.all = !directo.all;
        renderDirecto();
        return;
      }
      const id = e.target.closest('[data-open]')?.dataset.open;
      if (id) openFromDirecto(id);
    });
    // Al volver a la pestaña: el título normal y, si hace rato que no mira, una vuelta ya.
    window.addEventListener('focus', () => { if (!directo.fresh.size) document.title = directo.title; });
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && directo.on && directo.checked && Date.now() - directo.checked > LIVE_EVERY / 2) pollDirecto();
    });
    renderDirecto();
    startDirecto();
  }

  // ----------------------------------------------------------
  // INIT
  // ----------------------------------------------------------
  function init() {
    try {
      const saved = localStorage.getItem(LEAGUE_KEY);
      if (COMP[saved]) state.league = saved;
      state.sign = localStorage.getItem(SIGN_KEY) ?? DEFAULT_SIGN;
      const brand = localStorage.getItem(BRAND_KEY);
      state.brandLogo = brand || '';
      if (brand === null) loadDefaultBrand();
      if (localStorage.getItem(LANG_KEY) === 'en') state.lang = 'en';
      if (localStorage.getItem(THEME_KEY) === 'oscuro') state.theme = 'oscuro';
    } catch (e) { /* sin almacenamiento: los valores por defecto */ }
    renderCompPicker();
    setupDirecto();
    setupJornada();
    const signInput = document.getElementById('signInput');
    signInput.value = state.sign;
    signInput.addEventListener('input', onSignInput);
    updateBrandUi();
    updateLangUi();
    updateThemeUi();
    document.querySelector('.lang-switch:not(.theme-switch)').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-lang]');
      if (btn) setLang(btn.dataset.lang);
    });
    document.querySelector('.theme-switch').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-theme]');
      if (btn) setTheme(btn.dataset.theme);
    });
    document.getElementById('brandInput').addEventListener('change', (e) => { onBrandFile(e.target.files[0]); e.target.value = ''; });
    document.getElementById('brandDel').addEventListener('click', () => setBrand(''));
    const afInput = document.getElementById('afKeyInput');
    afInput.value = afKey();
    afInput.addEventListener('input', () => {
      try { localStorage.setItem(AF_KEY, afInput.value.trim()); } catch (e) { /* sin almacenamiento: no se recuerda */ }
      afCache.clear();
    });
    document.getElementById('captionCopyBtn').addEventListener('click', copyCaption);
    document.getElementById('captionText').addEventListener('input', () => { captionEdited = true; });

    // Por defecto, hoy (en fútbol se juega de tarde y de noche en España).
    const today = localIso();
    const dateInput = document.getElementById('dateInput');
    dateInput.value = today;
    markPreset(today);
    dateInput.addEventListener('change', () => {
      if (!dateInput.value) return;
      markPreset(dateInput.value);
      loadGames(dateInput.value);
    });
    document.querySelectorAll('.date-preset').forEach(btn => {
      btn.addEventListener('click', () => goToDate(localIso(Number(btn.dataset.offset))));
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
    ['musicVol', 'videoMusic', 'videoIntro', 'videoSubs'].forEach(id => document.getElementById(id).addEventListener('input', mixChanged));
    document.getElementById('musicStyle').addEventListener('click', (e) => {
      const btn = e.target.closest('.lang-opt[data-music]');
      if (!btn || btn.disabled || btn.dataset.music === musicStyle()) return;
      setMusicStyle(btn.dataset.music);
      mixChanged();
    });
    document.getElementById('mixResetBtn').addEventListener('click', resetMix);
    document.getElementById('mixPreviewBtn').addEventListener('click', previewMix);
    loadMix();
    updateVideoBtn();

    // Para tu IA: copiar el contexto y pegar la respuesta (en el mismo clic de «Colocar»)
    document.getElementById('aiBriefBtn').addEventListener('click', copyAiBrief);
    document.getElementById('aiPasteBtn').addEventListener('click', openAiPaste);
    document.querySelector('#aiPasteDialog form').addEventListener('submit', (e) => {
      if (e.submitter?.value === 'ok') applyAiReply(document.getElementById('aiPasteText').value);
    });

    const preview = document.getElementById('slidesPreview');
    setupSlideEditing(preview);
    setupPhotoSwap(preview);
    setupZoom();

    const params = new URLSearchParams(location.search);
    if (params.has('partido')) {
      openFromLink(params).then(done => { if (!done) { loadGames(today); restoreDraft(); } });
    } else {
      loadGames(today);
      restoreDraft();
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
