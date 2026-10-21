---
name: stitch
description: Hace el final de un Stitch de TikTok para Jornada90. Toni pasa una captura (o el enlace) del vídeo de otra cuenta que quiere pegar («Compartir → Pegar») y Claude genera con el Studio un vídeo corto, de 8 a 15 s, que contesta a lo que se ve en ese vídeo, con su descripción para TikTok. Úsala con /stitch o cuando pida «un final para pegar», «una respuesta para un Stitch» o algo parecido.
---

# /stitch · el final de un Stitch

Toni (Jornada90, @jornada90fc en TikTok) quiere publicar Stitch: los 5 primeros segundos son de
otra cuenta (un gol, un jugador con el trofeo, una polémica…) y luego va un vídeo corto suyo que
**contesta a eso**. Tú haces ese vídeo corto con el Studio (`tools/corto.mjs`) y se lo pasas.

Háblale en español, corto y sin jerga técnica (no programa). No le enseñes JSON ni comandos.

## 1. Qué hay en el vídeo que va a pegar

- Lo normal es que mande una **captura**. Si solo manda un enlace, intenta deducir el partido por
  el texto del enlace o de la captura; si no puedes, pídele una captura donde se vea.
- Saca: el **partido** (equipos y día), **qué se ve** (el gol de X en el minuto Y, X con el trofeo
  de jugador del partido, una roja, una celebración…), **de quién es la cuenta** y el **jugador o
  equipo** protagonista.
- Si no está claro qué partido es o qué se ve, pregúntaselo antes de hacer nada.

## 2. El partido en ESPN

Las competiciones del Studio están en `piloto.json` (`competiciones`). Con el día (AAAA-MM-DD,
hora de Madrid; si no lo dice, hoy o ayer):

```bash
curl -sS "https://site.api.espn.com/apis/site/v2/sports/soccer/<liga>/scoreboard?dates=AAAAMMDD" \
  | python3 -c "import sys,json; [print(e['id'], e['name'], e['status']['type']['description']) for e in json.load(sys.stdin)['events']]"
```

El partido es `<liga>/<id>` (p. ej. `uefa.champions/401915399`). Tiene que estar **acabado**.

Los datos, del resumen del partido. Los goles, las tarjetas y quién jugó:

```bash
curl -sS "https://site.api.espn.com/apis/site/v2/sports/soccer/<liga>/summary?event=<id>" > /tmp/sum.json
python3 - <<'PY'
import json; d = json.load(open('/tmp/sum.json'))
for e in d.get('keyEvents', []):
    print(e.get('clock', {}).get('displayValue'), e.get('type', {}).get('text'), e.get('text', '')[:120])
for r in d.get('rosters', []):
    for p in r.get('roster', []):
        s = {x['name']: x['value'] for x in p.get('stats', []) if x.get('value')}
        print(r['team']['abbreviation'], p['athlete']['displayName'], s)
PY
```

Por jugador, ESPN solo da goles, asistencias, tiros (y a puerta), paradas, faltas y tarjetas: no
da pases ni precisión. Las estadísticas de equipo están en `boxscore.teams[].statistics`. Si te hace falta algo más
(rachas, historial), búscalo en ESPN o en la web.

**Nunca te inventes un número.** Todo lo que salga en el vídeo tiene que estar en ESPN o en una
fuente que hayas mirado. Si no lo encuentras, no lo pongas.

## 3. El guion

Contesta a lo que se ve en esos 5 segundos: si es Doué con el trofeo, «por qué fue el mejor»; si
es el gol de Vitinha, sus números y lo que cambió el gol; si es una roja, la polémica. Corto:
**2 o 3 escenas, la pregunta y la marca** (8-15 s), y que la primera ya enseñe algo (va justo
después del corte).

