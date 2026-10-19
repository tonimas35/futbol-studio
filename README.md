# Studio Fútbol

Mi herramienta para hacer contenido de fútbol: eliges competición, día y partido, y sale un carrusel de hasta 9 slides (1080×1350) para Instagram o TikTok y un vídeo short con música y subtítulos, con los datos de ESPN. Se retoca en la propia página y se descarga en PNG, ZIP o MP4.

Es solo para mí. Se usa en la web (https://tonimas35.github.io/futbol-studio/, también en el móvil) o abriendo `index.html` en el ordenador. Con el **piloto automático**, el vídeo de cada partido de LaLiga se hace solo al pitido final y llega al móvil.

## Cómo abrirlo

1. Descarga el repo: en GitHub, **Code → Download ZIP** (y descomprímelo), o `git clone`.
2. Doble clic en `index.html`. Mejor con Chrome o Edge.
3. Hace falta internet: los partidos vienen de ESPN y las fuentes, de Google Fonts.

Para tener la última versión, vuelve a descargarlo o haz `git pull`. Para el móvil, ver «En el móvil». El borrador, la firma y la competición se guardan en ese navegador.

## En el móvil: la web

El Studio está publicado en **https://tonimas35.github.io/futbol-studio/** (GitHub Pages: gratis y sin límite de publicaciones porque el repo es público). En el móvil, abre esa dirección y **Compartir → Añadir a pantalla de inicio**: sale con su icono. Hace falta HTTPS para el vídeo, compartir y copiar, y GitHub Pages lo tiene.

**Cuándo se publica:** con cada cambio que entra en `main` y cada vez que el piloto automático hace un vídeo (`.github/workflows/web.yml`; tarda un par de minutos). Solo se publica la página: ni las pruebas ni este README. La dirección no sale en buscadores (`noindex`), pero quien la tenga puede abrirla; dentro no hay nada privado (los datos son de ESPN y tus borradores, tu clave y tu firma se quedan en tu navegador). Lo que hagas en el móvil se guarda en el móvil, y lo del ordenador, en el ordenador.

**La dirección de antes (`studio-toni.netlify.app`)** ya no existe: el proyecto de Netlify se borró el 18-10-2026. Lo que tuvieras guardado allí (la clave de API-Football, los borradores) no pasa a esta dirección: la clave se vuelve a pegar una vez.

## Las notas de los jugadores (API-Football)

En la web, el Studio añade la nota de cada jugador y su cara, de [API-Football](https://www.api-football.com):

- **«Las notas»:** una slide nueva, tras el jugador del partido, con los que han jugado de cada equipo, de mejor a peor nota, con su cara y la nota en color (verde, amarillo, naranja o rojo). El de la nota más alta, marcado.
- **Jugador del partido:** el de la nota más alta, con «Nota 8,9» como primer número (también en el vídeo y el guion: «un 8,9 de nota»). Si no hay foto grande, su cara en un retrato redondo con el escudo y, debajo, lo que más destaca de su partido (pases, duelos ganados, regates, entradas…).
- **«Líderes del partido»:** el mejor en cada cosa (más pases, pases clave, regates completados, duelos ganados, entradas, intercepciones, tiros, paradas, faltas recibidas), con su cara, su escudo y el número en grande. Solo las que llegan a un mínimo (30 pases, 2 regates…), hasta 8.
- **«Los onces»:** la cara de cada jugador en su círculo, con el dorsal al lado (si la foto no carga, el dorsal como siempre).
- A quien no tiene foto, API-Football le da una silueta gris: el Studio la detecta y pone el dorsal con los colores del equipo.
- En el pie de foto, la nota del jugador del partido; en «Para tu IA», las 5 mejores de cada equipo.

Cómo se conecta: pega tu clave en **«Tu clave de API-Football»** (Paso 2; está en dashboard.api-football.com → Profile → API-KEY). Se guarda solo en ese navegador, así que en cada móvil u ordenador se pone una vez, y el Studio pide los datos desde ahí, directamente a API-Football. **No pasa por ningún servidor a propósito:** API-Football suspende las cuentas que piden desde IPs compartidas (como AWS Lambda, donde corrían las funciones de Netlify, o GitHub Actions); le pasó a la tuya el primer día. Por eso el piloto automático hace sus vídeos sin notas. Cada partido gasta 2 peticiones (los partidos del día y los jugadores de ese partido; si lo rehaces, se reutilizan); el plan gratis da 100 al día y solo deja los partidos de ayer, hoy y mañana (para uno más antiguo, el carrusel sale sin notas y el aviso lo dice).

El partido se busca por la hora (±30 minutos), el resultado y los nombres de los equipos; los jugadores se emparejan por el dorsal (o, si no, por el apellido). Si API-Football no deja (el plan no incluye esa temporada, se acabaron las peticiones del día…), el carrusel sale igual, sin notas, y el aviso dice lo que ha contestado. Sin clave, todo igual, sin notas.

## En directo

Arriba del todo, «Los partidos de hoy»: eliges qué competiciones vigilar (las de siempre se recuerdan) y activas **Vigilar**. Con la pestaña abierta:

- Cada minuto mira ESPN y enseña los partidos de hoy: en juego (con el minuto), los que faltan y los acabados. De madrugada también enseña los de ayer, porque los de América acaban pasada la medianoche.
- Cuando acaba un partido, avisa: la tarjeta se ilumina con «Nuevo», la pestaña dice «(1) Final · …», suena un aviso corto y, si el navegador lo permite, sale una notificación.
- «Generar →» en la tarjeta elige la competición, el día y el partido, genera el carrusel y, en cuanto está, crea el vídeo: en un clic tienes el carrusel, el vídeo y la descripción para TikTok listos para revisar y publicar.
- «↻ Actualizar» mira ESPN en ese momento; «×» deja de vigilar una competición y «+ Añadir competición» suma otra.

### Al pitido final: un enlace que lo hace todo

`https://tonimas35.github.io/futbol-studio/?partido=esp.1/401882846` abre el Studio, elige la competición, busca el partido (hoy o ayer; si es de otro día, `&dia=2026-10-17`), genera el carrusel y crea el vídeo, con la descripción para TikTok escrita. El número es el del partido en ESPN (sale en la dirección de su ficha). Al abrirlo se borra de la barra, para que recargar no lo repita.

## La polémica

Al generar un partido, el Studio busca en la narración de ESPN (la misma que trae los goles, gratis) lo que más se va a discutir. Busca en este orden, y si hay varias del mismo tipo, coge la última:

1. Un gol que **anula el VAR**.
2. Un **penalti que el VAR da**.
3. Un **penalti que el VAR quita**.
4. Una **amarilla que el VAR cambia por roja**.
5. Una **roja directa**.

Cada polémica sale con su minuto y con cómo iba el marcador. Con ella:

- **La descripción para TikTok empieza por ella:** «😱 El VAR le anula un gol al Betis · Betis 2-5 Barcelona». Las del VAR mandan sobre «El dato»; la roja, solo si no hay dato.
- **La pregunta del cierre es la suya** y se entiende sola, sin contexto: «¿Bien anulado el gol del Betis?», «¿Era penalti a favor del Elche?», «¿Era roja para Facundo Bernal?». Vale para el carrusel, el vídeo y la descripción. Las polémicas son lo que más comentarios trae.
- **En el vídeo:**
  - la apertura (la portada) la cuenta: «POLÉMICA · El VAR le anula un gol al Betis»;
  - tras el marcador sale la escena **«LA POLÉMICA»**: el minuto en grande, qué pasó, quién, cómo iba («Así iba Betis 1-2 Barcelona») y la pregunta;
  - su frase va en el guion.

Sin nada de eso, todo sale como siempre. El robot lo hace igual, sin hacer nada.

## Previa de un partido

Con un partido que aún no ha empezado, en vez de «Generar carrusel» sale **«Crear previa (vídeo)»**: un vídeo de unos 20 segundos para subir antes del partido, con lo de ESPN del propio partido:

- **Apertura:** «PREVIA», el gancho («El Real Madrid ganó los 5 últimos» si uno ganó todos los cara a cara; si no, «… llega con 4 victorias en 5» si uno llega muy bien; si no, los dos equipos) y cuándo («HOY · 21:00»).
- **Cómo llegan:** los últimos 5 partidos oficiales de cada uno (sin amistosos: si había alguno, quedan menos y la descripción no dice «Últimos 5»), con el resultado, el rival y la cuenta («4G · 0E · 1P»).
- **Cara a cara:** los ganados por cada uno y los empates en grande, y los últimos 5 partidos entre ellos.
- **Sus goleadores:** el que más marca de cada uno esta temporada («Mbappé, 7 goles en 8 partidos»).
- **La clasificación** («Así llegan en LaLiga») y el cierre: **«¿Quién gana?»**.

Con su descripción para TikTok: «🔥 PREVIA · Real Madrid – Sevilla», la hora, cómo llegan, el cara a cara, la pregunta y los hashtags (con `#previa`). `?previa=esp.1/401882839` (y `&dia=` si no es de hoy ni de mañana) la crea sola.

## Piloto automático: el vídeo hecho y en el móvil al pitido final

Sin abrir el Studio: cuando acaba un partido, un robot hace el vídeo y te llega un aviso al móvil. Lo tocas, **Compartir vídeo** y a TikTok (la descripción se copia sola: mantén pulsado y pega).

- **Qué partidos:** los de LaLiga y, en la Copa, la Supercopa, las competiciones europeas y el Mundial de Clubes, los que juega un equipo de LaLiga (`piloto.json`): así entran todos los del Real Madrid y el Barça menos los amistosos, que el Studio no tiene. Solo los que empezaron hace menos de 5 horas, y uno por partido.
- **Cómo:** GitHub Actions (`.github/workflows/piloto.yml`, gratis en un repo público). El reloj es el **vigía** (`.github/workflows/vigia.yml`): cada 10 minutos, todo el día, mira ESPN y, si hay algo que hacer, lanza el piloto. GitHub no lanzaba el horario del piloto (ni una vez), así que el vigía da vueltas de 5 h 45 min y cada una lanza la siguiente al acabar. Para pararlo: **Actions → Vigía → «…» → Disable workflow**; para encenderlo, **Enable workflow** y **Run workflow**. Cuando un partido va por el final (en juego y a más de 80 minutos del inicio), se queda vigilándolo cada 30 segundos con el navegador y ffmpeg ya preparados, así que el aviso llega a los 3 o 4 minutos del pitido final. Abre el Studio en un Chrome con el enlace del pitido final (`tools/piloto.mjs`), con lo de por defecto (sin música, la firma y el logo de Jornada90, en español y claro), lo pasa a H.264 (el del iPhone) y lo deja en la web (`v/<id>.mp4`, con su descripción en `v/<id>.json`). Te avisa con [ntfy](https://ntfy.sh) («⚽ Real Madrid 2-1 Sevilla» y la descripción); el aviso abre `?video=<id>`: el vídeo, «Compartir vídeo», «Descargar» y la descripción para copiar.
- **Sin notas:** desde los servidores de GitHub, API-Football suspendería la cuenta. Si las quieres, hazlo en el Studio como siempre.
- **Con caras:** las del repo (`caras/`). En el Studio, con tu clave, **Caras para el robot** (debajo de la clave) baja las plantillas de los equipos de LaLiga de API-Football (unas 25 de tus peticiones; tarda unos 3 minutos) en `laliga.json`. Lo subes a la carpeta `caras` del repo (**Add file → Upload files**) y `.github/workflows/caras.yml` baja las fotos, que van sin clave y no gastan peticiones. El robot pone la cara en «Jugador del partido» (si no tiene foto grande en ESPN; también en el vídeo) y en «Los onces». A cada jugador se le busca por el apellido (y, si hay dos, por el dorsal): si no está, sin cara. Repítelo cuando cambien las plantillas (en septiembre y en enero): el que no salga se queda como estaba.
- **La portada:** el primer fotograma ya lleva el resultado (el gancho y, debajo, «REAL MADRID 2-1 SEVILLA» en verde), que es la portada que pone TikTok si no eliges otra.
- **Dónde se guardan:** en la release `videos` del repo (se borran solos a los 7 días; en la web están los de los últimos 3).
- **La previa, 3 horas antes de los partidos grandes:** los del Real Madrid, el Barça y el Atlético en cualquier competición y todos los de la Champions (`previas` en `piloto.json`: `equipos` y `competiciones`, enteras). En una jornada de Champions son unas 9 por día: tú eliges cuáles subir. Te llega «🔥 Previa · Real Madrid – Sevilla» con el vídeo y su descripción, igual que los del pitido final.
- **El resumen de la jornada, al acabar su último partido:** cuando termina el último partido de la jornada de LaLiga (la jornada son los partidos de los días de alrededor mientras ningún equipo repita, como en el Studio), el robot hace «Resumen de la jornada» en 9:16 y te llega «📊 Así fue la jornada · LaLiga · 16-19 oct 2026». Al tocarlo, las fotos en orden (portada, resultados, clasificación y cierre) con **«Compartir N fotos»**, que las manda todas a la vez (a TikTok como carrusel de fotos) con la descripción ya copiada. `?jornada=esp.1&dia=2026-10-19` la hace sola en el Studio.
- **A mano:** en GitHub, **Actions → Piloto automático → Run workflow**, con el partido (`liga/id`, p. ej. `esp.1/401882846`; para su previa, `previa:esp.1/401882846`; para el resumen de la jornada, `jornada:esp.1`) y, si no es de hoy, su día: lo hace (o lo rehace) y avisa.

**La voz del robot (ElevenLabs):** con la clave y la voz puestas, el guion de cada vídeo (y de cada previa) se dice con tu voz clonada o con una de la biblioteca de ElevenLabs. Sin ellas, o si ElevenLabs falla (sin saldo, caído), el vídeo sale como siempre, con subtítulos. Para ponerla:

1. En [elevenlabs.io](https://elevenlabs.io), una cuenta con el plan **Starter** o mejor: el gratis no deja clonar ni publicar (sin licencia comercial).
2. **Voices → Add a new voice → Instant Voice Clone:** sube o graba 1 o 2 minutos de tu voz, limpia, sin ruido y en el tono en que narrarías (por ejemplo, leyendo un guion del Studio). Copia su **Voice ID**.
3. **Developers → API Keys → Create:** con permiso de Text to Speech. Copia la clave. No la pegues en ningún chat.
4. En GitHub: **Settings → Secrets and variables → Actions**.
   - En **Secrets**, `ELEVENLABS_API_KEY` con la clave.
   - En **Variables**, `ELEVENLABS_VOICE_ID` con el Voice ID.

Cada vídeo son unos 450 caracteres de guion (la previa, unos 250). En `piloto.json` → `voz` se cambia el modelo (`eleven_multilingual_v2`, el más natural en español, gasta un crédito por carácter) y la velocidad (1,05). La clave solo la usa el robot (`tools/piloto.mjs`), fuera de la página.

**Para recibir los avisos:** instala la app **ntfy** (gratis y sin cuenta) y suscríbete al tema `jornada90-40dc7171c6b9c5a9` (el de `piloto.json`). El tema está en el repo, que es público: quien lo lea podría suscribirse (solo vería tus vídeos, que son para publicar) o mandarte avisos. Para cambiarlo sin que salga en el repo, pon otro en **Settings → Secrets and variables → Actions → Variables** como `NTFY_TOPIC`.

## En inglés

En «Idioma», **English** pasa a inglés todo lo que se publica: las slides, el vídeo (marcas, rótulos y cierre), el guion automático, el resumen de la jornada, el pie de foto con sus hashtags y «Para tu IA» (que pide la respuesta en inglés). La interfaz del Studio sigue en español.

- Inglés británico, el del fútbol: «Full time», «Half-time», «Line-ups», «Player of the match», «(pen)», «(og)», «Real Madrid complete the comeback», «Spain are champions».
- Los equipos, con su nombre en inglés: Bayern Munich, Inter, Spain, Germany, Man Utd, Spurs… Las competiciones y las rondas también (Champions League · League phase, Quarter-finals, 2nd leg, Agg. 3-1).
- Al cambiar de idioma se vuelven a generar el partido y la jornada que haya en pantalla (avisa antes si hay textos retocados a mano). Se recuerda para la próxima vez.

Para tener una cuenta en español y otra en inglés, se genera el partido una vez en cada idioma.

## Cómo se usa

1. **Competición:** 43, cada una con su logo y agrupadas.
   - España: LaLiga, LaLiga Hypermotion, Copa del Rey, Supercopa y Liga F.
   - Europa: Champions, Europa League, Conference, Supercopa de Europa y Champions femenina.
   - Inglaterra: Premier, Championship, FA Cup y Carabao Cup.
   - Italia: Serie A, Serie B y Coppa Italia.
   - Alemania: Bundesliga, 2. Bundesliga y Copa de Alemania.
   - Francia: Ligue 1, Ligue 2 y Copa de Francia.
   - Más ligas: Portugal, Países Bajos, Escocia, Turquía, Bélgica, Arabia Saudí y MLS.
   - Selecciones: Mundial, Eurocopa, Nations League, Copa América, la clasificación para el Mundial y para la Eurocopa, y amistosos.
   - América y mundo: Libertadores, Sudamericana, Liga MX, Argentina, Brasileirão y Mundial de Clubes.
   - Se recuerda la última elegida.
2. **Día y partido:** por defecto, hoy. Si ese día no hay partidos de la competición, salen botones para saltar al día con partidos anterior y al siguiente (en el Mundial, por ejemplo, a la última final). Los que no han empezado o están aplazados no se pueden generar. Uno en juego sí, avisando de que las slides cuentan el marcador de ese momento. En las eliminatorias, la tarjeta dice la ronda, si es la ida o la vuelta y el global.
3. **Generar:** salen las slides. Las que no tienen datos no salen; un amistoso sin alineaciones, por ejemplo, se queda en 4.
   - **Portada:** el marcador con cada equipo en su mitad, los goleadores y las rojas, el logo de la competición con la ronda (y si es la ida o la vuelta, con el global), y un titular automático: remontada, gol decisivo al final, goleada, festival de goles, por la mínima, empate… En las eliminatorias, lo que importa: «El Flamengo pasa a semifinales», «El Palmeiras pasa en los penaltis», «España, campeona». Abajo, algo que invite a deslizar: «El dato» a medias («EL DATO · 22 años después ▶») o, si no hay, lo mejor de dentro («DESLIZA · el mejor del partido y el mapa de tiros ▶»).
   - **El dato:** lo que te diferencia de las otras cuentas: una racha, un cara a cara o un «primera vez desde…», sacado del historial de ESPN de los dos equipos (ver «El dato», abajo). Si no hay ninguno que merezca la pena, no sale.
   - **Minuto a minuto:** la línea del partido con los goles (cómo y la asistencia), las rojas, los penaltis fallados y el marcador del descanso; y, en pequeño, las amarillas y los cambios (▲ entra ▼ sale). Cada cosa va junto a su minuto sin pisarse; si en una parte no cabe todo, se quitan primero los cambios y luego las amarillas de esa parte, nunca los goles. Si ESPN no tiene los goles (pasa en las primeras rondas de alguna copa), no sale.
   - **Estadísticas:** posesión, tiros, a puerta, pases con su precisión, córners, paradas, faltas y tarjetas. El número peor sale apagado.
   - **Mapa de tiros:** el campo entero. El local tira hacia la izquierda y el visitante hacia la derecha; los goles llevan la línea hasta la portería.
   - **Los onces:** las dos alineaciones en el campo con su sistema, los goles, las tarjetas y el minuto del cambio.
   - **Jugador del partido:** con las notas de API-Football, el de la nota más alta (como el «jugador del partido» de FotMob o Sofascore; la API no da uno oficial). Sin ellas, sale por goles, asistencias, tiros, paradas y resultado, y cómo marcó: el golazo desde fuera del área o de falta cuenta más, el de penalti algo menos y abrir el marcador un poco más. El desplegable de la slide deja elegir a otro.
   - **Clasificación:** 12 filas con los dos equipos marcados, con «···» si están lejos. Si el resumen de ESPN no la trae (la Europa League, la Conference…), se pide aparte. Al pitido final, ESPN tarda un rato en contar el partido: si a un equipo le falta justo ese (lleva uno menos que en su calendario), el Studio le suma el resultado y lo pone en su sitio.
   - **Cierre:** una pregunta para los comentarios y tu firma.
   - **El aspecto:** los fondos se pintan en el navegador (html2canvas no exporta filtros ni mezclas): el degradado de cada equipo con haces de luz en diagonal, una trama de puntos en una esquina y una viñeta. Las slides de datos (minuto a minuto, mapa de tiros, notas, clasificación y las de la jornada) van, según el **Estilo** (junto al idioma), en **claro** (por defecto: papel con la luz de cada equipo en su esquina de arriba y, al pie, una franja con los colores de los dos) o en **oscuro** (la misma luz sobre un fondo casi negro). Se recuerda; al cambiarlo, las slides se rehacen con los mismos datos. «Líderes del partido» va siempre en oscuro. En la portada, «Final» (o el minuto, en rojo, si está en juego) entre los dos marcadores, un brillo detrás de cada escudo y un balón junto a cada goleador.
4. **Retocar:** se toca cualquier texto de una slide y se escribe encima; «↺ original» deshace los de esa slide. El botón de la esquina abre la slide casi a pantalla completa. En «Jugador del partido» se toca al jugador para subir su foto: el fondo se quita en el navegador con `@imgly/background-removal` (licencia AGPL; la primera vez baja el modelo, unos 45 MB). ESPN casi no tiene fotos de futbolistas; sin foto, sale su cara de API-Football en un retrato (en la web) o su dorsal en grande.
5. **Tu firma y tu logo:** el campo «Tu firma» (por ejemplo, tu @) sale abajo a la derecha de cada slide y en el cierre. Si se deja vacío, no sale. «Subir logo» pone tu logo (mejor un PNG con el fondo transparente, o un SVG) junto a la firma en cada slide, grande en el cierre y, en el vídeo, en una esquina de cada escena y en la animación del final. Se guarda en el navegador; «Quitar» lo quita (y se recuerda). Mientras no pongas otros, salen los de **Jornada90**: la firma `@jornada90fc` y su logo (`jornada90-logo.png`, en la web; abierto como archivo, sin logo).
6. **Descripción para TikTok:** debajo de las slides sale ya escrita: el gancho (el dato, o el titular) con el resultado (los de «primera vez desde…» van con quién y dónde: «El Chelsea vuelve a ganar en casa del Everton 4 años después», no solo «4 años después»), el mejor del partido con su nota, una pregunta para los comentarios y los hashtags (`#futbol`, la competición, los dos equipos y los de deportes de TikTok; en inglés, los suyos). Se puede retocar y «Copiar» la copia; cambia sola con el partido mientras no la toques.
7. **Descargar:** ZIP de PNG 1080×1350 con el pie de foto (`caption.txt`) y la descripción para TikTok (`descripcion-tiktok.txt`), el mismo ZIP en 1080×1920 para TikTok/Stories, o cada slide suelta. En el móvil, «Compartir» (el carrusel o el vídeo) manda las PNG o el MP4 a TikTok, Instagram, Fotos o WhatsApp: el primer toque las prepara y copia la descripción para TikTok, el segundo abre la hoja de compartir.

El carrusel, sus retoques y las fotos subidas se guardan solos en el navegador (IndexedDB) y vuelven al abrir la página.

**Resumen de la jornada:** con partidos acabados en la lista, «Resumen de la jornada» hace un carrusel aparte, sin tocar el del partido:
- **Portada:** «Así fue la jornada», con los goles y lo más destacado (la mayor goleada, los hat-tricks y dobletes, el partido con más goles y cómo han ido los locales).
- **Resultados:** 5 por slide, con sus goleadores; los que faltan, con su día y hora.
- **Clasificación:** entera, con las zonas de cada liga en color (en la Champions, en dos slides).
- **Cierre:** «¿Cuál fue el partido de la jornada?», con tu logo y tu firma.

ESPN no da el número de jornada: el Studio coge los partidos del día elegido y los de hasta 4 días antes y después mientras ningún equipo repita. Se descarga en ZIP (4:5 o 9:16) con su pie de foto, y cada slide suelta en PNG.

**El dato:** al generar, el Studio mira todos los partidos oficiales de los dos equipos desde 2003 (los amistosos de clubes y la pretemporada no cuentan; una tanda de penaltis cuenta como empate) y busca lo más llamativo:
- **Rachas**, en todas las competiciones o en la del partido: victorias seguidas, sin perder, sin ganar, derrotas, sin encajar, marcando, sin marcar, en casa o fuera. Y las que se acaban hoy: «Se acaba la racha de la Roma: 14 partidos sin perder».
- **Desde cuándo no pasaba:** «Primera victoria del Crystal Palace en casa ante el Forest desde diciembre de 2003», «La mayor victoria del Aston Villa desde agosto de 2021», la peor derrota, tantos goles, la primera victoria en la competición…
- **El cara a cara:** primera victoria ante el rival desde…, en su campo por primera vez en N visitas, N victorias seguidas, sin perder ante él, la mayor victoria o el partido con más goles entre los dos desde…
- **La temporada:** pleno de victorias, invicto o la primera derrota (en los torneos, «en este Mundial»).
- **Los goleadores de hoy:** si marcan partido tras partido o cuántos llevan en la competición.

Cada dato tiene un peso según lo raro que es; salen los 3 mejores (el primero, en grande) y solo si llegan al mínimo. «En casa» es en su campo de verdad: una final en campo neutral no cuenta. Las «primera vez desde…» solo se dicen si la vez anterior está en los datos de ESPN y no falta ninguna temporada entre medias. De las selecciones, ESPN solo da sus últimos 25 partidos o así, así que sus datos son de ese tramo.

La primera vez que sale un equipo, el Studio baja su historial (unos segundos; avisa si tarda). Las temporadas acabadas se quedan guardadas en el navegador y la siguiente vez va al momento. Si ESPN tarda más de 15 segundos, el carrusel sale sin el dato. Sale en la slide, en una escena del vídeo (con su frase en el guion, más corta: sin «en todas las competiciones»), en el pie de foto («📊 …») y en «Para tu IA».

**Para tu IA:** el botón de arriba copia un texto con qué es el Studio, cómo ayudarte (tono, no inventar datos, cuánto cabe en cada escena) y lo que hay en pantalla: el partido con sus goles, estadísticas, jugador del partido y clasificación, el titular, la pregunta del cierre y el guion del vídeo. Lo pegas en Claude (o en otra IA) y te devuelve un bloque «TITULAR: …», «PREGUNTA: …» y una línea por escena («Marcador: …», «Los goles: …»). «Pegar de tu IA», en el guion, lo coloca solo: el titular y la pregunta en sus slides (marcadas como retocadas) y las frases en el guion. Es copiar y pegar: el Studio no llama a ninguna IA ni usa claves.

## El vídeo short (paso 4)

El partido en 30 a 40 segundos, en 1080×1920 para TikTok, Reels y Shorts, con música y subtítulos.

**Que nada se quede quieto:** cada escena se acerca despacio (un 4,5 % de principio a fin) y da un pequeño golpe de cámara con cada golpe de la música (el marcador, el dato, la nota del jugador…).

**Hecho para la pantalla de TikTok:** TikTok tapa la derecha (me gusta, comentarios, compartir), arriba (las pestañas) y abajo (tu nombre y la descripción), y en los móviles alargados recorta unos 50 px por cada lado. Por eso el contenido de cada escena (textos, números, subtítulos y tu logo) va reducido dentro de la zona que se ve siempre (de x = 60 a 902 y de y = 220 a unos 1550), y solo los fondos ocupan la pantalla entera. Sin grano (TikTok lo recomprime y emborrona) y a 12 Mbps. La cara del jugador (150 px en API-Football) se amplía en dos pasos con un enfoque suave, en el vídeo y en la slide.

- **Escenas:**
  - **Apertura (1,6 s):** el gancho, desde el primer fotograma: «EL DATO» con el dato a medias (como en la portada del carrusel) o, si no hay, «FINAL» y el titular. Empieza grande en el centro, así es también la portada del vídeo, y sube arriba cuando los dos escudos entran desde los lados y chocan en el centro. Se quita con «Apertura con los escudos».
  - **Marcador:** cada equipo en su mitad, con los goleadores y el titular de la portada en la cinta.
  - **El dato:** «EL DATO», el número grande que sube, lo que significa y la frase. Dura 3 compases, o 4 si la frase es larga.
  - **Minuto a minuto:** lo mismo que la slide, con ritmo y cámara. La línea corre por los minutos en los que no pasa nada y se detiene en cada suceso lo que pide (un gol, más; una amarilla o un cambio, un suspiro), así que no pasa medio vídeo en un primer tiempo vacío ni se amontona el final. La escena dura de 2 a 4 compases según lo que haya. Arriba, fijos, el título y el marcador, que da un golpe con cada gol; debajo, una ventana por la que baja la línea: la cámara sigue la punta, cada gol da un pequeño golpe de cámara y un destello del color del equipo, y al final la cámara se aleja para enseñar el partido entero hasta «Final». Cada amarilla y cada cambio suenan con un tic suave.
  - **Mapa de tiros:** el campo en vertical. Cada balón sale de donde se tiró y vuela a la portería: el gol mueve la red, la parada rebota y el que va fuera se pierde. Los contadores suben con los tiros.
  - **Jugador del partido:** su foto o, si no hay, su cara de API-Football en un retrato con el escudo (o su dorsal), y sus 3 números.
  - **Estadísticas:** posesión, tiros, a puerta, pases y córners, una fila por pulso.
  - **Clasificación:** las filas entran una a una, con los dos equipos marcados.
  - **Cierre:** la pregunta del cierre y, si no hay logo, tu firma.
  - **Tu marca (1,6 s, con logo):** tu logo entra de golpe en el centro sobre un círculo verde lima, con un destello y dos ondas, y debajo «Sígueme para más fútbol» y tu firma. Sin guion.
  - Las escenas sin datos no salen.
  - **El aspecto:** los fondos de equipo llevan la misma luz que el carrusel (haces en diagonal, trama y viñeta), y los goles y la clasificación siguen el **Estilo** elegido: claro (papel con la franja de los dos equipos) u oscuro.
- **Música (`audio.js`):** propia, sintetizada en el navegador y sin derechos de autor. Es una base de 150 BPM con un efecto por animación (el golpe del marcador, cada gol, cada tiro…) y va a tiempo: cada escena dura compases enteros. Dos estilos, a elegir junto al volumen (se recuerda):
  - **Urbana** (por defecto): trap a medio tiempo (808, palmada, platos y una campana en frases de pregunta y respuesta) que va con la cámara. Cada escena tiene su ritmo de bombo; en el último compás antes de cada corte la batería se para en las dos últimas semicorcheas, sube un redoble de caja y el 808 se desliza a la nota de la escena siguiente; en el corte entran bombo, 808 y platillo. Cada golpe de cámara (el marcador, cada gol, el dato, la nota…) lleva su 808. En el minuto a minuto los platos van en semicorcheas, con la línea; en los tiros, poco bombo para que se oiga cada tiro. Antes del golpe del marcador, platos y caja que se aceleran (1/8, 1/16, 1/32); al final, el 808 sube y queda un 808 largo en la menor.
  - **Épica:** como un tráiler. Taikos, cuerdas en semicorchea, metales, coro, timbales y una melodía de trompas sobre la menor, fa, do y sol. Antes del golpe del marcador, un redoble de timbal que crece hasta un «braaam»; en los tiros baja para que se oiga cada uno; al final, el acorde en la menor con toda la orquesta.
- **Guion y subtítulos:** el Studio escribe una frase por escena que cuenta el partido como lo contaría alguien que lo ha visto, no una lista de datos:
  - **los goles:** quién se adelantó, si hubo remontada, quién lo decidió, el doblete, quién sentenció o cerró la goleada y quién maquilló («Güler abrió el marcador en el 30 y Mbappé hizo doblete. Diomande cerró la goleada y Bueno maquilló.»);
  - **los tiros:** lo que más dice («Y eso que el Alavés tiró más: 20 veces, por 6 del Celta.», «Pegada de la Real Sociedad: 5 goles con 9 tiros a puerta.», «El Racing solo tiró una vez a puerta en todo el partido.»);
  - **la posesión:** si le sirvió al que tuvo el balón («El Racing tuvo más el balón, un 56%, pero no le sirvió.»);
  - **la tabla:** dónde se queda el que gana («El Real Madrid, tercero, a seis del líder.», «líder con 27 puntos», «colista»).

  Cada escena prueba de la frase más completa a la más corta y se queda la primera que cabe a ritmo normal. Se retoca en el paso 4 y cada frase avisa si no cabe; «↺ Automático» la vuelve a escribir. La previa también lleva el suyo: cómo llegan, el cara a cara, sus goleadores y la tabla (este no se retoca). El guion es lo que dice la voz; sin voz no sale en el vídeo.
- **Subtítulos:** de dos en dos o de tres en tres palabras, con la que suena en verde lima, sin cortar en «y», «el», «de»… Van debajo de lo que se ve en cada escena (la tabla, el minuto a minuto, el mapa de tiros y el cara a cara se han subido un poco para dejarles sitio) y por encima del nombre y la descripción de TikTok. Salen solos cuando el vídeo lleva voz (la del robot): sin voz, el vídeo va sin subtítulos, salvo que los enciendas con «Subtítulos» (se recuerda).
- **Voz:** la pone el robot con ElevenLabs (ver «La voz del robot», arriba). Cada frase del guion se dice con esa voz, la escena dura lo que pide su frase (en compases enteros, para que la música siga cuadrando) y los subtítulos van con lo que suena, palabra a palabra. En el Studio a mano no hay voz (se quitó «Grabar mi voz» y el teleprompter).
- **Versión larga (+1 min):** TikTok solo paga (Creator Rewards) los vídeos de más de un minuto. Con «Versión larga (+1 min)» (se recuerda) el vídeo suma lo que haya de:
  - **Más estadísticas:** las que no caben en la primera (faltas, amarillas…).
  - **Cómo llegaban:** los 5 partidos de antes de cada uno, como en la previa.
  - **Cara a cara:** los anteriores entre los dos, sin contar el de hoy.

  Si aún no llega a 62 s, cada escena se queda más en pantalla, en compases enteros (primero el minuto a minuto, la clasificación y el cara a cara). Su animación va a su ritmo y luego se queda quieta mientras la cámara se sigue acercando. El guion tiene frase para las escenas nuevas y el archivo se llama `…-largo.mp4`. El robot sigue haciendo el corto.
- **Sin música por defecto:** el vídeo sale mudo y en TikTok se le pone un sonido en tendencia (ayuda a que te descubran). «Con música» activa la música propia (se recuerda).
- **Volumen:** la barra «Volumen» (se recuerda) y «Escuchar la mezcla», que crea solo el sonido en unos segundos. «↺ Por defecto» vuelve a la urbana al 100 %.
- **El archivo:** MP4 (H.264 + AAC) codificado en el navegador con WebCodecs y `mp4-muxer`. Si el navegador no tiene H.264, sale en VP9 y avisa; con Chrome sale en H.264. También se puede bajar la música sola en WAV. En el iPhone (Safari), el codificador de AAC da una configuración que no vale ([WebKit 302253](https://bugs.webkit.org/show_bug.cgi?id=302253)) y el vídeo salía mudo: el Studio escribe siempre la buena (AAC-LC, la frecuencia y estéreo).

## Datos y ajustes

- **ESPN**, sin claves ni servidor (tiene CORS abierto, así que funciona abriendo el archivo):
  - `soccer/<código>/scoreboard?dates=AAAAMMDD` para la lista de partidos;
  - `soccer/<código>/summary?event=<id>` para el partido: `keyEvents` (goles, tarjetas y cambios), `commentary` (el sitio de cada tiro), `boxscore`, `rosters` y `standings`;
  - `apis/v2/sports/soccer/<código>/standings` para la clasificación, cuando el resumen no la trae;
  - `soccer/<código>/scoreboard` sin fecha para los días con partidos (el calendario de las ligas y la ronda de ahora en las copas).
- **Añadir una competición:** buscar su código en ESPN (que `site.api.espn.com/apis/site/v2/sports/soccer/<código>/scoreboard` dé partidos) y añadir una línea en `COMPETITIONS` (`futbol.js`) con el nombre del botón, el de las slides, el hashtag y el número de su logo (el de `leaguelogos/soccer/500/<n>.png` que da ese mismo `scoreboard`).
- **Nombres en español:** `CLUB_NAMES` (clubes: «Nápoles», «Oporto», «Brujas»…) y `COUNTRY_NAMES` (selecciones). Al resto se le quita lo que sobra («FC Utrecht» → «Utrecht», «Mainz 05» → «Mainz»). `FEMININE` son los que llevan «la» (la Roma, la Real Sociedad…). En los jugadores coreanos, el apellido es la primera palabra («Son», no «Heung-Min»).
- **Colores:** los de unos 130 clubes y casi 50 selecciones están a mano en `CLUB_COLORS` (por id de ESPN) y `NATIONAL_COLORS`. El resto salen de ESPN, arreglados para que se lean. Si los dos equipos salen casi del mismo color (dos blancos, dos rojos), el visitante va con su segundo color, como con la segunda equipación.
- **Lo que da ESPN según la competición:** en las grandes (LaLiga, Champions, Premier, Serie A, Bundesliga, Ligue 1, Portugal, Países Bajos, Championship, Libertadores, Mundial…) hay de todo. En otras (LaLiga Hypermotion, Liga F, Serie B, 2. Bundesliga, Ligue 2, Escocia, Turquía, Bélgica, Arabia Saudí, Copa de Alemania) no da el sitio de los tiros, así que no sale el mapa de tiros. En las primeras rondas de la Copa del Rey a veces solo da el resultado: sale la portada y el cierre.

## Archivos

| Archivo | Qué es |
|---|---|
| `index.html` | La página |
| `futbol.js` | Datos de ESPN, slides, retoques, borradores, descargas, y el guion y el volumen del vídeo |
| `video.js` | El vídeo: las escenas, los subtítulos, la mezcla (preparada para una voz) y la codificación |
| `audio.js` | La música y los efectos del vídeo |
| `futbol.css` | La interfaz y las slides (`.fc`); el grano de las slides va dentro, en base64, para que la descarga funcione abriendo el archivo |
| `manifest.webmanifest`, `apple-touch-icon.png`, `icon-*.png` | El nombre y el icono al añadirlo a la pantalla de inicio del móvil |
| `piloto.json` | El piloto automático: qué competiciones, el tema de ntfy, la dirección de la web, las previas y la voz |
| `tools/piloto.mjs` | El robot del piloto automático: busca los partidos acabados, hace el vídeo con el Studio, lo deja en la web y avisa |
| `.github/workflows/piloto.yml` | Lanza el robot cada 10 minutos en las horas de partidos (o a mano) |
| `.github/workflows/web.yml` | Publica el Studio y los vídeos del robot en GitHub Pages |
| `tests/` | Las pruebas y los datos de ESPN que usan |

## Pruebas

- `tests/test_futbol.mjs` abre el Studio en Chromium sin red, con datos reales de ESPN de `tests/fixtures`:
  - la jornada de LaLiga del 20-9-2026 (Atlético 2-1 Real Madrid);
  - Champions del 14-10-2026 (Roma 3-4 Real Madrid, LASK 3-6 Liverpool, City 2-4 PSG);
  - un Depor-Levante en juego y partidos sin empezar;
  - la final del Mundial 2026 (España 1-0 Argentina, en la prórroga);
  - la vuelta del Flamengo-Independiente del Valle de la Libertadores (global 3-1);
  - una eliminatoria de la Copa del Rey de la que ESPN solo da el resultado;
  - el Lech-Leverkusen de la Europa League (la clasificación, pedida aparte);
  - el Osnabrück-Bayern de la Copa de Alemania (un apellido con «ß»).

  Prueba las notas de API-Football (la slide, los líderes del partido, las caras en los onces, el jugador del partido por nota y el aviso si el plan no deja), «El dato» (la racha que se acaba, el cara a cara, el pie de foto, el guion y que el historial guardado no se vuelva a pedir), la versión en inglés (slides, guion, jornada y que se recuerde), el modo en directo (un partido que pasa de en juego a acabado: el aviso y generarlo a un clic, con el vídeo), el enlace del pitido final (`?partido=`: lo genera todo solo, y si el partido no está, lo dice) el piloto automático (qué partidos hace: uno por partido, sin repetir, no los de hace horas y fuera de LaLiga solo los de sus equipos; el aviso al móvil; y la página del aviso: el vídeo con su descripción, compartir, cerrar y si ya no está), el resumen de la jornada, tu logo, las competiciones y sus logos, la lista, las 9 slides, el minuto a minuto sin solapes, la firma, el jugador del partido, el borrador, el ZIP, el 9:16, compartir, el vídeo (guion, la mezcla y el MP4), «Para tu IA» (copiar y pegar), un partido en juego, uno con pocos datos, las eliminatorias (campeón, global, quién pasa), saltar a un día con partidos, el móvil y el Studio abierto como archivo (generar, descargar y recuperar el borrador).

Corre sola en cada push y PR (`.github/workflows/tests.yml`). En local:

```
npm install --no-save playwright-core@1 html2canvas@1.4.1 jszip@3.10.1 mp4-muxer@5.2.1
node tests/test_futbol.mjs
```
