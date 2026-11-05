"""Fotos 9:16 para TikTok/Instagram de la quiniela (pronóstico o resultado), en el estilo de Jornada90.

  python3 tools/quiniela/post.py pronostico 19 [--temporada 2027]   → quiniela/posts/2027-19-pronostico.html
  python3 tools/quiniela/post.py resultado 19
  node tools/quiniela/render.mjs quiniela/posts/2027-19-pronostico.html  → los PNG al lado

Todo lo importante va dentro de la zona segura de TikTok (y 380–1640, x 60–920 en 1080×1920).
Si un partido del JSON tiene «motivo», se usa ese texto en vez del automático.
"""
import json, os, re, sys
sys.path.insert(0, os.path.dirname(__file__))
import quiniela as Q

AQUI = os.path.dirname(__file__)
LOGO = 'https://a.espncdn.com/i/teamlogos/soccer/500/{}.png'
NOMBRE = {'MAN.UNITED': 'Man. United', 'MAN.CITY': 'Man. City', 'AT.MADRID': 'Atlético', 'B.MUNICH': 'Bayern', 'B.DORTMUND': 'Dortmund',
          'OL. LYON': 'Lyon', 'LOSC LILLE': 'Lille', 'R. UNION SG': 'Union SG', 'R.SOCIEDAD': 'R. Sociedad', 'R.MADRID': 'Real Madrid',
          'COMO 1907': 'Como', 'RB LEIPZIG': 'Leipzig', 'AEK ATENAS': 'AEK', 'ATH.CLUB': 'Athletic', 'RACING S.': 'Racing',
          'BODO GLIMT': 'Bodø/Glimt', 'SLAVIA PRAGA': 'Slavia', 'PSG': 'PSG', 'FENERBAHCE': 'Fenerbahçe'}
CSS = '''
.q{display:grid;grid-template-columns:38px minmax(0,1fr) 150px;align-items:center;gap:0 12px;height:66px;border-bottom:2px solid rgba(0,0,0,.08);padding:0 6px}
.q .n{font-family:Anton;font-size:24px;opacity:.35;text-align:center}
.q .m{display:flex;align-items:center;gap:8px;min-width:0;font-family:'Barlow Condensed';font-weight:800;font-size:29px;text-transform:uppercase;white-space:nowrap;overflow:hidden}
.q .m img{width:34px;height:34px;object-fit:contain;flex:none}
.q .w{font-family:'Barlow';font-weight:600;font-size:20px;opacity:.6;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:-2px}
.q .k{display:flex;gap:5px;justify-content:flex-end}
.q .k b{width:44px;height:44px;display:grid;place-items:center;border-radius:7px;font-family:Anton;font-size:26px;font-weight:400;color:rgba(11,13,16,.22);border:3px solid rgba(11,13,16,.12)}
.q .k b.on{background:var(--lime);color:var(--ink);border-color:var(--ink)}
.q .k b.dob{background:repeating-linear-gradient(135deg,var(--lime) 0 5px,#fff 5px 10px);color:var(--ink);border-color:var(--ink)}
.ley{display:flex;gap:26px;align-items:center;font-family:'Barlow Condensed';font-weight:800;font-size:26px;text-transform:uppercase;letter-spacing:.04em}
.ley i{display:inline-block;width:30px;height:30px;border:3px solid var(--ink);border-radius:6px;vertical-align:-7px;margin-right:8px}
.q.r{grid-template-columns:38px minmax(0,1fr) 112px 150px}
.q .r{font-family:Anton;font-size:34px;text-align:center}
.q.r .k{align-items:center;gap:8px}
.q.r .k b{width:auto;min-width:44px;padding:0 8px;color:var(--ink);border-color:var(--ink)}
.q .k i{font-style:normal;width:40px;height:40px;display:grid;place-items:center;border-radius:50%;font-family:Anton;font-size:26px;color:#fff}
.q.ok .k b{background:var(--lime)} .q.ok .k i{background:#1f9d4c}
.q.ko{background:rgba(230,40,60,.08)} .q.ko .k b{opacity:.45;text-decoration:line-through} .q.ko .k i{background:#d92b3a}
.q.p15{margin-top:10px;border-top:3px solid var(--ink)} .q.p15 .n{font-size:18px;opacity:.7}
.vv{display:flex;align-items:center;gap:22px;padding:22px 0;border-bottom:2px solid rgba(0,0,0,.1)}
.vv .t2{flex:1;font-family:Barlow;font-weight:600;font-size:31px;line-height:1.25}
.vv .t2 b{font-weight:800}
.fm{display:flex;gap:6px;margin-top:10px}
.fm i{width:30px;height:30px;border-radius:50%;display:grid;place-items:center;font-style:normal;font-family:'Barlow Condensed';font-weight:800;font-size:18px;color:#fff}
.fm .V{background:#1f9d4c}.fm .E{background:#9a9a9a}.fm .D{background:#d92b3a}
.vv .pk{display:flex;gap:5px}
.vv .pk b{min-width:52px;height:52px;padding:0 8px;display:grid;place-items:center;border-radius:8px;font-family:Anton;font-size:30px;font-weight:400;border:3px solid var(--ink);background:var(--lime)}
.vv .pk b.dob{background:repeating-linear-gradient(135deg,var(--lime) 0 5px,#fff 5px 10px)}
.vv img{width:84px;height:84px;object-fit:contain}
.vv .t{font-family:'Barlow Condensed';font-weight:800;font-size:40px;text-transform:uppercase;line-height:1.05}
.vv .t small{display:block;font-family:Barlow;font-weight:600;font-size:26px;text-transform:none;opacity:.65;margin-top:6px}
'''


