"""Quiniela de Jornada90: pronóstico, revisión después de la jornada y aprendizaje.

  python3 tools/quiniela/quiniela.py pronostico [--jornada 19] [--dobles 4]
  python3 tools/quiniela/quiniela.py revisar    [--jornada 19]
  python3 tools/quiniela/quiniela.py aprender
  python3 tools/quiniela/quiniela.py analisis
  python3 tools/quiniela/quiniela.py historico   (descarga lo que falte del histórico)

Todo se guarda en la carpeta quiniela/ del repo:
  historico.jsonl        las quinielas desde 2012/13 (partidos, resultados, % del público, premios)
  jornadas/2027-19.json  nuestro pronóstico de cada jornada y, después, su revisión
  registro.jsonl         cada partido que hemos pronosticado, con lo que dijo cada fuente y lo que pasó
  pesos.json             lo que ha aprendido el modelo (y cómo ha ido cambiando)
  analisis.md            lo que dice el histórico
"""
import json, math, os, sys, itertools
from datetime import datetime, timezone
sys.path.insert(0, os.path.dirname(__file__))
import fuentes, modelo, estrategia, historico

RAIZ = os.path.normpath(os.path.join(os.path.dirname(__file__), '..', '..', 'quiniela'))
SIG = estrategia.SIGNOS


def ruta(*p): return os.path.join(RAIZ, *p)


def leer(p, defecto=None):
    try:
        with open(p, encoding='utf-8') as f: return json.load(f)
    except FileNotFoundError:
        return defecto


def escribir(p, d):
    os.makedirs(os.path.dirname(p), exist_ok=True)
    with open(p, 'w', encoding='utf-8') as f: json.dump(d, f, ensure_ascii=False, indent=1)


def temporada_actual():
    h = fuentes.hoy(); return h.year + (1 if h.month >= 7 else 0)


def pesos_actuales():
    return (leer(ruta('pesos.json')) or {}).get('pesos') or dict(modelo.PREVIO)


def siguiente_jornada(t):
    js = [j['jornada'] for j in historico.cargar() if j['temporada'] == t]
    n = max(js) + 1 if js else 1
    for k in range(n, n + 6):
        d = fuentes.escrutinio(k, t)
        if d and d.get('estado') != 'ESCRUTADA': return k
    return n


def pct(p): return f'{round(100 * p):>3}'


# ---------------------------------------------------------------- pronóstico
def pronostico(jornada=None, temporada=None, dobles=4, ligas=fuentes.LIGAS, log=print):
    t = temporada or temporada_actual(); j = jornada or siguiente_jornada(t)
    d = fuentes.escrutinio(j, t)
    if not d: raise SystemExit(f'No encuentro la jornada {j} de {t}')
    los = fuentes.probabilidad_losilla(j, t); pub_x = fuentes.publico(j, t)
    partidos = [dict(n=p['num'], local=p['local'], visitante=p['visitante'], dia=p.get('dia'), hora=p.get('hora'), div=p.get('division'))
                for p in d['partidos']]
    log(f'Jornada {j} ({t - 1}/{str(t)[2:]}): buscando cuotas…')
    ev = fuentes.eventos_espn(fuentes.hoy(), 8, ligas)
    par = fuentes.emparejar(partidos, ev)
    pesos = pesos_actuales()
    filas = []
    for p in partidos:
        n = p['n']; e, score = par[n]
        f = {}
        if e:
            info = fuentes.resumen_espn(e); c = info.get('cuotas')
            if info.get('forma'): p['forma'] = info['forma']
            p['espn'] = dict(id=e['id'], liga=e['liga'], partido=f"{e['local']} - {e['visitante']}", fecha=e['fecha'], parecido=score,
                             local_id=e['local_id'], visitante_id=e['visitante_id'])
            if c: f['mercado'] = [round(x, 4) for x in c['p']]; p['cuotas'] = c
        if n in los: f['losilla'] = [round(x, 4) for x in los[n]]
        q = pub_x.get(n) or next(([x['porcentaje1'] / 100, x['porcentajeX'] / 100, x['porcentaje2'] / 100] for x in d['partidos']
                                  if x['num'] == n and x.get('porcentaje1') is not None), None)
        if q: f['publico'] = q
        p['fuentes'] = f
        p['prob'] = [round(x, 4) for x in modelo.combinar(f, pesos)]
        filas.append(p)
    probs = [p['prob'] for p in filas[:14]]
    signos = estrategia.elegir(probs, dobles); simples = estrategia.elegir(probs, 0)
    for p, s, s1 in zip(filas, signos, simples): p['signos'] = s; p['signo_simple'] = s1
    # Pleno al 15: goles de cada equipo con las cuotas (si hay) o con lo que dice Losilla
    p15 = filas[14] if len(filas) > 14 else None
    if p15:
        c = p15.get('cuotas')
        if c:
            lh, la = modelo.lambdas(p15['prob'], modelo.total_desde_linea(c.get('linea'), c.get('p_mas')))
            g = modelo.goles_equipo(modelo.matriz(lh, la)); p15['goles_esperados'] = [round(lh, 2), round(la, 2)]; fuente = 'cuotas'
        else:
            g = fuentes.goles_p15_losilla(j, t); fuente = 'losilla'
        if g:
            p15['goles'] = {k: [round(x, 4) for x in v] for k, v in g.items()}; p15['goles_fuente'] = fuente
            p15['signos'], p15['p_signos'] = estrategia.pleno15(g)
    res = estrategia.resumen(probs, signos); res_simple = estrategia.resumen(probs, simples)
    pub = [p['fuentes'].get('publico') for p in filas[:14]]
    val = estrategia.valor(probs, pub); inf = estrategia.inflados(probs, pub)
    out = dict(temporada=t, jornada=j, creado=datetime.now(timezone.utc).isoformat(timespec='minutes'), dobles=dobles,
               pesos=pesos, partidos=filas, resumen=res, resumen_simple=res_simple, valor=val, inflados=inf)
    escribir(ruta('jornadas', f'{t}-{j:02d}.json'), out)
    imprimir(out, log)
    return out


