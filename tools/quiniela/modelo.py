"""El modelo: junta varias opiniones sobre cada partido y aprende cuánto fiarse de cada una.

Fuentes (cada una da probabilidades de 1, X y 2):
  mercado  las cuotas de las casas de apuestas (ESPN), sin su margen
  losilla  la «probabilidad real» que publica Eduardo Losilla
  publico  lo que apuesta la gente en la Quiniela (LAE)

Se combinan con un «pool logarítmico»: log p = Σ peso_fuente · log p_fuente + sesgo_signo, y se
normaliza. Los pesos y el sesgo (por ejemplo, si los empates salen más de lo que dicen las fuentes)
se aprenden minimizando el error (log-loss) sobre todas las jornadas pasadas y las que vamos
registrando. Cada jornada nueva entra en el entrenamiento: así aprende de sus fallos.

En el histórico no hay cuotas guardadas; como la probabilidad de Losilla sale del mercado, ahí
hacen de «mercado» las de Losilla. Cuando el registro tiene jornadas con cuotas reales, el
entrenamiento ya distingue entre las dos.
"""
import math

FUENTES = ('mercado', 'losilla', 'publico')
SIGNOS = ('1', 'X', '2')
PREVIO = {'mercado': 0.5, 'losilla': 0.5, 'publico': 0.1, 'sesgo': [0.0, 0.0, 0.0]}
EPS = 1e-4


def _log(p):
    return [math.log(max(EPS, x)) for x in p]


def _softmax(z):
    m = max(z); e = [math.exp(v - m) for v in z]; s = sum(e)
    return [v / s for v in e]


def completar(f):
    """Rellena una fuente que falta con su pareja más parecida (mercado ↔ losilla)."""
    f = {k: v for k, v in f.items() if v}
    if 'mercado' not in f and 'losilla' in f: f['mercado'] = f['losilla']
    if 'losilla' not in f and 'mercado' in f: f['losilla'] = f['mercado']
    return f


def combinar(fuentes, pesos):
    """Probabilidad final [p1, pX, p2] de un partido a partir de las fuentes que haya."""
    f = completar(fuentes)
    if 'mercado' not in f:  # solo tenemos lo que apuesta la gente
        if 'publico' not in f: return [1 / 3] * 3
        P = pesos.get('solo_publico', {'publico': 1.0, 'sesgo': [0, 0, 0]})
        return _softmax([P['publico'] * l + b for l, b in zip(_log(f['publico']), P['sesgo'])])
    z = list(pesos['sesgo'])
    for s in FUENTES:
        if s in f:
            for k, l in enumerate(_log(f[s])): z[k] += pesos[s] * l
    return _softmax(z)


def logloss(p, y):
    return -math.log(max(EPS, p[y]))


def entrenar(filas, usar=FUENTES, previo=PREVIO, reg=0.002, iters=400, lr=0.6):
    """filas: [(fuentes_dict, y)] con y = 0/1/2. Devuelve pesos que minimizan el log-loss medio.

    Descenso por gradiente con un pequeño tirón hacia `previo` (para que con pocos datos no se vaya
    a valores raros). El sesgo del signo 1 se fija en 0 (solo cuentan las diferencias)."""
    X = []
    for f, y in filas:
        f = completar(f)
        if all(s in f for s in usar): X.append(([_log(f[s]) for s in usar], y))
    if not X: return dict(previo)
    w = [previo.get(s, 0.3) for s in usar]; b = list(previo.get('sesgo', [0, 0, 0]))
    n = len(X); mw = [0.0] * len(w); mb = [0.0] * 3
    for it in range(iters):
        gw = [0.0] * len(w); gb = [0.0] * 3
        for L, y in X:
            z = [b[k] + sum(w[i] * L[i][k] for i in range(len(w))) for k in range(3)]
            p = _softmax(z)
            for k in range(3):
                d = p[k] - (1.0 if k == y else 0.0)
                gb[k] += d
                for i in range(len(w)): gw[i] += d * L[i][k]
        for i, s in enumerate(usar):
            g = gw[i] / n + 2 * reg * (w[i] - previo.get(s, 0.3))
            mw[i] = 0.9 * mw[i] + g; w[i] = max(0.0, w[i] - lr * mw[i])
        for k in (1, 2):
            g = gb[k] / n + 2 * reg * b[k]
            mb[k] = 0.9 * mb[k] + g; b[k] -= lr * 0.5 * mb[k]
        lr *= 0.995
    out = {s: round(w[i], 4) for i, s in enumerate(usar)}
    out['sesgo'] = [0.0, round(b[1], 4), round(b[2], 4)]
    return out


def evaluar(filas, pesos):
    """Log-loss medio, Brier y % de acierto del favorito."""
    ll = br = ok = 0.0; n = 0
    for f, y in filas:
        p = combinar(f, pesos)
        ll += logloss(p, y); br += sum((p[k] - (k == y)) ** 2 for k in range(3)); ok += p.index(max(p)) == y; n += 1
    return dict(n=n, logloss=round(ll / n, 4), brier=round(br / n, 4), acierto=round(ok / n, 4)) if n else dict(n=0)


# ---------------------------------------------------------------- goles (Pleno al 15)
def _pois(l, k):
    return math.exp(-l) * l ** k / math.factorial(k)


def matriz(lh, la, rho=-0.08, G=10):
    M = [[_pois(lh, i) * _pois(la, j) for j in range(G)] for i in range(G)]
    M[0][0] *= 1 - lh * la * rho; M[0][1] *= 1 + lh * rho; M[1][0] *= 1 + la * rho; M[1][1] *= 1 - rho
    s = sum(map(sum, M))
    return [[v / s for v in r] for r in M]


def _1x2(M):
    G = len(M)
    return [sum(M[i][j] for i in range(G) for j in range(G) if i > j), sum(M[i][i] for i in range(G)),
            sum(M[i][j] for i in range(G) for j in range(G) if i < j)]


def lambdas(p, total=None):
    """Goles esperados de cada equipo que reproducen unas probabilidades 1X2 (y la línea de goles, si la hay)."""
    best = None
    T = total or 2.6
    for _ in range(2):
        for lt in [T * (0.7 + 0.03 * k) for k in range(21)] if total is None else [T]:
            lo, hi = 0.05, 0.95
            for _ in range(40):
                r = (lo + hi) / 2
                q = _1x2(matriz(lt * r, lt * (1 - r)))
                if q[0] - q[2] < p[0] - p[2]: lo = r
                else: hi = r
            q = _1x2(matriz(lt * r, lt * (1 - r)))
            e = sum((q[k] - p[k]) ** 2 for k in range(3))
            if best is None or e < best[0]: best = (e, lt * r, lt * (1 - r))
        break
    return best[1], best[2]


def goles_equipo(M):
    """Probabilidad de que cada equipo marque 0, 1, 2 o M (3+)."""
    G = len(M)
    L = [sum(M[i]) for i in range(G)]; V = [sum(M[i][j] for i in range(G)) for j in range(G)]
    f = lambda v: [v[0], v[1], v[2], sum(v[3:])]
    return {'L': f(L), 'V': f(V)}


def total_desde_linea(linea, p_mas):
    """Goles totales esperados a partir de la línea de over/under y su probabilidad."""
    if not linea or not p_mas: return None
    lo, hi = 0.5, 6.0
    k = math.floor(linea)
    for _ in range(50):
        m = (lo + hi) / 2
        pm = 1 - sum(_pois(m, i) for i in range(k + 1))
        if pm < p_mas: lo = m
        else: hi = m
    return m