def nombre(x): return NOMBRE.get(x, x.title().replace('.', '. ').replace('  ', ' '))


CORTO = {'Real Madrid': 'Madrid', 'Man. United': 'United', 'Man. City': 'City', 'Atlético': 'Atleti', 'Barcelona': 'Barça',
         'Bodø/Glimt': 'Bodø', 'Fenerbahçe': 'Fenerbahçe', 'Real Madrid F': 'Madrid'}
FEMENINOS = {'Roma', 'Real Sociedad', 'R. Sociedad', 'Lazio', 'Juventus', 'Fiorentina', 'Atalanta', 'Sampdoria', 'Real', 'Cultural'}


def corto(x):
    n = nombre(x); return CORTO.get(n, n.replace('R. Sociedad', 'Real Sociedad'))


def el(x, mayus=False):
    """«el Madrid», «la Roma»."""
    n = corto(x); a = 'la' if n in FEMENINOS else 'el'
    return (a.capitalize() if mayus else a) + ' ' + n


def de_el(x):
    t = el(x); return 'del ' + t[3:] if t.startswith('el ') else 'de ' + t


def logos(p):
    e = p.get('espn') or {}
    return (f'<img src="{LOGO.format(e["local_id"])}">' if e.get('local_id') else '',
            f'<img src="{LOGO.format(e["visitante_id"])}">' if e.get('visitante_id') else '')


def motivo(p, val):
    if p.get('motivo'): return p['motivo']
    pr = p['prob']; k = pr.index(max(pr)); eq = [nombre(p['local']), 'empate', nombre(p['visitante'])][k]
    racha = forma_texto(p)
    if p.get('signo_valor'):  # con las dos columnas: corto
        if p['signo_valor'] != p.get('signo_simple'): return f"Columna 2: {p['signo_valor']}"
        if racha: return racha
        if pr[k] >= 0.55: return f"{eq}, un {round(100 * pr[k])}%"
        return f"Igualado: {round(100 * pr[0])} - {round(100 * pr[1])} - {round(100 * pr[2])}"
    v = next((x for x in val if x['n'] == p['n']), None)
    if v:
        k2 = '1X2'.index(v['signo']); eq2 = [f"a {nombre(p['local'])}", 'al empate', f"a {nombre(p['visitante'])}"][k2]
        return f"La gente le da {eq2} un {round(100 * v['publico'])}%. Yo un {round(100 * v['prob'])}%"
    if len(p['signos']) > 1: return f"Igualado: {round(100 * pr[0])} - {round(100 * pr[1])} - {round(100 * pr[2])}" + (f" · {racha}" if racha else '')
    if pr[k] >= 0.75: return f"{eq} gana {round(100 * pr[k])} de cada 100"
    if racha: return f"{eq}, un {round(100 * pr[k])}% · {racha}"
    return f"{eq}, un {round(100 * pr[k])}%"


