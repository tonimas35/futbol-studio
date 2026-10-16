// Cloudflare Pages Function · se ejecuta delante de cada petición.
//
// El Studio es privado: lo protege Cloudflare Access (ver README). Esto es solo una red por si
// acaso: si una petición llega sin el pase de Access (la cabecera Cf-Access-Jwt-Assertion, que
// Access añade a todo lo que deja pasar), no se sirve. Así no se ve en la dirección .pages.dev,
// ni en el dominio mientras no exista su aplicación de Access. Quien protege de verdad es Access.

const NOT_READY = `<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<title>Página privada</title>
<body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#0d0f13;color:#f4f2ee;font:16px/1.5 system-ui,sans-serif;padding:24px;text-align:center">
<p>Esta página es privada.<br>Se entra con el login de Cloudflare Access.</p></body></html>`;

export async function onRequest({ request, next }) {
  if (!request.headers.get('cf-access-jwt-assertion')) {
    return new Response(NOT_READY, { status: 403, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
  }
  return next();
}
