"""De dónde salen los datos. Solo biblioteca estándar (urllib), para que funcione en cualquier sitio.

- Eduardo Losilla (api.eduardolosilla.es): los 15 partidos de cada jornada con su resultado, lo que
  apostó la gente (% LAE), los premios y acertantes, y su «probabilidad real». Histórico desde 2012.
- ESPN: las cuotas de las casas (DraftKings) para los partidos que aún no se han jugado.

La temporada de Losilla es el año en que acaba: 2027 = 2026/27.
"""
import json, re, time, unicodedata, urllib.request, urllib.error
from datetime import date, timedelta
from difflib import SequenceMatcher
from xml.etree import ElementTree

UA = {'User-Agent': 'Mozilla/5.0 (jornada90 quiniela)', 'Accept': 'application/json, text/xml'}
LOSILLA = 'https://api.eduardolosilla.es'
ESPN = 'https://site.api.espn.com/apis/site/v2/sports/soccer'


def get(url, tries=3):
    for i in range(tries):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=30) as r:
                return r.read()
        except urllib.error.HTTPError as e:
            if e.code in (400, 404): return None
            err = e
        except Exception as e:  # red, proxy
            err = e
        time.sleep(1 + 2 * i)
    raise err


def get_json(url):
    b = get(url)
    if not b: return None
    try: return json.loads(b)
    except ValueError: return None


# ---------------------------------------------------------------- Losilla
def escrutinio(jornada, temporada):
    """Partidos (con resultado y % del público si ya existen), premios y acertantes de una jornada."""
    d = get_json(f'{LOSILLA}/escrutinios?num_jornada={jornada}&num_temporada={temporada}')
    if not d or not d.get('partidos'): return None
    return d


def _xml_porcentajes(path, jornada, temporada):
    b = get(f'{LOSILLA}/servicios/v1/{path}?jornada={jornada}&temporada={temporada}')
    if not b: return {}
    try: root = ElementTree.fromstring(b)
    except ElementTree.ParseError: return {}
    out = {}
    for p in root.iter('partido'):
        a = p.attrib
        k = [a.get(f'porcDec_{s}') or a.get(f'porc_{s}') for s in '1X2']
        if all(x not in (None, '') for x in k):
            out[int(a['num'])] = [float(x) / 100 for x in k]
    return out


def probabilidad_losilla(jornada, temporada):
    """La «probabilidad real» que publica Losilla antes de la jornada (calculada por ellos)."""
    return _xml_porcentajes('probabilidad_real', jornada, temporada)


def goles_p15_losilla(jornada, temporada):
    """Pleno al 15 según Losilla: probabilidad de que cada equipo marque 0, 1, 2 o M (3 o más)."""
    b = get(f'{LOSILLA}/servicios/v1/probabilidad_real?jornada={jornada}&temporada={temporada}')
    try: root = ElementTree.fromstring(b or b'')
    except ElementTree.ParseError: return None
    for p in root.iter('partido'):
        a = p.attrib
        if a.get('num') != '15': continue
        try:
            return {lado: [float(a.get(f'porcDec_15{lado}_{g}') or a[f'porc_15{lado}_{g}']) / 100 for g in '012M'] for lado in 'LV'}
        except (KeyError, ValueError):
            return None
    return None


def publico(jornada, temporada):
    """Lo que está apostando la gente (estimación oficial de LAE)."""
    return _xml_porcentajes('porcentajes_lae', jornada, temporada)


def jornada_compacta(d, prob_losilla):
    """Lo que guardamos de cada jornada en el histórico."""
    ps = []
    for p in d['partidos']:
        n = p['num']
        r = dict(n=n, local=p['local'], visitante=p['visitante'], div=p.get('division'), dia=p.get('dia'),
                 res=p.get('resultado'), signo=p.get('signo') or None)
        if n == 15: r['goles'] = p.get('signo_goles') or None
        if p.get('porcentaje1') is not None:
            r['pub'] = [p['porcentaje1'] / 100, p['porcentajeX'] / 100, p['porcentaje2'] / 100]
        if n in prob_losilla: r['los'] = [round(x, 4) for x in prob_losilla[n]]
        ps.append(r)
    return dict(temporada=d['temporada'], jornada=int(d['jornada']), fecha=d.get('fecha_jornada'),
                recaudacion=d.get('recaudacion'), bote=d.get('bote'), estado=d.get('estado'),
                orden_real=d.get('orden_posicion_real'), acertantes=d.get('acertantes'), partidos=ps)