def forma_texto(p):
    """Una racha que se note (de sus últimos 5 partidos, en todas las competiciones)."""
    f = p.get('forma') or {}
    for lado, eq in (('local', p['local']), ('visitante', p['visitante'])):
        h = f.get(lado, '')
        v = len(h) - len(h.rstrip('V')); sin = len(h) - len(h.rstrip('ED'))
        if v >= 4: return f"{nombre(eq)}: {v} victorias seguidas"
        if sin >= 4: return f"{nombre(eq)}: {sin} sin ganar"
    return ''


def _racha(h):
    """('V', 5) si lleva 5 victorias seguidas; ('S', 4) si lleva 4 sin ganar; None si nada destacable."""
    v = len(h) - len(h.rstrip('V')); sin = len(h) - len(h.rstrip('ED'))
    return ('V', v) if v >= 3 else ('S', sin) if sin >= 3 else None


def _eleccion(p):
    base = p.get('signo_simple', p['signos'][:1])
    if p.get('signo_valor'):
        return base, (p['signo_valor'] if p['signo_valor'] != base else None)
    extra = [x for x in p['signos'] if x != base]
    return base, (extra[0] if extra else None)


FIJO = ['fijo', 'sin dudar', 'y a otra cosa', 'fijo']
GANA = ['llega con {n} victorias seguidas', 'ha ganado sus últimos {n} partidos', 'va lanzado: {n} victorias seguidas', 'suma {n} victorias seguidas']


COL2 = False


def _signo_txt(base, extra, fijo=True, k=0):
    if extra and COL2: return f"le pongo el {base}, y en la columna 2 el {extra}"
    if extra: return f"le pongo el {base}, con doble al {extra} por si acaso"
    return f"{base} {FIJO[k % len(FIJO)] if fijo else 'y que sea lo que Dios quiera'}"


def cambios_col2(o):
    """Los partidos donde la columna 2 cambia el signo, en una frase corta cada uno."""
    res = []
    for p in o['partidos'][:14]:
        base, extra = _eleccion(p)
        if not (extra and p.get('signo_valor')): continue
        k = '1X2'.index(extra); q = (p['fuentes'].get('publico') or [0, 0, 0])[k]
        a, b = logos(p); img = [a, a, b][k] or a
        que = 'empate' if extra == 'X' else f"el {extra}"
        txt = (f"<b>{nombre(p['local'])}–{nombre(p['visitante'])}.</b> Solo el {round(100 * q)}% de la gente pone {que} "
               f"y sale un {round(100 * p['prob'][k])}% de las veces. Lo meto en la columna 2.")
        res.append((img, txt, '', f'<b>{base}</b><b class="dob">{extra}</b>'))
    return res