def imprimir(o, log=print):
    log(f"\nJornada {o['jornada']} · pesos: mercado {o['pesos'].get('mercado')} · losilla {o['pesos'].get('losilla')} · "
        f"público {o['pesos'].get('publico')} · sesgo X {o['pesos']['sesgo'][1]}")
    log(' n  partido                          final 1/X/2   mercado      losilla      público    signo  forma (local / visitante)')
    for p in o['partidos']:
        f = p['fuentes']; s = lambda k: ' '.join(pct(x) for x in f[k]) if k in f else '   -   -   -'
        log(f"{p['n']:>2}  {(p['local'] + ' - ' + p['visitante'])[:31]:31}  {' '.join(pct(x) for x in p['prob'])}   "
            f"{s('mercado')}  {s('losilla')}  {s('publico')}   {p.get('signos', ''):5}  {(p.get('forma') or {}).get('local', '')} / {(p.get('forma') or {}).get('visitante', '')}")
    r1 = o.get('resumen_simple')
    if r1: log(f"\nSin dobles: aciertos esperados {r1['esperados']} · ≥10: {100 * r1['p10']:.0f}% · ≥11: {100 * r1['p11']:.0f}% · {r1['coste']} €")
    r = o['resumen']
    log(f"Con {o['dobles']} dobles: aciertos esperados {r['esperados']} · ≥10: {100 * r['p10']:.0f}% · ≥11: {100 * r['p11']:.0f}% · ≥12: {100 * r['p12']:.1f}% · "
        f"{r['apuestas']} apuestas ({r['coste']} €)")
    for v in o.get('inflados', []):
        log(f"  la gente se pasa: partido {v['n']} el {v['signo']}: lo apuesta el {100 * v['publico']:.0f}% y sale un {100 * v['prob']:.0f}%")
    for v in o['valor']:
        log(f"  la gente no lo ve: partido {v['n']} el {v['signo']}: {100 * v['prob']:.0f}% real y solo lo apuesta el {100 * v['publico']:.0f}%")
    sin = [p['n'] for p in o['partidos'] if 'mercado' not in p['fuentes']]
    if sin: log(f'  sin cuotas: {sin}')


# ---------------------------------------------------------------- revisión
def _y(signo): return SIG.index(signo) if signo in SIG else None


def tipo_fallo(p, y):
    if p[y] < 0.22: return 'sorpresa'
    if max(p) < 0.5: return 'igualado'
    return 'falla el favorito'


def premio_columnas(signos, reales, acertantes, p15_ok):
    """Cuánto se habría cobrado con todas las columnas que salen de los dobles."""
    tabla = {a['acierto']: a.get('premio') or 0 for a in (acertantes or [])}
    total = 0.0; mejor = 0
    for col in itertools.product(*signos):
        k = sum(c == r for c, r in zip(col, reales) if r)
        mejor = max(mejor, k)
        if k == 14 and p15_ok: total += tabla.get(15, 0)
        elif k >= 10: total += tabla.get(k, 0)
    return round(total, 2), mejor


