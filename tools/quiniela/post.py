"""Fotos 9:16 para TikTok/Instagram de la quiniela (pronóstico o resultado), en el estilo de Jornada90.

  python3 tools/quiniela/post.py pronostico 19 [--temporada 2027]   → quiniela/posts/2027-19-pronostico.html
  python3 tools/quiniela/post.py resultado 19
  node tools/quiniela/render.mjs quiniela/posts/2027-19-pronostico.html  → los PNG al lado

Todo lo importante va dentro de la zona segura de TikTok (y 380–1640, x 60–920 en 1080×1920).
Si un partido del JSON tiene «motivo», se usa ese texto en vez del automático.
"""
import json, os, sys
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
.q.r{grid-template-columns:38px minmax(0,1fr) 112px 150px}
.q .r{font-family:Anton;font-size:34px;text-align:center}
.q.r .k{align-items:center;gap:8px}
.q.r .k b{width:auto;min-width:44px;padding:0 8px;color:var(--ink);border-color:var(--ink)}
.q .k i{font-style:normal;width:40px;height:40px;display:grid;place-items:center;border-radius:50%;font-family:Anton;font-size:26px;color:#fff}
.q.ok .k b{background:var(--lime)} .q.ok .k i{background:#1f9d4c}
.q.ko{background:rgba(230,40,60,.08)} .q.ko .k b{opacity:.45;text-decoration:line-through} .q.ko .k i{background:#d92b3a}
.q.p15{margin-top:10px;border-top:3px solid var(--ink)} .q.p15 .n{font-size:18px;opacity:.7}
.vv{display:flex;align-items:center;gap:22px;padding:26px 0;border-bottom:2px solid rgba(0,0,0,.1)}
.vv img{width:84px;height:84px;object-fit:contain}
.vv .t{font-family:'Barlow Condensed';font-weight:800;font-size:40px;text-transform:uppercase;line-height:1.05}
.vv .t small{display:block;font-family:Barlow;font-weight:600;font-size:26px;text-transform:none;opacity:.65;margin-top:6px}
'''


def nombre(x): return NOMBRE.get(x, x.title().replace('.', '. ').replace('  ', ' '))


def logos(p):
    e = p.get('espn') or {}
    return (f'<img src="{LOGO.format(e["local_id"])}">' if e.get('local_id') else '',
            f'<img src="{LOGO.format(e["visitante_id"])}">' if e.get('visitante_id') else '')


def motivo(p, val):
    if p.get('motivo'): return p['motivo']
    pr = p['prob']; f = p['fuentes']; k = pr.index(max(pr)); eq = [nombre(p['local']), 'empate', nombre(p['visitante'])][k]
    v = next((x for x in val if x['n'] == p['n']), None)
    if v:
        k2 = '1X2'.index(v['signo']); eq2 = [nombre(p['local']), 'el empate', nombre(p['visitante'])][k2]
        return f"La gente le da a {eq2} un {round(100 * v['publico'])}%. Yo un {round(100 * v['prob'])}%"
    if len(p['signos']) > 1: return f"Igualado: {round(100 * pr[0])} - {round(100 * pr[1])} - {round(100 * pr[2])}"
    if pr[k] >= 0.75: return f"{eq} gana {round(100 * pr[k])} de cada 100"
    return f"{eq}, un {round(100 * pr[k])}%"


def pagina(cuerpo):
    base = open(os.path.join(AQUI, 'post_base.html'), encoding='utf-8').read()
    return base + CSS + '</style></head><body>' + cuerpo + '</body></html>'


def marco(i, lima_izq, contenido, marca=True):
    return (f'<section class="s" id="s{i}"><div class="gl" style="top:0;height:330px"><i></i></div>'
            f'<div class="gl" style="top:330px;height:18px;{lima_izq};background:var(--lime)"></div>{contenido}'
            + ('<div class="brand" style="left:60px;bottom:300px"><img src="jornada90-logo.png">Síguenos · @jornada90fc</div>' if marca else '')
            + '<div class="grain"></div></section>')


def pronostico(o):
    filas = []
    for p in o['partidos']:
        a, b = logos(p)
        if p['n'] == 15:
            k = f'<b class="on" style="width:auto;padding:0 14px">{p.get("signos", "")}</b>'
        else:
            k = ''.join(f'<b class="{"on" if s in p["signos"] else ""}">{s}</b>' for s in '1X2')
        filas.append(f'<div class="q{" p15" if p["n"] == 15 else ""}"><span class="n">{"P15" if p["n"] == 15 else p["n"]}</span>'
                     f'<div><div class="m">{a}{nombre(p["local"])} – {nombre(p["visitante"])}{b}</div><div class="w">{motivo(p, o["valor"])}</div></div>'
                     f'<div class="k">{k}</div></div>')
    s1 = marco(1, 'left:420px;right:0', f'''
  <div class="chip" style="position:absolute;left:60px;top:385px;font-size:30px">Jornada {o["jornada"]} · mi pronóstico</div>
  <h1 class="h" style="position:absolute;left:60px;width:860px;top:440px;font-size:84px">Mi quiniela</h1>
  <div style="position:absolute;left:60px;width:860px;top:560px">{"".join(filas)}</div>''', marca=False)
    items = ''
    for v in o.get('inflados', [])[:4]:
        p = o['partidos'][v['n'] - 1]; a, b = logos(p)
        k = '1X2'.index(v['signo']); img = [a, a, b][k]
        eq = [nombre(p['local']), 'Empate', nombre(p['visitante'])][k]
        donde = f"en el {nombre(p['local'])}–{nombre(p['visitante'])}" if k != 0 else f"contra el {nombre(p['visitante'])}"
        items += (f'<div class="vv">{img}<div class="t">{eq} {donde}'
                  f'<small>La gente: {round(100 * v["publico"])}%. Las cuentas: {round(100 * v["prob"])}%</small></div></div>')
    r = o['resumen']
    s2 = marco(2, 'left:0;right:420px', f'''
  <h1 class="h" style="position:absolute;left:60px;width:860px;top:400px;font-size:92px">{"Aquí la gente se pasa" if items else "Cuál cambiarías?"}</h1>
  <div style="position:absolute;left:60px;width:860px;top:{620 if items else 420}px">{items}</div>
  <div style="position:absolute;left:60px;width:860px;top:1230px;background:var(--ink);color:#fff;padding:30px 40px">
    <div class="h" style="font-size:58px;color:var(--lime)">{"Cuál cambiarías?" if items else "Pon la tuya 👇"}</div>
    <div class="lab" style="font-size:30px;margin-top:10px;opacity:.8">Al acabar la jornada subo cuántas acerté</div>
  </div>''')
    return pagina(s1 + s2)


def resultado(o):
    r = o['revision']; filas = []
    for p in o['partidos']:
        if not p.get('signo_real'): continue
        a, b = logos(p)
        ok = p.get('acierto') if p['n'] <= 14 else r['pleno15']
        filas.append(f'<div class="q r {"ok" if ok else "ko"}{" p15" if p["n"] == 15 else ""}"><span class="n">{"P15" if p["n"] == 15 else p["n"]}</span>'
                     f'<div class="m">{a}{nombre(p["local"])} – {nombre(p["visitante"])}{b}</div><div class="r">{p["resultado"]}</div>'
                     f'<div class="k"><b>{p.get("signos", "")}</b><i>{"✓" if ok else "✕"}</i></div></div>')
    s1 = marco(1, 'left:420px;right:0', f'''
  <div class="chip" style="position:absolute;left:60px;top:385px;font-size:30px">Jornada {o["jornada"]} · así acabó</div>
  <div style="position:absolute;left:60px;width:860px;top:440px;display:flex;align-items:flex-end;justify-content:space-between">
    <h1 class="h" style="font-size:84px">Mi quiniela</h1>
    <div class="big" style="font-size:96px;background:var(--ink);color:var(--lime);padding:6px 20px 0">{r["aciertos"]}/{r["jugados"]}</div></div>
  <div style="position:absolute;left:60px;width:860px;top:570px">{"".join(filas)}</div>''', marca=False)
    fallos = ''.join(f'<div style="display:flex;align-items:center;gap:16px;height:84px;border-bottom:2px solid rgba(0,0,0,.1);font-family:Barlow Condensed;'
                     f'font-weight:800;font-size:36px;text-transform:uppercase">{logos(o["partidos"][f["n"] - 1])[0]}'
                     f'{nombre(o["partidos"][f["n"] - 1]["local"])} {f["resultado"]} {nombre(o["partidos"][f["n"] - 1]["visitante"])}'
                     f'<span style="margin-left:auto;font-size:26px;opacity:.5">yo: {f["puse"]}</span></div>' for f in r['fallos'][:5])
    s2 = marco(2, 'left:0;right:420px', f'''
  <div class="big" style="position:absolute;left:60px;top:400px;font-size:300px;line-height:.9">{r["aciertos"]}<span style="opacity:.25">/{r["jugados"]}</span></div>
  <div class="lab" style="position:absolute;left:60px;width:860px;top:700px;font-size:44px">Me tumbaron estas:</div>
  <div style="position:absolute;left:60px;width:860px;top:780px">{fallos}</div>
  <div style="position:absolute;left:60px;width:860px;top:1240px;background:var(--ink);color:#fff;padding:30px 40px">
    <div class="h" style="font-size:58px;color:var(--lime)">Cuántas sacaste tú?</div>
    <div class="lab" style="font-size:30px;margin-top:10px;opacity:.8">La semana que viene, otra 👇</div></div>''')
    return pagina(s1 + s2)


if __name__ == '__main__':
    a = sys.argv[1:]
    tipo, j = a[0], int(a[1]); t = int(a[a.index('--temporada') + 1]) if '--temporada' in a else Q.temporada_actual()
    o = Q.leer(Q.ruta('jornadas', f'{t}-{j:02d}.json'))
    html = pronostico(o) if tipo == 'pronostico' else resultado(o)
    dst = Q.ruta('posts', f'{t}-{j:02d}-{tipo}.html'); os.makedirs(os.path.dirname(dst), exist_ok=True)
    open(dst, 'w', encoding='utf-8').write(html)
    import shutil; shutil.copy(os.path.join(AQUI, '..', '..', 'jornada90-logo.png'), os.path.join(os.path.dirname(dst), 'jornada90-logo.png'))
    print(dst)
