# Studio Fútbol

Mi herramienta para hacer carruseles de fútbol: eliges competición, día y partido, y sale un carrusel de 8 slides (1080×1350) para Instagram o TikTok con los datos de ESPN. Se retoca en la propia página y se descarga en PNG o ZIP.

Es solo para mí: no es una web publicada. Se abre en el navegador desde el propio ordenador.

## Cómo abrirlo

1. Descarga el repo: en GitHub, **Code → Download ZIP** (y descomprímelo), o `git clone`.
2. Doble clic en `index.html`. Mejor con Chrome o Edge.
3. Hace falta internet: los partidos vienen de ESPN y las fuentes, de Google Fonts.

Para tener la última versión, vuelve a descargarlo o haz `git pull`. El borrador, la firma y la competición se guardan en ese navegador.

## Cómo se usa

1. **Competición:** 28, agrupadas.
   - España: LaLiga, LaLiga Hypermotion, Copa del Rey, Supercopa y Liga F.
   - Europa: Champions, Europa League y Conference.
   - Grandes ligas: Premier, Serie A, Bundesliga, Ligue 1, Liga Portugal, Eredivisie, FA Cup y Carabao Cup.
   - Selecciones: Mundial, Eurocopa, Nations League, la clasificación para el Mundial y amistosos.
   - América y más: Libertadores, Liga MX, Liga Argentina, Brasileirão, MLS, Liga Saudí y Mundial de Clubes.
   - Se recuerda la última elegida.
2. **Día y partido:** por defecto, hoy. Los que no han empezado o están aplazados no se pueden generar. Uno en juego sí, avisando de que las slides cuentan el marcador de ese momento.
3. **Generar:** salen las slides. Las que no tienen datos no salen; un amistoso sin alineaciones, por ejemplo, se queda en 4.
   - **Portada:** el marcador con cada equipo en su mitad, los goleadores y las rojas, y un titular automático: remontada, gol decisivo al final, goleada, festival de goles, por la mínima, empate, penaltis…
   - **Minuto a minuto:** la línea del partido con los goles (cómo y la asistencia), las rojas, los penaltis fallados y el marcador del descanso. Las tarjetas van junto a su minuto sin pisarse.
   - **Estadísticas:** posesión, tiros, a puerta, pases con su precisión, córners, paradas, faltas y tarjetas. El número peor sale apagado.
   - **Mapa de tiros:** el campo entero. El local tira hacia la izquierda y el visitante hacia la derecha; los goles llevan la línea hasta la portería.
   - **Los onces:** las dos alineaciones en el campo con su sistema, los goles, las tarjetas y el minuto del cambio.
   - **Jugador del partido:** sale por goles, asistencias, tiros, paradas y resultado, y el desplegable de la slide deja elegir a otro.
   - **Clasificación:** 12 filas con los dos equipos marcados, con «···» si están lejos.
   - **Cierre:** una pregunta para los comentarios y tu firma.
4. **Retocar:** se toca cualquier texto de una slide y se escribe encima; «↺ original» deshace los de esa slide. El botón de la esquina abre la slide casi a pantalla completa. En «Jugador del partido» se toca al jugador para subir su foto: el fondo se quita en el navegador con `@imgly/background-removal` (licencia AGPL; la primera vez baja el modelo, unos 45 MB). ESPN casi no tiene fotos de futbolistas; sin foto, sale su dorsal en grande.
5. **Tu firma:** el campo «Tu firma» (por ejemplo, tu @) sale abajo a la derecha de cada slide y en el cierre. Si se deja vacío, no sale.
6. **Descargar:** ZIP de PNG 1080×1350 con el pie de foto (`caption.txt`), el mismo ZIP en 1080×1920 para TikTok/Stories, o cada slide suelta. En el móvil, «Compartir» manda las PNG a Instagram, Fotos o WhatsApp: el primer toque las prepara y copia el pie de foto, el segundo abre la hoja de compartir.

El carrusel, sus retoques y las fotos subidas se guardan solos en el navegador (IndexedDB) y vuelven al abrir la página.

## Datos y ajustes

- **ESPN**, sin claves ni servidor (tiene CORS abierto, así que funciona abriendo el archivo):
  - `soccer/<código>/scoreboard?dates=AAAAMMDD` para la lista de partidos;
  - `soccer/<código>/summary?event=<id>` para el partido: `keyEvents` (goles, tarjetas y cambios), `commentary` (el sitio de cada tiro), `boxscore`, `rosters` y `standings`.
- **Añadir una competición:** buscar su código en ESPN (que `site.api.espn.com/apis/site/v2/sports/soccer/<código>/scoreboard` dé partidos) y añadir una línea en `COMPETITIONS` (`futbol.js`) con el nombre del botón, el de las slides y el hashtag.
- **Nombres en español:** `CLUB_NAMES` (clubes) y `COUNTRY_NAMES` (selecciones). `FEMININE` son los que llevan «la» (la Roma, la Real Sociedad…).
- **Colores:** los de los clubes más vistos están a mano en `CLUB_COLORS` (por id de ESPN) y `NATIONAL_COLORS`. El resto salen de ESPN, arreglados para que se lean.

## Archivos

| Archivo | Qué es |
|---|---|
| `index.html` | La página |
| `futbol.js` | Todo: datos de ESPN, slides, retoques, borradores, descargas |
| `futbol.css` | La interfaz y las slides (`.fc`); el grano de las slides va dentro, en base64, para que la descarga funcione abriendo el archivo |
| `tests/` | Las pruebas y los datos de ESPN que usan |

## Pruebas

- `tests/test_futbol.mjs` abre el Studio en Chromium sin red, con datos reales de ESPN de `tests/fixtures`:
  - la jornada de LaLiga del 20-9-2026 (Atlético 2-1 Real Madrid);
  - Champions del 14-10-2026 (Roma 3-4 Real Madrid, LASK 3-6 Liverpool, City 2-4 PSG);
  - un Depor-Levante en juego y partidos sin empezar.

  Prueba las competiciones, la lista, las 8 slides, el minuto a minuto sin solapes, la firma, el jugador del partido, el borrador, el ZIP, el 9:16, compartir, un partido en juego, uno con pocos datos, el móvil y el Studio abierto como archivo (generar, descargar y recuperar el borrador).

Corre sola en cada push y PR (`.github/workflows/tests.yml`). En local:

```
npm install --no-save playwright-core@1 html2canvas@1.4.1 jszip@3.10.1
node tests/test_futbol.mjs
```