# ---------------------------------------------------------------- ESPN (cuotas)
LIGAS = ['esp.1', 'esp.2', 'esp.w.1', 'esp.copa_del_rey', 'uefa.champions', 'uefa.europa', 'uefa.europa.conf',
         'eng.1', 'eng.2', 'ita.1', 'ger.1', 'fra.1', 'por.1', 'ned.1', 'uefa.nations', 'fifa.worldq.uefa', 'fifa.friendly']

ALIAS = {  # cómo escribe Losilla → cómo escribe ESPN (palabras sueltas, ya sin acentos)
    'at': 'atletico', 'ath': 'athletic', 'man': 'manchester', 'r': 'real', 'b': '', 'ol': '',
    'atenas': 'athens', 'praga': 'prague', 'oporto': 'porto', 'lisboa': 'lisbon', 'munich': 'munich',
    'psg': 'paris saint germain', 'inter': 'internazionale', 'bodo': 'bodo', 'glimt': 'glimt', 'losc': 'lille',
    'union': 'union', 'sg': 'st gilloise', 'leverkusen': 'leverkusen', 'napoles': 'napoli', 'milan': 'milan',
    'brujas': 'brugge', 'estrella': 'crvena', 'roja': 'zvezda', 'racing s': 'racing santander', 'celta': 'celta vigo',
    'rayo': 'rayo vallecano', 'sevilla': 'sevilla', 'espanyol': 'espanyol', 'deportivo': 'deportivo la coruna',
    'gijon': 'gijon', 'dinamo': 'dinamo', 'z': 'zagreb', 'eintracht': 'eintracht', 'fra': 'frankfurt',
}
RUIDO = {'fc', 'cf', 'club', 'sc', 'ac', 'as', 'rc', 'cd', 'ud', 'sd', 'de', 'the', 'afc', 'ssc', 'fk', 'sk', 'bk', 'if', 'calcio', '1907', 'rcd'}


def norm(nombre):
    s = unicodedata.normalize('NFKD', nombre).encode('ascii', 'ignore').decode().lower()
    s = re.sub(r'[^a-z0-9]+', ' ', s).strip()
    if s in ALIAS: s = ALIAS[s]
    w = []
    for t in s.split():
        w += ALIAS.get(t, t).split()
    w = [t for t in w if t]
    return [t for t in w if t not in RUIDO] or s.split()


GENERICAS = {'real', 'atletico', 'athletic', 'manchester', 'borussia', 'olympique', 'sporting', 'racing', 'dinamo',
             'union', 'deportivo', 'united', 'city', 'club', 'saint', 'st', 'inter', 'ajax'}


def _lado(A, B):
    hit = tot = 0.0
    for t in A:
        w = 0.35 if t in GENERICAS else 1.0
        best = max((1.0 if t == u else 0.9 if (len(t) >= 3 and u.startswith(t)) or (len(u) >= 3 and t.startswith(u)) else
                    SequenceMatcher(None, t, u).ratio() * 0.8) for u in B)
        hit += w * best; tot += w
    return hit / tot


def parecido(a, b):
    """0..1: cuánto se parecen dos nombres de equipo escritos distinto («AT.MADRID» y «Atlético Madrid»)."""
    A, B = norm(a), norm(b)
    if not A or not B: return 0.0
    return 0.5 * _lado(A, B) + 0.5 * _lado(B, A)


def _prob_americana(ml):
    if ml is None: return None
    ml = float(ml)
    return 100 / (ml + 100) if ml > 0 else -ml / (-ml + 100)