def claves(o):
    """Las rachas más llamativas de la jornada, contadas como lo diría Toni, con la elección que justifican."""
    global COL2
    COL2 = any(p.get('signo_valor') for p in o['partidos'][:14])
    out = []
    for p in o['partidos'][:14]:
        f = p.get('forma') or {}
        base, extra = _eleccion(p)
        for lado, eq, rival in (('local', p['local'], p['visitante']), ('visitante', p['visitante'], p['local'])):
            r = _racha(f.get(lado, ''))
            if not r: continue
            tipo, n = r
            suyo = '1' if lado == 'local' else '2'
            donde = f"contra {el(rival)}" if lado == 'local' else f"en casa {de_el(rival)}"
            a_favor = base == suyo
            k = len(out)
            if tipo == 'V':
                gana = GANA[k % len(GANA)].format(n=n)
                txt = (f"<b>{el(eq, True)} {gana}.</b> {donde[:1].upper() + donde[1:]}, {_signo_txt(base, extra, k=k)}." if a_favor
                       else f"<b>{el(eq, True)} {gana}</b>, pero {donde} no me fío: {_signo_txt(base, extra, False)}.")
                peso = n + (1 if a_favor else 0)
            else:
                txt = (f"<b>{el(eq, True)} lleva {n} partidos sin ganar</b> y aun así {donde} {_signo_txt(base, extra, k=k)}." if a_favor
                       else f"<b>{el(eq, True)} lleva {n} partidos sin ganar.</b> {donde[:1].upper() + donde[1:]}, {_signo_txt(base, extra, k=k)}.")
                peso = n
            a, b = logos(p); img = a if lado == 'local' else b
            puntos = ''.join(f'<i class="{c}">{c}</i>' for c in f.get(lado, '')[-5:])
            pk = f'<b>{base}</b>' + (f'<b class="dob">{extra}</b>' if extra else '')
            out.append((peso + 0.5 * (len(p['signos']) == 1), p['n'], (img, txt, puntos, pk)))
    # Las más fuertes, una por partido
    vistos, res = set(), []
    for _, n, it in sorted(out, key=lambda x: -x[0]):
        if n in vistos: continue
        vistos.add(n); res.append(it)
    if res: return res
    # Sin rachas: los partidos con doble, explicados
    for p in o['partidos'][:14]:
        base, extra = _eleccion(p)
        if not extra: continue
        a, _ = logos(p); pr = p['prob']
        res.append((a, f"<b>{nombre(p['local'])}–{nombre(p['visitante'])}</b> está muy igualado ({round(100 * pr[0])}-{round(100 * pr[1])}-{round(100 * pr[2])}): "
                       f"{_signo_txt(base, extra)}.", '', f'<b>{base}</b><b class="dob">{extra}</b>'))
    return res


def descripcion(o, tipo):
    """El texto para TikTok, corto y en primera persona."""
    j = o['jornada']; dia = o.get('dia')
    serie = f"Día {dia} jugando a la Quiniela hasta que Claude haga pleno" if dia else f"Mi quiniela de la jornada {j}"
    if tipo == 'pronostico':
        if any(p.get('signo_valor') for p in o['partidos'][:14]):
            ch = [p for p in o['partidos'][:14] if p.get('signo_valor') and p['signo_valor'] != p.get('signo_simple')]
            nx = sum(p['signo_valor'] == 'X' for p in ch)
            return (f"{serie} 🤖\nColumna 1, lo que dice. Columna 2, {len(ch)} cambios que casi nadie juega"
                    + (f" ({nx} empate{'s' if nx > 1 else ''})" if nx else '') + ".\nCuál cambiarías?\n\n#quiniela #ia #laliga #futbol")
        return f"{serie}. Lo verde, sin dobles; lo rayado, con {o['dobles']} dobles.\nCuál cambiarías?\n\n#quiniela #futbol #laliga"
    r = o['revision']; jg = r.get('jugada')
    if jg:
        return (f"{serie}: {jg['columna1']} de {r['jugados']} 🤖\nColumna 2: {jg['columna2']}."
                + (f" Cobrado: {str(jg['premio']).replace('.', ',')} €." if jg['premio'] else '') + "\n\n#quiniela #ia #futbol")
    return f"{serie}: {r['aciertos_sin_dobles']} de {r['jugados']} 🤖\n\n#quiniela #ia #futbol"


def pagina(cuerpo):
    base = open(os.path.join(AQUI, 'post_base.html'), encoding='utf-8').read()
    return base + CSS + '</style></head><body>' + cuerpo + '</body></html>'


