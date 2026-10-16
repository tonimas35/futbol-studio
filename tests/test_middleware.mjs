// Pruebas de functions/_middleware.js: sin el pase de Cloudflare Access no se sirve nada.
//   node tests/test_middleware.mjs
import assert from 'node:assert/strict';

const { onRequest } = await import('../functions/_middleware.js');

const NEXT = new Response('página', { status: 200 });
const run = (url, headers = {}) => onRequest({ request: new Request(url, { headers }), next: async () => NEXT });

for (const url of [
  'https://futbol.example.com/',
  'https://futbol.example.com/futbol.js?v=1',
  'https://futbol-studio.pages.dev/',
  'https://3f2a1b4c.futbol-studio.pages.dev/index.html',
]) {
  const res = await run(url);
  assert.equal(res.status, 403, url);
  assert.match(await res.text(), /privada/, url);
  assert.equal(res.headers.get('cache-control'), 'no-store', url);
  assert.equal(await run(url, { 'Cf-Access-Jwt-Assertion': 'x.y.z' }), NEXT, url);
}

console.log('ok · sin el pase de Access, «Esta página es privada»; con él, la página');
