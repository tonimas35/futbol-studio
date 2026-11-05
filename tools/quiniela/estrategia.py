"""Cómo convertir probabilidades en una quiniela: signos, dobles y qué esperar de ella."""
SIGNOS = ('1', 'X', '2')
PRECIO = 0.75


def elegir(probs, dobles=4):
    """probs: lista de 14 [p1,pX,p2]. Signo más probable en todos y dobles donde más se gana.

    Un doble añade el segundo signo más probable; se ponen en los partidos donde ese segundo signo
    es más probable (los más igualados)."""
    orden = [sorted(range(3), key=lambda k: -p[k]) for p in probs]
    ganancia = sorted(range(len(probs)), key=lambda i: -probs[i][orden[i][1]])
    con_doble = set(ganancia[:dobles])
    out = []
    for i, p in enumerate(probs):
        ks = sorted(orden[i][:2] if i in con_doble else orden[i][:1])
        out.append(''.join(SIGNOS[k] for k in ks))
    return out


def cubierta(p, signos):
    return sum(p[SIGNOS.index(s)] for s in signos)


def distribucion(qs):
    """Probabilidad de acertar exactamente k partidos (k = 0..n) si cada uno se acierta con prob q."""
    d = [1.0]
    for q in qs:
        nd = [0.0] * (len(d) + 1)
        for k, v in enumerate(d):
            nd[k] += v * (1 - q); nd[k + 1] += v * q
        d = nd
    return d


def resumen(probs, signos):
    qs = [cubierta(p, s) for p, s in zip(probs, signos)]
    d = distribucion(qs)
    return dict(esperados=round(sum(qs), 2), p10=round(sum(d[10:]), 4), p11=round(sum(d[11:]), 4),
                p12=round(sum(d[12:]), 4), p14=round(d[14] if len(d) > 14 else 0, 6),
                apuestas=2 ** sum(len(s) - 1 for s in signos), coste=round(max(2, 2 ** sum(len(s) - 1 for s in signos)) * PRECIO, 2))


def valor(probs, pub, minimo=0.2, ratio=1.3):
    """Signos que la gente infravalora: nuestra probabilidad (≥ 20 %) es 1,3 veces o más lo que apuesta el público."""
    out = []
    for i, (p, q) in enumerate(zip(probs, pub)):
        if not q: continue
        for k in range(3):
            if p[k] >= minimo and q[k] > 0 and p[k] / q[k] >= ratio:
                out.append(dict(n=i + 1, signo=SIGNOS[k], prob=round(p[k], 3), publico=q[k], ratio=round(p[k] / q[k], 2)))
    return out


def pleno15(goles):
    """Signo del Pleno al 15 (goles de cada equipo: 0, 1, 2, M) más probable."""
    G = '012M'
    i = max(range(4), key=lambda k: goles['L'][k]); j = max(range(4), key=lambda k: goles['V'][k])
    return G[i] + '-' + G[j], round(goles['L'][i] * goles['V'][j], 4)


def inflados(probs, pub, minimo=0.06):
    """Dónde la gente se pasa: el signo al que el público da bastante más de lo que dicen las cuentas."""
    out = []
    for i, (p, q) in enumerate(zip(probs, pub)):
        if not q: continue
        k = max(range(3), key=lambda k: q[k] - p[k])
        if q[k] - p[k] >= minimo:
            out.append(dict(n=i + 1, signo=SIGNOS[k], prob=round(p[k], 3), publico=q[k], diferencia=round(q[k] - p[k], 3)))
    return sorted(out, key=lambda x: -x['diferencia'])


def columna_valor(probs, pub, cambios=3, minimo=0.25, signos=SIGNOS):
    """La segunda columna: la misma que la de sin dobles, pero con hasta 3 signos cambiados por otros
    que tienen opciones de verdad (25 % o más) y que la gente juega menos de lo que salen (empates,
    sobre todo). Si sale, se reparte con mucha menos gente. Con el histórico, una columna así
    devolvió el 77-89 % de lo jugado y la de lo más probable, el 42 %. Con signos='X', solo empates
    (los de más valor): devolvió el 62-83 %."""
    base = elegir(probs, 0)
    cands = []
    for i, (p, q) in enumerate(zip(probs, pub)):
        if not q: continue
        for k in range(3):
            if SIGNOS[k] in signos and SIGNOS[k] != base[i] and p[k] >= minimo and q[k] > 0 and p[k] / q[k] > 1:
                cands.append((p[k] / q[k], i, SIGNOS[k]))
    out = list(base); usados = set()
    for _, i, sg in sorted(cands, reverse=True):
        if i in usados or len(usados) >= cambios: continue
        out[i] = sg; usados.add(i)
    return out