def marco(i, lima_izq, contenido, marca=True):
    return (f'<section class="s" id="s{i}"><div class="gl" style="top:0;height:330px"><i></i></div>'
            f'<div class="gl" style="top:330px;height:18px;{lima_izq};background:var(--lime)"></div>{contenido}'
            + ('<div class="brand" style="left:60px;bottom:300px"><img src="jornada90-logo.png">Síguenos · @jornada90fc</div>' if marca else '')
            + '<div class="grain"></div></section>')


def pronostico(o):
    col2 = any(p.get('signo_valor') for p in o['partidos'][:14])
    filas = []
    for p in o['partidos']:
        a, b = logos(p)
        if p['n'] == 15:
            k = f'<b class="on" style="width:auto;padding:0 14px">{p.get("signos", "")}</b>'
        else:
            base = p.get('signo_simple', p['signos'][:1])
            otros = p['signo_valor'] if p.get('signo_valor') else p['signos']
            k = ''.join(f'<b class="{"on" if s == base else "dob" if s in otros else ""}">{s}</b>' for s in '1X2')
        filas.append(f'<div class="q{" p15" if p["n"] == 15 else ""}"><span class="n">{"P15" if p["n"] == 15 else p["n"]}</span>'
                     f'<div><div class="m">{a}{nombre(p["local"])} – {nombre(p["visitante"])}{b}</div><div class="w">{motivo(p, o["valor"])}</div></div>'
                     f'<div class="k">{k}</div></div>')
    s1 = marco(1, 'left:420px;right:0', f'''
  <div class="chip" style="position:absolute;left:60px;top:385px;font-size:28px">{f"Día {o['dia']} · jugando hasta que Claude haga pleno" if o.get("dia") else f"Jornada {o['jornada']} · mi pronóstico"}</div>
  <h1 class="h" style="position:absolute;left:60px;width:640px;white-space:nowrap;top:440px;font-size:84px">Mi quiniela</h1>
  <div class="ley" style="position:absolute;right:160px;top:452px;flex-direction:column;align-items:flex-start;gap:8px">
    <span><i style="background:var(--lime)"></i>{"Columna 1" if col2 else "Sin dobles"}</span>
    <span><i style="background:repeating-linear-gradient(135deg,var(--lime) 0 5px,#fff 5px 10px)"></i>{"Columna 2" if col2 else f"+ {o['dobles']} dobles"}</span></div>
  <div style="position:absolute;left:60px;width:860px;top:560px">{"".join(filas)}</div>''', marca=False)
    lista = (cambios_col2(o) + [c for c in claves(o) if c[3].count('<b') == 1])[:4] if col2 else claves(o)[:4]
    items = ''.join(f'<div class="vv">{img}<div class="t2">{txt}<div class="fm">{puntos}</div></div><div class="pk">{pk}</div></div>'
                    for img, txt, puntos, pk in lista)
    r = o['resumen']
    s2 = marco(2, 'left:0;right:420px', f'''
  <h1 class="h" style="position:absolute;left:60px;width:860px;top:400px;font-size:92px">Por qué</h1>
  <div style="position:absolute;left:60px;width:860px;top:530px">{items}</div>
  <div style="position:absolute;left:60px;width:860px;top:1230px;background:var(--ink);color:#fff;padding:30px 40px">
    <div class="h" style="font-size:58px;color:var(--lime)">Cuál cambiarías?</div>
    <div class="lab" style="font-size:30px;margin-top:10px;opacity:.8">Al acabar la jornada subo cuántas acerté</div>
  </div>''')
    return pagina(s1 + s2)