def sin_margen(ps):
    """Quita el margen de la casa: las tres probabilidades implícitas pasan a sumar 1."""
    s = sum(ps)
    return [p / s for p in ps]


def eventos_espn(desde, dias=8, ligas=LIGAS):
    out, seen = [], set()
    for liga in ligas:
        for k in range(dias):
            d = (desde + timedelta(days=k)).strftime('%Y%m%d')
            sb = get_json(f'{ESPN}/{liga}/scoreboard?dates={d}')
            for e in (sb or {}).get('events', []):
                if e['id'] in seen: continue
                seen.add(e['id'])
                c = e['competitions'][0]; t = {x['homeAway']: x['team'] for x in c['competitors']}
                out.append(dict(id=e['id'], liga=liga, fecha=e['date'], local=t['home']['displayName'],
                                visitante=t['away']['displayName'], local_id=t['home']['id'], visitante_id=t['away']['id']))
    return out


def emparejar(partidos, eventos, minimo=0.55, media=0.7):
    """Para cada partido de la quiniela, el evento de ESPN que es (o None). Tienen que parecerse los dos
    equipos: con uno solo («Barcelona») saldría otro partido suyo de esos días."""
    res = {}
    for p in partidos:
        best, bs = None, (0, 0)
        for e in eventos:
            a, b = parecido(p['local'], e['local']), parecido(p['visitante'], e['visitante'])
            sc = (min(a, b), (a + b) / 2)
            if sc[1] > bs[1] and sc[0] >= minimo: best, bs = e, sc
        res[p['n']] = (best, round(bs[1], 3)) if best and bs[1] >= media else (None, round(bs[1], 3))
    return res


def _forma(eventos):
    """Últimos partidos de un equipo, del más antiguo al más reciente: V (victoria), E (empate), D (derrota)."""
    letra = {'W': 'V', 'D': 'E', 'L': 'D'}
    ev = sorted(eventos or [], key=lambda e: e.get('gameDate', ''))
    return ''.join(letra.get(e.get('gameResult'), '') for e in ev)


def resumen_espn(evento):
    """Cuotas (1X2 sin margen y línea de goles) y forma de los dos equipos, de la ficha del partido en ESPN."""
    d = get_json(f"{ESPN}/{evento['liga']}/summary?event={evento['id']}") or {}
    out = {}
    for o in d.get('pickcenter', []) or []:
        h = _prob_americana((o.get('homeTeamOdds') or {}).get('moneyLine'))
        a = _prob_americana((o.get('awayTeamOdds') or {}).get('moneyLine'))
        x = _prob_americana((o.get('drawOdds') or {}).get('moneyLine'))
        if None in (h, a, x): continue
        ou = o.get('overUnder'); ov = _prob_americana(o.get('overOdds')); un = _prob_americana(o.get('underOdds'))
        mas = ov / (ov + un) if ov and un else None
        out['cuotas'] = dict(casa=(o.get('provider') or {}).get('name'), p=sin_margen([h, x, a]), linea=ou, p_mas=mas)
        break
    forma = {}
    for t in d.get('lastFiveGames', []) or []:
        tid = str((t.get('team') or {}).get('id'))
        lado = 'local' if tid == str(evento.get('local_id')) else 'visitante' if tid == str(evento.get('visitante_id')) else None
        if lado: forma[lado] = _forma(t.get('events'))
    if forma: out['forma'] = forma
    return out


def cuotas_espn(evento):
    return resumen_espn(evento).get('cuotas')


def resultado_espn(evento):
    d = get_json(f"{ESPN}/{evento['liga']}/summary?event={evento['id']}")
    try:
        c = d['header']['competitions'][0]
        if not c['status']['type']['completed']: return None
        s = {x['homeAway']: int(x['score']) for x in c['competitors']}
        return s['home'], s['away']
    except (KeyError, TypeError, ValueError):
        return None


def hoy():
    return date.today()
