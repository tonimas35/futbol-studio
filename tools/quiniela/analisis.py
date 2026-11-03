"""Lo que enseña el histórico de quinielas (sale en quiniela/analisis.md)."""
import statistics as st
import modelo, estrategia

SIG = ('1', 'X', '2')
DIV = {1: 'Primera', 2: 'Segunda'}


def _pct(x): return f'{100 * x:.1f}%'


def _calibracion(pares, cortes=(0, .1, .2, .3, .4, .5, .6, .7, .8, .9, 1.01)):
    """pares: (probabilidad dada, salió sí/no). Por tramos: lo que se decía y lo que pasó."""
    filas = []
    for a, b in zip(cortes, cortes[1:]):
        v = [(p, o) for p, o in pares if a <= p < b]
        if len(v) >= 30: filas.append((a, b, len(v), st.mean(p for p, _ in v), st.mean(o for _, o in v)))
    return filas


def informe(js, filas_historico):
    js = [j for j in js if j.get('partidos')]
    T = sorted({j['temporada'] for j in js})
    L = ['# Lo que dice el histórico de la Quiniela', '',
         f'{len(js)} jornadas, de la temporada {T[0] - 1}/{str(T[0])[2:]} a la {T[-1] - 1}/{str(T[-1])[2:]}. '
         'Fuente: Eduardo Losilla (resultados, % que apostó la gente según LAE, su «probabilidad real» y premios).', '']
    P = [p for j in js for p in j['partidos'] if p['n'] <= 14 and p.get('signo') in SIG]
    L += ['## 1. Cómo salen los signos', '']
    for nom, sub in [('Todos', P)] + [(DIV[d], [p for p in P if p.get('div') == d]) for d in (1, 2)] + [('Otros (Copa, Europa, extranjero)', [p for p in P if p.get('div') not in (1, 2)])]:
        if sub: L.append(f"- **{nom}** ({len(sub)} partidos): 1 {_pct(sum(p['signo'] == '1' for p in sub) / len(sub))} · "
                         f"X {_pct(sum(p['signo'] == 'X' for p in sub) / len(sub))} · 2 {_pct(sum(p['signo'] == '2' for p in sub) / len(sub))}")
    xs = [sum(p.get('signo') == 'X' for p in j['partidos'][:14]) for j in js]
    L += [f'- Empates por quiniela: {st.mean(xs):.1f} de media; en el {_pct(sum(x >= 4 for x in xs) / len(xs))} de las jornadas salen 4 o más.', '']

    L += ['## 2. ¿La gente apuesta bien?', '',
          'Por tramos: el % que le daba la gente a un signo y las veces que salió de verdad.', '',
          '| La gente le daba | Partidos | Salió |', '|---|---|---|']
    pares = [(p['pub'][k], p['signo'] == SIG[k]) for p in P if p.get('pub') for k in range(3)]
    for a, b, n, m, o in _calibracion(pares): L.append(f'| {100 * a:.0f}–{min(100, 100 * b):.0f}% (media {100 * m:.0f}%) | {n} | {100 * o:.0f}% |')
    px = [(p['pub'][1], p['signo'] == 'X') for p in P if p.get('pub')]
    if px: L += ['', f"Empates: la gente les da un {100 * st.mean(p for p, _ in px):.0f}% de media y salen el {100 * st.mean(o for _, o in px):.0f}%.", '']

    L += ['## 3. ¿Y la probabilidad de los expertos (Losilla)?', '', '| Le daban | Partidos | Salió |', '|---|---|---|']
    pares = [(p['los'][k], p['signo'] == SIG[k]) for p in P if p.get('los') for k in range(3)]
    for a, b, n, m, o in _calibracion(pares): L.append(f'| {100 * a:.0f}–{min(100, 100 * b):.0f}% (media {100 * m:.0f}%) | {n} | {100 * o:.0f}% |')
    L.append('')

    # Entrenar con lo viejo, probar con lo nuevo
    corte = T[-3] if len(T) >= 4 else T[-1]
    tr = filas_historico(js, hasta=corte - 1); te = filas_historico(js, desde=corte)
    if tr and te:
        pesos = modelo.entrenar(tr)
        solo_pub = {'mercado': 0, 'losilla': 0, 'publico': 1.0, 'sesgo': [0, 0, 0]}
        solo_los = {'mercado': 0, 'losilla': 1.0, 'publico': 0, 'sesgo': [0, 0, 0]}
        L += [f'## 4. Qué predice mejor (aprendiendo hasta {corte - 2}/{str(corte - 1)[2:]} y probando desde {corte - 1}/{str(corte)[2:]})', '',
              '| Método | Log-loss (menos es mejor) | Acierta el favorito |', '|---|---|---|']
        for nom, w in [('Lo que apuesta la gente', solo_pub), ('Probabilidad de Losilla', solo_los), ('Nuestro modelo combinado', pesos)]:
            e = modelo.evaluar(te, w); L.append(f"| {nom} | {e['logloss']} | {_pct(e['acierto'])} |")
        L += ['', f"Pesos aprendidos: Losilla/mercado {pesos['losilla'] + pesos['mercado']:.2f} · gente {pesos['publico']:.2f} · "
              f"ajuste a los empates {pesos['sesgo'][1]:+.2f}", '']

    # La columna de favoritos, jornada a jornada
    res = {0: [], 4: []}
    for j in js:
        ps = [p for p in j['partidos'][:14] if p.get('signo') in SIG and p.get('los')]
        if len(ps) < 14: continue
        for d in res:
            sg = estrategia.elegir([p['los'] for p in ps], d)
            res[d].append(sum(p['signo'] in s for p, s in zip(ps, sg)))
    if res[0]:
        L += ['## 5. Si cada semana hubiéramos jugado a lo más probable', '']
        for d, v in res.items():
            L.append(f"- **{'Sin dobles' if d == 0 else f'Con {d} dobles'}** ({len(v)} jornadas): {st.mean(v):.1f} aciertos de media · "
                     f"10+: {_pct(sum(x >= 10 for x in v) / len(v))} · 11+: {_pct(sum(x >= 11 for x in v) / len(v))} · "
                     f"12+: {_pct(sum(x >= 12 for x in v) / len(v))} · 14: {sum(x == 14 for x in v)} veces")
        L.append('')

    sorpresas = [sum(1 for p in j['partidos'][:14] if p.get('pub') and p.get('signo') in SIG and p['pub'][SIG.index(p['signo'])] < 0.25) for j in js]
    L += ['## 6. Sorpresas', '', f'- Signos que la gente apostaba menos de un 25% y salieron: {st.mean(sorpresas):.1f} por jornada de media '
          f'(mínimo {min(sorpresas)}, máximo {max(sorpresas)}).']
    orden = [j['orden_real'] for j in js if j.get('orden_real')]
    if orden: L.append('- Si se ordenan las 4.782.969 combinaciones posibles de más a menos probable, la ganadora suele quedar '
                       f"por el puesto {format(round(st.median(orden)), ',').replace(',', '.')} (mediana).")
    L.append('')

    rec = [j for j in js if j['temporada'] >= T[-1] - 2 and j.get('acertantes')]
    if rec:
        L += ['## 7. Premios (últimas 3 temporadas)', '', '| Aciertos | Premio mediano | Jornadas en que no se cobra |', '|---|---|---|']
        for k in (15, 14, 13, 12, 11, 10):
            v = [a.get('premio') or 0 for j in rec for a in j['acertantes'] if a['acierto'] == k]
            if v: L.append(f'| {k} | {st.median(v):,.2f} € | {_pct(sum(x == 0 for x in v) / len(v))} |'.replace(',', 'X').replace('.', ',').replace('X', '.'))
        L.append('')
    return '\n'.join(L) + '\n'