def revisar(jornada=None, temporada=None, log=print):
    t = temporada or temporada_actual()
    if jornada is None:
        hechas = sorted(f for f in os.listdir(ruta('jornadas')) if f.endswith('.json'))
        jornada = int(hechas[-1].split('-')[1][:2])
    o = leer(ruta('jornadas', f'{t}-{jornada:02d}.json'))
    if not o: raise SystemExit('No hay pronóstico guardado de esa jornada')
    d = fuentes.escrutinio(jornada, t)
    reales = {p['num']: p for p in d['partidos']}
    filas, aciertos, fallos, simples = [], 0, [], 0
    for p in o['partidos']:
        r = reales.get(p['n'], {}); y = _y(r.get('signo'))
        p['resultado'] = r.get('resultado'); p['signo_real'] = r.get('signo') or None
        if y is None: continue
        if p['n'] <= 14:
            ok = SIG[y] in p['signos']; aciertos += ok; p['acierto'] = ok
            p['acierto_simple'] = SIG[y] == p.get('signo_simple', p['signos'][:1]); simples += p['acierto_simple']
            if not ok:
                p['fallo'] = tipo_fallo(p['prob'], y)
                mejor = max(((k, v[y]) for k, v in p['fuentes'].items()), key=lambda x: x[1], default=(None, 0))
                if mejor[0] and mejor[1] >= p['prob'][y] + 0.08: p['pista'] = f"{mejor[0]} le daba un {100 * mejor[1]:.0f}%"
                fallos.append(p)
        filas.append(dict(temporada=t, jornada=jornada, n=p['n'], fuentes=p['fuentes'], y=y, prob=p['prob'], signos=p.get('signos')))
    p15 = o['partidos'][14] if len(o['partidos']) > 14 else None
    p15_ok = bool(p15 and p15.get('signos') and reales.get(15, {}).get('signo_goles') and
                  p15['signos'].replace('-', '') == reales[15]['signo_goles'])
    jugados = [p for p in o['partidos'][:14] if p.get('signo_real')]
    qs = [estrategia.cubierta(p['prob'], p['signos']) for p in jugados]
    dist = estrategia.distribucion(qs)
    premio, mejor = premio_columnas([p['signos'] for p in o['partidos'][:14]], [p.get('signo_real') for p in o['partidos'][:14]],
                                    d.get('acertantes'), p15_ok)
    ll = {}
    for fu in ('final',) + modelo.FUENTES:
        v = [modelo.logloss(r['prob'] if fu == 'final' else r['fuentes'][fu], r['y']) for r in filas if r['n'] <= 14 and (fu == 'final' or fu in r['fuentes'])]
        if v: ll[fu] = round(sum(v) / len(v), 4)
    rev = dict(revisado=datetime.now(timezone.utc).isoformat(timespec='minutes'), estado=d.get('estado'), jugados=len(jugados),
               aciertos=aciertos, aciertos_sin_dobles=simples, esperados=round(sum(qs), 2), p_igual_o_mas=round(sum(dist[aciertos:]), 4),
               pleno15=p15_ok, premio=premio, coste=o['resumen']['coste'], acertantes=d.get('acertantes'),
               fallos=[dict(n=p['n'], partido=f"{p['local']} - {p['visitante']}", resultado=p['resultado'], puse=p['signos'],
                            salio=p['signo_real'], prob=round(p['prob'][_y(p['signo_real'])], 3), tipo=p['fallo'], pista=p.get('pista'))
                       for p in fallos],
               logloss=ll)
    o['revision'] = rev
    escribir(ruta('jornadas', f'{t}-{jornada:02d}.json'), o)
    if d.get('estado') == 'ESCRUTADA':
        reg = [r for r in leer_registro() if not (r['temporada'] == t and r['jornada'] == jornada)] + filas
        with open(ruta('registro.jsonl'), 'w', encoding='utf-8') as f:
            for r in reg: f.write(json.dumps(r, ensure_ascii=False, separators=(',', ':')) + '\n')
        historico.completar(t, t, log=lambda *a: None)
        aprender(log)
    informe = texto_revision(o)
    with open(ruta('jornadas', f'{t}-{jornada:02d}-revision.md'), 'w', encoding='utf-8') as f: f.write(informe)
    log(informe)
    return o