def resultado(o):
    r = o['revision']; filas = []
    for p in o['partidos']:
        if not p.get('signo_real'): continue
        a, b = logos(p)
        if p['n'] <= 14 and r.get('jugada'):
            sg = p.get('signo_simple'); ok = p.get('acierto_simple')
        else:
            sg = p.get('signos', ''); ok = p.get('acierto') if p['n'] <= 14 else r['pleno15']
        filas.append(f'<div class="q r {"ok" if ok else "ko"}{" p15" if p["n"] == 15 else ""}"><span class="n">{"P15" if p["n"] == 15 else p["n"]}</span>'
                     f'<div class="m">{a}{nombre(p["local"])} – {nombre(p["visitante"])}{b}</div><div class="r">{p["resultado"]}</div>'
                     f'<div class="k"><b>{sg}</b><i>{"✓" if ok else "✕"}</i></div></div>')
    jg = r.get('jugada'); total = jg['columna1'] if jg else r['aciertos']
    s1 = marco(1, 'left:420px;right:0', f'''
  <div class="chip" style="position:absolute;left:60px;top:385px;font-size:28px">{f"Día {o['dia']} · jugando hasta que Claude haga pleno" if o.get("dia") else f"Jornada {o['jornada']} · así acabó"}</div>
  <div style="position:absolute;left:60px;width:860px;top:440px;display:flex;align-items:flex-end;justify-content:space-between">
    <h1 class="h" style="font-size:84px">Mi quiniela</h1>
    <div class="big" style="font-size:96px;background:var(--ink);color:var(--lime);padding:6px 20px 0">{total}/{r["jugados"]}</div></div>
  <div style="position:absolute;left:60px;width:860px;top:570px">{"".join(filas)}</div>
  {f'<div class="lab" style="position:absolute;left:60px;width:860px;top:1592px;font-size:30px">Columna 2: {jg["columna2"]} de {r["jugados"]}</div>' if jg else ''}''', marca=False)
    fallos = ''.join(f'<div style="display:flex;align-items:center;gap:16px;height:84px;border-bottom:2px solid rgba(0,0,0,.1);font-family:Barlow Condensed;'
                     f'font-weight:800;font-size:36px;text-transform:uppercase">{logos(o["partidos"][f["n"] - 1])[0]}'
                     f'{nombre(o["partidos"][f["n"] - 1]["local"])} {f["resultado"]} {nombre(o["partidos"][f["n"] - 1]["visitante"])}'
                     f'<span style="margin-left:auto;font-size:26px;opacity:.5">yo: {f["puse"]}</span></div>' for f in r['fallos'][:5])
    s2 = marco(2, 'left:0;right:420px', f'''
  <div class="big" style="position:absolute;left:60px;top:400px;font-size:300px;line-height:.9">{total}<span style="opacity:.25">/{r["jugados"]}</span></div>
  <div class="lab" style="position:absolute;left:60px;width:860px;top:700px;font-size:44px">Me tumbaron estas:</div>
  <div style="position:absolute;left:60px;width:860px;top:780px">{fallos}</div>
  <div style="position:absolute;left:60px;width:860px;top:1240px;background:var(--ink);color:#fff;padding:30px 40px">
    <div class="h" style="font-size:58px;color:var(--lime)">Cuántas sacaste tú?</div>
    <div class="lab" style="font-size:30px;margin-top:10px;opacity:.8">{f"Próximo: día {o['dia'] + 1}" if o.get("dia") else "La semana que viene, otra 👇"}</div></div>''')
    return pagina(s1 + s2)


if __name__ == '__main__':
    a = sys.argv[1:]
    tipo, j = a[0], int(a[1]); t = int(a[a.index('--temporada') + 1]) if '--temporada' in a else Q.temporada_actual()
    o = Q.leer(Q.ruta('jornadas', f'{t}-{j:02d}.json'))
    html = pronostico(o) if tipo == 'pronostico' else resultado(o)
    dst = Q.ruta('posts', f'{t}-{j:02d}-{tipo}.html'); os.makedirs(os.path.dirname(dst), exist_ok=True)
    open(dst, 'w', encoding='utf-8').write(html)
    open(dst.replace('.html', '.txt'), 'w', encoding='utf-8').write(descripcion(o, tipo))
    import shutil; shutil.copy(os.path.join(AQUI, '..', '..', 'jornada90-logo.png'), os.path.join(os.path.dirname(dst), 'jornada90-logo.png'))
    print(dst)
