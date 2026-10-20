// ============================================================
// VÍDEO SHORT · el partido en ~30 s (1080×1920) para TikTok, Reels y Shorts.
// futbol.js prepara los datos (los mismos de las slides) y aquí se dibuja cada fotograma en
// un canvas con Anton y Barlow Condensed, con los colores de cada equipo. Lleva música
// propia (audio.js), subtítulos con la palabra que suena y, si se graba, tu voz.
// Se codifica en el navegador: MP4 (H.264 + AAC) con WebCodecs y mp4-muxer; sin WebCodecs,
// se graba en tiempo real con MediaRecorder.
// ============================================================
(function () {
  'use strict';

  const W = 1080, H = 1920, FPS = 30;
  const M = 64; // margen lateral, como en el carrusel
  const MP4_MUXER_URL = 'https://cdn.jsdelivr.net/npm/mp4-muxer@5.2.1/build/mp4-muxer.min.js';
  // Todo va a 150 BPM (audio.js): un pulso dura 0,4 s, lo mismo que la cortinilla, y cada
  // escena dura compases enteros (1,6 s). Lo que suena cae en un pulso o en una semicorchea.
  const BEAT = 0.4, STEP = 0.1, BAR = 1.6;
  const TRANSITION = BEAT;
  const ACCENT = '#c8f53c';  // el verde lima del Studio
  const INK_BG = '#0d0f13';
  const NIGHT = '#10141b'; // el fondo oscuro de las escenas de datos (como en el carrusel)
  // La zona que TikTok no tapa: a la derecha van los botones (me gusta, comentarios…), arriba
  // las pestañas y abajo tu nombre y la descripción; en los móviles alargados, además, recorta
  // unos 50 px por cada lado. Cada escena se dibuja en 1080×1920 y su contenido se coloca
  // reducido (s) a partir de (x, y): de x = 60 a 902 y de y = 220 a unos 1550. Los fondos sí
  // ocupan la pantalla entera (bleed).
  const SAFE = { s: 0.78, x: 60, y: 220 };
  function inSafe(ctx, fn) {
    ctx.save();
    ctx.translate(SAFE.x, SAFE.y);
    ctx.scale(SAFE.s, SAFE.s);
    fn();
    ctx.restore();
  }
  // Un rectángulo de fondo que toca un borde de la escena se alarga hasta el borde de la
  // pantalla (en las coordenadas de la escena, sea cual sea la transformación de ahora).
  function bleed(ctx, x, y, w, h) {
    const m = ctx.getTransform();
    if (m.b || m.c || !m.a || !m.d) return [x, y, w, h];
    const x0 = -m.e / m.a, y0 = -m.f / m.d;
    const x1 = (ctx.canvas.width - m.e) / m.a, y1 = (ctx.canvas.height - m.f) / m.d;
    const L = x <= 0 ? Math.min(x, x0) : x, T = y <= 0 ? Math.min(y, y0) : y;
    const R = x + w >= W ? Math.max(x + w, x1) : x + w, B = y + h >= H ? Math.max(y + h, y1) : y + h;
    return [L, T, R - L, B - T];
  }
  const fillAll = (ctx, style) => { ctx.fillStyle = style; ctx.fillRect(...bleed(ctx, 0, 0, W, H)); };
  const ticks = (from, to, vel = 1) => {
    const out = [];
    for (let t = from, i = 0, n = Math.round((to - from) / STEP); i < n; i++, t += STEP) out.push({ t, kind: 'tick', p: i / Math.max(1, n - 1), vel });
    return out;
  };
  const snap = (t) => Math.round(t / STEP) * STEP; // a la semicorchea más cercana

  // ─── Tiempo y movimiento ───
  const clamp01 = (x) => Math.max(0, Math.min(1, x));
  const prog = (t, start, dur) => clamp01((t - start) / dur);
  const easeOut = (x) => 1 - (1 - x) ** 3;
  const easeInOut = (x) => (x < 0.5 ? 4 * x ** 3 : 1 - (-2 * x + 2) ** 3 / 2);
  const easeBack = (x) => (x <= 0 ? 0 : 1 + 2.70158 * (x - 1) ** 3 + 1.70158 * (x - 1) ** 2);

  // Un número que sube hasta su valor: 34, "6/12" (sube el primero) o "52%".
  function countText(v, p) {
    const s = String(v);
    let m;
    if (/^\d+$/.test(s)) return String(Math.round(Number(s) * p));
    if ((m = s.match(/^(\d+)\/(\d+)$/))) return `${Math.round(m[1] * p)}/${m[2]}`;
    if ((m = s.match(/^(\d+)%$/))) return `${Math.round(m[1] * p)}%`;
    return s;
  }

  // ─── Texto ───
  const ANTON = (size) => `${size}px Anton`;
  const BARLOW = (size, weight = 800) => `${weight} ${size}px "Barlow Condensed"`;
  const up = (s) => String(s || '').toLocaleUpperCase('es');

  function text(ctx, str, x, y, font, color, align = 'left') {
    ctx.font = font;
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(str, x, y);
  }
  // El tamaño de letra para que quepa en maxWidth (como mucho, size).
  function fit(ctx, str, fontFn, size, maxWidth) {
    ctx.font = fontFn(size);
    const w = ctx.measureText(str).width;
    return w > maxWidth ? Math.floor((size * maxWidth) / w) : size;
  }
  // Líneas que quepan en maxWidth; respeta los saltos de línea escritos a mano.
  function wrap(ctx, str, font, maxWidth) {
    ctx.font = font;
    const lines = [];
    for (const para of String(str).split('\n')) {
      let line = '';
      for (const word of para.split(/\s+/).filter(Boolean)) {
        const next = line ? `${line} ${word}` : word;
        if (line && ctx.measureText(next).width > maxWidth) {
          lines.push(line);
          line = word;
        } else {
          line = next;
        }
      }
      if (line) lines.push(line);
    }
    return lines;
  }
  const capHeight = (ctx, font) => {
    ctx.font = font;
    return ctx.measureText('H').actualBoundingBoxAscent;
  };

  // Etiqueta como .fc-chip: fondo del acento, texto en mayúsculas. y = borde de arriba.
  function chip(ctx, str, x, y, st, size = 38, align = 'left') {
    const label = up(str);
    const font = BARLOW(size);
    ctx.font = font;
    const w = ctx.measureText(label).width;
    const padX = size * 0.4, h = size * 1.3;
    const x0 = align === 'center' ? x - (w + padX * 2) / 2 : align === 'right' ? x - w - padX * 2 : x;
    ctx.fillStyle = st.acc;
    ctx.fillRect(x0, y, w + padX * 2, h);
    text(ctx, label, x0 + padX, y + (h + capHeight(ctx, font)) / 2, font, st.on);
    return w + padX * 2;
  }

  // La cinta blanca girada (como .fc-tape). p = aparición (0–1, con rebote).
  function tape(ctx, str, cx, cy, st, size, p = 1) {
    if (p <= 0) return;
    const label = up(str);
    const font = ANTON(size);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate((-3 * Math.PI) / 180);
    const k = easeBack(p);
    ctx.scale(k, k);
    ctx.font = font;
    const w = ctx.measureText(label).width;
    const padX = size * 0.45, h = size * 1.5;
    ctx.shadowColor = 'rgba(0,0,0,.35)';
    ctx.shadowBlur = 30;
    ctx.shadowOffsetY = 10;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-w / 2 - padX, -h / 2, w + padX * 2, h);
    ctx.shadowColor = 'transparent';
    text(ctx, label, 0, capHeight(ctx, font) / 2, font, st.dk || '#111111', 'center');
    ctx.restore();
  }

  // ─── Fondos e imágenes ───
  // Como en el carrusel (futbol.js, «FONDOS CON PROFUNDIDAD»): haces de luz en diagonal, una
  // trama de puntos en una esquina y la viñeta. Se pintan una vez en un canvas aparte y cada
  // fotograma solo lo copia.
  // Las capas pintadas (fondos, haces de luz…), guardadas para no repintarlas en cada fotograma.
  // Como mucho MAX_LAYERS (cada una ocupa ~8 MB): en el iPhone, sin tope, Safari se queda sin
  // memoria y cierra la página.
  const layers = new Map();
  const MAX_LAYERS = 16;
  function layer(key, w, h, draw) {
    let c = layers.get(key);
    if (c) {
      layers.delete(key); // la más usada, al final
    } else {
      c = document.createElement('canvas');
      c.width = w; c.height = h;
      draw(c.getContext('2d'), w, h);
      while (layers.size >= MAX_LAYERS) {
        const old = layers.keys().next().value;
        layers.get(old).width = 0; // que el navegador suelte la memoria ya
        layers.delete(old);
      }
    }
    layers.set(key, c);
    return c;
  }
  function rays(ctx, w, h, fromRight, alpha) {
    const sx = fromRight ? w * 1.05 : -w * 0.05, sy = -h * 0.08, len = Math.hypot(w, h) * 1.2;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const [a, wd, k] of [[0.18, 0.05, 1], [0.34, 0.022, 0.7], [0.47, 0.065, 0.9], [0.63, 0.03, 0.6], [0.8, 0.05, 0.5]]) {
      const th = Math.PI / 2 + (fromRight ? a : -a);
      const g = ctx.createLinearGradient(sx, sy, sx + Math.cos(th) * len, sy + Math.sin(th) * len);
      g.addColorStop(0, `rgba(255,255,255,${alpha * k})`);
      g.addColorStop(0.75, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx + Math.cos(th - wd) * len, sy + Math.sin(th - wd) * len);
      ctx.lineTo(sx + Math.cos(th + wd) * len, sy + Math.sin(th + wd) * len);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }
  function dots(ctx, w, h, cx, cy, radius, color) {
    const step = 18;
    ctx.fillStyle = color;
    for (let y = 0, row = 0; y < h + step; y += step * 0.866, row++) {
      for (let x = (row % 2) * step / 2; x < w + step; x += step) {
        const k = 1 - Math.hypot(x - cx, y - cy) / radius;
        const r = k > 0 ? step * 0.48 * k ** 1.5 : 0;
        if (r < 0.7) continue;
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      }
    }
  }
  function vignette(ctx, w, h, alpha) {
    const g = ctx.createRadialGradient(w / 2, h * 0.45, Math.min(w, h) * 0.28, w / 2, h * 0.5, Math.hypot(w, h) * 0.62);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, `rgba(0,0,0,${alpha})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }
  // La luz de encima del color de un equipo (transparente): los haces bajan desde el lado de la
  // luz y la trama va en la esquina de abajo contraria.
  function lightLayer(w, h, fromRight, lightBg) {
    return layer(`l|${w}|${h}|${fromRight}|${lightBg}`, w, h, (c) => {
      rays(c, w, h, fromRight, lightBg ? 0.08 : 0.07);
      dots(c, w, h, fromRight ? 0 : w, h, Math.min(w, h) * 0.85, lightBg ? 'rgba(0,0,0,.07)' : 'rgba(255,255,255,.07)');
      vignette(c, w, h, lightBg ? 0.16 : 0.38);
    });
  }
  // Las escenas de datos (minuto a minuto, clasificación) según el estilo, como en el carrusel:
  // claro (papel con la luz de cada equipo arriba y su franja al pie) u oscuro.
  function sheetBg(ctx, d) {
    if (d.dark) nightBg(ctx, d);
    else paperBg(ctx, d);
  }
  function paperBg(ctx, d) {
    const [ga, gb] = [d.home.style.glow, d.away.style.glow].map(g => (g && g.c !== '#ffffff' ? { c: g.c, a: 0.2 } : null));
    const [sa, sb] = [d.home.style.ink, d.away.style.ink];
    const [bx, by, bw, bh] = bleed(ctx, 0, 0, W, H);
    ctx.drawImage(layer(`p|${ga?.c}|${gb?.c}|${sa}|${sb}`, W, H, (c) => {
      const base = c.createLinearGradient(0, 0, 0, H);
      base.addColorStop(0, '#f6f4ef'); base.addColorStop(1, '#e9e5dc');
      c.fillStyle = base;
      c.fillRect(0, 0, W, H);
      for (const [g, x] of [[ga, -0.12], [gb, 1.12]]) {
        if (!g) continue;
        const r = c.createRadialGradient(x * W, -0.05 * H, 0, x * W, -0.05 * H, W * 0.95);
        r.addColorStop(0, rgba(g.c, g.a)); r.addColorStop(0.55, rgba(g.c, g.a * 0.25)); r.addColorStop(1, rgba(g.c, 0));
        c.fillStyle = r;
        c.fillRect(0, 0, W, H);
      }
      dots(c, W, H, W, H, W * 0.8, 'rgba(0,0,0,.05)');
      vignette(c, W, H, 0.08);
      c.fillStyle = sa; c.fillRect(0, H - 16, W / 2, 16);
      c.fillStyle = sb; c.fillRect(W / 2, H - 16, W / 2, 16);
    }), bx, by, bw, bh);
  }
  // Los colores de encima de cada fondo
  const SHEET = {
    claro: { ink: '#111111', mute: 'rgba(17,17,17,.65)', faint: 'rgba(17,17,17,.4)', track: 'rgba(17,17,17,.18)', line: '#111111', pill: '#111111', pillInk: '#ffffff', ring: '#ece9e2', zebra: 'rgba(0,0,0,.035)', small: '#333333', sub: '#8a8a8a', up: '#1f9d55', team: (st) => st.ink },
    oscuro: { ink: '#ffffff', mute: 'rgba(255,255,255,.62)', faint: 'rgba(255,255,255,.4)', track: 'rgba(255,255,255,.18)', line: 'rgba(255,255,255,.9)', pill: '#ffffff', pillInk: '#111111', ring: NIGHT, zebra: 'rgba(255,255,255,.035)', small: 'rgba(255,255,255,.8)', sub: '#7d8594', up: '#34c46e', team: (st) => st.night || st.ink },
  };
  const sheet = (d) => SHEET[d.dark ? 'oscuro' : 'claro'];
  // El fondo oscuro: la luz de cada equipo en su esquina de arriba (glow: { c, a }).
  function nightBg(ctx, d) {
    const [ga, gb] = [d.home.style.glow, d.away.style.glow].map(g => g || { c: '#ffffff', a: 0.14 });
    const [bx, by, bw, bh] = bleed(ctx, 0, 0, W, H);
    ctx.drawImage(layer(`n|${ga.c}|${ga.a}|${gb.c}|${gb.a}`, W, H, (c) => {
      const base = c.createLinearGradient(0, 0, 0, H);
      base.addColorStop(0, '#171c26'); base.addColorStop(1, '#0a0d12');
      c.fillStyle = base;
      c.fillRect(0, 0, W, H);
      for (const [g, x] of [[ga, -0.12], [gb, 1.12]]) {
        const r = c.createRadialGradient(x * W, -0.05 * H, 0, x * W, -0.05 * H, W * 1.05);
        r.addColorStop(0, rgba(g.c, g.a)); r.addColorStop(0.55, rgba(g.c, g.a * 0.25)); r.addColorStop(1, rgba(g.c, 0));
        c.fillStyle = r;
        c.fillRect(0, 0, W, H);
      }
      dots(c, W, H, W, H, W * 0.8, 'rgba(255,255,255,.045)');
      vignette(c, W, H, 0.3);
    }), bx, by, bw, bh);
  }
  // Como .fc-in: el centro iluminado (hi), el color del equipo y los bordes oscuros (lo), con su
  // luz encima.
  function teamBg(ctx, st, x0 = 0, y0 = 0, w0 = W, h0 = H, fx = 0.78, fy = 0.62) {
    const [x, y, w, h] = bleed(ctx, x0, y0, w0, h0);
    const cx = x + w * fx, cy = y + h * fy;
    const r = Math.hypot(Math.max(cx - x, x + w - cx), Math.max(cy - y, y + h - cy));
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, st.hi);
    g.addColorStop(0.42, st.bg);
    g.addColorStop(1, st.lo);
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w, h);
    // La capa de luz se pinta al tamaño de la escena (fijo) y se estira hasta el borde: con el
    // tamaño de la pantalla, que cambia en cada fotograma al moverse la cámara, salía una capa
    // nueva por fotograma.
    ctx.drawImage(lightLayer(Math.round(w0), Math.round(h0), fx >= 0.5, (st.fg || '#ffffff') !== '#ffffff'), x, y, w, h);
  }

  // Imagen a un ancho dado; bottom es el borde de abajo (las fotos van apoyadas abajo).
  function imgBottom(ctx, img, x, bottom, w, alpha = 1) {
    if (!img) return;
    const h = (w * img.height) / img.width;
    ctx.save();
    ctx.globalAlpha *= alpha;
    ctx.drawImage(img, x, bottom - h, w, h);
    ctx.restore();
  }
  // Escudo centrado en (cx, cy) dentro de un cuadrado de lado size.
  function logo(ctx, img, cx, cy, size, alpha = 1) {
    if (!img) return;
    const k = size / Math.max(img.width, img.height);
    ctx.save();
    ctx.globalAlpha *= alpha;
    ctx.drawImage(img, cx - (img.width * k) / 2, cy - (img.height * k) / 2, img.width * k, img.height * k);
    ctx.restore();
  }
  // LA FICHA DE UN JUGADOR: su cara (o su dorsal) en un círculo con el aro del color de su equipo
  // y, en la esquina, su escudo pequeñito. o: { crest (el escudo), name (debajo), rating (la nota,
  // abajo a la derecha: { text, bg, fg }), best (el mejor: un aro verde lima) }
  function playerChip(ctx, A, person, st, cx, cy, r, o = {}) {
    const face = person && A.faces?.[person.id];
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,.35)';
    ctx.shadowBlur = r * 0.5;
    ctx.shadowOffsetY = r * 0.12;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = o.best ? ACCENT : st.bg;
    ctx.fill();
    ctx.shadowColor = 'transparent';
    const ri = r * (o.best ? 0.84 : 0.88);
    ctx.beginPath();
    ctx.arc(cx, cy, ri, 0, Math.PI * 2);
    ctx.fillStyle = face ? '#e9e6df' : st.bg;
    ctx.fill();
    if (face) {
      ctx.save();
      ctx.clip();
      ctx.drawImage(face, cx - ri, cy - ri * 1.02, ri * 2, ri * 2);
      ctx.restore();
    } else {
      const n = String(person?.number || '');
      text(ctx, n, cx, cy + ri * 0.36, ANTON(ri * (n.length > 1 ? 1.05 : 1.2)), st.fg, 'center');
    }
    // El aro del equipo (encima de la cara, para que se lea el color)
    ctx.beginPath();
    ctx.arc(cx, cy, ri, 0, Math.PI * 2);
    ctx.lineWidth = Math.max(2, r * 0.1);
    ctx.strokeStyle = o.best ? ACCENT : st.bg;
    ctx.stroke();
    if (o.crest) logo(ctx, o.crest, cx + r * 0.72, cy - r * 0.72, r * 0.62);
    // Con cara, su dorsal en un circulito del color del equipo, abajo a la derecha (los onces)
    if (o.number && face && person?.number) {
      const br = r * 0.33, bx = cx + r * 0.72, by = cy + r * 0.62;
      ctx.beginPath();
      ctx.arc(bx, by, br, 0, Math.PI * 2);
      ctx.fillStyle = st.bg;
      ctx.fill();
      ctx.lineWidth = Math.max(2, r * 0.04);
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();
      text(ctx, String(person.number), bx, by + br * 0.4, ANTON(br * (String(person.number).length > 1 ? 1.0 : 1.15)), st.fg, 'center');
    }
    if (o.rating) {
      ctx.font = ANTON(r * 0.62);
      const tw = ctx.measureText(o.rating.text).width + r * 0.32, th = r * 0.74, bx = cx + r * 0.2, by = cy + r * 0.38;
      ctx.fillStyle = o.rating.bg;
      roundRect(ctx, bx, by, tw, th, th * 0.25);
      ctx.fill();
      text(ctx, o.rating.text, bx + tw / 2, by + th * 0.84, ANTON(r * 0.62), o.rating.fg, 'center');
    }
    if (o.name) {
      const size = Math.max(16, r * 0.42);
      ctx.font = BARLOW(size, 800);
      const nw = ctx.measureText(o.name).width + size * 0.7, ny = cy + r + size * 0.25;
      ctx.fillStyle = 'rgba(6,8,11,.86)';
      roundRect(ctx, cx - nw / 2, ny, nw, size * 1.3, size * 0.3);
      ctx.fill();
      text(ctx, o.name, cx, ny + size * 1.02, BARLOW(size, 800), '#ffffff', 'center');
    }
    ctx.restore();
  }
  function fadeBottom(ctx, color, height, top = H) {
    // Desde el mismo color transparente (desde negro transparente, en los fondos claros salía una
    // franja gris oscura) y hasta el borde de la pantalla
    const g = ctx.createLinearGradient(0, top - height, 0, top);
    g.addColorStop(0, /^#[0-9a-f]{6}$/i.test(color) ? rgba(color, 0) : 'rgba(0,0,0,0)');
    g.addColorStop(1, color);
    ctx.fillStyle = g;
    ctx.fillRect(...bleed(ctx, 0, top - height, W, height));
  }
  const rgba = (hex, a) => {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  };
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  // El balón: blanco, con el pentágono negro en el centro y un poco de giro.
  function football(ctx, x, y, r, alpha = 1, spin = 0) {
    ctx.save();
    ctx.globalAlpha *= alpha;
    ctx.translate(x, y);
    ctx.rotate(spin);
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.lineWidth = Math.max(1.5, r * 0.12);
    ctx.strokeStyle = '#111111';
    ctx.stroke();
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
      const px = Math.cos(a) * r * 0.42, py = Math.sin(a) * r * 0.42;
      if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
    }
    ctx.closePath();
    ctx.fillStyle = '#111111';
    ctx.fill();
    ctx.restore();
  }

  // ============================================================
  // ESCENAS · cada una { id, dur, accent, music, cues, draw(ctx, t) } con t en segundos desde
  // que empieza la escena
  // ============================================================

  // 0 · Apertura (un compás): los dos escudos entran desde los lados y chocan en el centro en
  // el primer pulso, con destello, onda y temblor; luego el «VS», la competición y la fecha.
  // El gancho de los primeros segundos (y la portada del vídeo): la etiqueta («EL DATO»,
  // «FINAL») y la frase en grande, desde el primer fotograma. Empieza en el centro, más grande,
  // y sube arriba cuando chocan los escudos (up: 0 → 1). En dos líneas como mucho.
  // score: el resultado, debajo y en verde. El primer fotograma es la portada que pone TikTok si no
  // eliges otra, así que ya lleva el resultado.
  function drawHook(ctx, h, up_ = 1, score = '') {
    let size = 124;
    const lines = () => wrap(ctx, up(h.text), ANTON(size), (W - 2 * M) / 1.18); // que quepa también en grande
    while (size > 72 && lines().length > 2) size -= 8;
    const ls = lines().slice(0, 3);
    const SCORE = 96;
    const scoreSize = score ? fit(ctx, score, ANTON, SCORE, (W - 2 * M) / 1.18) : 0;
    const blockH = 80 + ls.length * size * 1.02 + (score ? 40 + SCORE : 0);
    const k = 1.18 - 0.18 * up_;
    const top = (1 - up_) * (H * 0.44 - (blockH * k) / 2) + up_ * 140;
    ctx.save();
    ctx.translate(W / 2, top);
    ctx.scale(k, k);
    chip(ctx, h.tag, 0, 0, { acc: ACCENT, on: '#111111' }, 42, 'center');
    ls.forEach((l, i) => text(ctx, l, 0, 80 + (i + 1) * size * 1.02 - size * 0.12, ANTON(size), '#ffffff', 'center'));
    if (score) text(ctx, score, 0, 80 + ls.length * size * 1.02 + 40 + SCORE * 0.88, ANTON(scoreSize), ACCENT, 'center');
    ctx.restore();
  }

  function sceneIntro(d, A) {
    const HIT = BEAT, cy = 860, GAP = 250;
    const pens = d.home.shootout != null ? ` (${d.home.shootout}-${d.away.shootout})` : '';
    // En la previa no hay resultado: cuándo se juega («HOY · 21:00»)
    const score = d.introLine || `${up(d.home.short)} ${d.home.score}-${d.away.score} ${up(d.away.short)}${pens}`;
    return {
      id: 'intro',
      noScript: true,
      dur: BAR,
      accent: ACCENT,
      music: { energy: 'intro' },
      cues: [
        { t: 0, kind: 'riser', dur: HIT, vel: 0.6 },
        { t: HIT, kind: 'impact', vel: 1 },
        { t: HIT, kind: 'slam' },
        { t: 2 * BEAT, kind: 'hit', vel: 0.6 },
        { t: 3 * BEAT, kind: 'hit', vel: 0.6 },
      ],
      draw(ctx, t) {
        fillAll(ctx, INK_BG);
        const glow = easeOut(prog(t, HIT, 0.4));
        if (glow > 0) {
          const g = ctx.createRadialGradient(W / 2, cy, 0, W / 2, cy, 900);
          g.addColorStop(0, rgba(ACCENT, 0.25 * glow));
          g.addColorStop(1, rgba(ACCENT, 0));
          fillAll(ctx, g);
        }
        const sp = prog(t, HIT, 0.32), amp = sp > 0 && sp < 1 ? 24 * (1 - sp) ** 2 : 0;
        ctx.save();
        ctx.translate(Math.sin(t * 91) * amp, Math.cos(t * 77) * amp);
        const ring = prog(t, HIT, 0.5);
        if (ring > 0 && ring < 1) {
          ctx.save();
          ctx.strokeStyle = ACCENT;
          ctx.globalAlpha = 1 - ring;
          ctx.lineWidth = 30 * (1 - ring) + 2;
          ctx.beginPath();
          ctx.arc(W / 2, cy, 120 + 700 * easeOut(ring), 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }
        // Los escudos: llegan acelerando y rebotan un poco al chocar.
        const fly = prog(t, 0, HIT) ** 2;
        const bounce = Math.sin(Math.PI * prog(t, HIT, 0.25)) * 40;
        const size = 330 * (1 + 0.04 * prog(t, HIT, BAR));
        logo(ctx, A.homeLogo, W / 2 - GAP - bounce - (1 - fly) * 900, cy, size);
        logo(ctx, A.awayLogo, W / 2 + GAP + bounce + (1 - fly) * 900, cy, size);
        const vs = easeBack(prog(t, HIT + STEP, 0.3));
        if (vs > 0) {
          ctx.save();
          ctx.translate(W / 2, cy);
          ctx.scale(vs, vs);
          text(ctx, 'VS', 0, capHeight(ctx, ANTON(110)) / 2, ANTON(110), '#ffffff', 'center');
          ctx.restore();
        }
        const names = easeOut(prog(t, 2 * BEAT, 0.35));
        ctx.save();
        ctx.globalAlpha = names;
        text(ctx, up(d.home.short), W / 2 - GAP, cy + 260, ANTON(fit(ctx, up(d.home.short), ANTON, 64, 420)), '#ffffff', 'center');
        text(ctx, up(d.away.short), W / 2 + GAP, cy + 260, ANTON(fit(ctx, up(d.away.short), ANTON, 64, 420)), '#ffffff', 'center');
        ctx.restore();
        const info = easeOut(prog(t, 3 * BEAT, 0.35));
        ctx.save();
        ctx.globalAlpha = info;
        ctx.translate(0, (1 - info) * 40);
        chip(ctx, d.comp, W / 2, d.hook ? 1330 : 470, { acc: ACCENT, on: '#111111' }, 44, 'center');
        text(ctx, d.date, W / 2, d.hook ? 1470 : 1260, BARLOW(44), 'rgba(255,255,255,.75)', 'center');
        ctx.restore();
        ctx.restore();
        // El gancho, encima de todo: grande en el primer fotograma (la portada) y arriba antes de
        // que lleguen los escudos, para que no le pasen por encima
        if (d.hook) drawHook(ctx, d.hook, easeInOut(prog(t, 0.04, 0.26)), score);
        const flash = 1 - prog(t, HIT, 0.14);
        if (t >= HIT && flash > 0) fillAll(ctx, `rgba(255,255,255,${0.3 * flash})`);
      },
    };
  }


  // ─── Marcador LED: letras de 5×7 puntos, con los apagados también (como las bombillas de un
  // marcador de estadio). y = borde de arriba; dot = distancia entre puntos. ───
  const LED = { '0': [14,17,19,21,25,17,14], '1': [4,12,4,4,4,4,14], '2': [14,17,1,2,4,8,31], '3': [31,2,4,2,1,17,14], '4': [2,6,10,18,31,2,2], '5': [31,16,30,1,1,17,14], '6': [6,8,16,30,17,17,14], '7': [31,1,2,4,8,8,8], '8': [14,17,17,14,17,17,14], '9': [14,17,17,15,1,2,12], "'": [4,4,8,0,0,0,0], '-': [0,0,0,31,0,0,0], 'º': [12,18,12,0,30,0,0], '+': [0,4,4,31,4,4,0], ' ': [0,0,0,0,0,0,0], 'A': [14,17,17,31,17,17,17], 'B': [30,17,17,30,17,17,30], 'C': [14,17,16,16,16,17,14], 'D': [28,18,17,17,17,18,28], 'E': [31,16,16,30,16,16,31], 'F': [31,16,16,30,16,16,16], 'G': [14,17,16,23,17,17,15], 'H': [17,17,17,31,17,17,17], 'I': [14,4,4,4,4,4,14], 'J': [7,2,2,2,2,18,12], 'K': [17,18,20,24,20,18,17], 'L': [16,16,16,16,16,16,31], 'M': [17,27,21,21,17,17,17], 'N': [17,17,25,21,19,17,17], 'O': [14,17,17,17,17,17,14], 'P': [30,17,17,30,16,16,16], 'Q': [14,17,17,17,21,18,13], 'R': [30,17,17,30,20,18,17], 'S': [15,16,16,14,1,1,30], 'T': [31,4,4,4,4,4,4], 'U': [17,17,17,17,17,17,14], 'V': [17,17,17,17,17,10,4], 'W': [17,17,17,21,21,21,10], 'X': [17,17,10,4,10,17,17], 'Y': [17,17,10,4,4,4,4], 'Z': [31,1,2,4,8,16,31] };
  const ledWidth = (str, dot) => (String(str).length * 6 - 1) * dot;
  function ledText(ctx, str, x, y, dot, color, align = 'left', p = 1) {
    const s = up(str).replace(/Á/g, 'A').replace(/É/g, 'E').replace(/Í/g, 'I').replace(/Ó/g, 'O').replace(/[ÚÜ]/g, 'U').replace(/Ñ/g, 'N');
    const w = ledWidth(s, dot);
    const x0 = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x;
    const r = dot * 0.4;
    const lit = new Path2D(), off = new Path2D();
    let n = 0;
    [...s].forEach((ch, i) => {
      const rows = LED[ch] || LED[' '];
      rows.forEach((bits, ry) => {
        for (let cx = 0; cx < 5; cx++) {
          const px = x0 + (i * 6 + cx) * dot + dot / 2, py = y + ry * dot + dot / 2;
          // Se encienden de arriba abajo con p (0–1)
          const on = bits & (16 >> cx) && (n++, ry / 7 < p * 1.0001);
          (on ? lit : off).moveTo(px + r, py);
          (on ? lit : off).arc(px, py, r, 0, Math.PI * 2);
        }
      });
    });
    ctx.save();
    ctx.fillStyle = rgba(color, 0.12);
    ctx.fill(off);
    ctx.shadowColor = color;
    ctx.shadowBlur = dot * 0.9;
    ctx.fillStyle = color;
    ctx.fill(lit);
    ctx.restore();
    return w;
  }

  // Texto en círculo (centrado en cx, cy, de radio r), girado angle.
  function ringText(ctx, str, cx, cy, r, angle, font, color) {
    ctx.save();
    ctx.font = font;
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const total = ctx.measureText(str).width;
    const k = (Math.PI * 2 * r) / total; // que dé la vuelta entera
    let a = angle;
    for (const ch of str) {
      const w = ctx.measureText(ch).width * k;
      a += w / 2 / r;
      ctx.save();
      ctx.translate(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
      ctx.rotate(a + Math.PI / 2);
      ctx.scale(k, 1);
      ctx.fillText(ch, 0, 0);
      ctx.restore();
      a += w / 2 / r;
    }
    ctx.restore();
  }
  // Rebote al caer (las letras del goleador)
  const easeBounce = (x) => {
    const n = 7.5625, d = 2.75;
    if (x < 1 / d) return n * x * x;
    if (x < 2 / d) return n * (x -= 1.5 / d) * x + 0.75;
    if (x < 2.5 / d) return n * (x -= 2.25 / d) * x + 0.9375;
    return n * (x -= 2.625 / d) * x + 0.984375;
  };

  // ============================================================
  // EL PARTIDO AL GOLPE · el marcador, los goles y el dato en cifras gigantes, el pulso del
  // partido (quién apretaba, minuto a minuto) y el campo en perspectiva para los tiros. Sin
  // rótulos: la cifra es la imagen.
  // Las escenas con stretch(dur) reparten su animación en lo que duren cuando la voz o la
  // versión larga piden más tiempo (las demás se quedan quietas al final, con hold).
  // ============================================================

  // La cinta verde con el gancho, cruzada de lado a lado. p: lo que se ve de ella (0–1).
  function hookTape(ctx, str, cy, p = 1, tilt = 0) {
    if (p <= 0 || !str) return;
    let size = 92;
    const room = W - 2 * M - 40;
    while (size > 58 && wrap(ctx, str, ANTON(size), room).length > 2) size -= 6;
    const lines = wrap(ctx, str, ANTON(size), room).slice(0, 3);
    const lh = size * 1.06, h = lines.length * lh + size * 0.5;
    ctx.save();
    ctx.translate(W / 2, cy);
    ctx.rotate(-0.06 + tilt);
    const L0 = -1100;
    ctx.beginPath();
    ctx.rect(L0, -h / 2 - 10, 2200 * p, h + 20);
    ctx.clip();
    ctx.shadowColor = 'rgba(0,0,0,.35)';
    ctx.shadowBlur = 40;
    ctx.shadowOffsetY = 12;
    ctx.fillStyle = ACCENT;
    ctx.fillRect(L0, -h / 2, 2200, h);
    ctx.shadowColor = 'transparent';
    lines.forEach((l, i) => text(ctx, l, -W / 2 + M + 20, -h / 2 + size * 0.25 + (i + 1) * lh - size * 0.14, ANTON(size), '#111111'));
    ctx.restore();
  }

  // ============================================================
  // EL SISTEMA · un solo mundo para todo el vídeo, como el de la selección francesa de LJ Studio:
  // el fondo negro con la luz de los dos equipos, las placas con las esquinas cortadas (la forma
  // de Jornada90) y un marcador fijo arriba que no desaparece de escena en escena.
  // ============================================================
  // Los dos temas, el «Estilo» del Studio: claro (por defecto: papel) u oscuro (casi negro). El
  // marcador fijo y tu marca van siempre en oscuro.
  const THEME = {
    claro: { ground: '#f2f0eb', ink: '#111111', mute: 'rgba(17,17,17,.62)', dots: 'rgba(0,0,0,.05)', glow: 0.22, vig: 0.1, dim: '242,240,235', grass: ['#3e8c4d', '#388446'], lines: 'rgba(255,255,255,.9)' },
    oscuro: { ground: '#07090d', ink: '#ffffff', mute: 'rgba(255,255,255,.62)', dots: 'rgba(255,255,255,.035)', glow: 0.3, vig: 0.4, dim: '4,5,8', grass: ['#0f3a22', '#0d331e'], lines: 'rgba(255,255,255,.7)' },
  };
  const theme = (d) => THEME[d.dark ? 'oscuro' : 'claro'];
  function groundBg(ctx, d) {
    const T = theme(d);
    const [bx, by, bw, bh] = bleed(ctx, 0, 0, W, H);
    ctx.drawImage(layer(`g|${T.ground}|${d.home.style.bg}|${d.away.style.bg}`, W, H, (c) => {
      c.fillStyle = T.ground;
      c.fillRect(0, 0, W, H);
      for (const [col, x] of [[d.home.style.bg, -0.1], [d.away.style.bg, 1.1]]) {
        const r = c.createRadialGradient(x * W, -0.05 * H, 0, x * W, -0.05 * H, W * 1.15);
        r.addColorStop(0, rgba(col, T.glow));
        r.addColorStop(0.5, rgba(col, T.glow / 4));
        r.addColorStop(1, rgba(col, 0));
        c.fillStyle = r;
        c.fillRect(0, 0, W, H);
      }
      // La trama de un marcador LED, muy suave
      c.fillStyle = T.dots;
      for (let y = 9; y < H; y += 18) for (let x = 9; x < W; x += 18) c.fillRect(x, y, 2, 2);
      vignette(c, W, H, T.vig);
    }), bx, by, bw, bh);
  }
  // La placa de Jornada90: un rectángulo con las cuatro esquinas cortadas
  function plate(ctx, x, y, w, h, c = Math.min(w, h) * 0.22) {
    ctx.beginPath();
    ctx.moveTo(x + c, y); ctx.lineTo(x + w - c, y); ctx.lineTo(x + w, y + c); ctx.lineTo(x + w, y + h - c);
    ctx.lineTo(x + w - c, y + h); ctx.lineTo(x + c, y + h); ctx.lineTo(x, y + h - c); ctx.lineTo(x, y + c);
    ctx.closePath();
  }
  // Un color de cada equipo que se lea sobre el fondo del tema, y distinto del otro
  const marksDark = (d) => marksOn(d, theme(d).ground);

  // EL MARCADOR FIJO · arriba, en todas las escenas después de la portada: tu logo, los escudos,
  // las siglas, el resultado en sus dos placas y, debajo, el minuto en LED (o «FINAL»).
  const BUG = { y: 40, h: 116, sw: 120, gap: 8 };
  const bugPlates = () => ({
    home: { x: W / 2 - BUG.gap / 2 - BUG.sw, y: BUG.y + 10, w: BUG.sw, h: BUG.h - 20 },
    away: { x: W / 2 + BUG.gap / 2, y: BUG.y + 10, w: BUG.sw, h: BUG.h - 20 },
  });
  // Una placa del resultado con su número (r: dónde; k: el golpe del número al cambiar)
  function scorePlate(ctx, r, n, st, k = 1) {
    roundRect(ctx, r.x, r.y, r.w, r.h, Math.min(14, r.h * 0.14));
    ctx.fillStyle = st.bg;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(255,255,255,.18)';
    ctx.stroke();
    const size = Math.min(r.h * 0.86, fit(ctx, String(n), ANTON, r.h * 0.86, r.w * 0.62));
    ctx.save();
    ctx.translate(r.x + r.w / 2, r.y + r.h / 2);
    ctx.scale(k, k);
    text(ctx, String(n), 0, capHeight(ctx, ANTON(size)) / 2, ANTON(size), st.fg, 'center');
    ctx.restore();
  }
  // b: { score: [local, visitante], clock: «63'» o «FINAL», pop: [golpe del local, del visitante] }
  function drawBug(ctx, d, A, b, alpha = 1) {
    if (!b || alpha <= 0) return;
    const { y, h } = BUG, P = bugPlates();
    ctx.save();
    ctx.globalAlpha *= alpha;
    ctx.shadowColor = 'rgba(0,0,0,.5)';
    ctx.shadowBlur = 30;
    plate(ctx, M, y, W - 2 * M, h, 26);
    ctx.fillStyle = 'rgba(6,8,11,.92)';
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(255,255,255,.14)';
    ctx.stroke();
    let x = M + 30;
    if (A.brandImg) {
      const k = Math.min(70 / A.brandImg.naturalWidth, 70 / A.brandImg.naturalHeight);
      ctx.drawImage(A.brandImg, x, y + h / 2 - (A.brandImg.naturalHeight * k) / 2, A.brandImg.naturalWidth * k, A.brandImg.naturalHeight * k);
      x += 86;
    }
    const abbr = (t) => up(t.abbr || t.short.slice(0, 3));
    logo(ctx, A.homeLogo, x + 36, y + h / 2, 70);
    text(ctx, abbr(d.home), x + 80, y + h / 2 + 22, ANTON(fit(ctx, abbr(d.home), ANTON, 60, P.home.x - x - 96)), '#ffffff');
    logo(ctx, A.awayLogo, W - M - 66, y + h / 2, 70);
    text(ctx, abbr(d.away), W - M - 110, y + h / 2 + 22, ANTON(fit(ctx, abbr(d.away), ANTON, 60, W - M - 126 - (P.away.x + P.away.w))), '#ffffff', 'right');
    scorePlate(ctx, P.home, b.score[0], d.home.style, 1 + 0.25 * (b.pop?.[0] || 0));
    scorePlate(ctx, P.away, b.score[1], d.away.style, 1 + 0.25 * (b.pop?.[1] || 0));
    // El minuto, en una placa debajo
    const clock = String(b.clock || '');
    const dot = 9, cw = ledWidth(clock, dot) + 48, cy = y + h + 6;
    plate(ctx, W / 2 - cw / 2, cy, cw, 7 * dot + 28, 14);
    ctx.fillStyle = 'rgba(6,8,11,.92)';
    ctx.fill();
    ledText(ctx, clock, W / 2, cy + 14, dot, b.final ? '#ffffff' : ACCENT, 'center');
    ctx.restore();
  }
  // El marcador del final (para las escenas de después del partido)
  const finalBug = (d) => () => ({ score: [d.home.score, d.away.score], clock: d.live ? d.clock : (d.t?.fullTime || 'FINAL'), final: !d.live });

  // LA PORTADA EN EL ESTADIO (con el campo en 3D): la cámara empieza muy arriba, mirando al césped
  // (cada mitad del color de su equipo y su número gigante de pie, con el escudo), baja girando y
  // acaba justo en el plano con el que empieza el partido, donde las dos mitades ya son la ola del
  // territorio; los números se van hacia la cámara. El aviso del móvil se abre a este mismo plano (una ventana).
  const COVER_END = { R: 140, el: 0.92 + 0.06 * Math.sin(1) + 0.2, yaw: -0.22, fov: 74 };
  function coverFrame(t, dur) {
    const u = easeInOut(clamp01(t / dur)), out = prog(t, dur - 0.45, 0.45);
    const R = 230 + (COVER_END.R - 230) * u, el = 1.5 + (COVER_END.el - 1.5) * u, yaw = 0.9 * (1 - u) + COVER_END.yaw * u;
    const tg = [0, 0, 4 * u];
    const pos = [tg[0] + R * Math.cos(el) * Math.sin(yaw), tg[1] + R * Math.sin(el), tg[2] - R * Math.cos(el) * Math.cos(yaw)];
    return {
      cam: { pos, target: tg, fov: COVER_END.fov }, focus: { at: [0, 0, 0], size: 90 },
      cover: { halves: 1, nums: easeBack(prog(t, 0.05, 0.35)) * (1 + 0.5 * out * out), alpha: 1 - out },
    };
  }

  // 1 · La portada: cada equipo en su mitad, con su escudo, su nombre y su número gigante, y
  // cruzando, la cinta verde con el gancho. Todo desde el primer fotograma. Un compás, para llegar
  // pronto al campo; al acabar entra el marcador de arriba, que ya no se va. Con el campo en 3D, la
  // portada es el estadio (ver coverFrame).
  function sceneScore(d, A, intro = false) {
    const winner = d.home.won ? d.home : d.away.won ? d.away : null;
    const halves = [{ side: d.home, logo: A.homeLogo, x: 0 }, { side: d.away, logo: A.awayLogo, x: W / 2 }];
    // Con la apertura del aviso, el gancho ya va en la tarjeta: en la cinta, el titular
    const hook = up((!intro && d.hook?.text) || d.headline);
    const pulse = (t, at) => Math.sin(Math.PI * prog(t, at, 0.3));
    const dur = BAR;
    const world = A?.world;
    return {
      id: 'score',
      dur,
      // (su frase tiene sitio para dos compases: con la voz, la escena crece lo que haga falta)
      room: 2 * BAR,
      accent: (winner || d.home).style.acc,
      // (con el 3D, el aviso del móvil ya acaba en este plano: sin cortinilla)
      ...(world ? { enter: { kind: 'cut' } } : {}),
      overlay: (ctx, t) => drawBug(ctx, d, A, finalBug(d)(), easeOut(prog(t, dur - 0.3, 0.3))),
      music: { energy: 'full', drop: BEAT },
      cues: [
        { t: 0, kind: 'impact', vel: 1 },
        { t: BEAT, kind: 'slam' }, { t: BEAT, kind: 'hit', vel: 0.8 },
        { t: dur - 0.3, kind: 'slam' },
      ],
      draw(ctx, t) {
        if (world) {
          world.frame(coverFrame(t, dur));
          groundBg(ctx, d);
          ctx.drawImage(world.canvas, ...bleed(ctx, 0, 0, W, H));
          if (d.live) chip(ctx, `${d.t?.live || 'EN JUEGO'} ${d.clock}`, W / 2, 640, { acc: '#e3172d', on: '#ffffff' }, 46, 'center');
          hookTape(ctx, hook, 1340, 1 - prog(t, dur - 0.35, 0.35), 0.025 * pulse(t, BEAT));
          return;
        }
        for (const h of halves) {
          const st = h.side.style;
          ctx.save();
          const band = bleed(ctx, h.x, 0, W / 2, H);
          ctx.beginPath();
          ctx.rect(...band);
          ctx.clip();
          teamBg(ctx, st, h.x, 0, W / 2, H, 0.5, 0.55);
          if (h.side.lost) {
            ctx.fillStyle = `rgba(0,0,0,${0.28 * easeOut(prog(t, BAR, 0.4))})`;
            ctx.fillRect(...bleed(ctx, h.x, 0, W / 2, H));
          }
          logo(ctx, h.logo, h.x + W / 4, 250, 180);
          const name = up(h.side.short);
          text(ctx, name, h.x + W / 4, 420, ANTON(fit(ctx, name, ANTON, 80, W / 2 - 90)), st.fg, 'center');
          const n = String(h.side.score ?? '');
          const size = fit(ctx, n, ANTON, 780, W / 2 - 70);
          const pop = 1 + 0.08 * pulse(t, BEAT) + (h.side.won ? 0.06 * pulse(t, BAR) : 0);
          ctx.save();
          ctx.translate(h.x + W / 4, 1180);
          ctx.scale(pop, pop);
          ctx.shadowColor = 'rgba(0,0,0,.3)';
          ctx.shadowBlur = 50;
          text(ctx, n, 0, 0, ANTON(size), st.fg, 'center');
          ctx.restore();
          if (h.side.shootout != null) text(ctx, `(${h.side.shootout})`, h.x + W / 4, 520, ANTON(84), st.fg, 'center');
          ctx.restore();
        }
        if (d.live) chip(ctx, `${d.t?.live || 'EN JUEGO'} ${d.clock}`, W / 2, 640, { acc: '#e3172d', on: '#ffffff' }, 46, 'center');
        // La cinta, debajo del resultado (encima tapaba los números)
        hookTape(ctx, hook, 1340, 1, 0.025 * pulse(t, BEAT));
      },
    };
  }

  // 2 · EL PARTIDO, del 0' al 90' en una sola pieza (como los retratos de Bogachev): el campo en
  // perspectiva y el reloj corriendo. Con el territorio (el sitio de los sucesos de la narración),
  // el campo de cada equipo va de su color hasta una ola que avanza hacia la portería del que está
  // encerrado y saca una lengua hasta cada jugada que importa, y bajo el reloj se va dibujando quién
  // empujaba; sin él, la luz de cada equipo se enciende sobre la portería que ataca cuando aprieta
  // (el pulso) y abajo va su gráfica. Solo vuelan los goles y los palos; en cada gol el reloj se
  // para, la cámara entra en el área, salen el minuto y el goleador, cambia el marcador de arriba y
  // se saca de centro. Al final, la posesión llena la pantalla. Junta lo que antes eran tres escenas
  // (los goles, el pulso y los tiros). Con WebGL, el campo es 3D (campo3d.js: el estadio, el césped,
  // las porterías con red, el balón, luces y confeti) y la cámara es de tele; sin él, el campo se
  // dibuja a mano en 2D, con lo mismo encima.
  function sceneMatch(d, A) {
    const s = d.shots, pu = d.pulse, tr = d.territory;
    // El campo en 3D, si lo hay (ver loadAssets); si no, el de 2D
    const world = A?.world || null;
    const total = tr?.total || pu?.total || (d.extraTime ? 120 : 90);
    const PL = 105, PW = 68, HL = PL / 2;
    const TH = theme(d);
    // Con el territorio, cada tiro va del color de su equipo que se lea sobre el campo del otro,
    // que es donde caen casi todos
    const onField = (st, bg) => [st.bg, st.acc, st.fg].filter(Boolean).find(c => contrastWith(c, bg) >= 3)
      || [st.bg, st.acc, st.fg, '#ffffff', '#111111'].filter(Boolean).sort((p, q) => contrastWith(q, bg) - contrastWith(p, bg))[0];
    const col = marksDark(d), colShot = tr ? { home: onField(d.home.style, d.away.style.bg), away: onField(d.away.style, d.home.style.bg) } : marksOn(d, TH.grass[0]);
    const sub = (p, q) => [p[0] - q[0], p[1] - q[1], p[2] - q[2]];
    const dot = (p, q) => p[0] * q[0] + p[1] * q[1] + p[2] * q[2];
    const cross = (p, q) => [p[1] * q[2] - p[2] * q[1], p[2] * q[0] - p[0] * q[2], p[0] * q[1] - p[1] * q[0]];
    const norm = (p) => { const l = Math.hypot(...p); return [p[0] / l, p[1] / l, p[2] / l]; };
    const rnd = (i) => { const v = Math.sin(i * 12.9898 + 78.233) * 43758.5453; return v - Math.floor(v); };
    const pressure = (side, m) => {
      if (!pu) return 0;
      const arr = pu[side], i = Math.max(0, Math.min(arr.length - 2, Math.floor(m))), f = m - i;
      return (arr[i] * (1 - f) + arr[i + 1] * f) / pu.max;
    };
    // EL TERRITORIO · una ola: el campo de cada equipo va de su color desde su portería hasta la
    // frontera, que avanza hacia la portería del que está encerrado (quién empujaba, minuto a minuto)
    // y, en cada jugada que importa (los goles, los tiros y, cerca del área contraria, los córners,
    // las faltas y los fueras de juego), saca una lengua del color del que tenía el balón, por su
    // banda, hasta su sitio: llega en el momento de la jugada y se recoge, así cada una cae en el color
    // de su equipo. Si dos caen casi a la vez, la más importante. En cada gol, la lengua del que marca
    // se queda hasta que se saca de centro, y entonces la ola vuelve al medio y se va soltando.
    const TONGUE = 22; // lo ancha que es la lengua (en % del ancho del campo)
    // Quién empujaba (0-100, lo del local): la base de la ola y la banda de arriba
    const pushAt = (mm) => {
      const i = Math.max(0, Math.min(tr.total - 1, Math.floor(mm))), f = clamp01(mm - i);
      return tr.push[i] * (1 - f) + tr.push[i + 1] * f;
    };
    // La ola para un reloj (timeOf: el momento del vídeo de cada minuto) y sus goles: wave(m, t) da
    // la frontera (su z) de banda a banda, en 33 puntos
    // (dives: los goles y los palos, con la bajada de la cámara: su lengua llega al empezar a bajar)
    const makeWave = (timeOf, goals, dives) => {
      const keys = [];
      for (const [tm, x, y, side, size] of tr.spots) {
        if (size < 2 && (side > 0 ? x < 66 : x > 34)) continue;
        // (hasta dónde llega: en un gol, hasta la portería; en un tiro, algo más allá; si no, a su sitio)
        const reach = size === 3 ? 100 : size === 2 ? 8 : 5;
        // (sube en 0,4 s y se recoge en 0,7: rápida, pero sin tirones)
        const k = { T: timeOf(tm), y, rank: size, target: side > 0 ? Math.min(99, x + reach) : Math.max(1, x - reach), rise: 0.4, decay: 0.7 };
        const st = size >= 2 && dives.filter(x => (size === 3 ? x.ev : x.post) && Math.abs(x.m - tm) < 1.5).sort((p, q) => Math.abs(p.m - tm) - Math.abs(q.m - tm))[0];
        if (st) k.T = Math.min(k.T, st.dive ?? st.start);
        k.hold = st ? Math.max(0.15, st.end - k.T) : 0.15;
        // (dos del mismo equipo no chocan: las dos sacan su lengua; ni dos del otro por bandas distintas.
        // Si una del otro por la misma banda cae justo detrás, la ola salta de una a otra, como un tira y
        // afloja: la primera se recoge de golpe y la segunda sale deprisa. Si caen a la vez, manda la más
        // importante; a un gol, nada lo corta)
        k.side = side;
        const last = keys.filter(x => x.side !== side && Math.abs(x.y - y) < 1.5 * TONGUE).pop();
        const gap = last ? k.T - last.T : 1;
        if (!last || Math.abs(gap) >= 0.35) keys.push(k);
        else if (last.rank === 3 && k.rank < 3) { /* el gol manda */ }
        else if (gap >= 0.1) {
          last.hold = Math.min(last.hold, 0.02);
          last.decay = Math.min(last.decay, gap - 0.02);
          k.rise = Math.min(k.rise, gap - 0.06);
          keys.push(k);
        } else if (k.rank >= last.rank) keys.splice(keys.indexOf(last), 1, k);
      }
      const resetAt = (t, m) => goals.reduce((r, st) => Math.max(r, easeInOut(prog(t, st.end - 0.2, 0.5)) * Math.exp(-Math.max(0, m - st.m) / 3)), 0);
      const env = (k, t) => (t < k.T ? easeOut(prog(t, k.T - k.rise, k.rise)) : t < k.T + k.hold ? 1 : 1 - easeInOut(prog(t, k.T + k.hold, k.decay)));
      return (m, t) => {
        const base = 50 + (pushAt(m) - 50) * 0.5, b = base + (50 - base) * 0.85 * resetAt(t, m);
        const act = keys.map(k => [k, env(k, t)]).filter(([, e]) => e > 0.001);
        return Array.from({ length: 33 }, (_, j) => {
          const y = 50 - ((-PW / 2 + (PW * j) / 32) / PW) * 100;
          // Las lenguas, una encima de otra en su orden: la última manda (en su momento llega a su sitio)
          let v = b;
          for (const [k, e] of act) v += (k.target - v) * e * Math.exp(-((y - k.y) ** 2) / (2 * TONGUE ** 2));
          v += 0.8 * Math.sin(t * 2.4 + y * 0.09);
          return -HL + (Math.max(1, Math.min(99, v)) / 100) * PL;
        });
      };
    };
    // La banda del territorio va bajo el reloj del marcador; las amarillas, debajo de ella
    const TERR_Y = 290, CARDS_Y = tr ? 392 : 330;
    const lerp = (p, q, k) => p + (q - p) * k;
    // Los goles (y las rojas), con el marcador de después
    let h = 0, a = 0;
    const evs = d.goals.filter(e => e.kind === 'goal' || e.kind === 'red').map(e => {
      if (e.kind === 'goal') { if (e.side === 'home') h++; else a++; }
      return { e, score: e.score ? [...e.score] : [h, a] };
    });
    const goalEvs = evs.filter(x => x.e.kind === 'goal');
    goalEvs.forEach(x => {
      const his = goalEvs.filter(y => !y.e.own && !x.e.own && y.e.name === x.e.name && y.e.side === x.e.side);
      if (his.length > 1 && his[his.length - 1] === x) x.mins = his.map(y => String(y.e.min || '').replace(/\s/g, ''));
    });
    // La polémica: las amarillas salen en su minuto (sin parar el reloj); el VAR, parándolo
    const yellows = d.goals.filter(e => e.kind === 'yellow');
    const subGroups = [];
    for (const e of d.goals.filter(x => x.kind === 'sub')) {
      const g = subGroups.find(x => x.side === e.side && Math.floor(x.t) === Math.floor(e.t));
      if (g && g.subs.length < 3) g.subs.push(e); else subGroups.push({ side: e.side, t: e.t, min: e.min, subs: [e] });
    }
    const minOf = (str) => { const mm = String(str || '').match(/(\d+)(?:'?\+(\d+))?/); return mm ? Number(mm[1]) + Math.min(Number(mm[2] || 0), 9) * 0.1 : 0; };
    const pol = d.polemica?.strong ? { ...d.polemica, t: minOf(d.polemica.min) } : null;
    // ESPN da cada tiro en % del campo, atacando hacia x = 100; el local ataca hacia z = +HL
    const place = (side, x, y) => (side === 'home' ? [-(y / 100 - 0.5) * PW, -HL + (x / 100) * PL] : [(y / 100 - 0.5) * PW, HL - (x / 100) * PL]);
    const scorers = { home: goalEvs.filter(x => !x.e.own && x.e.side === 'home'), away: goalEvs.filter(x => !x.e.own && x.e.side === 'away') };
    const seen = { home: 0, away: 0 };
    // Solo vuelan los goles y los tiros al palo: los fallados y los parados, no (se queda en el
    // campo lo que importa)
    const shots = s.list.filter(sh => sh.kind === 'goal' || sh.kind === 'post').map((sh, i) => {
      const [X, Z] = place(sh.side, sh.x, sh.y);
      const goalZ = sh.side === 'home' ? HL : -HL;
      let X2, Z2, h2;
      if (sh.x2 != null && sh.y2 != null && sh.x2 >= 95) [X2, Z2] = place(sh.side, Math.min(100, sh.x2), sh.y2);
      else [X2, Z2] = [(rnd(i) - 0.5) * 9, goalZ];
      if (sh.kind === 'goal' || sh.kind === 'on') { X2 = Math.max(-3.4, Math.min(3.4, X2)); Z2 = goalZ; h2 = 0.3 + rnd(i + 3) * 1.8; }
      else if (sh.kind === 'post') { X2 = X2 < 0 ? -3.66 : 3.66; Z2 = goalZ; h2 = 1 + rnd(i) * 1.4; }
      else {
        h2 = Math.abs(X2) < 3.66 ? 2.9 + rnd(i + 5) * 1.2 : 0.6 + rnd(i + 5) * 1.6;
        Z2 = goalZ + (sh.side === 'home' ? 4 : -4);
        if (sh.x2 != null && sh.x2 < 95) { Z2 = place(sh.side, sh.x2, sh.y2)[1]; h2 = 0.5; }
      }
      const g = sh.kind === 'goal' ? scorers[sh.side][seen[sh.side]++] : null;
      return { ...sh, X, Z, X2, Z2, h2, g, i };
    });
    const FLY = 0.5;
    // La animación del gol: 'mapa' (por defecto: sin bajar la cámara; el reloj se para un momento,
    // la ola llega a la portería, la cámara empuja hacia ella, la grada salta y sale el rótulo con
    // la cara: así no se pierde el hilo del partido), 'balon' (la cámara se pone detrás del que tira
    // y sigue el disparo hasta la red), 'celebra' (la pantalla del color del equipo y el GOL
    // gigante), 'led' (el marcador de bombillas del estadio) o '' (el minuto gigante sobre el campo
    // oscurecido)
    const GOAL = d.goalStyle ?? 'mapa';
    const flyOf = (sh) => (GOAL === 'balon' && sh.g ? 1.1 : FLY);
    const ballAt = (sh, u) => {
      const dist = Math.hypot(sh.X2 - sh.X, sh.Z2 - sh.Z), peak = sh.x2 != null && sh.x2 < 95 ? 0.4 : Math.min(4, dist * 0.09);
      return [sh.X + (sh.X2 - sh.X) * u, peak * 4 * u * (1 - u) + sh.h2 * u, sh.Z + (sh.Z2 - sh.Z) * u];
    };
    // El tiempo: el reloj corre por los minutos sin nada y se para en cada gol (y un momento en el
    // descanso y en cada roja)
    // Con el territorio, la cámara se queda arriba mientras corre el reloj (para ver la frontera) y
    // baja detrás del que tira con el reloj casi parado: el último minuto antes del gol va despacio
    // (DIVE) mientras la cámara baja y el balón vuela; luego, el gol con el reloj parado.
    const DIVE = tr && GOAL === 'balon' ? 1.3 : 0;
    // (y los palos, con el reloj casi parado mientras vuela el balón y un momento después)
    // Con el territorio, el reloj va más despacio (para ver cómo se mueve la frontera) y tras cada gol
    // se saca de centro (KICK): la cámara vuelve al medio con el balón en el punto central
    const RUN = tr ? 13 : 6, KICK = 0.9, LINEUP = 2.2, HOLD = { goal: DIVE ? 1.3 : GOAL === 'mapa' ? 1.5 : 1.6, red: 0.8, ht: 0.55, pol: 1.8, post: 0.8 };
    const stops = [...evs.map(x => ({ m: x.e.t, hold: HOLD[x.e.kind], pre: x.e.kind === 'goal' ? DIVE : 0, ev: x })), ...(d.halftime ? [{ m: 45.01, hold: HOLD.ht, pre: 0, ht: true }] : []),
      ...(pol ? [{ m: pol.t + 0.01, hold: HOLD.pol, pre: 0, pol }] : []),
      ...shots.filter(sh => sh.kind === 'post' && sh.t != null).map(sh => ({ m: sh.t, hold: HOLD.post, pre: DIVE ? 0.9 : 0, post: sh })),
      ...(tr ? evs.filter(x => x.e.kind === 'goal').map(x => ({ m: x.e.t + 0.02, hold: KICK, pre: 0, kick: x.e.side === 'home' ? 'away' : 'home' })) : []),
      // (los onces, al empezar, con el reloj parado en el 0')
      ...(d.lineups ? [{ m: 0.0001, hold: LINEUP, pre: 0, lineup: true }] : [])].sort((p, q) => p.m - q.m);
    const holdsTotal = stops.reduce((sum, x) => sum + x.hold + x.pre, 0);
    // Al acabar: con notas, el once que terminó el partido, cada uno con la suya; sin ellas, solo el
    // mejor del partido en su sitio. Y el mejor vuela y crece hasta su cara de la escena siguiente
    // (la del jugador del partido), que se abre desde ella.
    const bestSpot = d.lineups && d.jugador ? ['home', 'away'].flatMap(side => d.lineups[side].map(p => ({ side, p })))
      .find(({ p }) => p.id === d.lineups.best || p.on?.id === d.lineups.best) : null;
    const RATED = d.lineups?.rated ? 3.4 : 0, MVP = bestSpot && !RATED ? 1.8 : 0;
    const END = 0.9 + RATED + MVP;
    const build = (dur) => {
      const k = (dur - 0.3 - END) / (RUN + holdsTotal);
      const knots = [[0.3, 0]];
      let T = 0.3, prevM = 0;
      for (const st of stops) {
        const slow = st.pre ? Math.max(prevM, st.m - 1) : st.m;
        T += k * RUN * ((slow - prevM) / total);
        if (st.pre) {
          knots.push([T, slow]);
          st.dive = T;
          T += k * st.pre;
        }
        knots.push([T, st.m]);
        st.start = T;
        T += k * st.hold;
        st.end = T;
        knots.push([T, st.m]);
        prevM = st.m;
      }
      T += k * RUN * ((total - prevM) / total);
      knots.push([T, total]);
      const RUN_END = T;
      const minuteAt = (t) => {
        if (t <= knots[0][0]) return 0;
        for (let j = 1; j < knots.length; j++) {
          const [t0, m0] = knots[j - 1], [t1, m1] = knots[j];
          if (t <= t1) return t1 > t0 ? m0 + (m1 - m0) * ((t - t0) / (t1 - t0)) : m1;
        }
        return total;
      };
      const timeOfMinute = (m) => {
        for (let j = 1; j < knots.length; j++) {
          const [t0, m0] = knots[j - 1], [t1, m1] = knots[j];
          if (m <= m1 && m1 > m0) return t0 + (t1 - t0) * ((m - m0) / (m1 - m0));
        }
        return RUN_END;
      };
      const goalStops = stops.filter(st => st.ev?.e.kind === 'goal');
      const wave = tr ? makeWave(timeOfMinute, goalStops, stops.filter(st => st.ev?.e.kind === 'goal' || st.post)) : null;
      // (para las pruebas: en el momento de cada tiro y cada gol, ¿cae la jugada en el color de su
      // equipo? la frontera, en su banda, tiene que pasar de su sitio)
      const probe = () => (wave ? tr.spots.filter(sp => sp[4] >= 2).map(([tm, x, y, side, size]) => {
        const st = size === 3 && goalStops.filter(g => Math.abs(g.m - tm) < 1.5).sort((p, q) => Math.abs(p.m - tm) - Math.abs(q.m - tm))[0];
        const T = (st ? st.start : timeOfMinute(tm)) + 0.05;
        const zf = wave(minuteAt(T), T)[Math.max(0, Math.min(32, Math.round(((100 - y) * 32) / 100)))], zs = -HL + (x / 100) * PL;
        return { tm, side, goal: size === 3, front: Math.round(zf * 10) / 10, spot: Math.round(zs * 10) / 10, ok: side > 0 ? zf >= zs - 0.5 : zf <= zs + 0.5 };
      }) : null);
      // Cuándo sale cada tiro: en su minuto; el del gol, para que entre justo cuando se para el reloj
      shots.forEach(sh => {
        const st = (sh.g && goalStops.find(x => x.ev === sh.g)) || stops.find(x => x.post === sh);
        sh.launch = st ? st.start - flyOf(sh) : timeOfMinute(sh.t ?? (total * (sh.i + 0.5)) / Math.max(1, shots.length));
      });
      // La cámara: alta y girando despacio; en cada gol, entra hacia esa portería
      const LEAD = GOAL === 'balon' ? 1.2 : 0.35;
      // (siguiendo el balón, la cámara llega antes de que salga el disparo)
      // (con el territorio, la cámara baja deprisa y alcanza al balón, que ya ha salido)
      const bell = (t, st) => Math.min(easeInOut(st.dive != null ? prog(t, st.dive, 0.4) : GOAL === 'balon' ? prog(t, st.start - 2.1, 0.85) : prog(t, st.start - LEAD, LEAD)),
        1 - easeInOut(prog(t, st.end, 0.4)));
      goalStops.forEach(st => { st.shot = shots.find(sh => sh.g === st.ev); });
      const camera = (t) => {
        let w = 0, end = 1, near = null;
        for (const st of goalStops) {
          const q = bell(t, st);
          if (q > 0 && q >= w) { w = q; end = st.ev.e.side === 'home' ? 1 : -1; near = st; } // (en un empate, el gol que viene)
        }
        // Seguir el balón: detrás del que tira, a la altura de la cabeza, mirando a la portería
        if (GOAL === 'balon' && near?.shot) {
          const sh = near.shot, gz = end * HL;
          const dx = sh.X, dz = sh.Z - gz, l = Math.hypot(dx, dz) || 1;
          const cp = [sh.X + (dx / l) * 9, 3.2, sh.Z + (dz / l) * 9], ct = [0, 1.1, gz];
          const u0 = t / dur, yaw0 = -0.16 + 0.32 * u0, R0 = 112, el0 = 0.98, t0 = [0, 0, 4];
          const p0 = [t0[0] + R0 * Math.cos(el0) * Math.sin(yaw0), R0 * Math.sin(el0), t0[2] - R0 * Math.cos(el0) * Math.cos(yaw0)];
          const lerp3 = (a, b) => a.map((v, i) => v + (b[i] - v) * w);
          const pos = lerp3(p0, cp), tg = lerp3(t0, ct);
          const fwd = norm(sub(tg, pos)), right = norm(cross([0, 1, 0], fwd));
          return { pos, fwd, right, up: cross(fwd, right) };
        }
        const u = t / dur;
        const close = GOAL === 'balon';
        const yaw = -0.16 + 0.32 * u + w * (close ? 0.3 : 0.12) * end, el = 0.98 - (close ? 0.6 : 0.32) * w, R = 112 - (close ? 84 : 52) * w;
        const tgt = [0, close ? 1.2 * w : 0, 4 + (end * HL * (close ? 0.86 : 0.62) - 4) * w];
        const p = [tgt[0] + R * Math.cos(el) * Math.sin(yaw), R * Math.sin(el), tgt[2] - R * Math.cos(el) * Math.cos(yaw)];
        const fwd = norm(sub(tgt, p)), right = norm(cross([0, 1, 0], fwd));
        return { pos: p, fwd, right, up: cross(fwd, right) };
      };
      const F = 1240, CX = W / 2, CY = 900;
      const cues = [];
      shots.forEach(sh => { if (!sh.g) cues.push({ t: snap(sh.launch + flyOf(sh)), kind: 'pop', made: false, clank: sh.kind === 'post' }); });
      goalStops.forEach(st => cues.push({ t: snap(st.start), kind: 'impact', vel: 1 }, { t: snap(st.start), kind: 'slam' }, { t: snap(st.start), kind: 'pop', made: true }));
      stops.filter(st => st.ht || st.ev?.e.kind === 'red').forEach(st => cues.push({ t: snap(st.start), kind: 'hit', vel: 0.8 }));
      stops.filter(st => st.pol).forEach(st => cues.push({ t: snap(st.start), kind: 'impact', vel: 0.9 }, { t: snap(st.start), kind: 'slam' }));
      yellows.forEach(e => cues.push({ t: snap(timeOfMinute(e.t)), kind: 'hit', vel: 0.4 }));
      const scoreAt = (t) => {
        let sc = [0, 0], pop = [0, 0];
        for (const st of goalStops) {
          if (t < st.start) break;
          sc = st.ev.score;
          const q = 1 - clamp01((t - st.start) / 0.4);
          pop = st.ev.e.side === 'home' ? [q, 0] : [0, q];
        }
        return { sc, pop };
      };
      const minStr = (e) => String(e.min || '').replace(/\s/g, '');
      const shake = (lt, at, amp = 26) => { const q = prog(lt, at, 0.25); return q > 0 && q < 1 ? amp * (1 - q) ** 2 : 0; };
      const penStamp = (ctx, lt, out, e, x = W / 2 + 230, y = 560) => {
        if (!e.pen) return;
        const k2 = easeBack(prog(lt, 0.05, 0.25));
        ctx.save();
        ctx.globalAlpha = 1 - out;
        ctx.translate(x, y);
        ctx.rotate(0.12);
        ctx.scale(k2, k2);
        const str = d.t?.penalty || 'PENALTI';
        ctx.font = ANTON(70);
        const pw = ctx.measureText(str).width + 60;
        plate(ctx, -pw / 2, -60, pw, 110, 22);
        ctx.fillStyle = '#e3172d';
        ctx.fill();
        text(ctx, str, 0, 22, ANTON(70), '#ffffff', 'center');
        ctx.restore();
      };
      const goalFx = {
        // A · La celebración: la pantalla se tiñe del color del equipo desde la portería, el
        // «GOOOL» gigante cruza cortado por los bordes y, a golpes, el minuto y el goleador
        celebra(ctx, st, lt, out, e, Pj) {
          // El color del equipo; si es casi blanco (el Madrid), su acento o el negro, que el blanco no grita
          const light = contrastWith(e.style.bg, '#ffffff') < 1.6;
          const alt = light && contrastWith(e.style.acc || '#111111', '#ffffff') >= 3 ? e.style.acc : '#111111';
          const S = light ? { bg: alt, fg: '#ffffff' } : e.style, sg = e.side === 'home' ? 1 : -1;
          const [gx, gy] = Pj([0, 1.2, sg * HL]);
          const r = Math.hypot(W, H) * 1.3 * easeOut(prog(lt, 0, 0.22)) * (1 - easeInOut(out));
          ctx.save();
          ctx.beginPath(); ctx.arc(gx, gy, Math.max(0, r), 0, Math.PI * 2); ctx.clip();
          fillAll(ctx, S.bg);
          const sx = Math.sin(lt * 90) * (shake(lt, 0.05) + shake(lt, 0.55, 20) + shake(lt, 0.85, 16));
          ctx.translate(sx, 0);
          // Detrás, filas de «GOOOL» en contorno que corren en sentidos contrarios
          ctx.font = ANTON(260);
          ctx.lineWidth = 3;
          ctx.strokeStyle = rgba(S.fg, 0.18);
          const word = `${d.t?.goal || 'GOL'}`.replace(/O/, 'OOO') + '  ';
          const ww = ctx.measureText(word).width;
          for (let i = 0; i < 8; i++) {
            const dir = i % 2 ? 1 : -1, off = ((lt * 700 * dir + i * 230) % ww + ww) % ww;
            for (let x = -ww + off - 400; x < W + 400; x += ww) ctx.strokeText(word, x, 260 + i * 250);
          }
          // El «GOOOL» que cruza, enorme, y deja paso al minuto
          const g1 = prog(lt, 0.02, 0.55);
          if (g1 > 0 && g1 < 1) {
            const big = word.trim() + '!';
            ctx.save();
            ctx.translate(W * (1.1 - 1.6 * easeInOut(g1)), 1050);
            ctx.rotate(-0.06);
            text(ctx, big, 0, 0, ANTON(520), S.fg, 'center');
            ctx.restore();
          }
          const k1 = easeBack(prog(lt, 0.5, 0.2));
          if (k1 > 0) {
            ctx.save();
            ctx.translate(W / 2, 1000);
            ctx.rotate(-0.05);
            ctx.scale(1.25 - 0.25 * k1, 1.25 - 0.25 * k1);
            ctx.globalAlpha *= Math.min(1, k1 * 2);
            const mins = (st.ev.mins || [minStr(e)]).join(' ');
            text(ctx, mins, 0, 0, ANTON(fit(ctx, mins, ANTON, 560, W - 2 * M)), S.fg, 'center');
            ctx.restore();
          }
          const k2 = easeBack(prog(lt, 0.8, 0.22));
          if (k2 > 0) {
            const name = up(e.name);
            ctx.save();
            ctx.translate(W / 2, 1290);
            ctx.scale(k2, k2);
            const ns = fit(ctx, name, ANTON, 200, W - 2 * M);
            ctx.font = ANTON(ns);
            const nw = ctx.measureText(name).width + 60;
            ctx.fillStyle = S.fg;
            ctx.fillRect(-nw / 2, -ns * 1.06, nw, ns * 1.22);
            text(ctx, name, 0, 0, ANTON(ns), S.bg, 'center');
            if (e.how) text(ctx, e.how, 0, 90, BARLOW(fit(ctx, e.how, BARLOW, 54, W - 2 * M), 700), S.fg, 'center');
            ctx.restore();
          }
          ctx.restore();
          penStamp(ctx, lt, out, e);
          if (lt < 0.08) fillAll(ctx, `rgba(255,255,255,${0.6 * (1 - lt / 0.08)})`);
        },
        // B · El marcador de bombillas del estadio: «GOOOL» se enciende bombilla a bombilla y
        // parpadea; luego el mismo marcador enseña el minuto y el goleador
        led(ctx, st, lt, out, e) {
          const a = Math.min(easeOut(prog(lt, 0, 0.15)), 1 - out);
          fillAll(ctx, `rgba(4,5,8,${0.82 * a})`);
          const k = easeBack(prog(lt, 0, 0.25)) * (1 - 0.15 * out);
          const BW = W - 2 * M + 40, BH = 760, bx = -BW / 2, by = -BH / 2;
          ctx.save();
          ctx.globalAlpha = a;
          ctx.translate(W / 2 + Math.sin(lt * 80) * shake(lt, 0.05, 18), 980);
          ctx.scale(k, k);
          plate(ctx, bx, by, BW, BH, 40);
          ctx.fillStyle = '#05070a';
          ctx.fill();
          ctx.lineWidth = 6;
          ctx.strokeStyle = '#1b1f27';
          ctx.stroke();
          // Las bombillas del borde, que corren
          const n = 46, per = 2 * (BW + BH) - 120;
          for (let i = 0; i < n; i++) {
            let dd = ((i / n) * per + lt * 900) % per, x, y;
            const w2 = BW - 60, h2 = BH - 60;
            if (dd < w2) [x, y] = [bx + 30 + dd, by + 30]; else if ((dd -= w2) < h2) [x, y] = [bx + 30 + w2, by + 30 + dd];
            else if ((dd -= h2) < w2) [x, y] = [bx + 30 + w2 - dd, by + 30 + h2]; else [x, y] = [bx + 30, by + 30 + h2 - (dd - w2)];
            const on = (i + Math.floor(lt * 12)) % 3 === 0;
            ctx.beginPath(); ctx.arc(x, y, 9, 0, Math.PI * 2);
            ctx.fillStyle = on ? '#ffd76a' : 'rgba(255,215,106,.18)';
            ctx.shadowColor = on ? '#ffd76a' : 'transparent';
            ctx.shadowBlur = on ? 18 : 0;
            ctx.fill();
          }
          ctx.shadowBlur = 0;
          if (lt < 0.85) {
            // «GOOOL!» bombilla a bombilla, y parpadeando
            const word = (d.t?.goal || 'GOL').replace(/O/, 'OOO') + '!';
            const dot = Math.min(30, (BW - 120) / (word.length * 6 - 1));
            const blink = lt > 0.4 && lt < 0.7 && Math.floor(lt * 14) % 2 === 1;
            if (!blink) ledText(ctx, word, 0, -dot * 3.5, dot, ACCENT, 'center', prog(lt, 0.03, 0.15));
          } else {
            const mins = (st.ev.mins || [minStr(e)]).join(' ');
            const d1 = Math.min(34, (BW - 140) / (mins.length * 6 - 1));
            ledText(ctx, mins, 0, by + 90, d1, ACCENT, 'center', prog(lt, 0.85, 0.15));
            const name = up(e.name);
            const d2 = Math.min(24, (BW - 120) / (name.length * 6 - 1));
            ledText(ctx, name, 0, by + 120 + d1 * 7 + 50, d2, '#ffffff', 'center', prog(lt, 0.95, 0.15));
          }
          ctx.restore();
          penStamp(ctx, lt, out, e, W / 2 + 260, 520);
          if (e.how && lt > 1.0) {
            ctx.save();
            ctx.globalAlpha = a * easeOut(prog(lt, 1.0, 0.2));
            text(ctx, e.how, W / 2, 1450, BARLOW(fit(ctx, e.how, BARLOW, 54, W - 2 * M), 700), '#ffffff', 'center');
            ctx.restore();
          }
        },
        // C · Seguir el balón: la cámara baja con el disparo hasta la red (ver la cámara y la red,
        // arriba), un destello y el goleador al lado de la portería, sin tapar el campo
        // D · El mapa: un destello y el rótulo en el centro, con la cámara de la tele empujando hacia
        // esa portería (ver broadcast) y la ola llegando a ella
        mapa(ctx, st, lt, out, e) {
          if (lt < 0.08) fillAll(ctx, `rgba(255,255,255,${0.45 * (1 - lt / 0.08)})`);
          goalPlate(ctx, st, lt, out, e, W / 2, 760);
          penStamp(ctx, lt, out, e, W / 2 + 250, 560);
        },
        balon(ctx, st, lt, out, e, Pj) {
          if (lt < 0.1) fillAll(ctx, `rgba(255,255,255,${0.65 * (1 - lt / 0.1)})`);
          const sg = e.side === 'home' ? 1 : -1;
          const [gx, gy] = Pj([0, 3.4, sg * HL]);
          goalPlate(ctx, st, lt, out, e, Math.max(M + 300, Math.min(W - M - 300, gx)), Math.max(520, Math.min(1300, gy - 230)));
          penStamp(ctx, lt, out, e, W / 2 + 250, 420);
        },
      };
      // El rótulo del gol: los minutos y el goleador sobre el verde lima, su cara asomando por la
      // izquierda (con el escudo pequeñito) y, debajo, cómo fue
      function goalPlate(ctx, st, lt, out, e, px, py) {
          const k = easeBack(prog(lt, 0.12, 0.3));
          if (k <= 0) return;
          const str = `${(st.ev.mins || [minStr(e)]).join(' ')} ${up(e.name)}`;
          // (con su cara a la izquierda del rótulo, con el escudo pequeñito)
          const person = !e.own && d.people?.[e.pid], R = 96;
          ctx.save();
          ctx.globalAlpha = 1 - out;
          ctx.translate(px + Math.sin(lt * 80) * shake(lt, 0.12, 14), py);
          ctx.rotate(-0.04);
          ctx.scale(k, k);
          const size = fit(ctx, str, ANTON, 120, W - 2 * M - 40 - (person ? R * 2.1 : 0));
          ctx.font = ANTON(size);
          // (la cara asoma por la izquierda del rótulo y el texto empieza a su derecha)
          const tw = ctx.measureText(str).width, lead = person ? R * 1.3 : 35, w = lead + tw + 35, over = person ? R * 0.75 : 0;
          const x0 = -(w + over) / 2 + over, dx = x0 + lead + tw / 2;
          plate(ctx, x0, -size * 0.95, w, size * 1.35, 24);
          ctx.fillStyle = ACCENT;
          ctx.fill();
          text(ctx, str, dx, size * 0.12, ANTON(size), '#111111', 'center');
          if (person) playerChip(ctx, A, person, d[e.side].style, x0 + R * 0.25, -size * 0.28, R, { crest: e.side === 'home' ? A.homeLogo : A.awayLogo });
          if (e.how) {
            ctx.font = BARLOW(50, 700);
            const hw = ctx.measureText(e.how).width + 40;
            plate(ctx, -hw / 2 + dx, size * 0.5, hw, 74, 14);
            ctx.fillStyle = '#06080b';
            ctx.fill();
            text(ctx, e.how, dx, size * 0.5 + 54, BARLOW(50, 700), '#ffffff', 'center');
          }
          ctx.restore();
      }
      // EL CAMPO EN 3D (campo3d.js, con Three.js): la cámara de la tele, alta y con gran angular, que
      // se va hacia donde se juega (la frontera) y no se está quieta; en cada gol baja detrás del que
      // tira, sigue el balón hasta la red, que se hunde, y gira alrededor de la portería entre el
      // confeti del equipo; en cada palo, el balón da en el poste y sale rebotado.
      const BALL_R = 0.11, FLY3 = 1.0, POST_FLY = 0.75;
      const lerpV = (p, q, k) => p.map((v, i) => lerp(v, q[i], k));
      const orbit = (tg, R, el, yaw) => [tg[0] + R * Math.cos(el) * Math.sin(yaw), tg[1] + R * Math.sin(el), tg[2] - R * Math.cos(el) * Math.cos(yaw)];
      const kicks = stops.filter(st => st.kick);
      const broadcast = (t, m) => {
        // (la cámara se va hacia donde se está jugando)
        const zF = wave ? wave(m, t).reduce((p, q) => p + q, 0) / 33 : 0;
        const intro = 1 - easeOut(prog(t, 0, 1.6)), outro = easeInOut(prog(t, RUN_END, 0.8));
        // (en cada gol, sin bajar, empuja hacia esa portería: gw, y el lado, gs)
        let gw = 0, gs = 1;
        if (GOAL === 'mapa') for (const st of goalStops) {
          const q = Math.min(easeOut(prog(t, st.start - 0.05, 0.3)), 1 - easeInOut(prog(t, st.end - 0.1, 0.5)));
          if (q > gw) { gw = q; gs = sideSign(st.ev.e.side); }
        }
        // (en el saque de centro, la cámara se acerca al círculo central)
        const kw = kicks.reduce((r, st) => Math.max(r, Math.min(easeInOut(prog(t, st.start - 0.5, 0.5)), 1 - easeInOut(prog(t, st.end, 0.7)))), 0);
        const yaw = (-0.22 + 0.44 * (t / dur) + 0.12 * Math.sin(t * 0.8)) * (1 - outro);
        // (al acabar, la cámara sube para ver el campo entero; con las notas, menos, para que se lean)
        const el = 0.92 + 0.06 * Math.sin(t * 0.55 + 1) + 0.2 * intro + (RATED ? 0.1 : 0.25) * outro - 0.12 * kw;
        const R = (100 + 8 * Math.sin(t * 0.45) + 40 * intro + (RATED ? -6 : 10) * outro) * (1 - 0.3 * kw);
        const tg = [0, 0, lerp(lerp(lerp(4 + zF * 0.4, 4, outro), 0, kw), gs * HL * 0.6, gw * 0.7)];
        return { pos: orbit(tg, R * (1 - 0.22 * gw), el - 0.1 * gw, yaw), target: tg, fov: 74 - 6 * gw };
      };
      // El saque de centro: el balón en el punto central y, al poco, un pase atrás del que ha encajado
      const kickBall = (st, t) => {
        const tk = st.start + 0.45, sg = st.kick === 'home' ? -1 : 1;
        const u = t < tk ? 0 : 1 - Math.exp(-(t - tk) * 3);
        return [1.6 * u, BALL_R, sg * 9 * u];
      };
      // La red: se hunde de golpe y vuelve despacio, con un temblor
      const netAmp = (lt) => (lt <= 0 ? 0 : 0.95 * (1 - Math.exp(-lt * 24)) * Math.exp(-lt * 2.4) + 0.06 * Math.sin(lt * 28) * Math.exp(-lt * 5));
      const sideSign = (side) => (side === 'home' ? 1 : -1);
      // El tiro del gol: del sitio del tiro (S) a la red (N), por donde entra
      const shot3 = (sh) => {
        if (!sh.p3) {
          const sg = sideSign(sh.side), h = Math.max(0.2, Math.min(2.3, sh.h2));
          const x = Math.max(-3.3, Math.min(3.3, sh.X2)), s = world.netHit(h);
          sh.p3 = { sg, S: [sh.X, BALL_R, sh.Z], N: world.netPoint(sg, x, s), x, s };
        }
        return sh.p3;
      };
      const ball3 = (st, t) => {
        const { sg, S, N } = shot3(st.shot);
        const lt = t - st.start;
        if (lt > 0) return [N[0], Math.max(BALL_R, N[1] - 4.9 * Math.max(0, lt - 0.18) ** 2), N[2] + sg * netAmp(lt) * 0.9];
        const p = clamp01((t - (st.start - FLY3)) / FLY3), u = 1 - (1 - p) ** 1.5;
        const peak = Math.min(2.5, Math.hypot(N[0] - S[0], N[2] - S[2]) * 0.05);
        return [lerp(S[0], N[0], u), lerp(S[1], N[1], u) + peak * 4 * u * (1 - u), lerp(S[2], N[2], u)];
      };
      const goalCam = (st, t) => {
        const sg = sideSign(st.ev.e.side), gz = sg * HL, G = [0, 1.2, gz], lt = t - st.start;
        // Sin el sitio del tiro (un gol en propia…): de frente a la portería
        if (!st.shot) return { pos: [6 * sg, 3.2, gz - sg * 17], target: G, fov: 48 };
        const { S, N } = shot3(st.shot);
        let dx = N[0] - S[0], dz = N[2] - S[2];
        const l = Math.hypot(dx, dz) || 1;
        dx /= l; dz /= l;
        // Detrás del que tira, a la altura de la cabeza; con el disparo, la cámara persigue al balón
        // (que sale más deprisa) y llega a 6 m de la red cuando entra
        const k = easeInOut(clamp01((t - (st.start - FLY3)) / FLY3));
        const C0 = [S[0] - dx * 6.5, 2.1, S[2] - dz * 6.5], C1 = [N[0] - dx * 6, 1.5, N[2] - dz * 6];
        let pos = lerpV(C0, C1, k);
        let target = lerpV(lerpV(G, ball3(st, Math.min(t, st.start)), 0.5), N, k * k);
        let fov = lerp(52, 46, k);
        if (lt > 0) {
          // Tras el gol: el golpe (la cámara se cierra y tiembla) y luego se abre girando alrededor de
          // la portería, hacia el lado abierto, para verla entera con el confeti
          const open = easeInOut(clamp01((lt - 0.25) / 1.4));
          const a = (N[0] >= 0 ? -1 : 1) * 0.75 * open, ca = Math.cos(a), sa = Math.sin(a);
          const back = 1 + 1.6 * open, rx = (pos[0] - G[0]) * back, rz = (pos[2] - G[2]) * back;
          const sk = 0.12 * Math.exp(-lt * 6);
          pos = [G[0] + rx * ca - rz * sa + sk * Math.sin(lt * 61), pos[1] + 1.8 * open + sk * Math.sin(lt * 47 + 1), G[2] + rx * sa + rz * ca];
          target = lerpV(N, [0, 1.3, gz + sg * 0.5], open);
          fov = 46 - 6 * Math.exp(-lt * 7) + 6 * open;
        }
        return { pos, target, fov };
      };
      // El palo: el balón va al poste de su lado (o al larguero) y sale rebotado hacia el campo
      const postBall = (st, t) => {
        const sh = st.post, sg = sideSign(sh.side), gz = sg * HL;
        const S = [sh.X, BALL_R, sh.Z], h = Math.max(0.3, Math.min(2.5, sh.h2));
        const P = h > 2.3 ? [Math.max(-3, Math.min(3, sh.X2 || 1)), 2.5, gz] : [Math.sign(sh.X2 || 1) * 3.72, h, gz];
        const t0 = st.start - POST_FLY;
        if (t < t0) return S;
        if (t <= st.start) {
          const u = 1 - (1 - (t - t0) / POST_FLY) ** 1.4, peak = Math.min(2, Math.hypot(P[0] - S[0], P[2] - S[2]) * 0.04);
          return [lerp(S[0], P[0], u), lerp(S[1], P[1], u) + peak * 4 * u * (1 - u), lerp(S[2], P[2], u)];
        }
        const lt = t - st.start;
        let bx = S[0] - P[0], bz = S[2] - P[2];
        const l = Math.hypot(bx, bz) || 1;
        return [P[0] + (bx / l) * 9 * lt - Math.sign(P[0] || 1) * 3 * lt, Math.max(BALL_R, P[1] + 3 * lt - 4.9 * lt * lt), P[2] + (bz / l) * 9 * lt];
      };
      // Como en el gol: la cámara persigue al balón hasta el palo; con el golpe tiembla y el balón
      // sale rebotado hacia ella
      const postCam = (st, t) => {
        const sh = st.post, S = [sh.X, BALL_R, sh.Z], P = postBall(st, st.start), lt = t - st.start;
        let dx = P[0] - S[0], dz = P[2] - S[2];
        const l = Math.hypot(dx, dz) || 1;
        dx /= l; dz /= l;
        const k = easeInOut(clamp01((t - (st.start - POST_FLY)) / POST_FLY));
        const C0 = [S[0] - dx * 6.5, 2.1, S[2] - dz * 6.5], C1 = [P[0] - dx * 6, Math.max(1.4, P[1]), P[2] - dz * 6];
        const sk = lt > 0 ? 0.14 * Math.exp(-lt * 7) : 0;
        const pos = lerpV(C0, C1, k).map((v, i) => v + (i === 0 ? sk * Math.sin(lt * 70) : i === 1 ? sk * Math.sin(lt * 53 + 1) : 0));
        const target = lt > 0 ? lerpV(P, postBall(st, t), 0.35) : lerpV(lerpV([0, 1.2, sideSign(sh.side) * HL], postBall(st, t), 0.5), P, k * k);
        return { pos, target, fov: lt > 0 ? 46 - 5 * Math.exp(-lt * 8) : lerp(52, 46, k) };
      };
      const confettiOf = (side) => [...new Set([d[side].style.bg, d[side].style.acc, ACCENT].filter(Boolean))];
      // De una cámara a otra girando alrededor de lo que mira (no en línea recta: en los goles de la
      // otra portería, la cámara tiene que darse la vuelta y, en línea recta, miraría al suelo)
      const toOrbit = (c) => {
        const v = sub(c.target, c.pos), D = Math.hypot(...v) || 1;
        return { T: c.target, D, yaw: Math.atan2(v[0], v[2]), pitch: Math.asin(v[1] / D), fov: c.fov };
      };
      const blendCam = (a, b, q) => {
        const A = toOrbit(a), B = toOrbit(b);
        let dy = B.yaw - A.yaw;
        while (dy > Math.PI) dy -= 2 * Math.PI;
        while (dy < -Math.PI) dy += 2 * Math.PI;
        const yaw = A.yaw + dy * q, pitch = lerp(A.pitch, B.pitch, q), D = Math.exp(lerp(Math.log(A.D), Math.log(B.D), q));
        const T = lerpV(A.T, B.T, q), f = [Math.cos(pitch) * Math.sin(yaw), Math.sin(pitch), Math.cos(pitch) * Math.cos(yaw)];
        return { pos: T.map((v, i) => v - f[i] * D), target: T, fov: lerp(A.fov, B.fov, q) };
      };
      const draw3d = (ctx, t, m) => {
        let cam = broadcast(t, m), w = 0, ball = null, trail = null, burst = null, cheer = null;
        const nets = {};
        const ripples = [];
        for (const st of stops) {
          if (st.kick && t > st.start - 0.3 && t < st.end + 0.4) {
            ball = { pos: kickBall(st, t), spin: Math.max(0, t - st.start - 0.45) * 10, scale: 1.6 };
            const age = (t - st.start - 0.45) / 0.8;
            if (age >= 0 && age < 1) ripples.push({ x: 0, z: 0, age, size: 2.4 });
          }
          const goal = st.ev?.e.kind === 'goal';
          if (!goal && !st.post) continue;
          if (GOAL === 'mapa') {
            const lt = t - st.start;
            if (goal && lt > 0 && lt < 3) cheer = { side: st.ev.e.side, age: lt };
            continue;
          }
          const from = st.dive ?? st.start - (st.post ? POST_FLY : FLY3) - 0.45;
          const q = Math.min(easeInOut(prog(t, from, 0.45)), 1 - easeInOut(prog(t, st.end, 0.45)));
          if (q > 0) {
            cam = blendCam(cam, st.post ? postCam(st, t) : goalCam(st, t), q);
            w = Math.max(w, q);
          }
          const lt = t - st.start, on = t >= from && t < st.end + 0.45;
          if (st.post && on) ball = { pos: postBall(st, t), spin: t * 14, scale: 1 };
          if (goal && st.shot && on) {
            ball = { pos: ball3(st, t), spin: Math.min(t, st.start) * 16, scale: 1 };
            const t0 = st.start - FLY3;
            if (t > t0 && lt < 0.05) trail = Array.from({ length: 10 }, (_, j) => ball3(st, Math.max(t0, t - 0.22 + j * 0.022)));
          }
          if (goal && lt > 0 && lt < 3) {
            if (st.shot) nets[shot3(st.shot).sg] = { x: shot3(st.shot).x, s: shot3(st.shot).s, amp: netAmp(lt) };
            if (lt < 2.2) burst = { at: [0, 1.7, sideSign(st.ev.e.side) * (HL - 0.4)], age: lt, dir: sideSign(st.ev.e.side), colors: confettiOf(st.ev.e.side) };
            cheer = { side: st.ev.e.side, age: lt };
          }
        }
        world.frame({
          cam, front: wave ? wave(m, t) : null, terr: tr ? 1 : 0, ball, trail, nets, burst, cheer, ripples,
          focus: w > 0.5 ? { at: [cam.target[0], 0, cam.target[2]], size: 18 } : { at: [0, 0, cam.target[2]], size: 85 },
        });
        groundBg(ctx, d);
        const [bx, by, bw, bh] = bleed(ctx, 0, 0, W, H);
        ctx.drawImage(world.canvas, bx, by, bw, bh);
        return (p) => { const [nx, ny] = world.project(p); return [bx + (nx * 0.5 + 0.5) * bw, by + (0.5 - ny * 0.5) * bh]; };
      };
      // EL CAMPO EN 2D (sin WebGL): la cámara, el campo, el territorio, las líneas, las porterías y los
      // tiros, dibujados a mano. Devuelve cómo se proyecta un punto del campo en la pantalla.
      const draw2d = (ctx, t, m) => {
        const cam = camera(t);
        const Pj = (p) => { const v = sub(p, cam.pos), z = dot(v, cam.fwd); return [CX + (F * dot(v, cam.right)) / z, CY - (F * dot(v, cam.up)) / z]; };
        // Lo que queda detrás de la cámara (con la cámara a ras de césped) se recorta contra un
        // plano a medio metro de ella; si no, el césped de detrás saldría por arriba
        const NEAR = 0.5;
        const camP = (p) => { const v = sub(p, cam.pos); return [dot(v, cam.right), dot(v, cam.up), dot(v, cam.fwd)]; };
        const scr = ([x, y, z]) => [CX + (F * x) / z, CY - (F * y) / z];
        const cut = (a, b) => { const k = (NEAR - a[2]) / (b[2] - a[2]); return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, NEAR]; };
        const path = (pts, close) => {
          ctx.beginPath();
          const cs = pts.map(camP);
          if (close) {
            const out = [];
            cs.forEach((a, j) => {
              const b = cs[(j + 1) % cs.length];
              if (a[2] >= NEAR) out.push(a);
              if ((a[2] >= NEAR) !== (b[2] >= NEAR)) out.push(cut(a, b));
            });
            out.forEach((c, j) => { const [x, y] = scr(c); if (j) ctx.lineTo(x, y); else ctx.moveTo(x, y); });
            if (out.length) ctx.closePath();
            return;
          }
          let pen = false;
          cs.forEach((a, j) => {
            const b = cs[j + 1];
            if (a[2] >= NEAR) { const [x, y] = scr(a); if (pen) ctx.lineTo(x, y); else ctx.moveTo(x, y); pen = true; }
            if (b && (a[2] >= NEAR) !== (b[2] >= NEAR)) {
              const [x, y] = scr(cut(a, b));
              if (pen) { ctx.lineTo(x, y); pen = false; } else { ctx.moveTo(x, y); pen = true; }
            }
          });
        };
        const rect = (x0, z0, x1, z1) => [[x0, 0, z0], [x1, 0, z0], [x1, 0, z1], [x0, 0, z1]];
        groundBg(ctx, d);
        // El césped de fuera de las líneas y, encima, el del campo a franjas
        path(rect(-PW / 2 - 9, -HL - 12, PW / 2 + 9, HL + 12), true);
        ctx.fillStyle = TH.grass[1];
        ctx.fill();
        for (let i = 0; i < 12; i++) {
          const z0 = -HL + (i * PL) / 12;
          path(rect(-PW / 2, z0, PW / 2, z0 + PL / 12), true);
          ctx.fillStyle = TH.grass[i % 2];
          ctx.fill();
        }
        // El territorio: el campo de cada uno, del color de su equipo, hasta la frontera (la ola)
        const front = wave && wave(m, t);
        if (front) {
          const F = front.map((z, j) => [-PW / 2 + (PW * j) / 32, z]);
          const poly = {
            home: [[-PW / 2, 0, -HL], [PW / 2, 0, -HL], ...F.slice().reverse().map(([x, z]) => [x, 0, z])],
            away: [...F.map(([x, z]) => [x, 0, z]), [PW / 2, 0, HL], [-PW / 2, 0, HL]],
          };
          for (const side of ['home', 'away']) {
            path(poly[side], true);
            ctx.fillStyle = rgba(d[side].style.bg, 0.94);
            ctx.fill();
          }
          front.F = F;
          front.poly = poly;
        }
        // La luz de quien aprieta, sobre la portería que ataca (sin territorio)
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (const [side, z] of tr ? [] : [['home', HL * 0.55], ['away', -HL * 0.55]]) {
          const p = pressure(side, m);
          if (p < 0.03) continue;
          const [gx, gy] = Pj([0, 0, z]);
          const [ex] = Pj([PW / 2, 0, z]);
          const rx = Math.max(60, Math.abs(ex - gx)) * 1.15;
          ctx.save();
          ctx.translate(gx, gy);
          ctx.scale(1, 0.55);
          const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
          g.addColorStop(0, rgba(colShot[side], 0.55 * p));
          g.addColorStop(1, rgba(col[side], 0));
          ctx.fillStyle = g;
          ctx.fillRect(-rx, -rx, 2 * rx, 2 * rx);
          ctx.restore();
        }
        ctx.restore();
        // Las líneas
        const draw = (pts, close, style = TH.lines, width = 3) => { path(pts, close); ctx.strokeStyle = style; ctx.lineWidth = width; ctx.stroke(); };
        ctx.lineJoin = 'round';
        const pitchLines = (style) => {
          draw(rect(-PW / 2, -HL, PW / 2, HL), true, style);
          draw([[-PW / 2, 0, 0], [PW / 2, 0, 0]], false, style);
          draw(Array.from({ length: 49 }, (_, j) => [9.15 * Math.cos((j / 48) * Math.PI * 2), 0, 9.15 * Math.sin((j / 48) * Math.PI * 2)]), false, style);
          for (const sg of [1, -1]) {
            draw([[-20.16, 0, sg * HL], [-20.16, 0, sg * (HL - 16.5)], [20.16, 0, sg * (HL - 16.5)], [20.16, 0, sg * HL]], false, style);
            draw([[-9.16, 0, sg * HL], [-9.16, 0, sg * (HL - 5.5)], [9.16, 0, sg * (HL - 5.5)], [9.16, 0, sg * HL]], false, style);
          }
        };
        if (front) {
          // Cada campo con sus líneas, del color que se lea encima
          for (const side of ['home', 'away']) {
            ctx.save();
            path(front.poly[side], true);
            ctx.clip();
            pitchLines(contrastWith(d[side].style.bg, '#ffffff') >= 2.2 ? 'rgba(255,255,255,.88)' : 'rgba(17,17,17,.5)');
            ctx.restore();
          }
        } else pitchLines(TH.lines);
        for (const sg of [1, -1]) {
          const ink = '255,255,255';
          draw([[-3.66, 2.44, sg * HL], [-3.66, 0, sg * (HL + 2)], [3.66, 0, sg * (HL + 2)], [3.66, 2.44, sg * HL]], false, `rgba(${ink},.3)`, 2);
          draw([[-3.66, 0, sg * HL], [-3.66, 2.44, sg * HL], [3.66, 2.44, sg * HL], [3.66, 0, sg * HL]], false, `rgb(${ink})`, 6);
        }
        // La frontera: una línea de luz verde lima
        if (front) {
          ctx.save();
          path(front.F.map(([x, z]) => [x, 0, z]));
          ctx.shadowColor = ACCENT;
          ctx.shadowBlur = 24;
          ctx.strokeStyle = ACCENT;
          ctx.lineWidth = 7;
          ctx.stroke();
          ctx.restore();
        }
        // Los tiros, cada uno en su minuto
        const glows = [];
        for (const sh of shots) {
          if (t < sh.launch) continue;
          const fly = flyOf(sh), u = clamp01((t - sh.launch) / fly), c = colShot[sh.side];
          // (con la cámara detrás del que tira, su marca quedaría enorme a sus pies)
          if (!(GOAL === 'balon' && sh.g)) path(Array.from({ length: 13 }, (_, j) => [sh.X + 0.9 * Math.cos((j / 12) * Math.PI * 2), 0, sh.Z + 0.9 * Math.sin((j / 12) * Math.PI * 2)]), true);
          else ctx.beginPath();
          if (sh.kind === 'goal' || sh.kind === 'on') { ctx.fillStyle = c; ctx.fill(); } else { ctx.strokeStyle = c; ctx.lineWidth = 4; ctx.stroke(); }
          const after = t - sh.launch - fly;
          if (u < 1 || (sh.kind === 'goal' && after < 0.9)) {
            const tail = Math.max(0, u - 0.35);
            path(Array.from({ length: 12 }, (_, j) => ballAt(sh, tail + ((u - tail) * j) / 11)));
            ctx.strokeStyle = rgba(c, 0.6 * (u < 1 ? 1 : 1 - after / 0.9));
            ctx.lineWidth = 5;
            ctx.stroke();
            if (u < 1) {
              const bp = ballAt(sh, u), [bx, by] = Pj(bp);
              // Siguiendo el balón, a su tamaño (de cerca, grande)
              const r = GOAL === 'balon' && sh.g ? Math.min(60, Math.max(12, (F * 0.3) / Math.max(1, camP(bp)[2]))) : 14;
              football(ctx, bx, by, r, 1, u * 9);
            }
          }
          if (sh.kind === 'goal' && u >= 1 && after < 1) glows.push({ sh, after });
        }
        // La red: con la cámara siguiendo el balón, la del gol se hunde donde entra
        if (GOAL === 'balon') {
          for (const { sh, after } of glows) {
            const sg = sh.side === 'home' ? 1 : -1, hit = ballAt(sh, 1);
            const bulge = 1.6 * Math.sin(Math.PI * clamp01(after / 0.5)) * (1 - clamp01(after / 0.9) * 0.6);
            const at = (x, y) => [x, y, sg * (HL + 2 + bulge * Math.exp(-((x - hit[0]) ** 2 + (y - hit[1]) ** 2) / 1.2))];
            ctx.strokeStyle = 'rgba(255,255,255,.75)';
            ctx.lineWidth = 2;
            for (let k = 0; k <= 10; k++) { const x = -3.66 + (7.32 * k) / 10; path(Array.from({ length: 9 }, (_, q) => at(x, (2.44 * q) / 8))); ctx.stroke(); }
            for (let k = 0; k <= 6; k++) { const y = (2.44 * k) / 6; path(Array.from({ length: 13 }, (_, q) => at(-3.66 + (7.32 * q) / 12, y))); ctx.stroke(); }
          }
        }
        for (const { sh, after } of glows) {
          const [gx, gy] = Pj([0, 1.2, sh.side === 'home' ? HL : -HL]);
          const r = 80 + 340 * easeOut(after);
          const g = ctx.createRadialGradient(gx, gy, 0, gx, gy, r);
          g.addColorStop(0, rgba(ACCENT, 0.85 * (1 - after)));
          g.addColorStop(1, rgba(ACCENT, 0));
          ctx.fillStyle = g;
          ctx.fillRect(gx - r, gy - r, 2 * r, 2 * r);
        }
        return Pj;
      };
      return {
        id: 'goals',
        dur,
        stretch: build,
        probe,
        camera: false,
        enter: { kind: 'cut' },
        accent: ACCENT,
        music: { energy: 'full' },
        cues,
        overlay: (ctx, t) => {
          const { sc, pop } = scoreAt(t);
          const done = t >= RUN_END;
          drawBug(ctx, d, A, { score: done ? [d.home.score, d.away.score] : sc, pop, clock: done ? (d.t?.fullTime || 'FINAL') : `${Math.floor(minuteAt(t))}'`, final: done });
        },
        draw(ctx, t) {
          const m = minuteAt(t);
          const Pj = world ? draw3d(ctx, t, m) : draw2d(ctx, t, m);
          // Arriba, bajo el reloj, quién empujaba minuto a minuto: una banda con el color de cada uno
          // (el local abajo, como en el campo) que se va dibujando con el reloj; cada gol, un balón
          // sobre la línea. Abajo queda sitio para los subtítulos.
          if (tr) {
            const GX0 = M, GX1 = W - M, GY0 = TERR_Y, GH = 72;
            const xOf = (mm) => GX0 + ((GX1 - GX0) * mm) / total;
            const yOf = (mm) => GY0 + GH * (1 - pushAt(mm) / 100);
            ctx.save();
            roundRect(ctx, GX0, GY0, GX1 - GX0, GH, 12);
            ctx.fillStyle = rgba(TH.ink, 0.05);
            ctx.fill();
            ctx.clip();
            for (const [side, edge] of [['away', GY0], ['home', GY0 + GH]]) {
              ctx.beginPath();
              ctx.moveTo(xOf(0), edge);
              for (let mm = 0; mm <= m; mm += 0.5) ctx.lineTo(xOf(mm), yOf(mm));
              ctx.lineTo(xOf(m), yOf(m));
              ctx.lineTo(xOf(m), edge);
              ctx.closePath();
              ctx.fillStyle = d[side].style.bg;
              ctx.fill();
            }
            // La mitad del campo y la frontera
            ctx.fillStyle = 'rgba(0,0,0,.18)';
            for (let x = GX0 + 6; x < GX1; x += 22) ctx.fillRect(x, GY0 + GH / 2 - 1, 11, 2);
            ctx.beginPath();
            for (let mm = 0; mm <= m; mm += 0.5) ctx.lineTo(xOf(mm), yOf(mm));
            ctx.lineTo(xOf(m), yOf(m));
            ctx.strokeStyle = ACCENT;
            ctx.lineWidth = 5;
            ctx.stroke();
            ctx.restore();
            roundRect(ctx, GX0, GY0, GX1 - GX0, GH, 12);
            ctx.strokeStyle = rgba(TH.ink, 0.18);
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.fillStyle = ACCENT;
            ctx.fillRect(xOf(m) - 2, GY0 - 6, 4, GH + 12);
            for (const st of goalStops) {
              if (t < st.start) continue;
              football(ctx, xOf(st.m), yOf(st.m), 13);
            }
            // Cómo se llama: «TERRITORIO», en pequeño a la izquierda del reloj
            ctx.font = BARLOW(28);
            const label = up(d.t?.territory || 'Territorio'), lw = ctx.measureText(label).width + 24;
            ctx.fillStyle = '#ffffff';
            roundRect(ctx, GX0, GY0 - 50, lw, 38, 8);
            ctx.fill();
            text(ctx, label, GX0 + 12, GY0 - 21, BARLOW(28), '#111111');
          } else if (pu) {
            const GX0 = M, GX1 = W - M, GY = 1500, GA = 70;
            const xOf = (mm) => GX0 + ((GX1 - GX0) * mm) / total;
            const net = (mm) => pressure('home', mm) - pressure('away', mm);
            ctx.fillStyle = rgba(TH.ink, 0.15);
            ctx.fillRect(GX0, GY - 1, GX1 - GX0, 2);
            for (const [side, sign] of [['home', -1], ['away', 1]]) {
              ctx.save();
              ctx.beginPath();
              ctx.rect(GX0, sign < 0 ? GY - GA - 10 : GY, GX1 - GX0, GA + 10);
              ctx.clip();
              ctx.beginPath();
              ctx.moveTo(xOf(0), GY);
              for (let mm = 0; mm <= m; mm += 0.5) ctx.lineTo(xOf(mm), GY - GA * net(mm));
              ctx.lineTo(xOf(m), GY);
              ctx.closePath();
              ctx.fillStyle = rgba(col[side], 0.8);
              ctx.fill();
              ctx.restore();
            }
            for (const st of goalStops) {
              if (t < st.start) continue;
              football(ctx, xOf(st.m), GY + (st.ev.e.side === 'home' ? -GA - 26 : GA + 26), 14);
            }
            ctx.fillStyle = ACCENT;
            ctx.fillRect(xOf(m) - 2, GY - GA - 6, 4, 2 * GA + 12);
          }
          // Los onces: al empezar, cada uno en su sitio (del portero a los delanteros), con su cara y
          // su apellido; al acabar (con notas), el once que terminó el partido, cada uno con su nota
          // y el mejor con el aro verde lima. Cada ficha, del tamaño que le toca en el campo.
          if (d.lineups) {
            const ls = stops.find(st => st.lineup);
            const flip = Pj([10, 0, 0])[0] < Pj([-10, 0, 0])[0] ? 1 : -1;
            const xi = (alpha, rated) => {
              for (const side of ['home', 'away']) {
                const st = d[side].style, sg = side === 'home' ? 1 : -1;
                for (const p of d.lineups[side]) {
                  // (al acabar, el que terminó en ese sitio; si el mejor del partido fue cambiado, él)
                  const who = rated ? (p.id === d.lineups.best ? p : p.on || p) : p;
                  const k = alpha(p);
                  if (k <= 0.01) continue;
                  const wx = flip * sg * (0.5 - p.x) * PW, wz = sg * (-HL + p.y * HL);
                  const [sx, sy] = Pj([wx, 0, wz]), ppm = Math.abs(Pj([wx, 1, wz])[1] - sy);
                  const best = rated && who.id === d.lineups.best;
                  const r = Math.max(rated ? 48 : 40, Math.min(80, ppm * (rated ? 5 : 4.4))) * (best ? 1.25 : 1) * k;
                  playerChip(ctx, A, who, st, sx, sy - r * 0.9, r, {
                    name: !rated || best ? up(who.last || '') : '', best,
                    rating: rated && who.rating ? { text: who.rating, bg: who.rc, fg: who.rk } : null,
                  });
                }
              }
            };
            if (ls && t < ls.end + 0.4) xi(p => Math.min(easeBack(prog(t, ls.start + 0.1 + p.y * 0.7, 0.3)), 1 - easeInOut(prog(t, ls.end - 0.1, 0.4))), false);
            const travel = easeInOut(prog(t, dur - 0.8, 0.8));
            if (RATED && t > RUN_END + 0.3) xi(p => (p === bestSpot?.p ? 0 : Math.min(easeBack(prog(t, RUN_END + 0.4 + p.y * 0.5, 0.3)), 1 - travel)), true);
            if (bestSpot && t > RUN_END + 0.3) {
              const { side, p } = bestSpot, who = p.id === d.lineups.best ? p : p.on, sg = side === 'home' ? 1 : -1;
              const wx = flip * sg * (0.5 - p.x) * PW, wz = sg * (-HL + p.y * HL);
              const [sx, sy] = Pj([wx, 0, wz]), ppm = Math.abs(Pj([wx, 1, wz])[1] - sy);
              const r0 = Math.max(RATED ? 60 : 84, Math.min(120, ppm * (RATED ? 6.2 : 8))) * easeBack(prog(t, RUN_END + 0.45, 0.35));
              const r = lerp(r0, FACE_R + 12, travel);
              playerChip(ctx, A, who, d[side].style, lerp(sx, W - M - FACE_R, travel), lerp(sy - r0 * 0.9, 440, travel), r, {
                best: true, name: travel < 0.3 ? up(who.last || '') : '',
                rating: who.rating && travel < 0.6 ? { text: who.rating, bg: who.rc, fg: who.rk } : null,
              });
            }
          }
          // Los cambios: en su minuto, sin parar nada, entra desde la banda de su equipo una placa
          // con el que entra (su cara, ▲) y el que sale (▼); los de un mismo minuto, juntos
          const subSlots = { home: 0, away: 0 };
          for (const g of subGroups) {
            const t0 = timeOfMinute(g.t), q = prog(t, t0, 2.1);
            if (q <= 0 || q >= 1) continue;
            const home = g.side === 'home', st = d[g.side].style, k2 = Math.min(easeOut(q / 0.18), 1 - prog(q, 0.8, 0.2));
            const rowH = 92, bh = g.subs.length * rowH + 22, bw = 420;
            const y = 1330 - bh - subSlots[g.side]; subSlots[g.side] += bh + 14;
            const bx = home ? M : W - M - bw;
            ctx.save();
            ctx.globalAlpha = k2;
            ctx.translate((home ? -1 : 1) * (1 - k2) * 260, 0);
            plate(ctx, bx, y, bw, bh, 18);
            ctx.fillStyle = 'rgba(6,8,11,.9)';
            ctx.fill();
            g.subs.forEach((e, i) => {
              const ry = y + 11 + i * rowH, pin = d.people?.[e.pid] || { number: '', last: e.name }, pout = d.people?.[e.pid2];
              playerChip(ctx, A, pin, st, bx + 56, ry + rowH / 2, 38, { crest: home ? A.homeLogo : A.awayLogo });
              text(ctx, `▲ ${up(e.name)}`, bx + 108, ry + 42, ANTON(fit(ctx, `▲ ${up(e.name)}`, ANTON, 42, bw - 190)), '#5ad66f');
              if (e.out) text(ctx, `▼ ${up(e.out)}`, bx + 108, ry + 80, BARLOW(fit(ctx, `▼ ${up(e.out)}`, BARLOW, 32, bw - 190), 700), 'rgba(255,255,255,.62)');
              if (pout) playerChip(ctx, A, pout, st, bx + bw - 40, ry + rowH / 2 + 10, 24);
            });
            text(ctx, String(g.min || '').replace(/\s/g, ''), bx + bw - 40, y + 34, BARLOW(30, 800), ACCENT, 'center');
            ctx.restore();
          }
          // El descanso
          const ht = stops.find(st => st.ht);
          if (ht && t >= ht.start && t < ht.end + 0.4) {
            const e = Math.min(easeBack(prog(t, ht.start, 0.25)), 1 - prog(t, ht.end, 0.4));
            ctx.save();
            ctx.globalAlpha = Math.max(0, e);
            const str = `${d.t?.halftime || 'DESCANSO'} ${d.halftime[0]}-${d.halftime[1]}`;
            ctx.font = ANTON(84);
            const w = ctx.measureText(str).width + 80;
            plate(ctx, W / 2 - w / 2, 760, w, 130, 30);
            ctx.fillStyle = ACCENT;
            ctx.fill();
            text(ctx, str, W / 2, 855, ANTON(84), '#111111', 'center');
            ctx.restore();
          }
          // Cada gol: el reloj se para, se oscurece el campo y salen el minuto gigante y el
          // goleador cayendo letra a letra (si lleva más de uno, sus minutos apilados)
          for (const st of stops) {
            if (!st.ev || t < st.start || t > st.end + 0.35) continue;
            const lt = t - st.start, e = st.ev.e, out = prog(t, st.end, 0.35);
            const c = col[e.side];
            if (e.kind === 'goal' && GOAL && goalFx[GOAL]) {
              goalFx[GOAL](ctx, st, lt, out, e, Pj);
              continue;
            }
            const dark = 0.62 * Math.min(easeOut(prog(lt, 0.15, 0.25)), 1 - out);
            fillAll(ctx, `rgba(${TH.dim},${dark + (d.dark ? 0 : 0.2)})`);
            ctx.save();
            ctx.globalAlpha = 1 - out;
            if (e.kind === 'red') {
              const name = up(e.name);
              text(ctx, String(e.min || '').replace(/\s/g, ''), W / 2, 900, ANTON(300), TH.ink, 'center');
              ctx.fillStyle = '#e3172d';
              const rp = d.people?.[e.pid];
              roundRect(ctx, W / 2 - 60 - (rp ? 80 : 0), 960, 120, 170, 14);
              ctx.fill();
              if (rp) playerChip(ctx, A, rp, d[e.side].style, W / 2 + 80, 1045, 92, { crest: e.side === 'home' ? A.homeLogo : A.awayLogo });
              text(ctx, name, W / 2, 1290, ANTON(fit(ctx, name, ANTON, 150, W - 2 * M)), c, 'center');
            } else {
              const mins = st.ev.mins || [String(e.min || '').replace(/\s/g, '')];
              const n = mins.length;
              const msize = Math.min(...mins.map(x => fit(ctx, x, ANTON, n === 1 ? 560 : n === 2 ? 400 : 290, W - 2 * M)));
              const k = 1.4 - 0.4 * easeOut(prog(lt, 0.12, 0.18));
              mins.forEach((x, j) => {
                const last = j === n - 1;
                if (last && lt < 0.12) return;
                ctx.save();
                ctx.translate(W / 2, 1060 - (n - 1 - j) * msize * 0.9);
                ctx.rotate(-0.045);
                if (last) ctx.scale(k, k);
                ctx.globalAlpha *= last ? 1 : 0.5;
                ctx.shadowColor = d.dark ? 'rgba(0,0,0,.5)' : 'rgba(0,0,0,.15)';
                ctx.shadowBlur = 50;
                text(ctx, x, 0, 0, ANTON(msize), TH.ink, 'center');
                ctx.restore();
              });
              const name = up(e.name);
              const nsize = fit(ctx, name, ANTON, 190, W - 2 * M);
              ctx.font = ANTON(nsize);
              const chars = [...name], cw = chars.map(ch => ctx.measureText(ch).width);
              let x = W / 2 - cw.reduce((p, q) => p + q, 0) / 2;
              chars.forEach((ch, j) => {
                const q = prog(lt, 0.2 + j * 0.035, 0.34);
                if (q > 0) {
                  const seed = rnd(j + name.length * 7);
                  ctx.save();
                  ctx.translate(x + cw[j] / 2, 1270 - (1 - easeBounce(q)) * 900);
                  ctx.rotate((seed - 0.5) * (0.5 * (1 - q) + 0.12));
                  text(ctx, ch, 0, 0, ANTON(nsize), c, 'center');
                  ctx.restore();
                }
                x += cw[j];
              });
              if (e.how) {
                const e2 = easeOut(prog(lt, 0.45, 0.25));
                ctx.globalAlpha *= e2;
                text(ctx, e.how, W / 2, 1360, BARLOW(fit(ctx, e.how, BARLOW, 56, W - 2 * M), 700), TH.mute, 'center');
              }
              // El penalti, con su sello
              if (e.pen) {
                const k2 = easeBack(prog(lt, 0.05, 0.25));
                ctx.save();
                ctx.globalAlpha = 1 - out;
                ctx.translate(W / 2 + 230, 560);
                ctx.rotate(0.12);
                ctx.scale(k2, k2);
                const str = d.t?.penalty || 'PENALTI';
                ctx.font = ANTON(70);
                const pw = ctx.measureText(str).width + 60;
                plate(ctx, -pw / 2, -60, pw, 110, 22);
                ctx.fillStyle = '#e3172d';
                ctx.fill();
                text(ctx, str, 0, 22, ANTON(70), '#ffffff', 'center');
                ctx.restore();
              }
            }
            ctx.restore();
          }
          // Las amarillas: en su minuto, una tarjeta con el nombre en el lado de su equipo
          const shown = { home: 0, away: 0 };
          for (const e of yellows) {
            const t0 = timeOfMinute(e.t), q = prog(t, t0, 1.1);
            if (q <= 0 || q >= 1) continue;
            const home = e.side === 'home', k2 = Math.min(easeOut(q / 0.2), 1 - prog(q, 0.8, 0.2));
            const y = CARDS_Y + shown[e.side]++ * 116;
            const str = `${String(e.min || '').replace(/\s/g, '')} ${up(e.name)}`;
            ctx.save();
            ctx.globalAlpha = k2;
            ctx.translate((home ? -1 : 1) * (1 - k2) * 200, 0);
            const yp = d.people?.[e.pid], fw = yp ? 92 : 0;
            ctx.font = ANTON(64);
            const tw = Math.min(ctx.measureText(str).width, W / 2 - M - 90 - fw);
            const bw = tw + 104 + fw, bx = home ? M : W - M - bw;
            plate(ctx, bx, y, bw, 96, 18);
            ctx.fillStyle = 'rgba(6,8,11,.9)';
            ctx.fill();
            if (yp) playerChip(ctx, A, yp, d[e.side].style, bx + 52, y + 48, 40, { crest: home ? A.homeLogo : A.awayLogo });
            ctx.fillStyle = '#f5c400';
            roundRect(ctx, bx + 20 + fw, y + 16, 44, 64, 6);
            ctx.fill();
            text(ctx, str, bx + 82 + fw, y + 72, ANTON(fit(ctx, str, ANTON, 64, W / 2 - M - 90 - fw)), '#ffffff');
            ctx.restore();
          }
          // Los palos: un destello en el poste y quién tiró («31' AL PALO · VITINHA»), en blanco
          for (const st of stops) {
            if (!st.post || t < st.start || t > st.end + 0.4) continue;
            const lt = t - st.start, out = prog(t, st.end, 0.4);
            if (world && lt < 0.25) {
              const [px, py] = Pj(postBall(st, st.start)), r = 60 + 260 * easeOut(lt / 0.25);
              const g = ctx.createRadialGradient(px, py, 0, px, py, r);
              g.addColorStop(0, `rgba(255,255,255,${0.9 * (1 - lt / 0.25)})`);
              g.addColorStop(1, 'rgba(255,255,255,0)');
              ctx.fillStyle = g;
              ctx.fillRect(px - r, py - r, 2 * r, 2 * r);
            }
            const k = easeBack(prog(lt, 0.05, 0.25));
            if (k <= 0) continue;
            const str = [`${String(st.post.min || '').replace(/\s/g, '')} ${d.t?.post || 'AL PALO'}`, up(st.post.name || '')].filter(x => x.trim()).join(' · ');
            ctx.save();
            ctx.globalAlpha = 1 - out;
            ctx.translate(W / 2, 560);
            ctx.rotate(-0.03);
            ctx.scale(k, k);
            const size = fit(ctx, str, ANTON, 86, W - 2 * M - 40);
            ctx.font = ANTON(size);
            const pw = ctx.measureText(str).width + 60;
            plate(ctx, -pw / 2, -size * 0.95, pw, size * 1.35, 20);
            ctx.fillStyle = '#ffffff';
            ctx.fill();
            text(ctx, str, 0, size * 0.12, ANTON(size), '#111111', 'center');
            ctx.restore();
          }
          // La polémica del VAR: el reloj se para y sale qué pasó
          for (const st of stops) {
            if (!st.pol || t < st.start || t > st.end + 0.35) continue;
            const lt = t - st.start, out = prog(t, st.end, 0.35);
            fillAll(ctx, `rgba(${TH.dim},${(d.dark ? 0.7 : 0.85) * Math.min(easeOut(prog(lt, 0, 0.2)), 1 - out)})`);
            ctx.save();
            ctx.globalAlpha = 1 - out;
            const k2 = easeBack(prog(lt, 0.05, 0.3));
            ctx.save();
            ctx.translate(W / 2, 760);
            ctx.scale(k2, k2);
            plate(ctx, -330, -150, 660, 260, 40);
            ctx.fillStyle = '#06080b';
            ctx.fill();
            ledText(ctx, 'VAR', 0, -100, 30, ACCENT, 'center');
            ctx.restore();
            text(ctx, String(st.pol.min || '').replace(/\s/g, ''), W / 2, 1060, ANTON(150), TH.ink, 'center');
            const ls = wrap(ctx, up(st.pol.title), ANTON(96), W - 2 * M).slice(0, 2);
            ls.forEach((l, i) => {
              const e2 = easeOut(prog(lt, 0.3 + i * 0.12, 0.3));
              ctx.globalAlpha = (1 - out) * e2;
              text(ctx, l, W / 2, 1200 + i * 100, ANTON(96), col[st.pol.side] || TH.ink, 'center');
            });
            ctx.globalAlpha = (1 - out) * easeOut(prog(lt, 0.6, 0.3));
            text(ctx, `${d.t?.atTheTime || 'ASÍ IBA'} ${st.pol.scoreLine}`, W / 2, 1220 + ls.length * 100, BARLOW(48), TH.mute, 'center');
            ctx.restore();
          }
        },
      };
    };
    const base = 0.3 + RUN + holdsTotal + END;
    return build(Math.ceil(base / BAR - 1e-6) * BAR);
  }

  // LA POSESIÓN Y EL RESTO (después del jugador del partido): la pantalla se llena con el color de
  // cada uno, en proporción a la posesión; luego la frontera se va al centro y, debajo, el resto de
  // estadísticas (tiros, a puerta, pases, córners, faltas…), una fila por golpe
  function scenePosesion(d, A) {
    const pos = d.stats.find(r => r.pct);
    const rows = [...(d.stats || []), ...(d.statsMore || [])].filter(r => !r.pct).slice(0, 6);
    const F0 = 0.1, dur = 2 * BAR;
    return {
      id: 'stats',
      dur,
      accent: ACCENT,
      overlay: (ctx, t) => drawBug(ctx, d, A, finalBug(d)()),
      music: { energy: 'full' },
      cues: [{ t: snap(F0), kind: 'impact', vel: 0.9 }, { t: snap(F0), kind: 'slam' }, ...rows.map((r, i) => ({ t: snap(F0 + 0.7 + i * 0.3), kind: 'hit', vel: 0.6 }))],
      draw(ctx, t) {
        groundBg(ctx, d);
        const f = easeInOut(prog(t, F0, 0.45));
        if (f > 0) {
          // Primero, en proporción a la posesión; luego la frontera se va al centro para el resto
          const share = pos.v[0] / Math.max(1, pos.v[0] + pos.v[1]);
          const split = W * share + (W / 2 - W * share) * easeInOut(prog(t, F0 + 0.55, 0.35));
          const [hx, hy, hw, hh] = bleed(ctx, 0, 0, split, H), [ax, ay, aw, ah] = bleed(ctx, split, 0, W - split, H);
          ctx.fillStyle = d.home.style.bg;
          ctx.fillRect(hx, hy + hh * (1 - f), hw, hh * f);
          ctx.fillStyle = d.away.style.bg;
          ctx.fillRect(ax, ay + ah * (1 - f), aw, ah * f);
          const e2 = easeOut(prog(t, F0 + 0.25, 0.35));
          ctx.save();
          ctx.globalAlpha = e2;
          // La posesión, arriba y en grande
          const pill = (label, y, size) => {
            ctx.font = BARLOW(size);
            const lw = ctx.measureText(label).width + 36;
            ctx.fillStyle = '#ffffff';
            roundRect(ctx, split - lw / 2, y - size * 0.95, lw, size * 1.35, 10);
            ctx.fill();
            text(ctx, label, split, y, BARLOW(size), '#111111', 'center');
          };
          const pair = (va, vb, y, size, worse = [false, false]) => {
            const [sa, sb] = [String(va), String(vb)];
            ctx.globalAlpha = e2 * (worse[0] ? 0.7 : 1);
            text(ctx, sa, split / 2, y, ANTON(fit(ctx, sa, ANTON, size, split - 60)), d.home.style.fg, 'center');
            ctx.globalAlpha = e2 * (worse[1] ? 0.7 : 1);
            text(ctx, sb, split + (W - split) / 2, y, ANTON(fit(ctx, sb, ANTON, size, W - split - 60)), d.away.style.fg, 'center');
            ctx.globalAlpha = e2;
          };
          pair(`${Math.round(pos.v[0])}%`, `${Math.round(pos.v[1])}%`, 600, 230);
          pill(up(pos.label), 650, 40);
          // Y debajo, el resto, una fila por golpe
          rows.forEach((r, i) => {
            const a2 = easeOut(prog(t, F0 + 0.7 + i * 0.3, 0.3));
            if (a2 <= 0) return;
            const y = 880 + i * 128;
            ctx.save();
            ctx.globalAlpha = a2;
            ctx.translate(0, (1 - a2) * 30);
            const worse = r.v[0] === r.v[1] ? [false, false] : r.more ? [r.v[0] < r.v[1], r.v[1] < r.v[0]] : [r.v[0] > r.v[1], r.v[1] > r.v[0]];
            pair(r.v[0], r.v[1], y, 118, worse);
            ctx.globalAlpha = a2;
            pill(up(r.label), y - 36, 40);
            ctx.restore();
          });
          ctx.restore();
        }
      },
    };
  }

  // 2 · Los goles, uno a uno y al golpe: el minuto a pantalla completa, del color del que marca,
  // el goleador debajo y su apellido repetido detrás; arriba, el marcador va cambiando. También
  // las rojas y los penaltis fallados. Cada uno dura lo mismo: dos pulsos o lo que pida la voz.
  function sceneGoals(d, A) {
    const evs = d.goals.filter(e => e.kind === 'goal' || e.kind === 'red' || e.kind === 'pen');
    let h = 0, a = 0;
    const steps = evs.map(e => {
      if (e.kind === 'goal') { if (e.side === 'home') h++; else a++; }
      return { e, score: e.score ? `${e.score[0]}-${e.score[1]}` : `${h}-${a}` };
    });
    const tag = { red: d.t?.red || 'ROJA', pen: d.t?.penMissed || 'PENALTI FALLADO' };
    // Quien marca más de uno: en su último gol salen todos sus minutos, apilados («37' 63'»)
    steps.forEach((s, i) => {
      if (s.e.kind !== 'goal' || s.e.own) return;
      const his = steps.filter(x => x.e.kind === 'goal' && !x.e.own && x.e.name === s.e.name && x.e.side === s.e.side);
      if (his.length > 1 && his[his.length - 1] === s) s.mins = his.map(x => String(x.e.min || '').replace(/\s/g, ''));
    });
    const rnd = (k) => { const v = Math.sin(k * 12.9898 + 78.233) * 43758.5453; return v - Math.floor(v); };
    const beatOf = (ctx, s, lt) => {
      const e = s.e, st = e.style;
      teamBg(ctx, st, 0, 0, W, H, 0.5, 0.55);
      // El apellido repetido detrás, en filas que corren en sentidos contrarios
      const name = up(e.name);
      ctx.save();
      ctx.font = ANTON(300);
      ctx.lineWidth = 3;
      ctx.strokeStyle = rgba(st.fg, 0.14);
      ctx.textAlign = 'left';
      const unit = `${name}   `, uw = ctx.measureText(unit).width, row = unit.repeat(Math.ceil(2600 / uw) + 1);
      for (let i = 0; i < 7; i++) {
        const dir = i % 2 ? 1 : -1, off = (((lt * 360 * dir) + i * 170) % uw + uw) % uw;
        ctx.strokeText(row, -700 - uw + off, 260 + i * 290);
      }
      ctx.restore();
      // El marcador, arriba, con los escudos
      const sp = easeOut(prog(lt, 0.05, 0.2));
      ctx.save();
      ctx.globalAlpha = sp;
      logo(ctx, A.homeLogo, W / 2 - 250, 300, 120);
      logo(ctx, A.awayLogo, W / 2 + 250, 300, 120);
      text(ctx, s.score, W / 2, 350, ANTON(150), st.fg, 'center');
      ctx.restore();
      // El minuto, de golpe; si es su segundo o tercer gol, todos sus minutos apilados (el de
      // ahora es el que golpea)
      const mins = s.mins || [String(e.min || '').replace(/\s/g, '')];
      const n = mins.length;
      const msize = Math.min(...mins.map(x => fit(ctx, x, ANTON, n === 1 ? 660 : n === 2 ? 430 : 300, W - 2 * M)));
      const k = 1.4 - 0.4 * easeOut(prog(lt, 0, 0.18));
      mins.forEach((x, j) => {
        const last = j === n - 1;
        const y = 1170 - (n - 1 - j) * msize * 0.9;
        ctx.save();
        ctx.translate(W / 2, y);
        ctx.rotate(-0.045);
        if (last) ctx.scale(k, k);
        ctx.globalAlpha = last ? 1 : 0.55;
        ctx.shadowColor = 'rgba(0,0,0,.35)';
        ctx.shadowBlur = 50;
        text(ctx, x, 0, 0, ANTON(msize), st.fg, 'center');
        ctx.restore();
      });
      // El goleador: cae letra a letra, rebota y se queda amontonado (cada letra un poco girada)
      const nsize = fit(ctx, name, ANTON, 210, W - 2 * M);
      ctx.font = ANTON(nsize);
      const chars = [...name], cw = chars.map(c => ctx.measureText(c).width);
      let x = W / 2 - cw.reduce((a2, b2) => a2 + b2, 0) / 2;
      chars.forEach((c, j) => {
        const q = prog(lt, 0.05 + j * 0.035, 0.34);
        if (q > 0) {
          const seed = rnd(j + name.length * 7);
          ctx.save();
          ctx.translate(x + cw[j] / 2, 1390 - (1 - easeBounce(q)) * 900);
          ctx.rotate((seed - 0.5) * (0.5 * (1 - q) + 0.12));
          text(ctx, c, 0, 0, ANTON(nsize), st.hl, 'center');
          ctx.restore();
        }
        x += cw[j];
      });
      // La roja o el penalti fallado; en los goles, cómo fue
      const en = easeOut(prog(lt, 0.3, 0.25));
      ctx.save();
      ctx.globalAlpha = en;
      if (e.kind !== 'goal') chip(ctx, e.how || tag[e.kind], W / 2, 1430, e.kind === 'red' ? { acc: '#e3172d', on: '#ffffff' } : st, 46, 'center');
      else if (e.how) text(ctx, e.how, W / 2, 1485, BARLOW(fit(ctx, e.how, BARLOW, 58, W - 2 * M), 700), rgba(st.fg, 0.85), 'center');
      ctx.restore();
      if (lt < 0.09) fillAll(ctx, `rgba(255,255,255,${0.5 * (1 - lt / 0.09)})`);
    };
    const build = (dur) => {
      const slot = dur / steps.length;
      return {
        id: 'goals',
        dur,
        stretch: build,
        enter: { kind: 'split', colors: [d.home.style.bg, d.away.style.bg] },
        accent: (d.home.won ? d.home : d.away.won ? d.away : d.home).style.acc,
        music: { energy: 'full' },
        cues: steps.flatMap((s, i) => [{ t: snap(i * slot), kind: 'impact', vel: s.e.kind === 'goal' ? 1 : 0.7 }, { t: snap(i * slot), kind: 'slam' }]),
        draw(ctx, t) {
          const i = Math.min(steps.length - 1, Math.max(0, Math.floor(t / slot)));
          beatOf(ctx, steps[i], t - i * slot);
        },
      };
    };
    return build(Math.max(1, Math.ceil((steps.length * 2 * BEAT) / BAR - 1e-6)) * BAR);
  }

  // Un color de cada equipo que se vea sobre un fondo, y que no se confunda con el del otro.
  function marksOn(d, bg) {
    const opts = (st) => [st.bg, st.acc, st.fg, '#ffffff'].filter(Boolean).map(c => ({ c, k: contrastWith(c, bg) })).sort((a, b) => b.k - a.k);
    const home = opts(d.home.style)[0].c;
    const away = opts(d.away.style).find(o => o.k >= 2.2 && contrastWith(o.c, home) >= 1.6)?.c || opts(d.away.style)[0].c;
    return { home, away };
  }

  // 3 · El pulso del partido: una línea baja por la pantalla, minuto a minuto, y se va hacia el
  // lado del equipo que apretaba (sus tiros, córners y faltas en campo rival, de la narración de
  // ESPN), como el «Attacking Threat» del City. Cada gol, un balón en el lado del que marca. Arriba,
  // el reloj y el marcador en LED. Al final, la posesión llena la pantalla con los colores de los
  // dos equipos.
  function scenePulso(d, A) {
    const pu = d.pulse, total = pu.total;
    const NIGHT_BG = '#0a0e16';
    const col = marksOn(d, NIGHT_BG);
    const T0 = 600, T1 = 1440, CX = W / 2, AMP = 380;
    const yOf = (m) => T0 + (T1 - T0) * Math.min(m, total) / total;
    const at = (arr, m) => {
      const i = Math.max(0, Math.min(arr.length - 2, Math.floor(m))), f = m - i;
      return (arr[i] * (1 - f) + arr[i + 1] * f) / pu.max;
    };
    // > 0: aprieta el local (a la izquierda); la mayor diferencia del partido llega al borde
    const diff = (m) => at(pu.home, m) - at(pu.away, m);
    let top = 0.2;
    for (let m = 0; m <= total; m++) top = Math.max(top, Math.abs(diff(m)));
    const net = (m) => diff(m) / top;
    const goals = d.goals.filter(e => e.kind === 'goal');
    const pos = d.stats?.find(r => r.pct);
    const build = (dur) => {
      const RUN0 = 0.3, RUN1 = dur - (pos ? 1.9 : 0.8);
      const minuteAt = (t) => total * easeInOut(prog(t, RUN0, RUN1 - RUN0));
      const timeOf = (m) => {
        let lo = RUN0, hi = RUN1;
        for (let k = 0; k < 30; k++) { const mid = (lo + hi) / 2; if (minuteAt(mid) < m) lo = mid; else hi = mid; }
        return hi;
      };
      const FILL = RUN1 + 0.3;
      return {
        id: 'pulso',
        dur,
        stretch: build,
        enter: { kind: 'blinds' },
        accent: ACCENT,
        music: { energy: 'light' },
        cues: [
          ...ticks(RUN0, RUN1, 0.35),
          ...goals.map(g => ({ t: snap(timeOf(g.t)), kind: 'hit', vel: 1 })),
          ...goals.map(g => ({ t: snap(timeOf(g.t)), kind: 'slam' })),
          ...(pos ? [{ t: snap(FILL), kind: 'impact', vel: 0.9 }, { t: snap(FILL), kind: 'slam' }] : []),
        ],
        draw(ctx, t) {
          const pm = minuteAt(t);
          fillAll(ctx, NIGHT_BG);
          // La rejilla: una línea cada 5 minutos y su número cada 15
          ctx.font = BARLOW(34, 700);
          ctx.textAlign = 'right';
          for (let m = 0; m <= total; m += 5) {
            ctx.fillStyle = m % 15 ? 'rgba(255,255,255,.05)' : 'rgba(255,255,255,.12)';
            ctx.fillRect(M, yOf(m), W - 2 * M - 60, 2);
            if (!(m % 15)) { ctx.fillStyle = 'rgba(255,255,255,.4)'; ctx.fillText(`${m}'`, W - M, yOf(m) + 12); }
          }
          // La línea: rellena hacia el lado de quien aprieta, con su color
          const pts = [];
          for (let m = 0; m <= pm; m += 0.25) pts.push([CX - AMP * net(m), yOf(m)]);
          pts.push([CX - AMP * net(pm), yOf(pm)]);
          const shape = () => {
            ctx.beginPath();
            ctx.moveTo(CX, yOf(0));
            pts.forEach(([x, y]) => ctx.lineTo(x, y));
            ctx.lineTo(CX, yOf(pm));
            ctx.closePath();
          };
          for (const [side, x0, w] of [['home', 0, CX], ['away', CX, W - CX]]) {
            ctx.save();
            ctx.beginPath(); ctx.rect(...bleed(ctx, x0, 0, w, H)); ctx.clip();
            shape();
            const g = ctx.createLinearGradient(CX, 0, side === 'home' ? CX - AMP : CX + AMP, 0);
            g.addColorStop(0, rgba(col[side], 0.15));
            g.addColorStop(1, rgba(col[side], 0.85));
            ctx.fillStyle = g;
            ctx.fill();
            ctx.restore();
          }
          ctx.strokeStyle = 'rgba(255,255,255,.35)';
          ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(CX, yOf(0)); ctx.lineTo(CX, yOf(pm)); ctx.stroke();
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 5;
          ctx.lineJoin = 'round';
          ctx.beginPath();
          pts.forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
          ctx.stroke();
          // El descanso
          if (d.halftime && pm > 45) {
            ctx.save();
            ctx.setLineDash([12, 12]);
            ctx.strokeStyle = rgba(ACCENT, 0.7);
            ctx.lineWidth = 3;
            ctx.beginPath(); ctx.moveTo(M, yOf(45)); ctx.lineTo(W - M - 60, yOf(45)); ctx.stroke();
            ctx.restore();
            chip(ctx, `${d.t?.halftime || 'DESCANSO'} ${d.halftime[0]}-${d.halftime[1]}`, CX, yOf(45) - 30, { acc: ACCENT, on: '#111111' }, 38, 'center');
          }
          // Los goles: un balón en el lado del que marca, con su minuto y su nombre
          let score = [0, 0], punch = 0;
          const lastOf = { home: -99, away: -99 };
          goals.forEach(g => {
            const below = g.t - lastOf[g.side] < 10;
            lastOf[g.side] = g.t;
            if (pm < g.t) return;
            score = g.score || [score[0] + (g.side === 'home' ? 1 : 0), score[1] + (g.side === 'away' ? 1 : 0)];
            const q = clamp01((pm - g.t) / (total * 0.04)), home = g.side === 'home', y = yOf(g.t);
            punch = Math.max(punch, 1 - clamp01((pm - g.t) / (total * 0.025)));
            const bx = home ? M + 34 : W - M - 94;
            ctx.save();
            ctx.globalAlpha = easeOut(q);
            ctx.strokeStyle = rgba(col[g.side], 0.6);
            ctx.lineWidth = 3;
            ctx.beginPath(); ctx.moveTo(CX - AMP * net(g.t), y); ctx.lineTo(bx, y); ctx.stroke();
            football(ctx, bx, y, 26 * (0.6 + 0.4 * easeBack(q)), 1, q * 3);
            const str = `${String(g.min).replace(/\s/g, '')} ${up(g.name)}`;
            const size = fit(ctx, str, ANTON, 54, W / 2 - M - 110), ly = below ? y + 76 : y - 30;
            ctx.font = ANTON(size);
            const tw = ctx.measureText(str).width;
            const lx = home ? bx + 40 : bx - 40;
            ctx.fillStyle = 'rgba(10,14,22,.85)';
            roundRect(ctx, home ? lx - 10 : lx - tw - 10, ly - size * 0.95, tw + 20, size * 1.2, 8);
            ctx.fill();
            text(ctx, str, lx, ly, ANTON(size), col[g.side], home ? 'left' : 'right');
            ctx.restore();
            if (q < 1) {
              ctx.strokeStyle = rgba(ACCENT, 1 - q);
              ctx.lineWidth = 5;
              ctx.beginPath(); ctx.arc(bx, y, 26 + 120 * q, 0, Math.PI * 2); ctx.stroke();
            }
          });
          // Arriba: el reloj y el marcador, en LED
          const done = t >= RUN1;
          ledText(ctx, done ? (d.t?.fullTime || 'FINAL') : `${Math.floor(pm)}'`, M, 250, 16, ACCENT);
          ctx.save();
          ctx.translate(W - M, 250 + 56);
          const s2 = 1 + 0.2 * easeOut(punch);
          ctx.scale(s2, s2);
          ledText(ctx, `${score[0]}-${score[1]}`, 0, -56, 16, '#ffffff', 'right');
          ctx.restore();
          logo(ctx, A.homeLogo, M + 30, 450, 60);
          text(ctx, `◀ ${up(d.home.short)}`, M + 72, 466, BARLOW(fit(ctx, `◀ ${up(d.home.short)}`, BARLOW, 42, W / 2 - M - 90)), col.home);
          logo(ctx, A.awayLogo, W - M - 30, 450, 60);
          text(ctx, `${up(d.away.short)} ▶`, W - M - 72, 466, BARLOW(fit(ctx, `${up(d.away.short)} ▶`, BARLOW, 42, W / 2 - M - 90)), col.away, 'right');
          if (!done) {
            ctx.fillStyle = ACCENT;
            ctx.fillRect(M, yOf(pm) - 3, W - 2 * M - 60, 6);
          }
          // Al final, la posesión: la pantalla se llena con el color de cada uno, en proporción
          if (pos) {
            const f = easeInOut(prog(t, FILL, 0.45));
            if (f > 0) {
              const share = pos.v[0] / Math.max(1, pos.v[0] + pos.v[1]);
              const split = W * share;
              const [hx, hy, hw, hh] = bleed(ctx, 0, 0, split, H), [ax, ay, aw, ah] = bleed(ctx, split, 0, W - split, H);
              ctx.fillStyle = d.home.style.bg;
              ctx.fillRect(hx, hy + hh * (1 - f), hw, hh * f);
              ctx.fillStyle = d.away.style.bg;
              ctx.fillRect(ax, ay + ah * (1 - f), aw, ah * f);
              const e2 = easeOut(prog(t, FILL + 0.25, 0.35));
              ctx.save();
              ctx.globalAlpha = e2;
              text(ctx, up(pos.label), W / 2, 420, ANTON(90), split > W / 2 ? d.home.style.fg : d.away.style.fg, 'center');
              const big = (v, x, w, st) => {
                const str = `${Math.round(v)}%`;
                text(ctx, str, x + w / 2, 1150, ANTON(fit(ctx, str, ANTON, 300, w - 40)), st.fg, 'center');
              };
              big(pos.v[0], 0, split, d.home.style);
              big(pos.v[1], split, W - split, d.away.style);
              logo(ctx, A.homeLogo, split / 2, 1320, 130);
              logo(ctx, A.awayLogo, split + (W - split) / 2, 1320, 130);
              ctx.restore();
            }
          }
        },
      };
    };
    return build(pos ? 4 * BAR : 3 * BAR);
  }

  // 6 · Jugador del partido: su apellido enorme y sus tres números gigantes apilados, cada uno
  // con su etiqueta (como el «Player of the game»); la nota, si la hay, la primera y en el acento.
  // Su cara en pequeño (o su foto detrás, si ESPN la tiene).
  const FACE_R = 150;
  function sceneJugador(d, A) {
    const m = d.jugador, st = m.style;
    // Sobre el fondo negro: el blanco y el color de su equipo que se lea
    const fg = theme(d).ink, hl = marksDark(d)[m.side] || ACCENT;
    const nums = m.stats.slice(0, 3);
    const statAt = (i) => (i + 1) * 2 * BEAT;
    const counts = (v) => /^\d+(\/\d+|%)?$/.test(String(v));
    return {
      id: 'jugador',
      dur: 3 * BAR,
      // (desde su cara: el mejor del partido vuela hasta ahí al acabar el partido)
      enter: { kind: 'circles', at: [SAFE.x + SAFE.s * (W - M - FACE_R), SAFE.y + SAFE.s * 440], colors: [st.bg, theme(d).ground] },
      overlay: (ctx, t) => drawBug(ctx, d, A, finalBug(d)()),
      accent: st.acc,
      music: { energy: 'full' },
      cues: [
        ...nums.flatMap((s, i) => [{ t: statAt(i), kind: 'hit' }, { t: statAt(i), kind: 'slam' }, ...(counts(s.v) ? ticks(statAt(i) + STEP, statAt(i) + 0.7, 0.6) : [])]),
      ],
      draw(ctx, t) {
        groundBg(ctx, d);
        if (A.jugadorPhoto) {
          const e0 = easeOut(prog(t, 0.05, 0.75));
          const pw = 1400 * (1 + 0.035 * prog(t, 0, 3 * BAR));
          imgBottom(ctx, A.jugadorPhoto, W - pw + 420, H + 40 + (1 - e0) * 400, pw, 0.55 * e0);
          fadeBottom(ctx, theme(d).ground, 520);
        } else {
          logo(ctx, A.jugadorLogo, W - 230, 1050, 820 * (1 + 0.05 * prog(t, 0, 3 * BAR)), 0.1);
        }
        // La cara, en su círculo, arriba a la derecha
        // (si no carga la de la slide, la de los onces: es el mejor del partido)
        const face = !A.jugadorPhoto && (A.jugadorFace || A.faces?.[d.lineups?.best]);
        if (face) {
          const e = easeBack(prog(t, 0.1, 0.4));
          const cx = W - M - FACE_R, cy = 440;
          ctx.save();
          ctx.translate(cx, cy);
          ctx.scale(e, e);
          ctx.beginPath(); ctx.arc(0, 0, FACE_R + 12, 0, Math.PI * 2); ctx.fillStyle = st.acc; ctx.fill();
          ctx.save();
          ctx.beginPath(); ctx.arc(0, 0, FACE_R, 0, Math.PI * 2); ctx.clip();
          ctx.fillStyle = '#e6e3dc'; ctx.fillRect(-FACE_R, -FACE_R, 2 * FACE_R, 2 * FACE_R);
          ctx.drawImage(face, -FACE_R, -FACE_R, 2 * FACE_R, 2 * FACE_R);
          ctx.restore();
          if (A.jugadorLogo) {
            ctx.beginPath(); ctx.arc(FACE_R * 0.72, FACE_R * 0.72, 54, 0, Math.PI * 2);
            ctx.fillStyle = '#ffffff'; ctx.fill();
            logo(ctx, A.jugadorLogo, FACE_R * 0.72, FACE_R * 0.72, 70);
          }
          ctx.restore();
        }
        // El nombre
        const k = easeOut(prog(t, 0.1, 0.35));
        ctx.save();
        ctx.globalAlpha = k;
        ctx.translate((1 - k) * -80, 0);
        const room = W - 2 * M - (face ? 2 * FACE_R + 40 : 0);
        const kw = d.t?.player || 'JUGADOR', kr = d.t?.ofMatch || ' DEL PARTIDO';
        ctx.font = BARLOW(46);
        text(ctx, up(kw), M, 340, BARLOW(46), hl);
        text(ctx, up(kr), M + ctx.measureText(up(kw)).width, 340, BARLOW(46), fg);
        if (m.first) text(ctx, up(m.first), M, 420, BARLOW(fit(ctx, up(m.first), BARLOW, 56, room)), fg);
        text(ctx, up(m.last), M, 610, ANTON(fit(ctx, up(m.last), ANTON, 190, room)), fg);
        ctx.restore();
        // Sus números, gigantes y apilados
        nums.forEach((s, i) => {
          const start = statAt(i);
          const a = easeOut(prog(t, start, 0.3));
          if (a <= 0) return;
          // Con dos números, más grandes (que llenen la pantalla como tres)
          const big = nums.length <= 2 ? 420 : 300;
          const y = 980 + i * big * 1.0;
          const v = countText(s.v, easeOut(prog(t, start, 0.7)));
          const size = fit(ctx, String(s.v), ANTON, big, W - 2 * M - 280);
          ctx.save();
          ctx.globalAlpha = a;
          ctx.translate((1 - a) * -60, 0);
          const pop = 1 + 0.12 * (1 - easeOut(prog(t, start, 0.25)));
          ctx.translate(M, y);
          ctx.scale(pop, pop);
          ctx.shadowColor = 'rgba(0,0,0,.25)';
          ctx.shadowBlur = 30;
          text(ctx, v, 0, 0, ANTON(size), s.rating ? hl : fg);
          ctx.shadowColor = 'transparent';
          ctx.font = ANTON(size);
          const nw = ctx.measureText(String(s.v)).width;
          const lines = wrap(ctx, up(s.label), BARLOW(50), W - 2 * M - nw - 40).slice(0, 2);
          lines.forEach((l, j) => text(ctx, l, nw + 30, -size * 0.55 + (j + 1) * 54 - (lines.length - 1) * 27, BARLOW(50), s.rating || i === 0 ? hl : fg));
          ctx.restore();
        });
      },
    };
  }

  // 5 · Estadísticas: cada equipo en su mitad y una fila por pulso, con los números subiendo;
  // el peor, apagado. En la versión larga, una segunda con las que no caben (stats2).
  function sceneStats(d, A, rows = d.stats.slice(0, 5), id = 'stats') {
    const rowAt = (i) => (i + 1) * BEAT;
    const TOP = 560, ROW = 200;
    return {
      id,
      dur: rows.length <= 3 ? 2 * BAR : 3 * BAR,
      accent: (d.home.won ? d.home : d.away).style.acc,
      music: { energy: 'full' },
      cues: rows.map((r, i) => ({ t: rowAt(i), kind: 'hit', vel: 0.8 })),
      draw(ctx, t) {
        const halves = [[d.home, A.homeLogo, 0], [d.away, A.awayLogo, W / 2]];
        for (const [team, img, x] of halves) {
          const st = team.style;
          ctx.save();
          ctx.beginPath();
          ctx.rect(...bleed(ctx, x, 0, W / 2, H));
          ctx.clip();
          teamBg(ctx, st, x, 0, W / 2, H, 0.5, 0.25);
          logo(ctx, img, x + W / 4, 250, 150);
          text(ctx, up(team.short), x + W / 4, 400, ANTON(fit(ctx, up(team.short), ANTON, 64, W / 2 - 60)), st.fg, 'center');
          ctx.restore();
        }
        rows.forEach((r, i) => {
          const start = rowAt(i);
          const a = easeOut(prog(t, start, 0.35));
          if (a <= 0) return;
          const y = TOP + i * ROW;
          const c = easeOut(prog(t, start, 0.6));
          [0, 1].forEach(j => {
            const st = (j ? d.away : d.home).style;
            const worse = r.v[0] === r.v[1] ? false : r.more ? r.v[j] < r.v[1 - j] : r.v[j] > r.v[1 - j];
            ctx.save();
            // El peor, más pequeño y algo apagado (apagado del todo no se leía sobre colores vivos)
            ctx.globalAlpha = a * (worse ? 0.78 : 1);
            const val = r.pct ? `${countText(Math.round(r.v[j]), c)}%` : countText(r.v[j], c);
            text(ctx, val, j ? W - 200 : 200, y + 70, ANTON(worse ? 100 : 140), st.fg, 'center');
            ctx.restore();
          });
          ctx.save();
          ctx.globalAlpha = a;
          ctx.font = BARLOW(36);
          const lw = ctx.measureText(up(r.label)).width + 32;
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(W / 2 - lw / 2, y - 4, lw, 56);
          text(ctx, up(r.label), W / 2, y + 37, BARLOW(36), '#111111', 'center');
          ctx.restore();
        });
      },
    };
  }

  // 8 · Clasificación: arriba, el puesto del equipo en un marcador LED; debajo, las filas una a
  // una, cada una con una barra de sus puntos en el color de su equipo, los dos del partido
  // marcados y, a la izquierda, los corchetes de las zonas (Champions, descenso…).
  function sceneTable(d, A) {
    const rows = d.table.rows.slice(0, 11);
    const rowAt = (i) => BEAT + i * STEP;
    const TOP = 630, ROW = 78;
    const side = d.home.won ? 'home' : d.away.won ? 'away' : rows.some(r => r?.me === 'home') ? 'home' : 'away';
    const me = rows.find(r => r?.me === side);
    const maxPts = Math.max(1, ...rows.filter(Boolean).map(r => r.pts || 0));
    // Las zonas: filas seguidas con la misma
    const zones = [];
    rows.forEach((r, i) => {
      const z = r?.zone && r.zoneName ? r : null;
      const last = zones[zones.length - 1];
      if (z && last && last.zone === z.zone && last.to === i - 1) last.to = i;
      else if (z) zones.push({ zone: z.zone, name: z.zoneName, from: i, to: i });
    });
    return {
      id: 'tabla',
      dur: 2 * BAR,
      accent: (d.home.won ? d.home : d.away).style.acc,
      overlay: d.kind === 'previa' ? null : (ctx, t) => drawBug(ctx, d, A, finalBug(d)()),
      music: { energy: 'full' },
      cues: [{ t: 0.1, kind: 'hit', vel: 0.8 }, { t: BEAT, kind: 'whoosh', dur: 0.5, vel: 0.5 }, ...rows.map((r, i) => (r?.me ? { t: rowAt(i), kind: 'hit', vel: 0.9 } : null)).filter(Boolean)],
      draw(ctx, t) {
        const P = sheet(d);
        groundBg(ctx, d);
        const k = easeOut(prog(t, 0.05, 0.35));
        ctx.save();
        ctx.globalAlpha = k;
        text(ctx, up(d.table.title), M, 310, BARLOW(fit(ctx, up(d.table.title), BARLOW, 48, W - 2 * M)), P.mute);
        if (me) {
          const st = d[side].style;
          const ink = marksDark(d)[side];
          const lw = ledText(ctx, `${me.rank}º`, M, 340, 30, ink, 'left', prog(t, 0.05, 0.35));
          logo(ctx, A.tableLogos[rows.indexOf(me)], M + lw + 90, 410, 100);
          const name = up(d[side].short);
          text(ctx, name, M + lw + 160, 440, ANTON(fit(ctx, name, ANTON, 84, W - 2 * M - lw - 170)), P.ink);
          if (me.pts != null) text(ctx, `${me.pts} ${d.t?.pts || 'PUNTOS'}`, M + lw + 160, 510, BARLOW(46), P.mute);
        } else {
          text(ctx, 'PTS', W - M - 20, TOP - 30, BARLOW(34), P.mute, 'center');
        }
        ctx.restore();
        // Los corchetes de las zonas
        for (const z of zones) {
          const a = easeOut(prog(t, rowAt(z.from), 0.35));
          if (a <= 0) continue;
          const y0 = TOP + z.from * ROW + 4, y1 = TOP + z.to * ROW + ROW - 14;
          ctx.save();
          ctx.globalAlpha = a;
          ctx.fillStyle = z.zone;
          ctx.fillRect(M - 34, y0, 8, (y1 - y0) * a);
          ctx.fillRect(M - 34, y0, 18, 6);
          ctx.fillRect(M - 34, y0 + (y1 - y0) * a - 6, 18, 6);
          ctx.font = BARLOW(24, 700);
          if (ctx.measureText(z.name).width < y1 - y0 - 10) {
            ctx.translate(M - 46, (y0 + y1) / 2);
            ctx.rotate(-Math.PI / 2);
            text(ctx, z.name, 0, 0, BARLOW(24, 700), P.mute, 'center');
          }
          ctx.restore();
        }
        const BX0 = M + 470, BX1 = W - M - 100;
        rows.forEach((r, i) => {
          const a = easeOut(prog(t, rowAt(i), 0.35));
          if (a <= 0) return;
          const y = TOP + i * ROW;
          ctx.save();
          ctx.globalAlpha = a;
          ctx.translate((1 - a) * 300, 0);
          if (!r) {
            text(ctx, '···', W / 2, y + 50, ANTON(48), P.faint, 'center');
            ctx.restore();
            return;
          }
          let fg = P.ink, bar = r.color;
          if (r.me) {
            // Con su color (si no se vería sobre el fondo, con el del acento)
            const st = d[r.me].style;
            const hidden = contrastWith(st.bg, theme(d).ground) < 1.4;
            ctx.fillStyle = hidden ? st.acc : st.bg;
            fg = hidden ? st.on : st.fg;
            bar = fg;
            roundRect(ctx, M - 16, y, W - 2 * M + 32, ROW - 10, 16);
            ctx.fill();
          } else if (i % 2 === 0) {
            ctx.fillStyle = P.zebra;
            roundRect(ctx, M - 16, y, W - 2 * M + 32, ROW - 10, 16);
            ctx.fill();
          }
          if (!bar || contrastWith(bar, theme(d).ground) < 1.5) bar = P.track;
          text(ctx, String(r.rank), M + 30, y + 54, ANTON(46), fg, 'center');
          logo(ctx, A.tableLogos[i], M + 110, y + 37, 54);
          text(ctx, up(r.name), M + 160, y + 54, BARLOW(fit(ctx, up(r.name), (z) => BARLOW(z), 44, BX0 - M - 180)), fg);
          // La barra de sus puntos, que crece
          const g = easeOut(prog(t, rowAt(i) + 0.15, 0.5));
          const bw = (BX1 - BX0) * ((r.pts || 0) / maxPts) * g;
          ctx.fillStyle = bar;
          roundRect(ctx, BX0, y + 22, Math.max(6, bw), ROW - 54, 8);
          ctx.fill();
          text(ctx, String(r.pts ?? ''), W - M - 20, y + 56, ANTON(52), fg, 'center');
          ctx.restore();
        });
      },
    };
  }

  // 7 · Cierre: la pregunta para los comentarios y tu firma.
  function sceneOutro(d, A) {
    const c = d.closing, st = c.style;
    return {
      id: 'outro',
      dur: 2 * BAR,
      accent: st.acc,
      overlay: d.kind === 'previa' || d.kind === 'onces' ? null : (ctx, t) => drawBug(ctx, d, A, finalBug(d)()),
      music: { energy: 'outro' },
      cues: [{ t: 0.2, kind: 'riser', dur: BAR - 0.2, vel: 0.6 }, ...(d.brand || !d.sign ? [] : [{ t: BAR, kind: 'stab' }, { t: BAR, kind: 'impact', vel: 0.8 }])],
      draw(ctx, t) {
        groundBg(ctx, d);
        if (A.closingPhoto) {
          const pw = 1500 * (1 + 0.04 * prog(t, 0, 2 * BAR));
          imgBottom(ctx, A.closingPhoto, W - pw + 380, H + 40, pw, 0.3);
        } else {
          logo(ctx, A.closingLogo, W - 260, 1180, 820 * (1 + 0.04 * prog(t, 0, 2 * BAR)), 0.13);
        }
        const size = wrap(ctx, up(c.question), ANTON(150), W - 2 * M).length > 4 ? 120 : 150;
        const ls = wrap(ctx, up(c.question), ANTON(size), W - 2 * M);
        ls.forEach((l, i) => {
          const e = easeOut(prog(t, 0.1 + i * 0.12, 0.45));
          ctx.save();
          ctx.globalAlpha = e;
          ctx.translate(0, (1 - e) * 60);
          text(ctx, l, M, 520 + i * size * 1.05, ANTON(size), theme(d).ink);
          ctx.restore();
        });
        const after = 520 + ls.length * size * 1.05;
        const e1 = easeOut(prog(t, 0.6, 0.4));
        ctx.save();
        ctx.globalAlpha = e1;
        text(ctx, d.t?.comments || 'TE LEO EN COMENTARIOS', M, after + 30, BARLOW(48), d.dark ? ACCENT : marksDark(d)[c.side] || theme(d).ink);
        ctx.restore();
        // Con logo, la firma y el logo van en la escena siguiente, la de tu marca
        if (d.brand || !d.sign) return;
        const e2 = easeOut(prog(t, BAR, 0.45));
        ctx.save();
        ctx.globalAlpha = e2;
        ctx.translate((1 - e2) * -80, 0);
        chip(ctx, d.t?.follow || 'Sígueme para más fútbol', M, 1170, st, 40);
        text(ctx, d.sign, M, 1330, ANTON(fit(ctx, d.sign, ANTON, 130, W - 2 * M)), st.fg);
        ctx.restore();
      },
    };
  }

  // 8 · Tu marca (un compás, sin guion, solo si has puesto logo): tu logo entra de golpe en el
  // centro sobre un círculo verde lima que se abre, con un destello, un temblor y dos ondas, y
  // debajo «Sígueme para más fútbol» y tu firma.
  function sceneMarca(d, A) {
    const HIT = 2 * STEP;
    return {
      id: 'marca',
      dur: BAR,
      accent: ACCENT,
      noScript: true,
      music: { energy: 'tail' },
      cues: [{ t: HIT, kind: 'slam' }, { t: HIT, kind: 'impact', vel: 0.9 }],
      draw(ctx, t) {
        fillAll(ctx, INK_BG);
        ctx.drawImage(lightLayer(W, H, true, false), ...bleed(ctx, 0, 0, W, H));
        const cx = W / 2, cy = 820, R = 290;
        const img = A.brandImg;
        const round = img && Math.abs(img.naturalWidth / img.naturalHeight - 1) < 0.25;
        ctx.save();
        // El golpe: un temblor corto
        const shake = t >= HIT ? 16 * (1 - prog(t, HIT, 0.18)) : 0;
        if (shake > 0) ctx.translate(Math.sin(t * 90) * shake, Math.cos(t * 70) * shake);
        // El círculo lima que se abre hasta el golpe y se queda detrás del logo (con un logo
        // alargado, solo las ondas)
        if (round) {
          const r = (R + 34) * easeOut(prog(t, 0, HIT));
          if (r > 0) {
            ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
            ctx.fillStyle = ACCENT; ctx.fill();
          }
        }
        // Dos ondas que salen del logo
        [0, 0.14].forEach((delay) => {
          const q = prog(t, HIT + delay, 0.75);
          if (q <= 0 || q >= 1) return;
          ctx.beginPath(); ctx.arc(cx, cy, R + 34 + q * 460, 0, Math.PI * 2);
          ctx.lineWidth = 12 * (1 - q) + 2;
          ctx.strokeStyle = rgba(ACCENT, 0.85 * (1 - q));
          ctx.stroke();
        });
        // El logo, que entra con rebote
        if (img && t >= HIT) {
          const k = easeBack(prog(t, HIT, 0.35));
          logo(ctx, img, cx, cy, 2 * R * (round ? 1 : 1.5) * k);
        }
        ctx.restore();
        // «SÍGUEME PARA MÁS FÚTBOL · @FIRMA ·» girando en círculo alrededor del logo
        const ring = easeOut(prog(t, HIT, 0.4));
        if (ring > 0) {
          const str = `${up(d.t?.follow || 'Sígueme para más fútbol')} · ${d.sign ? up(d.sign) + ' · ' : ''}`;
          ctx.save();
          ctx.globalAlpha = ring;
          ringText(ctx, str.repeat(str.length > 40 ? 1 : 2), cx, cy, R + 90, -Math.PI / 2 + t * 0.9, BARLOW(52), ACCENT);
          ctx.restore();
        }
        // El destello del golpe
        if (t >= HIT) fillAll(ctx, `rgba(255,255,255,${0.32 * (1 - prog(t, HIT, 0.2))})`);
        // Debajo, «Sígueme para más fútbol» y tu firma
        const e = easeOut(prog(t, HIT + 0.25, 0.35));
        if (e > 0) {
          ctx.save();
          ctx.globalAlpha = e;
          ctx.translate(0, (1 - e) * 40);
          if (d.sign) text(ctx, d.sign, cx, cy + R + 300, ANTON(fit(ctx, d.sign, ANTON, 120, W - 2 * M)), '#ffffff', 'center');
          ctx.restore();
        }
      },
    };
  }

  // 5 · El dato, sin rótulo: quién (si es de un jugador), el número gigante que sube y lo que
  // significa entrando línea a línea. La frase la dice la voz; en pantalla no se repite.
  function sceneDato(d, A) {
    const x = d.dato, st = x.style;
    const fg = theme(d).ink, hl = marksDark(d)[x.side] || ACCENT;
    const counts = /^\d+(\/\d+)?$/.test(x.big);
    const build = (dur) => ({
      id: 'dato',
      dur,
      stretch: build,
      accent: st.acc,
      overlay: (ctx, t) => drawBug(ctx, d, A, finalBug(d)()),
      music: { energy: 'full' },
      cues: [{ t: 0, kind: 'impact', vel: 0.9 }, { t: 0, kind: 'slam' }, ...(counts ? ticks(STEP, 0.6, 0.6) : []), { t: BAR, kind: 'hit', vel: 0.8 }],
      draw(ctx, t) {
        groundBg(ctx, d);
        logo(ctx, x.side === 'away' ? A.awayLogo : A.homeLogo, W - 170, 620, 900 * (1 + 0.05 * prog(t, 0, dur)), 0.12);
        if (x.who) {
          const k = easeOut(prog(t, 0.05, 0.3));
          ctx.save();
          ctx.globalAlpha = k;
          text(ctx, up(x.who), M, 380, ANTON(fit(ctx, up(x.who), ANTON, 80, W - 2 * M)), fg);
          ctx.restore();
        }
        const big = up(x.big);
        const size = fit(ctx, big, ANTON, big.length <= 2 ? 760 : 560, W - 2 * M);
        const a = easeBack(prog(t, 0, 0.45));
        ctx.save();
        ctx.translate(M, 960);
        ctx.scale(0.7 + 0.3 * a, 0.7 + 0.3 * a);
        ctx.shadowColor = 'rgba(0,0,0,.25)';
        ctx.shadowBlur = 40;
        text(ctx, countText(big, easeOut(prog(t, 0, 0.6))), 0, 0, ANTON(size), hl);
        ctx.restore();
        let usize = 150;
        while (usize > 90 && wrap(ctx, up(x.unit), ANTON(usize), W - 2 * M).length > 3) usize -= 10;
        const lines = wrap(ctx, up(x.unit), ANTON(usize), W - 2 * M).slice(0, 4);
        lines.forEach((l, i) => {
          const e = easeOut(prog(t, 0.45 + i * 0.18, 0.3));
          ctx.save();
          ctx.globalAlpha = e;
          ctx.translate((1 - e) * 200, 0);
          text(ctx, l, M, 1130 + i * usize * 1.02, ANTON(usize), i === lines.length - 1 ? hl : fg);
          ctx.restore();
        });
        if (t < 0.09) fillAll(ctx, `rgba(255,255,255,${0.5 * (1 - t / 0.09)})`);
      },
    });
    return build(2 * BAR);
  }

  // 0 · Apertura con el aviso del móvil (a prueba): la pantalla de bloqueo con el marcador en
  // directo (como una Live Activity): la isla de arriba crece hasta la tarjeta con los dos
  // escudos, el resultado y lo que pasó, y la tarjeta se abre hasta llenar la pantalla con el
  // marcador gigante. Desde el primer fotograma se lee el resultado.
  function sceneNotice(d, A) {
    const res = d.live ? `${d.t?.live || 'EN JUEGO'} ${d.clock}` : (d.t?.fullTime || 'FINAL');
    const H1 = d.home.style, A1 = d.away.style;
    return {
      id: 'intro',
      noScript: true,
      dur: BAR,
      accent: ACCENT,
      music: { energy: 'intro' },
      cues: [{ t: 0, kind: 'hit', vel: 0.7 }, { t: 3 * BEAT, kind: 'riser', dur: BEAT, vel: 0.7 }],
      draw(ctx, t) {
        const g = ctx.createLinearGradient(0, 0, W, H);
        g.addColorStop(0, H1.lo);
        g.addColorStop(0.55, '#14101c');
        g.addColorStop(1, A1.lo);
        fillAll(ctx, g);
        const open = easeInOut(prog(t, 1.05, 0.5));
        ctx.save();
        ctx.globalAlpha = 1 - open;
        text(ctx, d.noticeDay || d.date, W / 2, 330, BARLOW(52, 600), 'rgba(255,255,255,.85)', 'center');
        text(ctx, d.noticeTime || '', W / 2, 590, BARLOW(270, 600), '#ffffff', 'center');
        ctx.restore();
        // La isla: de pastilla a tarjeta (y luego a toda la pantalla)
        const grow = easeBack(prog(t, 0.1, 0.4));
        const lines = d.comp ? [d.comp] : [];
        const cardH = 400 + lines.length * 40;
        const pill = { x: W / 2 - 170, y: 40, w: 340, h: 100 };
        const card = { x: M, y: 700, w: W - 2 * M, h: cardH };
        const lerp = (p, q, k) => p + (q - p) * k;
        const full = bleed(ctx, 0, 0, W, H);
        let x = lerp(pill.x, card.x, grow), y = lerp(pill.y, card.y, grow), w = lerp(pill.w, card.w, grow), h = lerp(pill.h, card.h, grow);
        x = lerp(x, full[0], open); y = lerp(y, full[1], open); w = lerp(w, full[2], open); h = lerp(h, full[3], open);
        const r = lerp(lerp(50, 56, grow), 0, open);
        ctx.save();
        ctx.shadowColor = 'rgba(0,0,0,.45)';
        ctx.shadowBlur = 50;
        roundRect(ctx, x, y, w, h, r);
        ctx.fillStyle = '#050608';
        ctx.fill();
        ctx.shadowColor = 'transparent';
        ctx.clip();
        // Los colores de cada equipo, a su lado
        for (const [st, gx] of [[H1, x], [A1, x + w]]) {
          const gl = ctx.createRadialGradient(gx, y + h / 2, 0, gx, y + h / 2, w * 0.6);
          gl.addColorStop(0, rgba(st.bg, 0.55));
          gl.addColorStop(1, rgba(st.bg, 0));
          ctx.fillStyle = gl;
          ctx.fillRect(x, y, w, h);
        }
        // Con el campo en 3D, la tarjeta se abre como una ventana al estadio (el primer plano de la
        // portada): se ve a través de ella mientras crece
        if (A.world && open > 0) {
          A.world.frame(coverFrame(0, BAR));
          ctx.save();
          ctx.globalAlpha = Math.min(1, open * 1.6);
          groundBg(ctx, d);
          ctx.drawImage(A.world.canvas, ...full);
          ctx.restore();
        }
        // Dentro: los escudos, el resultado y lo que pasó (se ven en cuanto la isla crece)
        const c = clamp01((grow - 0.4) / 0.6) * (1 - open);
        const cx = x + w / 2, top = y + 40 * (1 - open);
        ctx.globalAlpha = Math.max(c, 1 - grow); // en la pastilla ya se lee el resultado
        const k = 0.35 + 0.65 * grow;
        logo(ctx, A.homeLogo, cx - w * 0.36, top + 150 * k, 150 * k);
        logo(ctx, A.awayLogo, cx + w * 0.36, top + 150 * k, 150 * k);
        text(ctx, `${d.home.score}`, cx - w * 0.14, top + 230 * k, ANTON(220 * k), '#ffffff', 'center');
        text(ctx, `${d.away.score}`, cx + w * 0.14, top + 230 * k, ANTON(220 * k), '#ffffff', 'center');
        chip(ctx, res, cx, top + 70 * k, { acc: d.live ? '#e3172d' : ACCENT, on: d.live ? '#ffffff' : '#111111' }, 40 * k, 'center');
        ctx.globalAlpha = c;
        text(ctx, `${up(d.home.short)} · ${up(d.away.short)}`, cx, top + 300, BARLOW(fit(ctx, `${up(d.home.short)} · ${up(d.away.short)}`, BARLOW, 46, w - 80), 700), 'rgba(255,255,255,.7)', 'center');
        lines.forEach((l, i) => text(ctx, l, cx, top + 380 + i * 64, BARLOW(fit(ctx, l, BARLOW, 50, w - 80), 600), 'rgba(255,255,255,.6)', 'center'));
        ctx.restore();
        if (open > 0 && !A.world) fillAll(ctx, `rgba(255,255,255,${0.5 * open})`);
      },
    };
  }

  // Contraste WCAG entre dos colores (como en futbol.js).
  function contrastWith(a, b) {
    const lum = (hex) => [16, 8, 0].map(s => ((parseInt(hex.slice(1), 16) >> s) & 255) / 255)
      .map(v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
      .reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
    const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
    return (x + 0.05) / (y + 0.05);
  }

  // ─── PREVIA (d.kind === 'previa'): cómo llegan, el cara a cara y los goleadores ───
  // Los colores de ganado, empatado y perdido
  const RES = { W: { c: '#22a861', l: 'G' }, D: { c: '#8b919c', l: 'E' }, L: { c: '#e0414f', l: 'P' } };
  // El título en la pastilla blanca, como en las estadísticas
  function pill(ctx, title, y = 70) {
    ctx.font = ANTON(56);
    const tw = ctx.measureText(title).width + 40;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(W / 2 - tw / 2, y, tw, 82);
    text(ctx, title, W / 2, y + 63, ANTON(56), '#111111', 'center');
  }
  // Cada equipo en su mitad (local a la izquierda), con su escudo y su nombre arriba
  function halvesBg(ctx, d, A) {
    for (const [team, img, x] of [[d.home, A.homeLogo, 0], [d.away, A.awayLogo, W / 2]]) {
      const st = team.style;
      ctx.save();
      ctx.beginPath();
      ctx.rect(...bleed(ctx, x, 0, W / 2, H));
      ctx.clip();
      teamBg(ctx, st, x, 0, W / 2, H, 0.5, 0.25);
      logo(ctx, img, x + W / 4, 260, 150);
      text(ctx, up(team.short), x + W / 4, 410, ANTON(fit(ctx, up(team.short), ANTON, 64, W / 2 - 60)), st.fg, 'center');
      ctx.restore();
    }
  }

  // La polémica: en el color del equipo al que le tocó, la etiqueta roja, el minuto en grande, qué
  // pasó y quién, cómo iba el marcador y, al final, la pregunta para los comentarios.
  const POLEMICA_RED = { acc: '#ff3b3b', on: '#ffffff' };
  function scenePolemica(d, A) {
    const x = d.polemica, st = x.style;
    return {
      id: 'polemica',
      dur: 3 * BAR,
      accent: POLEMICA_RED.acc,
      music: { energy: 'full' },
      cues: [{ t: BEAT, kind: 'slam' }, { t: BEAT + 0.4, kind: 'hit', vel: 0.7 }, { t: 2 * BAR, kind: 'hit', vel: 0.9 }],
      draw(ctx, t) {
        teamBg(ctx, st);
        logo(ctx, x.side === 'away' ? A.awayLogo : A.homeLogo, W - 160, 640, 920 * (1 + 0.05 * prog(t, 0, 3 * BAR)), 0.12);
        const k = easeOut(prog(t, 0.05, 0.4));
        ctx.save();
        ctx.globalAlpha = k;
        ctx.translate((1 - k) * -80, 0);
        chip(ctx, d.t?.polemica || 'LA POLÉMICA', M, 190, POLEMICA_RED, 52);
        ctx.restore();
        // El minuto, de golpe
        const a = easeBack(prog(t, BEAT, 0.5));
        if (a > 0) {
          ctx.save();
          ctx.translate(M, 640);
          ctx.scale(a, a);
          ctx.shadowColor = 'rgba(0,0,0,.25)';
          ctx.shadowBlur = 40;
          text(ctx, x.min, 0, 0, ANTON(fit(ctx, x.min, ANTON, 330, W - 2 * M)), st.hl);
          ctx.restore();
        }
        const title = wrap(ctx, up(x.title), ANTON(100), W - 2 * M).slice(0, 2);
        title.forEach((l, i) => {
          const e = easeOut(prog(t, BEAT + 0.3 + i * 0.1, 0.4));
          ctx.save();
          ctx.globalAlpha = e;
          ctx.translate((1 - e) * -60, 0);
          text(ctx, l, M, 780 + i * 108, ANTON(100), st.fg);
          ctx.restore();
        });
        let y = 780 + title.length * 108;
        const e = easeOut(prog(t, BAR, 0.5));
        ctx.save();
        ctx.globalAlpha = e;
        ctx.translate(0, (1 - e) * 40);
        if (x.who && !x.title.includes(x.who)) {
          text(ctx, up(x.who), M, y + 10, BARLOW(fit(ctx, up(x.who), BARLOW, 60, W - 2 * M)), st.fg);
          y += 80;
        }
        text(ctx, d.t?.atTheTime || 'ASÍ IBA', M, y + 70, BARLOW(40), st.fg);
        text(ctx, up(x.scoreLine), M, y + 160, ANTON(fit(ctx, up(x.scoreLine), ANTON, 84, W - 2 * M)), st.fg);
        ctx.restore();
        // La pregunta, en blanco, para que la contesten
        const q = easeBack(prog(t, 2 * BAR, 0.45));
        if (q > 0) {
          const lines = wrap(ctx, up(x.question), ANTON(72), W - 2 * M - 60).slice(0, 2);
          const h = 60 + lines.length * 82;
          ctx.save();
          ctx.translate(M, 1500 - h);
          ctx.scale(1, Math.min(1, q));
          ctx.globalAlpha = Math.min(1, q);
          ctx.fillStyle = '#ffffff';
          roundRect(ctx, 0, 0, W - 2 * M, h, 18);
          ctx.fill();
          lines.forEach((l, i) => text(ctx, l, 30, 100 + i * 82, ANTON(72), '#111111'));
          ctx.restore();
        }
      },
    };
  }

  // Cómo llegan: los últimos 5 de cada uno (el más reciente arriba), con el resultado y el rival,
  // y abajo la cuenta («4G · 0E · 1P»)
  function scenePrevForma(d, A) {
    const n = Math.max(d.forma.home.length, d.forma.away.length);
    const rowAt = (i) => BEAT + i * STEP * 2;
    // Las cuentas («4G · 0E · 1P») acaban en 1445: debajo van los subtítulos
    const TOP = 500, ROW = 175;
    return {
      id: 'forma',
      dur: 3 * BAR,
      accent: d.home.style.acc,
      music: { energy: 'full' },
      cues: [...Array(n)].map((_, i) => ({ t: rowAt(i), kind: 'hit', vel: 0.7 })),
      draw(ctx, t) {
        halvesBg(ctx, d, A);
        ctx.save();
        ctx.globalAlpha = easeOut(prog(t, 0.1, 0.4));
        pill(ctx, d.t?.forma || 'CÓMO LLEGAN');
        ctx.restore();
        [['home', 0], ['away', W / 2]].forEach(([side, x0]) => {
          const st = d[side].style;
          const list = [...d.forma[side]].reverse();
          list.forEach((g, i) => {
            const a = easeBack(prog(t, rowAt(i), 0.35));
            if (a <= 0) return;
            const y = TOP + i * ROW;
            const r = RES[g.res] || RES.D;
            ctx.save();
            ctx.globalAlpha = Math.min(1, a);
            ctx.translate(x0 + 120, y + 60);
            ctx.scale(a, a);
            ctx.fillStyle = r.c;
            roundRect(ctx, -60, -60, 120, 120, 22);
            ctx.fill();
            text(ctx, r.l, 0, 30, ANTON(80), '#ffffff', 'center');
            ctx.restore();
            ctx.save();
            ctx.globalAlpha = easeOut(prog(t, rowAt(i) + 0.1, 0.35));
            text(ctx, g.score, x0 + 210, y + 66, ANTON(70), st.fg);
            text(ctx, `${g.home ? 'vs' : '@'} ${up(g.opp)}`, x0 + 210, y + 112, BARLOW(fit(ctx, `${g.home ? 'vs' : '@'} ${up(g.opp)}`, (z) => BARLOW(z), 36, W / 2 - 240)), st.fg);
            ctx.restore();
          });
          const c = d.forma[side].reduce((acc, g) => ({ ...acc, [g.res]: (acc[g.res] || 0) + 1 }), {});
          ctx.save();
          ctx.globalAlpha = easeOut(prog(t, rowAt(n) + 0.2, 0.4));
          const [w, dr, l] = d.t?.wdl || ['G', 'E', 'P'];
          text(ctx, `${c.W || 0}${w} · ${c.D || 0}${dr} · ${c.L || 0}${l}`, x0 + W / 4, TOP + 5 * ROW + 70, ANTON(64), st.fg, 'center');
          ctx.restore();
        });
      },
    };
  }

  // ─── La previa nueva (inspirada en tres pines de Pinterest) ───
  // Saira, ancha e inclinada (la de los textos de la portada), y Barlow, la de las cifras del cara
  // a cara. Sin fontStretch (Safari), Saira sale igual de ancha: es la única anchura que se carga.
  const SAIRA = (size) => `italic 800 ${size}px Saira`;
  const DIN = (size, weight = 800) => `${weight} ${size}px Barlow`;
  const wide = (ctx, on) => { if ('fontStretch' in ctx) ctx.fontStretch = on ? 'expanded' : 'normal'; };
  // Texto con espacio entre letras (sin letterSpacing, el navegador lo pone junto)
  function spaced(ctx, px, fn) {
    const has = 'letterSpacing' in ctx;
    if (has) ctx.letterSpacing = `${px}px`;
    try { return fn(); } finally { if (has) ctx.letterSpacing = '0px'; }
  }

  // El papel de la portada: sin grano (TikTok lo recomprime y se ve borroso), con arrugas suaves de
  // luz y sombra y los dos dobleces en cruz de un póster
  function paperLayer(dark) {
    return layer(`paper|${dark}`, W, H, (c) => {
      c.fillStyle = dark ? '#12151b' : '#f6f3ec';
      c.fillRect(0, 0, W, H);
      let s = 20261020;
      const rnd = () => { s = (s + 0x6d2b79f5) | 0; let x = Math.imul(s ^ (s >>> 15), 1 | s); x ^= x + Math.imul(x ^ (x >>> 7), 61 | x); return ((x ^ (x >>> 14)) >>> 0) / 4294967296; };
      for (let k = 0; k < 10; k++) {
        const x = rnd() * W, y = rnd() * H, r = 260 + rnd() * 520;
        const g = c.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, k % 2 ? (dark ? 'rgba(255,255,255,.03)' : 'rgba(255,255,255,.35)') : (dark ? 'rgba(0,0,0,.12)' : 'rgba(0,0,0,.025)'));
        g.addColorStop(1, 'rgba(0,0,0,0)');
        c.fillStyle = g;
        c.fillRect(0, 0, W, H);
      }
      c.fillStyle = dark ? 'rgba(255,255,255,.05)' : 'rgba(255,255,255,.7)';
      c.fillRect(W / 2 - 2, 0, 3, H);
      c.fillRect(0, H / 2 - 2, W, 3);
      c.fillStyle = dark ? 'rgba(0,0,0,.25)' : 'rgba(0,0,0,.05)';
      c.fillRect(W / 2 + 1, 0, 2, H);
      c.fillRect(0, H / 2 + 1, W, 2);
    });
  }

  // PORTADA (el pin «Blue vs Blue»): papel, dos franjas en diagonal del color de cada equipo con su
  // escudo de fondo, los textos por su borde, los escudos en las esquinas y el «VS» verde en el
  // hueco. Es el primer fotograma (la portada que pone TikTok si no eliges otra): todo está desde
  // el principio y se mueve poco; en el primer pulso, el golpe del «VS» y los escudos.
  const SLOPE = 0.58, TILT = Math.atan(SLOPE);
  const edgeY = (x, b) => SLOPE * x + b;
  function scenePrevPortada(d, A) {
    // Los bordes de las franjas (y = SLOPE·x + b): local arriba, visitante abajo, y el hueco del «VS»
    const L1 = -113, L2 = 489, L3 = 525, L4 = 1127, VS = [540, 820];
    // Sobre el papel, el color de cada equipo que se lea; la franja de un equipo claro (blanco), en
    // papel claro, con su segundo color, y en oscuro, blanca
    const ink = (st) => (d.dark ? st.night || st.ink : st.ink);
    const bandOf = (st) => (st.fg === '#111111' && !d.dark ? st.ink : st.bg);
    const top = up(`${d.t?.previa || 'Previa'} · ${d.compName || d.comp} | ${d.when || ''}`);
    const bottom = up([d.hhmm, d.venue].filter(Boolean).join(' | '));
    return {
      id: 'intro',
      noScript: true,
      dur: 2 * BAR,
      accent: ACCENT,
      music: { energy: 'intro' },
      cues: [
        { t: 0, kind: 'riser', dur: BEAT, vel: 0.6 },
        { t: BEAT, kind: 'impact', vel: 1 },
        { t: BEAT, kind: 'slam' },
        { t: BAR, kind: 'hit', vel: 0.6 },
      ],
      draw(ctx, t) {
        ctx.drawImage(paperLayer(!!d.dark), ...bleed(ctx, 0, 0, W, H));
        // Las franjas (de lado a lado de la pantalla), con el escudo de fondo que se desliza por ellas
        const drift = 40 * easeInOut(prog(t, 0, 2 * BAR));
        const band = (b0, b1, st, img, cx, dir) => {
          ctx.save();
          ctx.beginPath();
          ctx.moveTo(-800, edgeY(-800, b0)); ctx.lineTo(1900, edgeY(1900, b0));
          ctx.lineTo(1900, edgeY(1900, b1)); ctx.lineTo(-800, edgeY(-800, b1));
          ctx.closePath();
          ctx.fillStyle = bandOf(st);
          ctx.fill();
          ctx.clip();
          if (img) {
            const x = cx + dir * drift * Math.cos(TILT);
            ctx.globalCompositeOperation = 'luminosity';
            ctx.globalAlpha = 0.2;
            ctx.translate(x, edgeY(x, (b0 + b1) / 2));
            ctx.rotate(TILT);
            logo(ctx, img, 0, 0, 1100);
          }
          ctx.restore();
        };
        band(L1, L2, d.home.style, A.homeLogo, 470, 1);
        band(L3, L4, d.away.style, A.awayLogo, 760, -1);
        // Las rayas finas, paralelas a las franjas, cortadas por los escudos
        ctx.lineWidth = 6;
        const ray = (x0, x1, b, color) => {
          ctx.strokeStyle = color;
          ctx.beginPath(); ctx.moveTo(x0, edgeY(x0, b)); ctx.lineTo(x1, edgeY(x1, b)); ctx.stroke();
        };
        ray(530, 790, L1 - 192, ink(d.home.style));
        ray(1100, 1500, L1 - 192, ink(d.home.style));
        ray(-400, 30, L4 + 205, ink(d.away.style));
        ray(330, 590, L4 + 205, ink(d.away.style));
        // Los textos, por el borde de fuera de cada franja, corriendo un poco por él
        const edgeText = (str, x, b, dy, size, maxLen, color, run) => {
          if (!str) return;
          ctx.save();
          wide(ctx, true);
          spaced(ctx, 2, () => {
            ctx.font = SAIRA(size);
            while (ctx.measureText(str).width > maxLen && size > 28) { size -= 2; ctx.font = SAIRA(size); }
            const r = run * easeOut(prog(t, 0, 2 * BAR));
            ctx.translate(x + r * Math.cos(TILT), edgeY(x, b) + dy + r * Math.sin(TILT));
            ctx.rotate(TILT);
            ctx.fillStyle = color;
            ctx.textAlign = 'left';
            ctx.textBaseline = 'alphabetic';
            ctx.fillText(str, 0, 0);
          });
          wide(ctx, false);
          ctx.restore();
        };
        edgeText(top, 300, L1, -28, 54, 880, ink(d.home.style), 24);
        edgeText(bottom, 40, L4, 74, 51, 830, ink(d.away.style), -24);
        // Los escudos en las esquinas de papel, con un golpe en el primer pulso
        const k = 1 + 0.08 * Math.sin(Math.PI * prog(t, BEAT, 0.3));
        logo(ctx, A.homeLogo, 940, 141, 270 * k);
        logo(ctx, A.awayLogo, 180, 1539, 270 * k);
        // El «VS», verde, en el hueco: crece de golpe en el primer pulso y deja una onda
        const ring = prog(t, BEAT, 0.6);
        if (ring > 0 && ring < 1) {
          ctx.save();
          ctx.globalAlpha = 1 - ring;
          ctx.strokeStyle = ACCENT;
          ctx.lineWidth = 24 * (1 - ring) + 2;
          ctx.beginPath(); ctx.arc(VS[0], VS[1], 90 + 520 * easeOut(ring), 0, Math.PI * 2); ctx.stroke();
          ctx.restore();
        }
        const s = 1 + 0.3 * Math.sin(Math.PI * prog(t, BEAT, 0.35));
        ctx.save();
        ctx.translate(VS[0], VS[1]);
        ctx.scale(s, s);
        ctx.beginPath();
        [[-59, -56], [59, -56], [82, -33], [82, 33], [59, 56], [-59, 56], [-82, 33], [-82, -33]].forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
        ctx.closePath();
        ctx.fillStyle = ACCENT;
        ctx.shadowColor = 'rgba(0,0,0,.25)';
        ctx.shadowBlur = 18;
        ctx.shadowOffsetY = 6;
        ctx.fill();
        ctx.shadowColor = 'transparent';
        wide(ctx, true);
        text(ctx, 'VS', -3, 23, SAIRA(64), '#111111', 'center');
        wide(ctx, false);
        ctx.restore();
        const flash = 1 - prog(t, BEAT, 0.14);
        if (t >= BEAT && flash > 0) fillAll(ctx, `rgba(255,255,255,${0.25 * flash})`);
      },
    };
  }

  // CARA A CARA (el pin de Goal de los grandes derbis): fondo oscuro y filas con el color de cada
  // equipo en los extremos de la barra y su escudo encima. Arriba, en grande, el total (victorias
  // de cada uno y empates, que suben contando); debajo, cada partido, con el local de hoy a la
  // izquierda: la cifra del que perdió, en gris, y en casa de quién se jugó.
  function h2hBg(ctx) {
    const [bx, by, bw, bh] = bleed(ctx, 0, 0, W, H);
    ctx.drawImage(layer('h2h|goal', W, H, (c) => {
      const g = c.createRadialGradient(W / 2, H * 0.42, 0, W / 2, H * 0.42, H * 0.75);
      g.addColorStop(0, '#4b4c50'); g.addColorStop(0.55, '#333438'); g.addColorStop(1, '#1f2023');
      c.fillStyle = g;
      c.fillRect(0, 0, W, H);
      c.save();
      c.translate(W / 2, H / 2);
      c.rotate(-0.44);
      c.fillStyle = 'rgba(255,255,255,.025)';
      for (let x = -1500; x < 1500; x += 26) c.fillRect(x, -1500, 3, 3000);
      c.restore();
    }), bx, by, bw, bh);
  }
  // Una fila: y = el borde de arriba de su pestaña. o: { big, tab, l, mid, r, lLose, rLose, sub,
  // tabA, bar, crest, subA } (bar, crest: lo que se ve, de 0 a 1)
  function h2hRow(ctx, A, d, y, o) {
    const big = o.big, barY = y + (big ? 45 : 35), barH = big ? 188 : 120, cy = barY + barH / 2;
    if (o.bar > 0) {
      ctx.save();
      ctx.translate(W / 2, 0);
      ctx.scale(o.bar, 1);
      ctx.translate(-W / 2, 0);
      const L = d.home.style.bg, R = d.away.style.bg;
      const g = ctx.createLinearGradient(-80, 0, W + 80, 0);
      g.addColorStop(0, rgba(L, 0)); g.addColorStop(0.1, L); g.addColorStop(0.16, L);
      g.addColorStop(0.4, '#26272b'); g.addColorStop(0.5, '#1d1e21'); g.addColorStop(0.6, '#26272b');
      g.addColorStop(0.84, R); g.addColorStop(0.9, R); g.addColorStop(1, rgba(R, 0));
      ctx.fillStyle = g;
      ctx.fillRect(-80, barY, W + 160, barH);
      ctx.fillStyle = 'rgba(255,255,255,.12)';
      ctx.fillRect(-80, barY, W + 160, 4);
      ctx.fillStyle = 'rgba(0,0,0,.35)';
      ctx.fillRect(-80, barY + barH - 4, W + 160, 4);
      ctx.restore();
    }
    // Los escudos, encima de los extremos (entran desde los lados)
    if (o.crest > 0) {
      const size = big ? 227 : 160, x = big ? 124 : 128, off = (1 - Math.min(1, o.crest)) * 320;
      ctx.save();
      ctx.globalAlpha *= Math.min(1, o.crest);
      ctx.shadowColor = 'rgba(0,0,0,.45)';
      ctx.shadowBlur = 16;
      ctx.shadowOffsetY = 8;
      logo(ctx, A.homeLogo, x - off, cy - (big ? 8 : 6), size);
      logo(ctx, A.awayLogo, W - x + off, cy - (big ? 8 : 6), size);
      ctx.restore();
    }
    // La pestaña, por encima de la barra
    if (o.tabA > 0 && o.tab) {
      ctx.save();
      ctx.globalAlpha *= o.tabA;
      const size = big ? 42 : 36, pad = big ? 65 : 59, th = big ? 64 : 57;
      spaced(ctx, big ? 6.7 : 7.9, () => {
        ctx.font = BARLOW(size, 700);
        const tw = ctx.measureText(o.tab).width + 2 * pad, x0 = W / 2 - tw / 2, cut = tw * 0.05;
        ctx.beginPath();
        ctx.moveTo(x0 + cut, y); ctx.lineTo(x0 + tw - cut, y); ctx.lineTo(x0 + tw, y + th); ctx.lineTo(x0, y + th);
        ctx.closePath();
        ctx.fillStyle = '#1b1c1f';
        ctx.fill();
        text(ctx, o.tab, W / 2, y + th * 0.72, BARLOW(size, 700), '#e9e9ea', 'center');
      });
      ctx.restore();
    }
    // Las cifras: las dos grandes y, en medio, la pequeña (los empates o el guion)
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,.45)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 5;
    ctx.font = DIN(big ? 86 : 60, 700);
    const mw = ctx.measureText(String(o.mid)).width, gap = big ? 34 : 30, base = cy + (big ? 57 : 40);
    text(ctx, String(o.mid), W / 2, cy + (big ? 30 : 21), DIN(big ? 86 : 60, 700), '#cfd0d3', 'center');
    text(ctx, String(o.l), W / 2 - mw / 2 - gap, base, DIN(big ? 162 : 113), o.lLose ? '#9a9ba0' : '#ffffff', 'right');
    text(ctx, String(o.r), W / 2 + mw / 2 + gap, base, DIN(big ? 162 : 113), o.rLose ? '#9a9ba0' : '#ffffff', 'left');
    ctx.restore();
    if (o.subA > 0 && o.sub) {
      ctx.save();
      ctx.globalAlpha *= o.subA;
      spaced(ctx, big ? 5.3 : 5, () => text(ctx, o.sub, W / 2, big ? y + 277 : y + 185, BARLOW(big ? 33 : 31, 600), big ? '#d6d7da' : '#b9babe', 'center'));
      ctx.restore();
    }
  }
  function scenePrevH2H(d, A) {
    const h = d.h2h;
    const games = h.games.slice(0, 5);
    const rowAt = (i) => BAR + i * STEP * 2;
    // Arriba a la derecha va tu logo; las filas acaban en 1420: debajo van los subtítulos
    const TOP = 130, ROW0 = 432, ROW = 200;
    const wins = up(d.t?.wins || 'Victorias');
    return {
      id: 'h2h',
      dur: 3 * BAR,
      accent: d.home.style.acc,
      music: { energy: 'full' },
      cues: [{ t: BEAT, kind: 'slam' }, ...games.map((_, i) => ({ t: rowAt(i), kind: 'tick', p: i / 5, vel: 0.6 }))],
      draw(ctx, t) {
        h2hBg(ctx);
        const c = easeOut(prog(t, BEAT, 0.6));
        h2hRow(ctx, A, d, TOP, {
          big: true, tab: up(h.tab || d.t?.h2h || 'CARA A CARA'), tabA: easeOut(prog(t, 0.05, 0.3)),
          bar: easeOut(prog(t, 0.1, 0.4)), crest: easeBack(prog(t, BEAT, 0.4)),
          l: countText(h.home, c), mid: countText(h.draws, c), r: countText(h.away, c), lLose: h.home < h.away, rLose: h.away < h.home,
          sub: `${wins} · ${up(d.t?.draws || 'EMPATES')} · ${wins}`, subA: easeOut(prog(t, BEAT + 0.3, 0.4)),
        });
        games.forEach((g, i) => {
          const a = easeOut(prog(t, rowAt(i), 0.35));
          if (a <= 0) return;
          const l = Number(g.left), r = Number(g.right);
          ctx.save();
          ctx.globalAlpha = a;
          ctx.translate((1 - a) * (i % 2 ? -180 : 180), 0);
          h2hRow(ctx, A, d, ROW0 + i * ROW, {
            big: false, tab: up(g.month || g.date), tabA: 1, bar: 1, crest: 1,
            l: g.left ?? '', mid: '–', r: g.right ?? '', lLose: l < r, rLose: r < l, sub: up(g.where || ''), subA: 1,
          });
          ctx.restore();
        });
      },
    };
  }

  // LOS QUE MÁS MARCAN (el pin de Kane y Lewandowski): uno a cada lado de una línea verde, con su
  // cara (o su escudo) pegada a ella y sus goles y partidos en círculos: verdes los del de casa y
  // negros (blancos, en oscuro) los del de fuera, que crecen de golpe y suben contando. Abajo, los
  // de los dos juntos.
  function scenePrevGoles(d, A) {
    const g = d.goleadores;
    const both = !!(g.home && g.away);
    const sum = both ? { goals: g.home.goals + g.away.goals, played: g.home.played && g.away.played ? g.home.played + g.away.played : null } : null;
    const T = d.t || {};
    const title = up([g.home?.last, g.away?.last].filter(Boolean).join(` ${T.and || 'y'} `));
    return {
      id: 'goleadores',
      dur: 2 * BAR,
      accent: ACCENT,
      music: { energy: 'full' },
      cues: [{ t: BEAT, kind: 'hit', vel: 0.9 }, { t: BEAT + STEP * 2, kind: 'hit', vel: 0.9 }, ...(both ? [{ t: BAR, kind: 'hit', vel: 0.8 }] : [])],
      draw(ctx, t) {
        sheetBg(ctx, d);
        const P = sheet(d);
        const dkFill = d.dark ? '#ffffff' : '#0d0f13', dkText = d.dark ? '#0d0f13' : ACCENT;
        const tag = (str, cy, a) => {
          if (a <= 0) return;
          ctx.save();
          ctx.globalAlpha *= a;
          spaced(ctx, 4, () => {
            ctx.font = BARLOW(40, 700);
            const w = ctx.measureText(str).width + 70;
            ctx.fillStyle = ACCENT;
            ctx.fillRect(W / 2 - w / 2, cy - 33, w, 66);
            text(ctx, str, W / 2, cy + 14, BARLOW(40, 700), '#111111', 'center');
          });
          ctx.restore();
        };
        const circle = (cx, cy, r, v, label, lime, at) => {
          const a = easeBack(prog(t, at, 0.4));
          if (a <= 0) return;
          const c = easeOut(prog(t, at, 0.6));
          ctx.save();
          ctx.translate(cx, cy);
          ctx.scale(a, a);
          ctx.beginPath();
          ctx.arc(0, 0, r, 0, Math.PI * 2);
          ctx.fillStyle = lime ? ACCENT : dkFill;
          ctx.fill();
          const ink = lime ? '#111111' : dkText;
          text(ctx, countText(v, c), 0, 32, ANTON(fit(ctx, String(v), ANTON, 140, r * 1.6)), ink, 'center');
          spaced(ctx, 4, () => text(ctx, up(label), 0, 70, BARLOW(36, 700), ink, 'center'));
          ctx.restore();
        };
        const k = easeOut(prog(t, 0.05, 0.4));
        ctx.save();
        ctx.globalAlpha = k;
        text(ctx, title, W / 2, 250, ANTON(fit(ctx, title, ANTON, 112, W - 80)), P.ink, 'center');
        ctx.restore();
        tag(up(T.scorersTag || T.scorers || 'SUS GOLEADORES'), 318, k);
        // La línea del medio, que baja
        const ax = easeOut(prog(t, 0.1, 0.5));
        ctx.fillStyle = ACCENT;
        ctx.fillRect(W / 2 - 3, 360, 6, (both ? 1090 : 660) * ax);
        [['home', -1, true], ['away', 1, false]].forEach(([side, dir, lime], j) => {
          const p = g[side];
          if (!p) return;
          // La cara, pegada a la línea (en papel, sin su fondo blanco; en oscuro, en un círculo); sin
          // cara, su escudo
          const fa = easeOut(prog(t, 0.25 + j * 0.1, 0.4));
          const face = A.scorerFaces?.[side], cx = W / 2 + dir * 145;
          ctx.save();
          ctx.globalAlpha = fa;
          if (face && !d.dark) {
            ctx.globalCompositeOperation = 'multiply';
            ctx.drawImage(face, cx - 140, 405, 280, 280);
          } else if (face) {
            ctx.beginPath();
            ctx.arc(cx, 545, 135, 0, Math.PI * 2);
            ctx.fillStyle = '#e9e6df';
            ctx.fill();
            ctx.clip();
            ctx.drawImage(face, cx - 135, 410, 270, 270);
          } else {
            logo(ctx, side === 'home' ? A.homeLogo : A.awayLogo, cx, 545, 230);
          }
          ctx.restore();
          // Su apellido y su equipo, junto a la línea
          ctx.save();
          ctx.globalAlpha = easeOut(prog(t, BEAT + 0.2 + j * 0.1, 0.4));
          const align = dir < 0 ? 'right' : 'left', nx = W / 2 + dir * 20;
          text(ctx, up(p.last), nx, 865, ANTON(fit(ctx, up(p.last), ANTON, 70, 220)), P.ink, align);
          spaced(ctx, 3, () => text(ctx, up(d[side].short), nx, 910, BARLOW(fit(ctx, up(d[side].short), (z) => BARLOW(z, 700), 33, 220), 700), P.mute, align));
          ctx.restore();
          // Sus goles y sus partidos, a su lado
          const ox = dir < 0 ? 145 : W - 145;
          circle(ox, 545, 145, p.goals, T.goalsWord || 'Goles', lime, BEAT + j * STEP);
          if (p.played) circle(ox, 865, 145, p.played, T.gamesWord || 'Partidos', lime, BEAT + 2 * STEP + j * STEP);
        });
        if (both) {
          tag(up(T.between || 'Entre los dos'), 1083, easeOut(prog(t, BAR - 0.1, 0.35)));
          if (sum.played) {
            circle(W / 2 - 150, 1300, 150, sum.goals, T.goalsWord || 'Goles', true, BAR);
            circle(W / 2 + 150, 1300, 150, sum.played, T.gamesWord || 'Partidos', false, BAR + STEP);
          } else {
            circle(W / 2, 1300, 150, sum.goals, T.goalsWord || 'Goles', true, BAR);
          }
        }
      },
    };
  }

  // ─── ONCES CONFIRMADOS (d.kind === 'onces'): los dos onces en el campo, como en el FIFA ───
  // El campo sale desde arriba y la cámara baja hasta detrás de la portería del local; su once se
  // coloca por filas, una en cada pulso (el portero, la defensa, los medios, la delantera), cada uno
  // con su cara, su dorsal y su apellido. Luego la cámara gira hasta la otra portería y entra el del
  // visitante. Con WebGL, en el estadio en 3D del vídeo del partido; sin él, el campo en 2D.
  // El campo: x a lo ancho, z a lo largo (el local defiende z = -52,5), como en campo3d.js.
  const ONCES_T = {
    intro: 1.2, // la cámara, de arriba a detrás de la portería
    home: { head: 1.0, rows: 1.4, out: 6.2 },
    turn: [6.4, 1.2], // el giro, de una portería a la otra
    away: { head: 7.4, rows: 7.8, out: 12.2 },
  };
  // De la escena 3D a la pantalla, como la cámara de Three.js (fov vertical, en grados): de -1 a 1
  function lookCam(pos, target, fov) {
    const sub = (a, b) => a.map((v, i) => v - b[i]);
    const dotp = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    const nrm = (v) => { const l = Math.hypot(...v) || 1; return v.map(x => x / l); };
    const crs = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
    const f = nrm(sub(target, pos)), r = nrm(crs(f, [0, 1, 0])), u = crs(r, f), th = Math.tan((fov * Math.PI) / 360);
    return { pos, target, fov, ndc: (p) => { const d = sub(p, pos), z = Math.max(0.5, dotp(d, f)); return [dotp(d, r) / z / (th * (W / H)), dotp(d, u) / z / th]; } };
  }
  function sceneOnces(d, A) {
    const world = A.world, TH = theme(d), HL = 52.5, PW = 68;
    const T = ONCES_T;
    // La cámara de detrás de la portería del local (la del visitante, girada media vuelta)
    const HOME = { pos: [-3, 110, -102.5], target: [-3, 0, -20] }, TOP = { pos: [-3, 330, -40], target: [-3, 0, -6] }, FOV = 42;
    const rotY = (v, a) => [v[0] * Math.cos(a) + v[2] * Math.sin(a), v[1], -v[0] * Math.sin(a) + v[2] * Math.cos(a)];
    const lerpV = (p, q, k) => p.map((v, i) => v + (q[i] - v) * k);
    const camAt = (t) => {
      if (t < T.intro) {
        const q = easeInOut(prog(t, 0, T.intro));
        return lookCam(lerpV(TOP.pos, HOME.pos, q), lerpV(TOP.target, HOME.target, q), FOV);
      }
      const q = easeInOut(prog(t, T.turn[0], T.turn[1])), pos = rotY(HOME.pos, Math.PI * q);
      pos[1] += 30 * Math.sin(Math.PI * q);
      return lookCam(pos, rotY(HOME.target, Math.PI * q), FOV);
    };
    // Dónde está cada uno: de su portería (4,5 m el portero) a pasado el medio campo (58 m), y a lo
    // ancho, sin salirse por los lados (los botones de TikTok)
    const spot = (p, side) => {
      const depth = 4.5 + ((p.y - 0.07) / 0.8) * 53.5, wide = (0.5 - p.x) * 56;
      return side === 'home' ? [wide, 0, -HL + depth] : [-wide, 0, HL - depth];
    };
    const sides = [['home', T.home], ['away', T.away]];
    // El campo en 2D (sin WebGL), con la misma cámara
    const pitch2d = (ctx, P) => {
      const path = (pts, close) => { ctx.beginPath(); pts.forEach((p, i) => { const [x, y] = P(p); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); }); if (close) ctx.closePath(); };
      const rect = (x0, z0, x1, z1) => [[x0, 0, z0], [x1, 0, z0], [x1, 0, z1], [x0, 0, z1]];
      path(rect(-PW / 2 - 40, -HL - 40, PW / 2 + 40, HL + 40), true);
      ctx.fillStyle = TH.grass[1];
      ctx.fill();
      for (let i = 0; i < 14; i++) {
        const z0 = -HL + (i * 2 * HL) / 14;
        path(rect(-PW / 2, z0, PW / 2, z0 + (2 * HL) / 14), true);
        ctx.fillStyle = TH.grass[i % 2];
        ctx.fill();
      }
      ctx.strokeStyle = TH.lines;
      ctx.lineWidth = 4;
      ctx.lineJoin = 'round';
      path(rect(-PW / 2, -HL, PW / 2, HL), true); ctx.stroke();
      path([[-PW / 2, 0, 0], [PW / 2, 0, 0]]); ctx.stroke();
      path(Array.from({ length: 49 }, (_, j) => [9.15 * Math.cos((j / 48) * Math.PI * 2), 0, 9.15 * Math.sin((j / 48) * Math.PI * 2)])); ctx.stroke();
      for (const s of [-1, 1]) {
        path([[-20.16, 0, s * HL], [-20.16, 0, s * (HL - 16.5)], [20.16, 0, s * (HL - 16.5)], [20.16, 0, s * HL]]); ctx.stroke();
        path([[-9.16, 0, s * HL], [-9.16, 0, s * (HL - 5.5)], [9.16, 0, s * (HL - 5.5)], [9.16, 0, s * HL]]); ctx.stroke();
        const a0 = Math.acos(5.5 / 9.15);
        path(Array.from({ length: 25 }, (_, j) => { const a = -a0 + (2 * a0 * j) / 24; return [9.15 * Math.sin(a), 0, s * (HL - 11) - s * 9.15 * Math.cos(a)]; })); ctx.stroke();
        ctx.lineWidth = 6;
        ctx.strokeStyle = '#ffffff';
        path([[-3.66, 0, s * HL], [-3.66, 2.44, s * HL], [3.66, 2.44, s * HL], [3.66, 0, s * HL]]); ctx.stroke();
        ctx.lineWidth = 4;
        ctx.strokeStyle = TH.lines;
      }
    };
    // Arriba: «Once confirmado», su escudo, su nombre y su sistema
    const header = (ctx, side, a) => {
      if (a <= 0.01) return;
      const team = d[side];
      ctx.save();
      ctx.globalAlpha = a;
      ctx.translate((1 - a) * -60, 0);
      chip(ctx, d.t?.once || 'Once confirmado', 0, 0, { acc: ACCENT, on: '#111111' }, 44);
      logo(ctx, side === 'home' ? A.homeLogo : A.awayLogo, 75, 196, 150);
      text(ctx, up(team.short), 172, 238, ANTON(fit(ctx, up(team.short), ANTON, 118, 660)), '#ffffff');
      const meta = up([team.formation, d.compName, d.when && d.hhmm && `${d.when} ${d.hhmm}`].filter(Boolean).join(' · '));
      text(ctx, meta, 175, 300, BARLOW(fit(ctx, meta, (z) => BARLOW(z, 700), 46, 700), 700), 'rgba(255,255,255,.78)');
      ctx.restore();
    };
    return {
      id: 'onces',
      dur: 8 * BAR,
      accent: ACCENT,
      camera: false,
      music: { energy: 'full' },
      cues: [
        { t: 0, kind: 'riser', dur: T.intro, vel: 0.6 },
        ...sides.flatMap(([, b]) => [0, 1, 2, 3, 4].map(r => ({ t: b.rows + r * BEAT, kind: 'hit', vel: r ? 0.7 : 0.9 }))),
        { t: T.turn[0], kind: 'riser', dur: T.turn[1], vel: 0.5 },
      ],
      draw(ctx, t) {
        const cam = camAt(t);
        const [bx, by, bw, bh] = bleed(ctx, 0, 0, W, H);
        let ndc = cam.ndc;
        if (world) {
          world.frame({ cam: { pos: cam.pos, target: cam.target, fov: cam.fov }, roofs: false, focus: { at: [cam.target[0], 0, cam.target[2]], size: 70 } });
          fillAll(ctx, TH.ground);
          ctx.drawImage(world.canvas, bx, by, bw, bh);
          ndc = (p) => world.project(p);
        }
        const P = (p) => { const [nx, ny] = ndc(p); return [bx + (nx * 0.5 + 0.5) * bw, by + (0.5 - ny * 0.5) * bh]; };
        if (!world) {
          fillAll(ctx, d.dark ? '#07090d' : '#0b1a12');
          ctx.save();
          ctx.globalAlpha = easeOut(prog(t, 0, 0.5));
          pitch2d(ctx, P);
          ctx.restore();
        }
        // Arriba más oscuro (ahí va el nombre del equipo) y los bordes, en sombra
        const g = ctx.createLinearGradient(0, by, 0, 560);
        g.addColorStop(0, 'rgba(7,9,13,.92)'); g.addColorStop(0.6, 'rgba(7,9,13,.65)'); g.addColorStop(1, 'rgba(7,9,13,0)');
        ctx.fillStyle = g;
        ctx.fillRect(bx, by, bw, 560 - by);
        // Los dos onces: cada fila en su pulso, de izquierda a derecha, y se van antes del giro
        for (const [side, b] of sides) {
          const st = d[side].style;
          const items = (d.lineups?.[side] || []).map(p => {
            const start = b.rows + p.row * BEAT + p.col * 0.06;
            const out = 1 - easeInOut(prog(t, b.out + (4 - p.row) * 0.03, 0.3));
            const w = spot(p, side);
            return { p, w, k: easeBack(prog(t, start, 0.35)) * out, drop: 1 - easeOut(prog(t, start, 0.3)), name: Math.min(easeOut(prog(t, start + 0.18, 0.25)), out), at: P(w) };
          }).filter(it => it.k > 0.01).sort((a, c) => a.at[1] - c.at[1]);
          for (const it of items) {
            const [sx, sy] = it.at, ppm = Math.abs(P([it.w[0] + 1, 0, it.w[2]])[0] - sx);
            const r = Math.max(66, Math.min(115, ppm * 3.1));
            ctx.save();
            ctx.globalAlpha = 0.45 * clamp01(it.k);
            ctx.fillStyle = '#000000';
            ctx.beginPath();
            ctx.ellipse(sx, sy, r * 0.75 * clamp01(it.k), r * 0.22 * clamp01(it.k), 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
            ctx.save();
            ctx.globalAlpha = clamp01(it.k * 1.4);
            const cy = sy - r * 0.98 - it.drop * 110;
            ctx.translate(sx, cy);
            ctx.scale(it.k, it.k);
            playerChip(ctx, A, it.p, st, 0, 0, r, { number: true });
            ctx.restore();
            if (it.name > 0.01) {
              ctx.save();
              ctx.globalAlpha = it.name;
              ctx.translate(0, (1 - it.name) * 16);
              const size = Math.max(32, r * 0.42), name = up(it.p.last || '');
              ctx.font = BARLOW(size, 800);
              const nw = ctx.measureText(name).width + size * 0.7, ny = cy + r + size * 0.2;
              ctx.fillStyle = 'rgba(6,8,11,.88)';
              roundRect(ctx, sx - nw / 2, ny, nw, size * 1.3, size * 0.3);
              ctx.fill();
              text(ctx, name, sx, ny + size * 1.02, BARLOW(size, 800), '#ffffff', 'center');
              ctx.restore();
            }
          }
          header(ctx, side, Math.min(easeOut(prog(t, b.head, 0.35)), 1 - prog(t, b.out, 0.3)));
        }
        // Al empezar, sobre el campo visto desde arriba: «ONCES CONFIRMADOS»
        const a = Math.min(easeOut(prog(t, 0.05, 0.3)), 1 - prog(t, 0.95, 0.25));
        if (a > 0.01) {
          const [l1, l2] = (d.t?.title || ['Onces', 'confirmados']).map(up);
          const k = 0.9 + 0.1 * easeBack(prog(t, 0.05, 0.35));
          ctx.save();
          ctx.globalAlpha = a;
          ctx.translate(W / 2, 870);
          ctx.scale(k, k);
          text(ctx, l1, 0, -50, ANTON(192), '#ffffff', 'center');
          ctx.font = ANTON(144);
          const w2 = ctx.measureText(l2).width;
          ctx.fillStyle = ACCENT;
          ctx.fillRect(-w2 / 2 - 28, 0, w2 + 56, 170);
          text(ctx, l2, 0, 145, ANTON(144), '#111111', 'center');
          ctx.restore();
        }
      },
    };
  }

  // intro: con la apertura de los escudos (se quita en el Studio).
  function buildScenes(d, A, intro = true) {
    if (d.kind === 'onces') return [sceneOnces(d, A), sceneOutro(d, A), d.brand && sceneMarca(d, A)].filter(Boolean);
    if (d.kind === 'previa') {
      return [
        scenePrevPortada(d, A),
        d.forma && (d.forma.home.length || d.forma.away.length) && scenePrevForma(d, A),
        d.h2h?.games.length && scenePrevH2H(d, A),
        d.goleadores && (d.goleadores.home || d.goleadores.away) && scenePrevGoles(d, A),
        d.table?.rows.length && sceneTable(d, A),
        sceneOutro(d, A),
        d.brand && sceneMarca(d, A),
      ].filter(Boolean);
    }
    const beats = d.goals?.some(e => e.kind === 'goal' || e.kind === 'red' || e.kind === 'pen');
    const match = d.shots?.list.length >= 4;
    const scenes = [
      intro && sceneNotice(d, A),
      sceneScore(d, A, intro),
      !match && d.polemica && scenePolemica(d, A),
      // El partido en una pieza (con el sitio de los tiros); si ESPN no lo da, los goles uno a uno
      // y el pulso aparte
      match && sceneMatch(d, A),
      !match && beats && sceneGoals(d, A),
      !match && d.pulse && scenePulso(d, A),
      d.jugador && sceneJugador(d, A),
      // La posesión y el resto: con el partido en una pieza, en su escena (como al acabarlo); si no,
      // las estadísticas si no hay pulso (que ya lleva la posesión) o en la versión larga
      match && d.stats?.find(r => r.pct) ? scenePosesion(d, A) : (!match && !d.pulse || d.long) && d.stats?.length >= 3 && sceneStats(d, A),
      // La versión larga: también el resto de estadísticas
      d.long && d.stats?.length >= 3 && d.statsMore?.length >= 2 && sceneStats(d, A, d.statsMore.slice(0, 5), 'stats2'),
      // La tabla y el dato (y, en la versión larga, cómo llegaban y el cara a cara)
      d.table?.rows.length && sceneTable(d, A),
      d.dato && sceneDato(d, A),
      d.long && d.forma && (d.forma.home.length || d.forma.away.length) && scenePrevForma(d, A),
      d.long && d.h2h?.games.length && scenePrevH2H(d, A),
      sceneOutro(d, A),
      d.brand && sceneMarca(d, A),
    ].filter(Boolean);
    return d.long ? stretchScenes(scenes) : scenes;
  }

  // VERSIÓN LARGA · TikTok paga los vídeos de más de un minuto: si con sus escenas no llega, cada
  // una se queda más en pantalla (compases enteros, para que la música siga cuadrando), primero
  // las de más que leer. La animación va a su ritmo y luego se queda quieta, con la cámara
  // acercándose; el paso a la siguiente, igual que siempre.
  const LONG_MIN = 62;
  const LONG_FIRST = ['goals', 'pulso', 'tabla', 'h2h', 'forma', 'polemica', 'stats', 'stats2', 'jugador', 'tiros', 'dato', 'score'];
  function stretchScenes(scenes) {
    let need = Math.ceil((LONG_MIN - scenes.reduce((sum, sc) => sum + sc.dur, 0)) / BAR);
    const order = LONG_FIRST.map(id => scenes.findIndex(sc => sc.id === id)).filter(i => i >= 0);
    if (need <= 0 || !order.length) return scenes;
    const extra = scenes.map(() => 0);
    for (let k = 0; need > 0; k++, need--) extra[order[k % order.length]] += BAR;
    return scenes.map((sc, i) => (extra[i] ? grow(sc, extra[i]) : sc));
  }
  // Una escena que se queda más en pantalla: su animación va a su ritmo y luego se queda quieta
  // (la cámara se sigue acercando); el paso a la siguiente, igual que siempre.
  function hold(sc, extra) {
    const end = sc.dur;
    return { ...sc, dur: end + extra, draw: (ctx, t) => sc.draw(ctx, t < end ? t : t < end + extra ? end : t - extra) };
  }
  // Más tiempo para una escena: la que sabe repartir su animación (stretch) la reparte; las
  // demás se quedan quietas al final.
  const grow = (sc, extra) => (sc.stretch ? sc.stretch(sc.dur + extra) : hold(sc, extra));
  // Lo que dura la apertura (para colocar la voz si se grabó con ella o sin ella).
  const leadOf = (scenes) => (scenes[0]?.id === 'intro' ? scenes[0].dur : 0);

  const sceneStarts = (scenes) => {
    let total = 0;
    return scenes.map(s => { const at = total; total += s.dur; return at; });
  };

  // ============================================================
  // GUION Y SUBTÍTULOS · una frase por escena. Cada palabra tiene su momento: los subtítulos
  // resaltan la que suena y, al grabarte, lees al mismo ritmo, así la voz y el texto van juntos.
  // ============================================================
  const SPEAK_FROM = 0.15;
  const STRETCH_ROOM = 1.5;
  const SPEAK_END = 0.3;
  // Lo que se tarda en decir una palabra, a ritmo de short (unas 170 por minuto): más cuanto
  // más larga, las cifras mucho más y una pausa corta tras un punto o una coma.
  const sayTime = (w) => 0.1 + 0.05 * (w.match(/\p{L}/gu) || []).length + 0.17 * (w.match(/\d/g) || []).length
    + (/[.,:;!?…]$/.test(w) ? 0.15 : 0);

  // clips: la voz de cada escena (la del robot). Con los tiempos de cada palabra, los suyos; si
  // no, repartidas por lo que dura la frase.
  function captionWords(scenes, starts, script, clips = null) {
    const words = [];
    scenes.forEach((sc, i) => {
      const tokens = String(script?.[sc.id] || '').trim().split(/\s+/).filter(Boolean);
      if (!tokens.length || sc.noScript) return;
      const clip = clips?.[sc.id];
      if (clip?.times?.length === tokens.length) {
        const t0 = starts[i] + SPEAK_FROM;
        tokens.forEach((w, j) => words.push({ text: w, start: t0 + clip.times[j][0], end: t0 + clip.times[j][1], scene: i }));
        return;
      }
      const room = clip ? clip.buffer.duration : sc.dur - SPEAK_FROM - SPEAK_END;
      const need = tokens.reduce((sum, w) => sum + sayTime(w), 0);
      const k = clip ? room / need : Math.min(1, room / need);
      let t = starts[i] + SPEAK_FROM;
      for (const w of tokens) {
        const dd = sayTime(w) * k;
        words.push({ text: w, start: t, end: t + dd, scene: i });
        t += dd;
      }
    });
    return words;
  }

  function scriptFit(scenes, script) {
    return scenes.filter(sc => !sc.noScript).map((sc) => {
      const tokens = String(script?.[sc.id] || '').trim().split(/\s+/).filter(Boolean);
      const need = tokens.reduce((sum, w) => sum + sayTime(w), 0);
      // Las que reparten su animación (stretch) se alargan con la voz: caben frases más largas
      const room = (sc.room ?? (sc.stretch ? STRETCH_ROOM : 1) * sc.dur) - SPEAK_FROM - SPEAK_END;
      return { id: sc.id, dur: sc.dur, words: tokens.length, speed: need / room };
    });
  }

  // Subtítulos de creador: mayúsculas gruesas con borde negro, de dos o tres palabras, y la
  // que suena sobre un recuadro verde lima que salta. Debajo de lo que se ve (la tabla y el minuto
  // a minuto acaban hacia 1490) y por encima del nombre y la descripción de TikTok, que tapan la
  // parte de abajo de la pantalla.
  const CAP_FONT = (size) => `900 ${size}px Montserrat, "Arial Black", sans-serif`;
  const CAP_Y = 1560;
  const CAP_SIZE = 84;
  const CAP_MAX_W = W - 2 * M - 40;
  const capUp = (w) => up(w).replace(/[,;:]$/, '');
  // Las palabras que no cierran un trozo («LA GOLEADA Y» → «LA GOLEADA» · «Y BUENO MAQUILLÓ»)
  const WEAK = new Set(['y', 'e', 'o', 'ni', 'el', 'la', 'los', 'las', 'un', 'una', 'de', 'del', 'a', 'al', 'en', 'con', 'por',
    'para', 'que', 'su', 'sus', 'le', 'lo', 'se', 'sin', 'the', 'an', 'and', 'of', 'to', 'in', 'on', 'for', 'with', 'at', 'by']);
  function captionPages(words) {
    const measure = document.createElement('canvas').getContext('2d');
    const widthOf = (ws, size) => {
      measure.font = CAP_FONT(size);
      return ws.reduce((sum, w) => sum + measure.measureText(capUp(w.text)).width, 0) + (ws.length - 1) * size * 0.32;
    };
    const pages = [];
    let cur = null;
    for (const w of words) {
      const last = cur?.words[cur.words.length - 1];
      if (!cur || cur.scene !== w.scene || cur.words.length >= 3 || /[.,:;!?…]$/.test(last.text)
        || widthOf([...cur.words, w], CAP_SIZE) > CAP_MAX_W) {
        // Si el trozo acaba en «y», «el», «de»…, esa palabra pasa al siguiente
        const carry = cur && cur.scene === w.scene && cur.words.length > 1 && WEAK.has(last.text.toLowerCase()) ? [cur.words.pop()] : [];
        cur = { scene: w.scene, words: carry };
        pages.push(cur);
      }
      cur.words.push(w);
    }
    pages.forEach((pg, i) => {
      const next = pages[i + 1];
      pg.start = pg.words[0].start;
      pg.end = next && next.scene === pg.scene ? next.words[0].start : pg.words[pg.words.length - 1].end + 0.35;
      pg.size = Math.min(CAP_SIZE, Math.floor((CAP_SIZE * CAP_MAX_W) / widthOf(pg.words, CAP_SIZE)));
    });
    return pages;
  }

  function drawCaptions(ctx, pages, T) {
    const pg = pages.find(p => T >= p.start && T < p.end);
    if (!pg) return;
    const size = pg.size;
    const gap = size * 0.32;
    ctx.save();
    ctx.font = CAP_FONT(size);
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
    const labels = pg.words.map(w => capUp(w.text));
    const widths = labels.map(l => ctx.measureText(l).width);
    const total = widths.reduce((a, b) => a + b, 0) + gap * (labels.length - 1);
    const cap = ctx.measureText('H').actualBoundingBoxAscent;
    const base = CAP_Y + cap / 2;
    const k = 0.86 + 0.14 * easeBack(prog(T, pg.start, 0.14));
    ctx.translate(W / 2, CAP_Y);
    ctx.scale(k, k);
    ctx.translate(-W / 2, -CAP_Y);
    let active = -1;
    pg.words.forEach((w, i) => { if (T >= w.start) active = i; });
    let x = (W - total) / 2;
    labels.forEach((label, i) => {
      const w = widths[i];
      if (i === active) {
        const pop = 0.9 + 0.1 * easeBack(prog(T, pg.words[i].start, 0.12));
        const padX = size * 0.2, padY = size * 0.2;
        ctx.save();
        ctx.translate(x + w / 2, CAP_Y);
        ctx.scale(pop, pop);
        ctx.shadowColor = 'rgba(0,0,0,.45)';
        ctx.shadowBlur = 24;
        ctx.shadowOffsetY = 8;
        ctx.fillStyle = ACCENT;
        roundRect(ctx, -w / 2 - padX, -cap / 2 - padY, w + 2 * padX, cap + 2 * padY, size * 0.16);
        ctx.fill();
        ctx.shadowColor = 'transparent';
        ctx.fillStyle = '#111111';
        ctx.fillText(label, -w / 2, cap / 2);
        ctx.restore();
      } else {
        ctx.lineJoin = 'round';
        ctx.lineWidth = size * 0.2;
        ctx.strokeStyle = '#000000';
        ctx.shadowColor = 'rgba(0,0,0,.55)';
        ctx.shadowBlur = 18;
        ctx.shadowOffsetY = 6;
        ctx.strokeText(label, x, base);
        ctx.shadowColor = 'transparent';
        ctx.fillStyle = '#ffffff';
        ctx.fillText(label, x, base);
      }
      x += w + gap;
    });
    ctx.restore();
  }

  // ============================================================
  // MONTAJE · las escenas seguidas, con una cortinilla en diagonal entre una y otra
  // ============================================================
  // Tu logo en una esquina (arriba a la derecha), en todas las escenas menos la apertura y el
  // cierre, que lo lleva en grande.
  function drawBrand(ctx, img) {
    const k = Math.min(200 / img.naturalWidth, 84 / img.naturalHeight);
    const w = img.naturalWidth * k, h = img.naturalHeight * k;
    ctx.save();
    ctx.globalAlpha = 0.92;
    ctx.shadowColor = 'rgba(0,0,0,.35)';
    ctx.shadowBlur = 12;
    ctx.drawImage(img, W - M - w, 56, w, h);
    ctx.restore();
  }

  // La cámara de cada escena, para que nada se quede quieto: se acerca despacio (un 4,5 % en toda
  // la escena) y da un pequeño golpe con cada «slam» (el marcador, un gol, el dato, la nota…).
  // La apertura y el logo llevan sus golpes; el minuto a minuto, su propia cámara (camera: false).
  const kick = (x) => (x < 0 || x > 0.35 ? 0 : Math.sin(Math.PI * x / 0.35) * (1 - x / 0.35) * 1.6);
  function drawScene(ctx, sc, t) {
    inSafe(ctx, () => {
      if (sc.camera !== false && sc.id !== 'intro' && sc.id !== 'marca') {
        const push = 1 + 0.045 * clamp01(t / sc.dur); // a ritmo constante: que no se pare al final
        const hit = (sc.cues || []).reduce((m, c) => (c.kind === 'slam' ? Math.max(m, kick(t - c.t)) : m), 0);
        const z = push * (1 + 0.03 * hit);
        ctx.translate(W / 2, H / 2);
        ctx.scale(z, z);
        ctx.translate(-W / 2, -H / 2);
      }
      sc.draw(ctx, t);
    });
  }

  // LAS TRANSICIONES · cada escena dice cómo entra (enter.kind); si no, la cortinilla en
  // diagonal de siempre. Todas duran lo mismo (TRANSITION, un pulso) para que la música cuadre.
  //  · split: los colores de los dos equipos entran por los lados, chocan en una frontera curva y
  //    se abren con la escena nueva detrás.
  //  · blinds: una persiana de barras de distinto grosor que bajan cada una a su tiempo.
  //  · circles: círculos de colores que se abren desde un punto (enter.at) y dejan la escena nueva
  //    dentro del último.
  const BLINDS = [[0.06, 0.1], [0.11, 0.24], [0.05, 0.05], [0.14, 0.3], [0.08, 0.15], [0.12, 0.0], [0.07, 0.2], [0.13, 0.12], [0.09, 0.28], [0.15, 0.08]];
  function transition(ctx, a, b, t) {
    const u = t / TRANSITION, e = easeInOut(u);
    const kind = b.enter?.kind;
    // Sin transición: la escena de antes ya ha dejado todo donde empieza la nueva
    if (kind === 'cut') { drawScene(ctx, b, t); return; }
    drawScene(ctx, a, a.dur + t);
    if (kind === 'blinds') {
      ctx.save();
      ctx.beginPath();
      let x = 0;
      for (const [w, delay] of BLINDS) {
        const h = H * easeInOut(clamp01((u - delay) / 0.7));
        ctx.rect(x, 0, w * W + 1, h);
        x += w * W;
      }
      ctx.clip();
      drawScene(ctx, b, t);
      ctx.restore();
      // El borde de cada barra, en el acento
      let x2 = 0;
      ctx.fillStyle = b.accent;
      for (const [w, delay] of BLINDS) {
        const q = clamp01((u - delay) / 0.7);
        if (q > 0 && q < 1) ctx.fillRect(x2, H * easeInOut(q) - 14, w * W + 1, 14);
        x2 += w * W;
      }
      return;
    }
    if (kind === 'split') {
      const [c1, c2] = b.enter.colors;
      // Hasta la mitad se cierran sobre la escena de antes; luego se abren con la nueva detrás
      const close = u < 0.5 ? easeOut(u * 2) : 1 - easeInOut((u - 0.5) * 2);
      if (u >= 0.5) drawScene(ctx, b, t);
      const bow = 120 * Math.sin(Math.PI * u);
      const half = (W / 2) * close;
      ctx.fillStyle = c1;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(half, 0); ctx.quadraticCurveTo(half + bow, H / 2, half, H); ctx.lineTo(0, H); ctx.closePath(); ctx.fill();
      ctx.fillStyle = c2;
      ctx.beginPath(); ctx.moveTo(W, 0); ctx.lineTo(W - half, 0); ctx.quadraticCurveTo(W - half + bow, H / 2, W - half, H); ctx.lineTo(W, H); ctx.closePath(); ctx.fill();
      return;
    }
    if (kind === 'circles') {
      const [cx, cy] = b.enter.at || [W / 2, H * 0.55];
      const cols = b.enter.colors || [ACCENT, INK_BG, '#ffffff'];
      const R = Math.hypot(Math.max(cx, W - cx), Math.max(cy, H - cy)) * 1.05;
      const ring = (k) => R * easeInOut(clamp01((u - k * 0.13) / (1 - cols.length * 0.13)));
      cols.forEach((c, k) => {
        const r = ring(k);
        if (r <= 0) return;
        ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fillStyle = c;
        ctx.fill();
      });
      const r = ring(cols.length);
      if (r > 0) {
        ctx.save();
        ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.clip();
        drawScene(ctx, b, t);
        ctx.restore();
      }
      return;
    }
    const SL = 320;
    const edge = H + SL - e * (H + 2 * SL);
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(0, H); ctx.lineTo(W, H); ctx.lineTo(W, edge - SL); ctx.lineTo(0, edge);
    ctx.closePath();
    ctx.clip();
    drawScene(ctx, b, t);
    ctx.restore();
    ctx.beginPath();
    ctx.moveTo(0, edge); ctx.lineTo(W, edge - SL); ctx.lineTo(W, edge - SL - 28); ctx.lineTo(0, edge - 28);
    ctx.closePath();
    ctx.fillStyle = b.accent;
    ctx.fill();
  }

  // Sin grano: en el vídeo solo ensucia (TikTok lo recomprime y se ve borroso).
  function makeDrawer(scenes, captions = null, brandImg = null) {
    const starts = sceneStarts(scenes);
    const total = scenes.reduce((sum, s) => sum + s.dur, 0);
    return {
      duration: total,
      scenes,
      starts,
      draw(ctx, T) {
        let i = scenes.length - 1;
        while (i > 0 && T < starts[i]) i--;
        const t = T - starts[i];
        ctx.save();
        if (i > 0 && t < TRANSITION) {
          transition(ctx, scenes[i - 1], scenes[i], t);
        } else {
          drawScene(ctx, scenes[i], t);
        }
        ctx.restore();
        inSafe(ctx, () => {
          // El marcador fijo de arriba (lleva tu logo); sin él, tu logo en la esquina
          if (scenes[i].overlay) scenes[i].overlay(ctx, t);
          else if (brandImg && !['intro', 'outro', 'marca'].includes(scenes[i].id)) drawBrand(ctx, brandImg);
          if (captions) drawCaptions(ctx, captions, T);
        });
      },
    };
  }

  // ─── Fuentes e imágenes ───
  // Las caras de API-Football miden 150 px: ampliadas a lo bruto se ven borrosas. Se amplían
  // en dos pasos con el mejor suavizado y se les da un enfoque (máscara de enfoque) suave.
  function crisp(img, size, amount = 0.7) {
    if (!img) return null;
    // Ya grande (la del retrato de la slide, que ya pasó por aquí) o una de 1 px: tal cual
    const nw = img.naturalWidth || img.width;
    if (nw >= size * 0.9 || nw < 32) return img;
    try {
      let src = img, w = nw;
      while (w * 2 < size) {
        const c = document.createElement('canvas');
        c.width = c.height = w * 2;
        const g = c.getContext('2d');
        g.imageSmoothingQuality = 'high';
        g.drawImage(src, 0, 0, w * 2, w * 2);
        src = c; w *= 2;
      }
      const out = document.createElement('canvas');
      out.width = out.height = size;
      const g = out.getContext('2d');
      g.imageSmoothingQuality = 'high';
      g.drawImage(src, 0, 0, size, size);
      const im = g.getImageData(0, 0, size, size);
      const a = im.data, blur = new Float32Array(a.length);
      // Desenfoque 3×3 (dos pasadas de caja) y, a cada píxel, su diferencia con él.
      const box = (from, to) => {
        for (let y = 0; y < size; y++) {
          for (let x = 0; x < size; x++) {
            for (let ch = 0; ch < 3; ch++) {
              let sum = 0, n = 0;
              for (let dy = -1; dy <= 1; dy++) {
                const yy = y + dy;
                if (yy < 0 || yy >= size) continue;
                for (let dx = -1; dx <= 1; dx++) {
                  const xx = x + dx;
                  if (xx < 0 || xx >= size) continue;
                  sum += from[(yy * size + xx) * 4 + ch]; n++;
                }
              }
              to[(y * size + x) * 4 + ch] = sum / n;
            }
          }
        }
      };
      const tmp = new Float32Array(a.length);
      box(a, tmp);
      box(tmp, blur);
      for (let i = 0; i < a.length; i += 4) {
        for (let ch = 0; ch < 3; ch++) a[i + ch] = Math.max(0, Math.min(255, a[i + ch] + amount * (a[i + ch] - blur[i + ch])));
      }
      g.putImageData(im, 0, 0);
      return out;
    } catch (e) {
      return img; // una imagen sin permiso (CORS) para leerla: tal cual
    }
  }

  async function loadImage(srcs) {
    for (const src of [].concat(srcs).filter(Boolean)) {
      try {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = src;
        await Promise.race([img.decode(), new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 10000))]);
        return img;
      } catch (e) { /* la siguiente */ }
    }
    return null;
  }

  // Las caras de los jugadores que salen en el vídeo (los onces, los goles, las tarjetas y los
  // cambios), ampliadas con cuidado; la silueta gris de API-Football (quien no tiene foto), fuera
  function isSilhouette(img) {
    try {
      const c = document.createElement('canvas');
      c.width = c.height = 24;
      const g = c.getContext('2d', { willReadFrequently: true });
      g.drawImage(img, 0, 0, 24, 24);
      const corner = g.getImageData(0, 0, 1, 1).data, mid = g.getImageData(12, 12, 1, 1).data;
      const grey = Math.abs(mid[0] - mid[1]) < 10 && Math.abs(mid[1] - mid[2]) < 10 && mid[0] >= 110 && mid[0] <= 180;
      return (img.naturalWidth || img.width) >= 100 && corner[3] < 16 && grey;
    } catch (e) {
      return false;
    }
  }
  async function loadFaces(d) {
    const ids = new Set();
    for (const side of ['home', 'away']) for (const p of d.lineups?.[side] || []) { ids.add(p.id); if (p.on) ids.add(p.on.id); }
    for (const e of d.goals || []) { if (e.pid) ids.add(e.pid); if (e.pid2) ids.add(e.pid2); }
    const list = [...ids].filter(id => d.people?.[id]?.face);
    const imgs = await Promise.all(list.map(id => loadImage(d.people[id].face)));
    const faces = {};
    list.forEach((id, i) => { if (imgs[i] && !isSilhouette(imgs[i])) faces[id] = crisp(imgs[i], 160, 0.5); });
    return faces;
  }

  // Las caras de los que más marcan (la previa), ampliadas con cuidado
  async function scorerFaces(d) {
    const out = {};
    await Promise.all(['home', 'away'].map(async (side) => {
      const url = d.goleadores?.[side]?.face;
      const img = url ? await loadImage(url) : null;
      if (img && !isSilhouette(img)) out[side] = crisp(img, 280, 0.5);
    }));
    return out;
  }

  async function loadAssets(d) {
    await Promise.all([
      document.fonts.load('100px Anton'),
      document.fonts.load('800 50px "Barlow Condensed"'),
      document.fonts.load('700 50px "Barlow Condensed"'),
      document.fonts.load('600 50px "Barlow Condensed"'),
      document.fonts.load('500 50px "Barlow Condensed"'),
      document.fonts.load('900 84px Montserrat'),
      ...(d.kind === 'previa' ? [document.fonts.load('italic 800 54px Saira'), document.fonts.load('800 100px Barlow'), document.fonts.load('700 100px Barlow')] : []),
    ]);
    const [homeLogo, awayLogo, jugadorPhoto, jugadorFace, jugadorLogo, closingPhoto, brandImg, ...tableLogos] = await Promise.all([
      loadImage(d.home.logo), loadImage(d.away.logo), loadImage(d.jugador?.photo), loadImage(d.jugador?.face), loadImage(d.jugador?.logo),
      loadImage(d.closing.photo), loadImage(d.brand),
      ...(d.table?.rows || []).map(r => loadImage(r?.logo)),
    ]);
    const closingLogo = d.closing.side === 'away' ? awayLogo : homeLogo;
    return { homeLogo, awayLogo, jugadorPhoto, jugadorFace: crisp(jugadorFace, 2 * FACE_R), jugadorLogo, closingPhoto, closingLogo, brandImg, tableLogos, faces: d.kind === 'previa' ? {} : await loadFaces(d), scorerFaces: d.kind === 'previa' ? await scorerFaces(d) : {}, world: await world3d(d, homeLogo, awayLogo) };
  }
  // El campo en 3D de la escena del partido (campo3d.js): si el navegador tiene WebGL y Three.js
  // carga en unos segundos; si no, null y la escena va en 2D. Las líneas, del color que se lea
  // sobre el campo de cada equipo.
  async function world3d(d, homeLogo, awayLogo) {
    if (!((d.kind === 'onces' || (d.kind !== 'previa' && d.shots?.list.length >= 4)) && window.Campo3D)) return null;
    const ink = (bg) => (contrastWith(bg, '#ffffff') >= 2.2 ? '#ffffff' : '#2b2b2b');
    const made = window.Campo3D.create({
      W, H, grass: theme(d).grass, accent: ACCENT, dark: !!d.dark,
      home: { bg: d.home.style.bg, acc: d.home.style.acc, line: ink(d.home.style.bg) }, away: { bg: d.away.style.bg, acc: d.away.style.acc, line: ink(d.away.style.bg) },
      cover: { home: { n: d.home.score, fg: d.home.style.fg, logo: homeLogo }, away: { n: d.away.score, fg: d.away.style.fg, logo: awayLogo } },
    });
    const world = await Promise.race([made, new Promise(r => setTimeout(() => r(null), 12000))]).catch(() => null);
    if (!world) made.then(w => w?.dispose()).catch(() => {});
    return world;
  }

  // ============================================================
  // CODIFICACIÓN
  // ============================================================
  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = () => reject(new Error('no se pudo cargar el codificador de vídeo'));
      document.head.appendChild(s);
    });
  }

  async function pickCodec() {
    if (typeof VideoEncoder === 'undefined' || typeof VideoFrame === 'undefined') return null;
    const candidates = [
      { codec: 'avc1.640028', muxer: 'avc' },
      { codec: 'avc1.4d0028', muxer: 'avc' },
      { codec: 'avc1.42e028', muxer: 'avc' },
      { codec: 'vp09.00.40.08', muxer: 'vp9' },
    ];
    for (const c of candidates) {
      const config = { codec: c.codec, width: W, height: H, bitrate: 12_000_000, framerate: FPS };
      try {
        if ((await VideoEncoder.isConfigSupported(config)).supported) return { ...c, config };
      } catch (e) { /* el siguiente */ }
    }
    return null;
  }

  async function pickAudioCodec(rate) {
    if (typeof AudioEncoder === 'undefined' || typeof AudioData === 'undefined') return null;
    const candidates = [
      { codec: 'mp4a.40.2', muxer: 'aac' },
      { codec: 'opus', muxer: 'opus' },
    ];
    for (const c of candidates) {
      const config = { codec: c.codec, sampleRate: rate, numberOfChannels: 2, bitrate: 192_000 };
      try {
        if ((await AudioEncoder.isConfigSupported(config)).supported) return { ...c, config };
      } catch (e) { /* el siguiente */ }
    }
    return null;
  }

  // Lo que suena y cuándo, para audio.js: la energía de cada escena, sus efectos y un barrido
  // en cada cortinilla.
  function soundTimeline(drawer, seed, style) {
    const cues = [];
    drawer.scenes.forEach((sc, i) => {
      const start = drawer.starts[i];
      if (i > 0) cues.push({ t: start - 0.15, kind: 'whoosh', dur: 0.55, vel: 0.8 });
      (sc.cues || []).forEach(c => cues.push({ ...c, t: start + c.t }));
    });
    cues.sort((a, b) => a.t - b.t);
    return {
      duration: drawer.duration,
      seed,
      style,
      cues,
      scenes: drawer.scenes.map((sc, i) => ({ id: sc.id, start: drawer.starts[i], dur: sc.dur, energy: sc.music?.energy || 'full', drop: sc.music?.drop })),
    };
  }

  // La configuración de AAC (AudioSpecificConfig, ISO 14496-3): AAC-LC, la frecuencia y los
  // canales, en 2 bytes (48 kHz estéreo: 11 90).
  function aacConfig(rate, channels) {
    const index = [96000, 88200, 64000, 48000, 44100, 32000, 24000, 22050, 16000, 12000, 11025, 8000, 7350].indexOf(rate);
    const bits = (2 << 11) | (Math.max(0, index) << 7) | (channels << 3);
    return new Uint8Array([bits >> 8, bits & 255]);
  }

  async function encodeAudio(buffer, acodec, muxer, duration) {
    let failure = null;
    const rate = buffer.sampleRate;
    // Safari da para el AAC una descripción que no es la AudioSpecificConfig (WebKit 302253) y,
    // con ella, el MP4 sale con el sonido mudo. Se pone siempre la buena, que es la misma que da
    // Chrome.
    const fix = (meta) => (acodec.muxer === 'aac' && meta?.decoderConfig
      ? { ...meta, decoderConfig: { ...meta.decoderConfig, codec: 'mp4a.40.2', sampleRate: rate, numberOfChannels: 2, description: aacConfig(rate, 2) } }
      : meta);
    const enc = new AudioEncoder({
      output: (chunk, meta) => muxer.addAudioChunk(chunk, fix(meta)),
      error: (e) => { failure = e; },
    });
    enc.configure(acodec.config);
    const total = Math.min(buffer.length, Math.round(duration * rate));
    const L = buffer.getChannelData(0), R = buffer.getChannelData(1);
    const N = rate / 10;
    for (let i = 0; i < total; i += N) {
      if (failure) throw failure;
      const n = Math.min(N, total - i);
      const planar = new Float32Array(n * 2);
      planar.set(L.subarray(i, i + n), 0);
      planar.set(R.subarray(i, i + n), n);
      const data = new AudioData({
        format: 'f32-planar', sampleRate: rate, numberOfFrames: n, numberOfChannels: 2,
        timestamp: Math.round((i / rate) * 1e6), data: planar,
      });
      enc.encode(data);
      data.close();
    }
    await enc.flush();
    enc.close();
    if (failure) throw failure;
  }

  async function encodeWebCodecs(drawer, codec, onProgress, audio) {
    if (!window.Mp4Muxer) await loadScript(MP4_MUXER_URL);
    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');
    const muxer = new Mp4Muxer.Muxer({
      target: new Mp4Muxer.ArrayBufferTarget(),
      video: { codec: codec.muxer, width: W, height: H, frameRate: FPS },
      ...(audio ? { audio: { codec: audio.codec.muxer, numberOfChannels: 2, sampleRate: audio.buffer.sampleRate } } : {}),
      fastStart: 'in-memory',
    });
    if (audio) await encodeAudio(audio.buffer, audio.codec, muxer, drawer.duration);
    let failure = null;
    const encoder = new VideoEncoder({
      output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
      error: (e) => { failure = e; },
    });
    encoder.configure(codec.config);
    const frames = Math.round(drawer.duration * FPS);
    for (let i = 0; i < frames; i++) {
      if (failure) throw failure;
      drawer.draw(ctx, i / FPS);
      const frame = new VideoFrame(canvas, { timestamp: Math.round((i * 1e6) / FPS), duration: Math.round(1e6 / FPS) });
      encoder.encode(frame, { keyFrame: i % (FPS * 2) === 0 });
      frame.close();
      while (encoder.encodeQueueSize > 6) await new Promise(r => setTimeout(r, 2));
      if (i % 6 === 0) {
        onProgress(i / frames);
        await new Promise(r => setTimeout(r));
      }
    }
    await encoder.flush();
    encoder.close();
    if (failure) throw failure;
    muxer.finalize();
    return new Blob([muxer.target.buffer], { type: 'video/mp4' });
  }

  // Sin WebCodecs (o sin codificador de audio): se reproduce en tiempo real y se graba el
  // canvas, con la música sonando a la vez.
  async function recordRealtime(drawer, onProgress, audioBuffer, live) {
    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');
    drawer.draw(ctx, 0);
    let stream = canvas.captureStream(FPS);
    let source = null;
    if (audioBuffer && live) {
      await live.resume();
      const dest = live.createMediaStreamDestination();
      source = live.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(dest);
      stream = new MediaStream([...stream.getVideoTracks(), ...dest.stream.getAudioTracks()]);
    }
    const mime = (source
      ? ['video/mp4;codecs=avc1,mp4a.40.2', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm']
      : ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm'])
      .find(m => window.MediaRecorder && MediaRecorder.isTypeSupported(m));
    if (!mime) throw new Error('este navegador no puede crear vídeos; prueba con Chrome');
    const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 8_000_000 });
    const chunks = [];
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    const stopped = new Promise(r => { rec.onstop = r; });
    rec.start(250);
    source?.start();
    const t0 = performance.now();
    await new Promise((resolve) => {
      const tick = () => {
        const t = (performance.now() - t0) / 1000;
        drawer.draw(ctx, Math.min(t, drawer.duration));
        onProgress(Math.min(1, t / drawer.duration));
        if (t < drawer.duration + 0.2) requestAnimationFrame(tick); else resolve();
      };
      requestAnimationFrame(tick);
    });
    rec.stop();
    source?.stop();
    await stopped;
    return new Blob(chunks, { type: mime.split(';')[0] });
  }

  // ─── Tu voz (grabada en el Studio mientras corría el vídeo) ───
  const MIX_RATE = 48000; // el de audio.js
  async function decodeVoice(blob) {
    return new OfflineAudioContext(1, 1, MIX_RATE).decodeAudioData(await blob.arrayBuffer());
  }

  // La voz delante y la música debajo: mientras se habla la música baja a un tercio, con rampas
  // cortas, como en la radio. musicVolume y voiceVolume: las barras del Studio (1 = como suena
  // por defecto). delay: segundos que se mueve la voz.
  function mixAudio(music, voice, duration, words, { musicVolume = 1, voiceVolume = 1, delay = 0 } = {}) {
    const n = Math.round(duration * MIX_RATE);
    const v = new Float32Array(n);
    const shift = Math.round(delay * MIX_RATE);
    for (let c = 0; c < (voice?.numberOfChannels || 0); c++) {
      const dd = voice.getChannelData(c);
      for (let i = Math.max(0, shift), m = Math.min(n, dd.length + shift); i < m; i++) v[i] += dd[i - shift] / voice.numberOfChannels;
    }
    const sample = [];
    for (let i = 0; i < n; i += 16) sample.push(Math.abs(v[i]));
    sample.sort((a, b) => a - b);
    const top = sample[Math.floor(sample.length * 0.999)] || 0;
    const gain = (top > 0.003 ? 0.72 / top : 1) * voiceVolume;
    const DUCK = 0.33, RAMP = 0.12;
    const spans = [];
    for (const w of words) {
      const last = spans[spans.length - 1];
      if (last && last.scene === w.scene) last.to = w.end + 0.25;
      else spans.push({ scene: w.scene, from: w.start - 0.1, to: w.end + 0.25 });
    }
    const duckAt = (t) => {
      if (!spans.length) return DUCK;
      let g = 1;
      for (const sp of spans) {
        const inside = Math.min(1, (t - sp.from + RAMP) / RAMP, (sp.to + RAMP - t) / RAMP);
        if (inside > 0) g = Math.min(g, 1 - (1 - DUCK) * inside);
      }
      return g;
    };
    const out = new AudioBuffer({ length: n, numberOfChannels: 2, sampleRate: MIX_RATE });
    const L = new Float32Array(n), R = new Float32Array(n);
    const mL = music?.getChannelData(0), mR = music?.getChannelData(1);
    const soft = (x, knee, room) => (Math.abs(x) <= knee ? x : Math.sign(x) * (knee + room * Math.tanh((Math.abs(x) - knee) / room)));
    for (let i = 0; i < n; i++) {
      const g = music ? (voice ? duckAt(i / MIX_RATE) : 1) * musicVolume : 0;
      const x = soft(v[i] * gain, 0.72, 0.26);
      L[i] = soft(x + (mL ? (mL[i] || 0) * g : 0), 0.9, 0.08);
      R[i] = soft(x + (mR ? (mR[i] || 0) * g : 0), 0.9, 0.08);
    }
    out.copyToChannel(L, 0);
    out.copyToChannel(R, 1);
    return out;
  }

  // ─── La voz del robot (ElevenLabs, desde tools/piloto.mjs): una frase por escena ───
  // voiceClips: { idDeEscena: { audio (base64), times: [[inicio, fin], …] (una por palabra del
  // guion) o null } }. Cada escena dura lo que pide su frase, en compases enteros (para que la
  // música siga cuadrando), y los subtítulos van con lo que suena.
  const VOICE_TAIL = 0.35;
  async function decodeClips(clips) {
    const out = {};
    for (const [id, c] of Object.entries(clips || {})) {
      try {
        const bytes = Uint8Array.from(atob(c.audio), ch => ch.charCodeAt(0));
        out[id] = { buffer: await new OfflineAudioContext(1, 1, MIX_RATE).decodeAudioData(bytes.buffer), times: c.times || null };
      } catch (e) {
        console.warn(`Voz de «${id}»: ${e.message}`);
      }
    }
    return out;
  }
  function fitVoice(scenes, clips) {
    return scenes.map(sc => {
      const c = !sc.noScript && clips[sc.id];
      const need = c ? SPEAK_FROM + c.buffer.duration + VOICE_TAIL - sc.dur : 0;
      return need > 0 ? grow(sc, Math.ceil(need / BAR - 1e-6) * BAR) : sc;
    });
  }
  // Todas las frases en una pista, cada una al empezar su escena
  function voiceTrack(scenes, starts, clips, duration) {
    const n = Math.round(duration * MIX_RATE);
    const track = new AudioBuffer({ length: n, numberOfChannels: 1, sampleRate: MIX_RATE });
    const v = track.getChannelData(0);
    scenes.forEach((sc, i) => {
      const c = !sc.noScript && clips[sc.id];
      if (!c) return;
      const at = Math.round((starts[i] + SPEAK_FROM) * MIX_RATE);
      for (let ch = 0; ch < c.buffer.numberOfChannels; ch++) {
        const dd = c.buffer.getChannelData(ch);
        for (let k = 0; k < dd.length && at + k < n; k++) v[at + k] += dd[k] / c.buffer.numberOfChannels;
      }
    });
    return track;
  }

  // Cuánto va la voz por detrás de los subtítulos: en cada frase se busca dónde empieza a
  // sonar de verdad cerca de donde debería, y se toma la mediana (segundos; positivo = tarde).
  async function measureVoiceLag(blob, words) {
    const voice = await decodeVoice(blob);
    const dd = voice.getChannelData(0);
    const FRAME = Math.round(MIX_RATE / 100);
    const rms = new Float32Array(Math.floor(dd.length / FRAME));
    for (let f = 0; f < rms.length; f++) {
      let sum = 0;
      for (let i = f * FRAME, e = i + FRAME; i < e; i++) sum += dd[i] * dd[i];
      rms[f] = Math.sqrt(sum / FRAME);
    }
    const sorted = [...rms].sort((a, b) => a - b);
    const floor = sorted[Math.floor(sorted.length * 0.2)] || 0;
    const peak = sorted[Math.floor(sorted.length * 0.99)] || 0;
    const threshold = Math.max(floor * 4, peak * 0.12, 0.002);
    const starts = [];
    for (const w of words) if (!starts.length || starts[starts.length - 1].scene !== w.scene) starts.push({ scene: w.scene, t: w.start });
    const lags = [];
    for (const { t } of starts) {
      const from = Math.max(0, Math.floor((t - 0.3) * 100)), to = Math.min(rms.length - 3, Math.floor((t + 1.2) * 100));
      for (let f = from; f < to; f++) {
        if (rms[f] > threshold && rms[f + 1] > threshold && rms[f + 2] > threshold) {
          lags.push(f / 100 - t);
          break;
        }
      }
    }
    if (lags.length < 2) return 0;
    lags.sort((a, b) => a - b);
    return Math.max(-0.3, Math.min(1, lags[Math.floor(lags.length / 2)]));
  }

  // Semilla de la música: el mismo partido suena siempre igual.
  const seedOf = (d) => [...`${d.home.name}${d.home.score}${d.away.name}${d.away.score}`]
    .reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0, 2166136261);

  // ============================================================
  // API
  // · StudioVideo.render(datos, onProgress, { music, script, captions, voice, intro, voiceLead,
  //     voiceShift, musicVolume, voiceVolume, musicStyle, voiceClips }) → { blob, ext, note, audio, mix }
  //     voiceClips: la voz del robot, una frase por escena (ver decodeClips).
  //     intro: con la apertura de los escudos. voiceLead: la apertura con la que se grabó la voz
  //     (prepare(…).lead). voiceShift: cuánto se mueve la voz (negativo = antes).
  //     musicStyle: 'trap' (la urbana, por defecto) o 'epica'.
  // · StudioVideo.prepare(datos, script, { intro }) → para grabarse: draw(ctx, t), la duración,
  //     cada palabra con su momento, cada escena con su inicio (para dibujar solo una) y si el campo
  //     va en 3D (world).
  // · StudioVideo.probe(datos) → (pruebas) en cada tiro y cada gol, si cae en el color de su equipo.
  // · StudioVideo.plan(datos, script) → las escenas con guion, lo que duran y a qué velocidad
  //     habría que decir cada frase (1 = ritmo normal).
  // · StudioVideo.audio(datos, { … }) → solo el sonido del vídeo en WAV, para ajustar el volumen.
  // · StudioVideo.measureVoiceLag(voz, palabras) → cuánto llega tarde la voz (segundos).
  // ============================================================
  async function render(data, onProgress = () => {}, {
    music = true, script = null, captions = true, voice = null, musicVolume = 1, voiceVolume = 1,
    intro = true, voiceLead = null, voiceShift = 0, musicStyle = 'trap', voiceClips = null,
  } = {}) {
    const live = ((music && window.StudioAudio) || voice || voiceClips) && typeof AudioContext !== 'undefined' ? new AudioContext() : null;
    let assets = null;
    try {
      assets = await loadAssets(data);
      let scenes = buildScenes(data, assets, intro);
      const clips = voiceClips ? await decodeClips(voiceClips) : {};
      const voiced = Object.keys(clips).length > 0;
      if (voiced) scenes = fitVoice(scenes, clips);
      const words = captionWords(scenes, sceneStarts(scenes), script, voiced ? clips : null);
      const withCaptions = !!(captions && words.length);
      const delay = (voiceLead == null ? 0 : leadOf(scenes) - voiceLead) + (voiceShift || 0);
      const drawer = makeDrawer(scenes, withCaptions ? captionPages(words) : null, assets.brandImg);
      let audioBuffer = null;
      if (music && window.StudioAudio) {
        onProgress(0, 'Componiendo la música…');
        audioBuffer = await window.StudioAudio.render(soundTimeline(drawer, seedOf(data), musicStyle));
      }
      const audioOut = audioBuffer ? window.StudioAudio.toWav(audioBuffer, drawer.duration) : null;
      if (voiced) {
        onProgress(0, 'Mezclando la voz…');
        audioBuffer = mixAudio(audioBuffer, voiceTrack(scenes, drawer.starts, clips, drawer.duration), drawer.duration, words, { musicVolume, voiceVolume });
      } else if (voice || (audioBuffer && musicVolume !== 1)) {
        if (voice) onProgress(0, 'Mezclando tu voz…');
        audioBuffer = mixAudio(audioBuffer, voice && await decodeVoice(voice), drawer.duration, words, { musicVolume, voiceVolume, delay });
      }
      const mix = { music: !!(music && window.StudioAudio), captions: withCaptions, voice: !!voice || voiced, intro: leadOf(scenes) > 0, lead: leadOf(scenes) };
      const codec = await pickCodec();
      const acodec = audioBuffer ? await pickAudioCodec(audioBuffer.sampleRate) : null;
      if (codec && (!audioBuffer || acodec)) {
        const blob = await encodeWebCodecs(drawer, codec, onProgress, audioBuffer && { buffer: audioBuffer, codec: acodec });
        const notes = [];
        if (codec.muxer !== 'avc') notes.push('el vídeo va en VP9');
        if (acodec && acodec.muxer !== 'aac') notes.push('el sonido va en Opus');
        return {
          blob, ext: 'mp4', audio: audioOut, mix, duration: drawer.duration,
          note: notes.length ? `Tu navegador no tiene H.264/AAC: ${notes.join(' y ')}. Si TikTok no lo acepta, créalo con Chrome.` : '',
        };
      }
      const blob = await recordRealtime(drawer, onProgress, audioBuffer, live);
      const ext = blob.type.includes('mp4') ? 'mp4' : 'webm';
      return { blob, ext, audio: audioOut, mix, duration: drawer.duration, note: ext === 'webm' ? 'Este navegador solo graba WebM: TikTok e Instagram lo aceptan, pero el MP4 sale con Chrome.' : '' };
    } finally {
      live?.close();
      // (el campo en 3D suelta su WebGL: el iPhone tiene pocos)
      assets?.world?.dispose();
    }
  }

  async function prepare(data, script, { intro = true } = {}) {
    const assets = await loadAssets(data);
    const scenes = buildScenes(data, assets, intro);
    const words = captionWords(scenes, sceneStarts(scenes), script);
    const drawer = makeDrawer(scenes, words.length ? captionPages(words) : null, assets.brandImg);
    return {
      duration: drawer.duration, draw: (ctx, t) => drawer.draw(ctx, t), words, lead: leadOf(scenes), W, H,
      scenes: scenes.map((sc, i) => ({ id: sc.id, t: drawer.starts[i], dur: sc.dur })), world: !!assets.world,
    };
  }

  const plan = (data, script) => scriptFit(buildScenes(data, {}), script);
  // Para las pruebas: el territorio de la escena del partido en cada tiro y cada gol (ver probe)
  const probe = (data) => buildScenes(data, {}).find(sc => sc.id === 'goals')?.probe?.() || null;
  // Lo que va a durar el vídeo (con o sin la apertura), antes de crearlo
  const length = (data, intro = true) => buildScenes(data, {}, intro).reduce((sum, sc) => sum + sc.dur, 0);

  async function audio(data, {
    music = true, script = null, voice = null, musicVolume = 1, voiceVolume = 1, intro = true, voiceLead = null, voiceShift = 0,
    musicStyle = 'trap',
  } = {}) {
    const scenes = buildScenes(data, {}, intro);
    const drawer = makeDrawer(scenes);
    const words = captionWords(scenes, drawer.starts, script);
    const delay = (voiceLead == null ? 0 : leadOf(scenes) - voiceLead) + (voiceShift || 0);
    let buffer = music && window.StudioAudio ? await window.StudioAudio.render(soundTimeline(drawer, seedOf(data), musicStyle)) : null;
    if (voice || (buffer && musicVolume !== 1)) {
      buffer = mixAudio(buffer, voice && await decodeVoice(voice), drawer.duration, words, { musicVolume, voiceVolume, delay });
    }
    return buffer && window.StudioAudio ? window.StudioAudio.toWav(buffer, drawer.duration) : null;
  }

  window.StudioVideo = { render, prepare, plan, length, audio, measureVoiceLag, crisp, probe, layerCount: () => layers.size };
})();