def texto_revision(o):
    r = o['revision']
    L = [f"# Jornada {o['jornada']}: {r['aciertos']} de {r['jugados']} con dobles · {r.get('aciertos_sin_dobles', '?')} sin dobles", '',
         f"- Esperábamos {r['esperados']} aciertos. Sacar {r['aciertos']} o más tenía un {100 * r['p_igual_o_mas']:.0f}% de probabilidad.",
         f"- Pleno al 15: {'sí' if r['pleno15'] else 'no'}.",
         f"- Jugándola habría costado {r['coste']} € y se habrían cobrado {r['premio']} €.", '']
    if r['fallos']:
        L += ['## Fallos', '']
        for f in r['fallos']:
            L.append(f"- **{f['partido']} {f['resultado']}**: puse {f['puse']}, salió {f['salio']} ({100 * f['prob']:.0f}%) · {f['tipo']}"
                     + (f" · ojo: {f['pista']}" if f.get('pista') else ''))
        L.append('')
    if r['logloss']:
        L += ['## ¿Qué fuente acertó más esta jornada? (log-loss, más bajo es mejor)', '']
        L += [f"- {k}: {v}" for k, v in sorted(r['logloss'].items(), key=lambda x: x[1])]
    return '\n'.join(L) + '\n'


def leer_registro():
    try:
        with open(ruta('registro.jsonl'), encoding='utf-8') as f: return [json.loads(l) for l in f if l.strip()]
    except FileNotFoundError:
        return []


# ---------------------------------------------------------------- aprendizaje
def filas_historico(js=None, hasta=None, desde=None):
    out = []
    for j in js if js is not None else historico.cargar():
        if hasta and j['temporada'] > hasta: continue
        if desde and j['temporada'] < desde: continue
        for p in j['partidos']:
            y = _y(p.get('signo'))
            if y is None or p['n'] > 14: continue
            f = {}
            if p.get('los'): f['losilla'] = p['los']
            if p.get('pub'): f['publico'] = p['pub']
            if 'losilla' in f and 'publico' in f: out.append((f, y))
    return out


def aprender(log=print):
    js = historico.cargar(); reg = leer_registro()
    hist = filas_historico(js)
    nuevas = [(r['fuentes'], r['y']) for r in reg if r['n'] <= 14]
    filas = hist + nuevas * 3  # lo nuestro pesa más: es lo más reciente
    if not filas:
        log('Sin datos para aprender'); return modelo.PREVIO
    p = modelo.entrenar(filas)
    solo = modelo.entrenar(filas, usar=('publico',), previo={'publico': 1.0, 'sesgo': [0, 0, 0]})
    p['solo_publico'] = solo
    prev = leer(ruta('pesos.json')) or {}
    ev = dict(historico=modelo.evaluar(hist[-3000:], p), registro=modelo.evaluar(nuevas, p) if nuevas else None)
    hist_pesos = prev.get('historial', []) + [dict(fecha=datetime.now(timezone.utc).isoformat(timespec='minutes'), filas=len(filas),
                                                   jornadas_propias=len({(r['temporada'], r['jornada']) for r in reg}),
                                                   pesos={k: v for k, v in p.items() if k != 'solo_publico'}, evaluacion=ev)]
    escribir(ruta('pesos.json'), dict(pesos=p, historial=hist_pesos[-60:]))
    log(f"Pesos nuevos: mercado {p['mercado']} · losilla {p['losilla']} · público {p['publico']} · sesgo {p['sesgo']}  ({len(filas)} filas)")
    return p


# ---------------------------------------------------------------- análisis del histórico
def analisis(log=print):
    import analisis as A
    txt = A.informe(historico.cargar(), filas_historico)
    with open(ruta('analisis.md'), 'w', encoding='utf-8') as f: f.write(txt)
    log(txt)


if __name__ == '__main__':
    a = sys.argv[1:] or ['pronostico']
    arg = lambda k, d=None, tipo=int: tipo(a[a.index(k) + 1]) if k in a else d
    cmd = a[0]
    if cmd == 'pronostico': pronostico(arg('--jornada'), arg('--temporada'), arg('--dobles', 4))
    elif cmd == 'revisar': revisar(arg('--jornada'), arg('--temporada'))
    elif cmd == 'aprender': aprender()
    elif cmd == 'analisis': analisis()
    elif cmd == 'historico': historico.completar(arg('--desde', 2013))
    else: print(__doc__)
