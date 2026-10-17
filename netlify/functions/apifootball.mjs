// Puente con API-Football (api-sports.io). El Studio pide aquí lo que necesita y esta función
// lo pide con la clave, que se queda en Netlify (variable de entorno APIFOOTBALL_KEY): en la
// página no aparece nunca. Solo deja pasar lo que usa el Studio y Netlify guarda la respuesta
// un rato, para no gastar peticiones del plan (el gratis da 100 al día).
const API = 'https://v3.football.api-sports.io';
// Lo que se deja pedir y cuántos segundos se guarda la respuesta
const ALLOWED = {
  status: 0,                  // el plan y las peticiones que quedan hoy
  fixtures: 600,              // los partidos de un día
  'fixtures/players': 21600,  // las notas y las fotos de los jugadores de un partido
};

const json = (body, status, extra = {}) => new Response(JSON.stringify(body), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', ...extra },
});

export default async (req) => {
  const url = new URL(req.url);
  const path = url.searchParams.get('path') || '';
  if (!Object.hasOwn(ALLOWED, path)) return json({ errors: { path: `No permitido: ${path}` } }, 400);
  const key = globalThis.Netlify?.env.get('APIFOOTBALL_KEY') || process.env.APIFOOTBALL_KEY;
  if (!key) return json({ errors: { key: 'Falta la variable APIFOOTBALL_KEY en Netlify' } }, 503);
  const params = new URLSearchParams(url.searchParams);
  params.delete('path');
  let res;
  try {
    res = await fetch(`${API}/${path}?${params}`, { headers: { 'x-apisports-key': key } });
  } catch (e) {
    return json({ errors: { network: `API-Football no responde (${e.message})` } }, 502);
  }
  const body = await res.text();
  // Solo se guarda lo que ha ido bien (API-Football da 200 también cuando el plan no deja)
  let ok = res.ok;
  try {
    const errors = JSON.parse(body).errors;
    ok = ok && !(Array.isArray(errors) ? errors.length : errors && Object.keys(errors).length);
  } catch (e) {
    ok = false;
  }
  const cache = ok && ALLOWED[path] ? { 'netlify-cdn-cache-control': `public, durable, s-maxage=${ALLOWED[path]}` } : { 'cache-control': 'no-store' };
  return new Response(body, { status: res.status, headers: { 'content-type': 'application/json; charset=utf-8', ...cache } });
};
