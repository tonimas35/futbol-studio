"""Descarga el histórico de quinielas (2012/13 → hoy) a quiniela/historico.jsonl: una línea por jornada.

  python3 tools/quiniela/historico.py            # completa lo que falte
  python3 tools/quiniela/historico.py --desde 2013
"""
import json, os, sys, time
sys.path.insert(0, os.path.dirname(__file__))
import fuentes

RAIZ = os.path.join(os.path.dirname(__file__), '..', '..', 'quiniela')
FICH = os.path.join(RAIZ, 'historico.jsonl')


def cargar():
    if not os.path.exists(FICH): return []
    with open(FICH, encoding='utf-8') as f:
        return [json.loads(l) for l in f if l.strip()]


def guardar(js):
    js = sorted(js, key=lambda j: (j['temporada'], j['jornada']))
    os.makedirs(RAIZ, exist_ok=True)
    with open(FICH, 'w', encoding='utf-8') as f:
        for j in js: f.write(json.dumps(j, ensure_ascii=False, separators=(',', ':')) + '\n')


def _bajar(k):
    t, n = k
    d = fuentes.escrutinio(n, t)
    if not d: return k, None
    if d.get('estado') != 'ESCRUTADA': return k, 'abierta'
    return k, fuentes.jornada_compacta(d, fuentes.probabilidad_losilla(n, t))


def completar(desde=2013, hasta=None, hilos=8, log=print):
    """Baja las jornadas que falten (8 a la vez). Una temporada acaba cuando aparecen 3 jornadas vacías."""
    from concurrent.futures import ThreadPoolExecutor
    hasta = hasta or fuentes.hoy().year + (1 if fuentes.hoy().month >= 7 else 0)
    hay = {(j['temporada'], j['jornada']): j for j in cargar()}
    nuevas = 0
    with ThreadPoolExecutor(hilos) as ex:
        for t in range(desde, hasta + 1):
            n0 = 1
            while n0 <= 100:
                rango = range(n0, n0 + 16)
                lote = [(t, n) for n in rango if not ((t, n) in hay and hay[(t, n)].get('estado') == 'ESCRUTADA')]
                res = dict(ex.map(_bajar, lote))
                for k, v in res.items():
                    if isinstance(v, dict): hay[k] = v; nuevas += 1
                n0 += 16
                if sum(1 for n in rango if (t, n) not in hay and res.get((t, n)) is None) >= 3: break
            guardar(list(hay.values()))
            log(f'  temporada {t}: {sum(1 for k in hay if k[0] == t)} jornadas')
    log(f'{len(hay)} jornadas en el histórico ({nuevas} nuevas)')
    return list(hay.values())


if __name__ == '__main__':
    desde = int(sys.argv[sys.argv.index('--desde') + 1]) if '--desde' in sys.argv else 2013
    completar(desde)
