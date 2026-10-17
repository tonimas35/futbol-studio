# Studio Fútbol

Mi herramienta para hacer contenido de fútbol: eliges competición, día y partido, y sale un carrusel de hasta 9 slides (1080×1350) para Instagram o TikTok y un vídeo short con música, subtítulos y tu voz, con los datos de ESPN. Se retoca en la propia página y se descarga en PNG, ZIP o MP4.

Es solo para mí: no es una web publicada. Se abre en el navegador desde el propio ordenador.

## Cómo abrirlo

1. Descarga el repo: en GitHub, **Code → Download ZIP** (y descomprímelo), o `git clone`.
2. Doble clic en `index.html`. Mejor con Chrome o Edge.
3. Hace falta internet: los partidos vienen de ESPN y las fuentes, de Google Fonts.

Para tener la última versión, vuelve a descargarlo o haz `git pull`. Para el móvil, ver «En el móvil». El borrador, la firma y la competición se guardan en ese navegador.

## En el móvil

En el móvil hace falta abrirlo desde una web con HTTPS (sin ella, el navegador bloquea el micrófono, el vídeo, compartir y copiar). Se publica gratis en Netlify, que sí permite uso comercial, y el repo sigue privado:

1. En [app.netlify.com](https://app.netlify.com), entra con GitHub.
2. **Add new site → Import an existing project → GitHub** y elige `futbol-studio` (si no sale, «Configure the Netlify app on GitHub» y dale acceso a ese repo).
3. Deja todo como viene (lo lee de `netlify.toml`) y pulsa **Deploy**.
4. En **Site configuration → Change site name**, ponle un nombre: queda en `https://<nombre>.netlify.app`.
5. En el móvil, abre esa dirección y **Compartir → Añadir a pantalla de inicio**: sale con su icono.

Cada cambio que entra en `main` se publica solo. Solo se publica la página (`netlify.toml` copia sus archivos): ni las pruebas ni este README. La dirección no sale en buscadores (`noindex`), pero quien la tenga puede abrirla; dentro no hay nada privado (los datos son de ESPN y tus borradores se quedan en tu navegador). Lo que hagas en el móvil se guarda en el móvil, y lo del ordenador, en el ordenador.

## En directo

Arriba del todo, «Los partidos de hoy»: eliges qué competiciones vigilar (las de siempre se recuerdan) y activas **Vigilar**. Con la pestaña abierta:

- Cada minuto mira ESPN y enseña los partidos de hoy: en juego (con el minuto), los que faltan y los acabados. De madrugada también enseña los de ayer, porque los de América acaban pasada la medianoche.
- Cuando acaba un partido, avisa: la tarjeta se ilumina con «Nuevo», la pestaña dice «(1) Final · …», suena un aviso corto y, si el navegador lo permite, sale una notificación.
- «Generar →» en la tarjeta elige la competición, el día y el partido, y genera el carrusel: en un clic lo tienes listo para revisar y publicar.
- «↻ Actualizar» mira ESPN en ese momento; «×» deja de vigilar una competición y «+ Añadir competición» suma otra.

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
   - **Jugador del partido:** sale por goles, asistencias, tiros, paradas y resultado, y el desplegable de la slide deja elegir a otro.
   - **Clasificación:** 12 filas con los dos equipos marcados, con «···» si están lejos. Si el resumen de ESPN no la trae (la Europa League, la Conference…), se pide aparte.
   - **Cierre:** una pregunta para los comentarios y tu firma.
4. **Retocar:** se toca cualquier texto de una slide y se escribe encima; «↺ original» deshace los de esa slide. El botón de la esquina abre la slide casi a pantalla completa. En «Jugador del partido» se toca al jugador para subir su foto: el fondo se quita en el navegador con `@imgly/background-removal` (licencia AGPL; la primera vez baja el modelo, unos 45 MB). ESPN casi no tiene fotos de futbolistas; sin foto, sale su dorsal en grande.
5. **Tu firma y tu logo:** el campo «Tu firma» (por ejemplo, tu @) sale abajo a la derecha de cada slide y en el cierre. Si se deja vacío, no sale. «Subir logo» pone tu logo (mejor un PNG con el fondo transparente, o un SVG) junto a la firma en cada slide, grande en el cierre y, en el vídeo, en una esquina de cada escena y grande en el cierre. Se guarda en el navegador; «Quitar» lo quita.
6. **Descargar:** ZIP de PNG 1080×1350 con el pie de foto (`caption.txt`), el mismo ZIP en 1080×1920 para TikTok/Stories, o cada slide suelta. En el móvil, «Compartir» manda las PNG a Instagram, Fotos o WhatsApp: el primer toque las prepara y copia el pie de foto, el segundo abre la hoja de compartir.

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

El partido en 30 a 40 segundos, en 1080×1920 para TikTok, Reels y Shorts, con música, subtítulos y, si quieres, tu voz.

- **Escenas:**
  - **Apertura (1,6 s):** los dos escudos entran desde los lados y chocan en el centro. Se quita con «Apertura con los escudos».
  - **Marcador:** cada equipo en su mitad, con los goleadores y el titular de la portada en la cinta.
  - **El dato:** «EL DATO», el número grande que sube, lo que significa y la frase. Dura 3 compases, o 4 si la frase es larga.
  - **Los goles:** la línea del partido baja minuto a minuto y cada gol, roja o penalti fallado salta cuando llega a su minuto. Arriba, el marcador cambia con cada gol. Con más goles, la escena dura más.
  - **Mapa de tiros:** el campo en vertical. Cada balón sale de donde se tiró y vuela a la portería: el gol mueve la red, la parada rebota y el que va fuera se pierde. Los contadores suben con los tiros.
  - **Jugador del partido:** su foto (o su dorsal) y sus 3 números.
  - **Estadísticas:** posesión, tiros, a puerta, pases y córners, una fila por pulso.
  - **Clasificación:** las filas entran una a una, con los dos equipos marcados.
  - **Cierre:** la pregunta del cierre y tu firma.
  - Las escenas sin datos no salen.
- **Música (`audio.js`):** propia, sintetizada en el navegador y sin derechos de autor. Es una base de 150 BPM con un efecto por animación (el golpe del marcador, cada gol, cada tiro…) y va a tiempo: cada escena dura compases enteros.
- **Guion y subtítulos:** el Studio escribe una frase por escena con los datos del partido («Remontada del Real Madrid: 4-3 a la Roma.»). Se retoca en el paso 4 y cada frase avisa si no cabe a ritmo normal; «↺ Automático» la vuelve a escribir. Los subtítulos salen de dos en dos o de tres en tres palabras, con la que suena en verde lima. Se quitan con «Subtítulos».
- **Tu voz:** «Grabar mi voz» abre un teleprompter con el vídeo en directo y la frase que toca, tras una cuenta atrás de 3 s.
  - El teleprompter va 0,2 s por delante.
  - Al acabar, el Studio mide cuánto llega tarde tu voz y la adelanta.
  - La barra «Sincronía» la afina a mano.
  - En el vídeo, la música baja a un tercio mientras hablas.
- **Volumen:** las barras «Música» y «Tu voz» (se recuerdan) y «Escuchar la mezcla», que crea solo el sonido en un par de segundos.
- **El archivo:** MP4 (H.264 + AAC) codificado en el navegador con WebCodecs y `mp4-muxer`. Si el navegador no tiene H.264, sale en VP9 y avisa; con Chrome sale en H.264. También se puede bajar la música sola en WAV.

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
| `futbol.js` | Datos de ESPN, slides, retoques, borradores, descargas, y el guion, la voz y el volumen del vídeo |
| `video.js` | El vídeo: las escenas, los subtítulos, la mezcla con tu voz y la codificación |
| `audio.js` | La música y los efectos del vídeo |
| `futbol.css` | La interfaz y las slides (`.fc`); el grano de las slides va dentro, en base64, para que la descarga funcione abriendo el archivo |
| `manifest.webmanifest`, `apple-touch-icon.png`, `icon-*.png` | El nombre y el icono al añadirlo a la pantalla de inicio del móvil |
| `netlify.toml` | Cómo se publica en Netlify (solo los archivos de la página) |
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

  Prueba «El dato» (la racha que se acaba, el cara a cara, el pie de foto, el guion y que el historial guardado no se vuelva a pedir), la versión en inglés (slides, guion, jornada y que se recuerde), el modo en directo (un partido que pasa de en juego a acabado: el aviso y generarlo a un clic), el resumen de la jornada, tu logo, las competiciones y sus logos, la lista, las 9 slides, el minuto a minuto sin solapes, la firma, el jugador del partido, el borrador, el ZIP, el 9:16, compartir, el vídeo (guion, grabar la voz con un micrófono de prueba, la mezcla y el MP4), «Para tu IA» (copiar y pegar), un partido en juego, uno con pocos datos, las eliminatorias (campeón, global, quién pasa), saltar a un día con partidos, el móvil y el Studio abierto como archivo (generar, descargar y recuperar el borrador).

Corre sola en cada push y PR (`.github/workflows/tests.yml`). En local:

```
npm install --no-save playwright-core@1 html2canvas@1.4.1 jszip@3.10.1 mp4-muxer@5.2.1
node tests/test_futbol.mjs
```