| escena | qué es | dura |
|---|---|---|
| `marcador` | el resultado, cada equipo en su mitad, con una cinta (`titular`) | 1,6 s |
| `jugador` | un jugador con su cara, su nombre y hasta 3 números grandes | 4,8 s |
| `dato` | un número gigante y lo que significa | 3,2 s |
| `polemica` | la jugada polémica del partido (si ESPN la tiene) | 4,8 s |
| `posesion` | la posesión y debajo tiros, pases, córners… | 3,2 s |
| `estadisticas` | 3-5 estadísticas de los dos | 3,2-4,8 s |
| `tabla` | cómo va la clasificación | 3,2 s |
| `pregunta` | la pregunta para que comenten («Te leo en comentarios») | 3,2 s |
| `marca` | el logo de Jornada90 (siempre al final) | 1,6 s |

El guion es un JSON, todo opcional:

```json
{
  "escenas": ["jugador", "dato", "pregunta", "marca"],
  "jugador": "Vitinha",
  "etiqueta": "Los números de",
  "numeros": [{ "v": "81'", "texto": "Su gol, el 3-2" }, { "v": "94%", "texto": "Pases buenos" }],
  "dato": { "grande": "3", "texto": "goles del PSG en los últimos 15 minutos", "equipo": "PSG" },
  "pregunta": "¿El mejor medio de Europa?",
  "titular": "Vitinha lo cambió todo",
  "equipo": "PSG"
}
```

- `jugador`: su nombre, su apellido o su id de ESPN. Sin él, el mejor del partido (el de la slide).
- `etiqueta`: lo de encima de su nombre; la primera palabra va en color. Por defecto «Jugador del
  partido»: cámbiala si no lo es («Los números de», «El gol de»).
- `numeros`: hasta 3 (el número y lo que es). Sin ellos, los de la slide (goles, asistencias, tiros…).
- `dato`: `grande` es el número (corto: «12», «3», «1ª») y `texto` lo que significa; la última línea
  sale en color.
- `pregunta`: corta y que se pueda contestar con una palabra o un nombre.
- `equipo` (local, visitante o su nombre): de qué equipo son los colores del dato y la pregunta.
- Textos cortos: en pantalla caben 2-3 palabras por línea.

## 4. Hacerlo

La primera vez en la sesión, las librerías (tarda unos segundos):

```bash
npm install --no-save --no-package-lock --silent playwright-core@1 html2canvas@1.4.1 jszip@3.10.1 mp4-muxer@5.2.1 three@0.186.1
```

Luego (unos 30 s), con el vídeo en la carpeta de borradores de la sesión (scratchpad), nunca en el repo:

```bash
node tools/corto.mjs <liga>/<id> '<guion en JSON>' --dia AAAA-MM-DD --salida <scratchpad>/stitch-<algo>.mp4
```

Escribe en la consola el archivo, las escenas que lleva, lo que dura y un `aviso` si se ha saltado
alguna escena porque el partido no tiene esos datos. Si falla, dice por qué (un jugador que no
encuentra, una escena que no existe, un partido que no está).

## 5. Revisarlo antes de pasarlo

Saca una tira de fotogramas y **mírala**:

```bash
ffmpeg -v error -y -i <video>.mp4 -vf "select='not(mod(n,12))',scale=162:288,tile=11x3" -frames:v 1 <scratchpad>/tira.png
```

Mira que los textos se lean y no se corten, que la cara sea la del jugador, que los números sean
los buenos y que la primera escena enseñe algo desde el principio. Si algo no está bien, cambia el
guion y vuelve a hacerlo.

## 6. Pasárselo

1. El vídeo, con la herramienta para mandar archivos (SendUserFile).
2. La **descripción** para TikTok, lista para copiar: qué contesta, el resultado, la pregunta y
   5 hashtags (`#futbol`, la competición, los dos equipos y `#deportesentiktok`).
3. Los pasos, en una línea: en su vídeo, **Compartir → Pegar** → elige los 5 segundos → **Subir**
   → este vídeo → pega la descripción.

Si en esa cuenta no sale «Pegar», la cuenta lo tiene desactivado: que pruebe con la oficial
(@championsleague lo deja; Movistar Plus+ no). **Nunca** le propongas descargar el vídeo de otra
cuenta y subirlo: solo Stitch, que TikTok permite y acredita solo.
