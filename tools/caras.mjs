// Las fotos de los jugadores de caras/*.json (laliga.json y champions.json: las plantillas de
// API-Football que hace el Studio con «Caras de LaLiga» y «Caras de la Champions»), guardadas en
// caras/<id>.png para que el robot las use
// sin pedir nada a API-Football. Las fotos se bajan sin clave y no gastan peticiones; solo las que
// faltan, despacio.
//   node tools/caras.mjs
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const DIR = resolve(new URL('../caras', import.meta.url).pathname);
const PHOTO = (id) => `https://media.api-sports.io/football/players/${id}.png`;

// Los ids de jugador que tienen que tener foto (números: así no se escribe fuera de caras/)
export function photoIds(file) {
  const ids = (file?.equipos || []).flatMap(t => (t.jugadores || []).map(p => p.id));
  return [...new Set(ids.filter(id => Number.isInteger(id) && id > 0))];
}

async function main() {
  const files = readdirSync(DIR).filter(n => n.endsWith('.json')).map(n => JSON.parse(readFileSync(join(DIR, n), 'utf8')));
  const all = [...new Set(files.flatMap(photoIds))];
  const todo = all.filter(id => !existsSync(join(DIR, `${id}.png`)));
  console.log(`${files.length} plantillas, ${all.length} jugadores; faltan ${todo.length} fotos`);
  let got = 0;
  for (const id of todo) {
    try {
      const res = await fetch(PHOTO(id), { signal: AbortSignal.timeout(15000) });
      const type = res.headers.get('content-type') || '';
      if (res.ok && type.startsWith('image/')) {
        writeFileSync(join(DIR, `${id}.png`), Buffer.from(await res.arrayBuffer()));
        got++;
      } else console.log(`Sin foto: ${id} (${res.status})`);
    } catch (e) {
      console.log(`Sin foto: ${id} (${e.message})`);
    }
    await new Promise(r => setTimeout(r, 150));
  }
  console.log(`Bajadas: ${got}`);
}

if (import.meta.url === `file://${process.argv[1]}`) await main();
