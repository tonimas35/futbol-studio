# Caras de los jugadores (para el robot)

- `laliga.json`: las plantillas de LaLiga de API-Football (id, nombre y dorsal de cada jugador, y el id de ESPN de cada equipo). Lo hace el Studio: **Tu clave de API-Football → Caras para el robot**. Se sube aquí con **Add file → Upload files**.
- `<id>.png`: la foto de cada jugador. Las baja solo `.github/workflows/caras.yml` al subir `laliga.json` (sin clave: no gastan peticiones).

Cuando el Studio no tiene las notas de API-Football (el robot, o sin clave), pone estas caras en «Jugador del partido» (también en el vídeo) y en «Los onces».
