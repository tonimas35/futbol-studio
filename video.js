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
  function fadeBottom(ctx, color, height, top = H) {
    const g = ctx.createLinearGradient(0, top - height, 0, top);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, color);
    ctx.fillStyle = g;
    ctx.fillRect(0, top - height, W, height);
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
  function drawHook(ctx, h, up_ = 1) {
    let size = 124;
    const lines = () => wrap(ctx, up(h.text), ANTON(size), (W - 2 * M) / 1.18); // que quepa también en grande
    while (size > 72 && lines().length > 2) size -= 8;
    const ls = lines().slice(0, 3);
    const blockH = 80 + ls.length * size * 1.02;
    const k = 1.18 - 0.18 * up_;
    const top = (1 - up_) * (H * 0.44 - (blockH * k) / 2) + up_ * 140;
    ctx.save();
    ctx.translate(W / 2, top);
    ctx.scale(k, k);
    chip(ctx, h.tag, 0, 0, { acc: ACCENT, on: '#111111' }, 42, 'center');
    ls.forEach((l, i) => text(ctx, l, 0, 80 + (i + 1) * size * 1.02 - size * 0.12, ANTON(size), '#ffffff', 'center'));
    ctx.restore();
  }

  function sceneIntro(d, A) {
    const HIT = BEAT, cy = 860, GAP = 250;
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
        if (d.hook) drawHook(ctx, d.hook, easeInOut(prog(t, HIT - 0.12, 0.3)));
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
        const flash = 1 - prog(t, HIT, 0.14);
        if (t >= HIT && flash > 0) fillAll(ctx, `rgba(255,255,255,${0.3 * flash})`);
      },
    };
  }

  // 1 · Marcador: cada equipo en su mitad (el local arriba), los goles suben, los goleadores
  // y el titular en la cinta.
  function sceneScore(d, A) {
    const SEAM = 900;
    const halves = [
      { side: d.home, logo: A.homeLogo, top: 0, bottom: SEAM, from: -1, delay: 0 },
      { side: d.away, logo: A.awayLogo, top: SEAM, bottom: H, from: 1, delay: 0.12 },
    ];
    const winner = d.home.won ? d.home : d.away.won ? d.away : d.home;
    return {
      id: 'score',
      dur: 3 * BAR,
      accent: winner.style.acc,
      music: { energy: 'full', drop: BAR },
      cues: [
        { t: 0, kind: 'riser', dur: BAR, vel: 0.8 },
        ...ticks(BEAT, BAR, 0.8),
        { t: BAR, kind: 'impact', vel: 1 },
        { t: BAR + 2 * BEAT, kind: 'slam' },
      ],
      draw(ctx, t) {
        for (const h of halves) {
          const st = h.side.style;
          const e = easeOut(prog(t, h.delay, 0.55));
          const top = h.top === 0;
          ctx.save();
          const band = bleed(ctx, 0, h.top, W, h.bottom - h.top);
          ctx.beginPath();
          ctx.rect(...band);
          ctx.clip();
          ctx.translate((1 - e) * (band[0] + band[2]) * h.from, 0);
          teamBg(ctx, st, 0, h.top, W, h.bottom - h.top, 0.7, 0.6);
          logo(ctx, h.logo, W - 220, h.top + 470, 760 * (1 + 0.04 * prog(t, 0, 3 * BAR)), 0.12);
          const labelY = h.top + (top ? 330 : 190);
          logo(ctx, h.logo, M + 50, labelY - 30, 100);
          text(ctx, up(h.side.name), M + 122, labelY, ANTON(fit(ctx, up(h.side.name), ANTON, 76, W - 2 * M - 122)), st.fg);
          // Los goles suben y el del ganador da un golpe al llegar.
          const p = easeOut(prog(t, BEAT, BAR - BEAT));
          const pop = h.side.won ? 1 + 0.08 * Math.sin(Math.PI * prog(t, BAR, 0.3)) : 1;
          const baseY = h.top + (top ? 760 : 620);
          ctx.save();
          ctx.translate(M, baseY);
          ctx.scale(pop, pop);
          ctx.shadowColor = 'rgba(0,0,0,.3)';
          ctx.shadowBlur = 40;
          text(ctx, countText(h.side.score, p), 0, 0, ANTON(380), st.fg);
          ctx.restore();
          // Los goleadores, a la derecha del número, en cuanto ha llegado.
          ctx.font = ANTON(380);
          const numW = ctx.measureText(String(h.side.score)).width;
          const lx = M + numW + 60;
          const lines = h.side.lines.slice(0, 5);
          lines.forEach((l, i) => {
            const a = easeOut(prog(t, BAR + BEAT + i * STEP, 0.3));
            if (a <= 0) return;
            ctx.save();
            ctx.globalAlpha = a;
            ctx.translate((1 - a) * 40, 0);
            const size = lines.length <= 3 ? 46 : 38;
            text(ctx, l, lx, baseY - 250 + i * (size + 14), BARLOW(fit(ctx, l, (s) => BARLOW(s), size, W - lx - M)), st.fg);
            ctx.restore();
          });
          if (h.side.shootout != null) {
            text(ctx, `${h.side.shootout} ${d.t?.onPens || 'EN LOS PENALTIS'}`, M, baseY + 70, BARLOW(44), st.fg);
          }
          ctx.restore();
          if (h.side.lost) {
            ctx.fillStyle = `rgba(0,0,0,${0.42 * easeOut(prog(t, BAR, 0.4))})`;
            ctx.fillRect(...bleed(ctx, 0, h.top, W, h.bottom - h.top));
          }
        }
        const ce = easeOut(prog(t, 0.6, 0.4));
        ctx.save();
        ctx.globalAlpha = ce;
        chip(ctx, d.live ? `${d.comp} · en juego ${d.clock}` : d.comp, M, 120, winner.style, 40);
        ctx.restore();
        tape(ctx, d.headline, W / 2, SEAM, winner.style, fit(ctx, up(d.headline), ANTON, 92, 900), prog(t, BAR + 2 * BEAT, 0.45));
      },
    };
  }

  // 2 · Los goles: la línea del partido baja de arriba abajo, minuto a minuto, y cada gol
  // (o roja, o penalti fallado) salta cuando la línea llega a él. Arriba, el marcador va
  // cambiando con cada gol.
  // Una amarilla o un cambio en el minuto a minuto: en pequeño y en gris, como en la slide.
  // El punto en su minuto, el minuto en un recuadro y la tarjeta o «▲ entra ▼ sale».
  function smallEvent(ctx, e, p, P, ink, dir, ty, cy) {
    const AX = W / 2;
    ctx.strokeStyle = rgba(ink, 0.35);
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(AX, ty); ctx.lineTo(AX + dir * 24, cy); ctx.lineTo(AX + dir * 40, cy); ctx.stroke();
    ctx.beginPath();
    ctx.arc(AX, ty, 8 * easeBack(p), 0, Math.PI * 2);
    ctx.fillStyle = e.kind === 'yellow' ? '#f5c400' : P.sub;
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = P.ring;
    ctx.stroke();
    const a = easeOut(p);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.translate((1 - a) * 60 * dir, 0);
    const minFont = BARLOW(32);
    ctx.font = minFont;
    const minW = ctx.measureText(e.min).width + 22, minH = 44;
    const x1 = AX + dir * 40;
    const mx = dir < 0 ? x1 - minW : x1;
    ctx.strokeStyle = P.faint;
    ctx.lineWidth = 2;
    roundRect(ctx, mx, cy - minH / 2, minW, minH, 6);
    ctx.stroke();
    text(ctx, e.min, mx + minW / 2, cy + capHeight(ctx, minFont) / 2, minFont, P.mute, 'center');
    // Lo de dentro: [tarjeta] Nombre o [▲] Entra [▼] Sale, que quepa en su mitad
    const parts = e.kind === 'yellow' ? [['card', up(e.name)]] : [['in', up(e.name)], ...(e.out ? [['out', up(e.out)]] : [])];
    const ICON = 30, GAP = 12;
    const room = W / 2 - 40 - M - minW - 14;
    let size = 42, widths;
    do {
      ctx.font = BARLOW(size);
      widths = parts.map(([, t]) => ICON + 8 + ctx.measureText(t).width);
    } while (size-- > 26 && widths.reduce((s2, w) => s2 + w, 0) + GAP * (parts.length - 1) > room);
    const font = BARLOW(size + 1);
    const totalW = widths.reduce((s2, w) => s2 + w, 0) + GAP * (parts.length - 1);
    let x = dir < 0 ? mx - 14 - totalW : mx + minW + 14;
    parts.forEach(([icon, label], i) => {
      if (icon === 'card') {
        ctx.fillStyle = '#f5c400';
        roundRect(ctx, x + 5, cy - 18, 22, 32, 3);
        ctx.fill();
      } else {
        const up_ = icon === 'in';
        ctx.fillStyle = up_ ? P.up : '#d8263a';
        ctx.beginPath();
        if (up_) { ctx.moveTo(x + 2, cy + 10); ctx.lineTo(x + 28, cy + 10); ctx.lineTo(x + 15, cy - 12); }
        else { ctx.moveTo(x + 2, cy - 10); ctx.lineTo(x + 28, cy - 10); ctx.lineTo(x + 15, cy + 12); }
        ctx.closePath();
        ctx.fill();
      }
      text(ctx, label, x + ICON + 8, cy + capHeight(ctx, font) / 2, font, P.small);
      x += widths[i] + GAP;
    });
    ctx.restore();
  }

  function sceneGoals(d, A) {
    const evs = d.goals;
    const total = d.extraTime ? 120 : 90;
    const AX = W / 2;
    // Arriba, fijos, el título y el marcador; debajo, una ventana (VT–VB) por la que baja la
    // línea. La cámara sigue la punta de la línea y, al final, se aleja para enseñarla entera.
    const VT = 440, VB = 1560;
    const TOP = VT + 90;
    const hOf = (e) => (e.kind === 'goal' ? 112 : e.tiny ? 58 : 84);
    // Lo larga que es la línea: lo que pidan los sucesos de cada lado (para no tener que quitar
    // ninguno), entre lo que cabe en la ventana y 2400.
    const stack = Math.max(...['home', 'away'].map(s => evs.filter(e => e.side === s).reduce((sum, e) => sum + hOf(e) + 10, 0)));
    const BOTTOM = TOP + Math.round(Math.min(2600, Math.max(VB - TOP - 120, stack * 1.5)));
    const yOf = (t) => TOP + (Math.min(Math.max(t, 0), total + 1) / (total + 1)) * (BOTTOM - TOP);

    // El ritmo: la línea corre por los minutos sin nada (RUN segundos todo el partido) y se
    // detiene en cada suceso lo que pide (un gol, más; una amarilla o un cambio, un suspiro).
    // Los del mismo minuto van juntos.
    const RUN = 1.1;
    const SLOT = { goal: 0.6, red: 0.42, pen: 0.42, yellow: 0.16, sub: 0.14 };
    const order = evs.map((e, i) => ({ e, i })).sort((a, b) => a.e.t - b.e.t || a.i - b.i);
    const knots = [[0, 0]];
    const startOf = new Map();
    let T = 0, prevM = 0;
    for (let k = 0; k < order.length;) {
      const m = order[k].e.t;
      T += RUN * (Math.max(0, m - prevM) / (total + 1));
      knots.push([m, T]);
      let off = 0;
      for (; k < order.length && order[k].e.t === m; k++) {
        startOf.set(order[k].e, T + off * 0.7);
        off += SLOT[order[k].e.kind] ?? 0.3;
      }
      T += off;
      knots.push([m, T]);
      prevM = m;
    }
    T += RUN * ((total + 1 - prevM) / (total + 1));
    knots.push([total + 1, T]);
    // La duración: compases enteros (2 a 4) con el arranque, el paseo y la vista final.
    const drawStart = BEAT, REVEAL = 1.0;
    const bars = Math.min(4, Math.max(2, Math.ceil((drawStart + T + REVEAL - 0.25) / BAR)));
    const dur = bars * BAR;
    const f = (dur - drawStart - REVEAL) / T;
    const drawEnd = drawStart + f * T;
    const minuteAt = (u) => {
      const x = Math.max(0, Math.min(T, u));
      for (let k = 1; k < knots.length; k++) {
        const [m0, t0] = knots[k - 1], [m1, t1] = knots[k];
        if (x <= t1) return t1 > t0 ? m0 + (m1 - m0) * ((x - t0) / (t1 - t0)) : m1;
      }
      return total + 1;
    };
    // La punta de la línea, suavizada (para que acelere y frene sin tirones).
    const headMinute = (t) => {
      let sum = 0;
      for (const dt of [-0.12, -0.06, 0, 0.06, 0.12]) sum += minuteAt((t + dt - drawStart) / f);
      return sum / 5;
    };
    const at = (e) => drawStart + f * startOf.get(e);

    // Dónde va cada tarjeta, a su lado de la línea y cerca de su minuto, sin pisarse ni tapar
    // las marcas (el descanso y la prórroga). Con la línea larga casi nunca hay que quitar nada;
    // si hiciera falta, como en la slide: fuera primero los cambios y luego las amarillas.
    let placed = evs.map(e => ({ ...e, h: hOf(e), appear: snap(at(e)) }));
    const cuts = [yOf(45.5), ...(d.extraTime ? [yOf(90.5)] : [])];
    const edges = [TOP - 30, ...cuts, BOTTOM + 10];
    const need = (list) => list.reduce((sum, e) => sum + e.h + 10, 0) - 10;
    for (const side of ['home', 'away']) {
      for (let i = 0; i < edges.length - 1; i++) {
        const top = edges[i] + (i ? 30 : 0), bottom = edges[i + 1] - (i < cuts.length ? 30 : 0);
        const inSeg = () => placed.filter(e => e.side === side && yOf(e.t) >= edges[i] && yOf(e.t) < edges[i + 1]);
        for (const drop of ['sub', 'yellow']) {
          let extra;
          while (need(inSeg()) > bottom - top && (extra = inSeg().filter(e => e.kind === drop).pop())) placed = placed.filter(e => e !== extra);
        }
      }
    }
    const bands = cuts.map(y => ({ y0: y - 30, y1: y + 30 }));
    const clear = (y, h, down) => {
      for (const b of bands) if (y < b.y1 && y + h > b.y0) y = down ? b.y1 + 8 : b.y0 - 8 - h;
      return y;
    };
    for (const side of ['home', 'away']) {
      const list = placed.filter(e => e.side === side);
      list.forEach((e, i) => {
        let y = Math.max(yOf(e.t) - e.h / 2, TOP - 30);
        if (i) y = Math.max(y, list[i - 1].y + list[i - 1].h + 10);
        e.y = clear(y, e.h, true);
      });
      for (let i = list.length - 1; i >= 0; i--) {
        // Lo último, por encima del rótulo de «Final» (centrado en BOTTOM + 40)
        const limit = i === list.length - 1 ? BOTTOM + 10 - list[i].h : list[i + 1].y - 10 - list[i].h;
        if (list[i].y > limit) list[i].y = clear(limit, list[i].h, false);
      }
    }
    // El marcador de arriba: el de cada gol cuando aparece.
    const scoreAt = (t) => {
      let s = [0, 0];
      placed.forEach(e => { if (e.score && t >= e.appear) s = e.score; });
      return s;
    };
    const lastGoal = [...placed].reverse().find(e => e.score);
    const finalScore = lastGoal ? lastGoal.score : [d.home.score, d.away.score];
    const goals = placed.filter(e => e.kind === 'goal');

    // La cámara: y' = o + s·y (y x' = AX + s·(x − AX)). Siguiendo, la punta va a un 60 % de la
    // ventana; al final, se aleja hasta que cabe todo, del 0' al «Final».
    const FOLLOW = VT + 0.6 * (VB - VT);
    const camMax = Math.max(0, BOTTOM + 100 - VB);
    const zFit = Math.min(1, (VB - VT - 30) / (BOTTOM + 100 - (TOP - 60)));
    const camera = (t, headY) => {
      const follow = -Math.min(camMax, Math.max(0, headY - FOLLOW));
      const r = easeInOut(prog(t, drawEnd + 0.15, 0.55));
      const s = 1 + (zFit - 1) * r;
      const o = follow + ((VT + 15 - zFit * (TOP - 60)) - follow) * r;
      return { s, o };
    };
    return {
      id: 'goals',
      dur,
      camera: false, // lleva la suya
      accent: (d.home.won ? d.home : d.away).style.acc,
      music: { energy: 'full' },
      cues: placed.map(e => (e.kind === 'goal' ? { t: e.appear, kind: 'slam' }
        : e.tiny ? { t: e.appear, kind: 'tick', p: e.kind === 'yellow' ? 0.7 : 0.35, vel: 0.5 }
          : { t: e.appear, kind: 'hit', vel: 0.8 })),
      draw(ctx, t) {
        const P = sheet(d);
        sheetBg(ctx, d);
        const k = easeOut(prog(t, 0.1, 0.4));
        ctx.save();
        ctx.globalAlpha = k;
        text(ctx, d.goalsTitle, M, 220, ANTON(fit(ctx, d.goalsTitle, ANTON, 120, W - 2 * M)), P.ink);
        // El marcador, que cambia con cada gol (y da un golpe): cada equipo a su lado de la línea
        const s = scoreAt(t);
        logo(ctx, A.homeLogo, M + 40, 340, 80);
        text(ctx, up(d.home.short), M + 96, 362, BARLOW(fit(ctx, up(d.home.short), (z) => BARLOW(z), 44, 260)), P.ink);
        logo(ctx, A.awayLogo, W - M - 40, 340, 80);
        text(ctx, up(d.away.short), W - M - 96, 362, BARLOW(fit(ctx, up(d.away.short), (z) => BARLOW(z), 44, 260)), P.ink, 'right');
        const hit = goals.reduce((m, e) => Math.max(m, t >= e.appear ? 1 - prog(t, e.appear, 0.35) : 0), 0);
        ctx.save();
        ctx.translate(W / 2, 350);
        ctx.scale(1 + 0.18 * hit, 1 + 0.18 * hit);
        text(ctx, `${s[0]}-${s[1]}`, 0, 35, ANTON(110), P.ink, 'center');
        ctx.restore();
        ctx.fillStyle = P.track;
        ctx.fillRect(M, VT - 2, W - 2 * M, 3);
        ctx.restore();

        // La ventana: lo de la línea se ve solo aquí (de lado a lado de la pantalla).
        const head = headMinute(t);
        const headY = yOf(head);
        const cam = camera(t, headY);
        ctx.save();
        ctx.beginPath();
        ctx.rect(...bleed(ctx, 0, VT, W, VB - VT));
        ctx.clip();
        // Cada gol da un pequeño golpe de cámara hacia su tarjeta.
        const goalHit = goals.reduce((best, e) => {
          const p = t >= e.appear ? prog(t, e.appear, 0.5) : 1;
          const v = p < 1 ? Math.sin(Math.PI * Math.min(1, p * 1.6)) * (1 - p) : 0;
          return v > best.v ? { v, e } : best;
        }, { v: 0, e: null });
        if (goalHit.e) {
          const gx = AX + (goalHit.e.side === 'home' ? -200 : 200), gy = cam.o + cam.s * (goalHit.e.y + goalHit.e.h / 2);
          const z = 1 + 0.06 * goalHit.v;
          ctx.translate(gx, gy); ctx.scale(z, z); ctx.translate(-gx, -gy);
        }
        ctx.translate(AX * (1 - cam.s), cam.o);
        ctx.scale(cam.s, cam.s);

        // La línea, que baja con la punta
        ctx.lineCap = 'round';
        ctx.strokeStyle = P.track;
        ctx.lineWidth = 6;
        ctx.beginPath(); ctx.moveTo(AX, TOP); ctx.lineTo(AX, BOTTOM); ctx.stroke();
        ctx.strokeStyle = P.line;
        ctx.beginPath(); ctx.moveTo(AX, TOP); ctx.lineTo(AX, Math.max(TOP, Math.min(BOTTOM, headY))); ctx.stroke();
        ctx.lineWidth = 4;
        for (let m = 15; m < total; m += 15) {
          if (m === 45 || m === 90) continue;
          ctx.beginPath(); ctx.moveTo(AX - 14, yOf(m)); ctx.lineTo(AX + 14, yOf(m)); ctx.stroke();
        }
        // La punta: un punto que brilla mientras corre
        if (t >= drawStart && head < total + 0.5) {
          ctx.beginPath();
          ctx.arc(AX, headY, 11, 0, Math.PI * 2);
          ctx.fillStyle = P.line;
          ctx.fill();
          ctx.save();
          ctx.globalAlpha = 0.18;
          ctx.beginPath();
          ctx.arc(AX, headY, 22, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
        const mark = (label, y, show) => {
          if (show <= 0) return;
          ctx.save();
          ctx.globalAlpha = show;
          ctx.font = BARLOW(32);
          const w = ctx.measureText(label).width + 28;
          ctx.fillStyle = P.pill;
          ctx.fillRect(AX - w / 2, y - 24, w, 48);
          text(ctx, label, AX, y + 11, BARLOW(32), P.pillInk, 'center');
          ctx.restore();
        };
        // Las marcas de la línea, encima de todo (como en la slide): un gol en el descuento queda
        // debajo de su marca y su tarjeta, al lado.
        const marks = () => {
          mark("0'", TOP - 4, k);
          const ht = d.t?.halftime || 'DESCANSO';
          mark(d.halftime ? `${ht} · ${d.halftime[0]}-${d.halftime[1]}` : ht, yOf(45.5), easeOut(prog(headY, yOf(45.5) - 10, 40)));
          if (d.extraTime) mark(d.t?.extraTime || 'PRÓRROGA', yOf(90.5), easeOut(prog(headY, yOf(90.5) - 10, 40)));
          mark(d.live ? `${d.t?.now || 'AHORA'} · ${d.clock}` : `${d.t?.fullTime || 'FINAL'} · ${finalScore[0]}-${finalScore[1]}`, BOTTOM + 40, easeOut(prog(t, drawEnd, 0.3)));
        };
        // Cada suceso: el punto en su minuto, la línea hasta su tarjeta y la tarjeta.
        for (const e of placed) {
          const p = prog(t, e.appear, 0.35);
          if (p <= 0) continue;
          const st = e.style;
          const dir = e.side === 'home' ? -1 : 1;
          const ty = yOf(e.t), cy = e.y + e.h / 2;
          const ink = P.team(st);
          if (e.tiny) {
            smallEvent(ctx, e, p, P, ink, dir, ty, cy);
            continue;
          }
          // Un gol: un destello del color de su equipo detrás de la tarjeta
          if (e.kind === 'goal') {
            const fl = 1 - prog(t, e.appear, 0.6);
            if (fl > 0 && fl < 1) {
              ctx.save();
              ctx.globalAlpha = 0.35 * fl;
              ctx.fillStyle = st.acc;
              ctx.fillRect(dir < 0 ? M - 20 : AX + 20, e.y - 12, W / 2 - M, e.h + 24);
              ctx.restore();
            }
          }
          ctx.strokeStyle = rgba(ink, 0.7);
          ctx.lineWidth = 3;
          ctx.beginPath(); ctx.moveTo(AX, ty); ctx.lineTo(AX + dir * 24, cy); ctx.lineTo(AX + dir * 40, cy); ctx.stroke();
          ctx.beginPath();
          ctx.arc(AX, ty, (e.kind === 'goal' ? 16 : 12) * easeBack(p), 0, Math.PI * 2);
          ctx.fillStyle = e.kind === 'red' ? '#e3172d' : ink;
          ctx.fill();
          ctx.lineWidth = 4;
          ctx.strokeStyle = P.ring;
          ctx.stroke();
          const a = easeOut(p);
          ctx.save();
          ctx.globalAlpha = a;
          ctx.translate((1 - a) * 60 * dir, 0);
          const nameSize = e.kind === 'goal' ? 58 : 44;
          const minSize = e.kind === 'goal' ? 40 : 32;
          ctx.font = ANTON(minSize);
          const minW = ctx.measureText(e.min).width + 24;
          const scoreTxt = e.score ? `${e.score[0]}-${e.score[1]}` : '';
          ctx.font = ANTON(48);
          const scoreW = scoreTxt ? ctx.measureText(scoreTxt).width + 18 : 0;
          const room = W / 2 - 40 - M - minW - 14 - scoreW;
          const nameFont = ANTON(fit(ctx, up(e.name), ANTON, nameSize, room));
          const nameY = e.how ? cy + 6 : cy + capHeight(ctx, nameFont) / 2;
          const chipY = cy - (minSize * 1.25) / 2;
          if (e.side === 'home') {
            const x1 = AX - 40;
            ctx.fillStyle = st.acc;
            ctx.fillRect(x1 - minW, chipY, minW, minSize * 1.25);
            text(ctx, e.min, x1 - minW / 2, chipY + (minSize * 1.25 + capHeight(ctx, ANTON(minSize))) / 2, ANTON(minSize), st.on, 'center');
            text(ctx, up(e.name), x1 - minW - 14, nameY, nameFont, P.ink, 'right');
            if (e.how) text(ctx, e.how, x1 - minW - 14, nameY + 38, BARLOW(fit(ctx, e.how, (z) => BARLOW(z, 700), 30, room), 700), P.mute, 'right');
            if (scoreTxt) text(ctx, scoreTxt, M, cy + capHeight(ctx, ANTON(48)) / 2, ANTON(48), P.ink);
          } else {
            const x1 = AX + 40;
            ctx.fillStyle = st.acc;
            ctx.fillRect(x1, chipY, minW, minSize * 1.25);
            text(ctx, e.min, x1 + minW / 2, chipY + (minSize * 1.25 + capHeight(ctx, ANTON(minSize))) / 2, ANTON(minSize), st.on, 'center');
            text(ctx, up(e.name), x1 + minW + 14, nameY, nameFont, P.ink);
            if (e.how) text(ctx, e.how, x1 + minW + 14, nameY + 38, BARLOW(fit(ctx, e.how, (z) => BARLOW(z, 700), 30, room), 700), P.mute);
            if (scoreTxt) text(ctx, scoreTxt, W - M, cy + capHeight(ctx, ANTON(48)) / 2, ANTON(48), P.ink, 'right');
          }
          if (e.kind === 'red') {
            // La tarjeta roja, pegada al nombre por fuera
            ctx.font = nameFont;
            const nw = ctx.measureText(up(e.name)).width;
            const rx = e.side === 'home' ? AX - 40 - minW - 14 - nw - 40 : AX + 40 + minW + 14 + nw + 14;
            ctx.fillStyle = '#e3172d';
            roundRect(ctx, rx, nameY - 40, 26, 36, 4);
            ctx.fill();
          }
          ctx.restore();
        }
        marks();
        ctx.restore();
      },
    };
  }

  // 3 · Mapa de tiros: el campo en vertical, el local ataca hacia arriba y el visitante hacia
  // abajo. Cada tiro sale desde donde se hizo y vuela hacia la portería: el gol mueve la red,
  // el que va a puerta lo para el portero y el que va fuera se va lejos. Los contadores suben
  // con los tiros que ya han llegado.
  function sceneShots(d, A) {
    const s = d.shots;
    const PW = 700, PH = Math.round(PW * 105 / 68), PX = (W - PW) / 2, PY = 400;
    const sx = PW / 68, sy = PH / 105; // metros → píxeles
    const GOAL_W = 7.32 * sx;
    // ESPN da cada tiro en % del campo, atacando hacia x = 100.
    const at = (side, x, y) => (side === 'home'
      ? [PX + (1 - y / 100) * PW, PY + (1 - x / 100) * PH]
      : [PX + (y / 100) * PW, PY + (x / 100) * PH]);
    const goalLine = (side) => (side === 'home' ? PY : PY + PH);
    const n = s.list.length;
    const FLIGHT = 4 * STEP;
    const launch = (i) => 2 * BEAT + Math.round((22 * i) / Math.max(1, n - 1)) * STEP;
    const land = (i) => launch(i) + FLIGHT;
    const rnd = (i) => { const v = Math.sin(i * 12.9898 + 78.233) * 43758.5453; return v - Math.floor(v); };
    const flights = s.list.map((shot, i) => {
      const [x0, y0] = at(shot.side, shot.x, shot.y);
      const gy = goalLine(shot.side);
      let x1, y1;
      if (shot.x2 != null && shot.y2 != null && shot.x2 >= 95) [x1, y1] = at(shot.side, Math.min(shot.x2, 100), shot.y2);
      else if (shot.kind === 'off' || shot.kind === 'post') x1 = W / 2 + (rnd(i) < 0.5 ? -1 : 1) * (GOAL_W / 2 + 20 + rnd(i + 7) * 120), y1 = gy;
      else x1 = W / 2 + (rnd(i) - 0.5) * GOAL_W * 0.8, y1 = gy;
      if (shot.kind === 'goal' || shot.kind === 'on') x1 = Math.max(W / 2 - GOAL_W / 2 + 6, Math.min(W / 2 + GOAL_W / 2 - 6, x1));
      const dist = Math.hypot(x1 - x0, y1 - y0);
      return { x0, y0, x1, y1, h: Math.min(120, 20 + dist * 0.18) };
    });
    const cues = [];
    s.list.forEach((shot, i) => {
      const t = land(i);
      const same = cues.find(c => Math.abs(c.t - t) < STEP / 2);
      const made = shot.kind === 'goal';
      if (!same) cues.push({ t, kind: 'pop', made, clank: shot.kind === 'post' });
      else { same.made = same.made || made; same.clank = same.clank && shot.kind === 'post'; }
    });
    const count = (side, kinds) => s.list.filter(x => x.side === side && kinds.includes(x.kind)).length;
    const plotted = { home: [count('home', ['goal', 'on', 'off', 'post']), count('home', ['goal', 'on'])], away: [count('away', ['goal', 'on', 'off', 'post']), count('away', ['goal', 'on'])] };
    const PITCH = { bg: '#155232', hi: '#1f6b3f', lo: '#0c3520' };
    const markOf = (st) => [st.bg, st.acc, '#ffffff'].map(c => ({ c, k: contrastWith(c, PITCH.bg) })).sort((a, b) => b.k - a.k)[0].c;
    const marks = { home: markOf(d.home.style), away: markOf(d.away.style) };
    return {
      id: 'tiros',
      dur: 3 * BAR,
      accent: ACCENT,
      music: { energy: 'light' },
      cues,
      draw(ctx, t) {
        teamBg(ctx, PITCH, 0, 0, W, H, 0.5, 0.5);
        const k = easeOut(prog(t, 0.1, 0.4));
        ctx.save();
        ctx.globalAlpha = k;
        text(ctx, d.t?.shotMap || 'MAPA DE TIROS', M, 200, ANTON(110), '#ffffff');
        // Contadores: suben con los tiros que ya han llegado.
        const shown = (side) => s.list.filter((x, i) => x.side === side && t >= land(i));
        const counter = (side, img, right) => {
          const list = shown(side);
          const tot = Math.round(s[side].total * (list.length / Math.max(1, plotted[side][0])));
          const on = Math.round(s[side].on * (list.filter(x => x.kind === 'goal' || x.kind === 'on').length / Math.max(1, plotted[side][1])));
          const label = (d.t?.shotCount || '{t} TIROS · {o} A PUERTA').replace('{t}', tot).replace('{o}', on);
          if (right) {
            logo(ctx, img, W - M - 38, 300, 72);
            text(ctx, label, W - M - 90, 316, BARLOW(42), '#ffffff', 'right');
          } else {
            logo(ctx, img, M + 38, 300, 72);
            text(ctx, label, M + 90, 316, BARLOW(42), '#ffffff');
          }
        };
        counter('home', A.homeLogo, false);
        counter('away', A.awayLogo, true);
        ctx.restore();
        // El campo, trazo a trazo
        const lp = easeInOut(prog(t, 0.2, 0.8));
        ctx.save();
        ctx.strokeStyle = 'rgba(255,255,255,.5)';
        ctx.lineWidth = 4;
        ctx.setLineDash([5200, 5200]);
        ctx.lineDashOffset = 5200 * (1 - lp);
        ctx.strokeRect(PX, PY, PW, PH);
        ctx.beginPath(); ctx.moveTo(PX, PY + PH / 2); ctx.lineTo(PX + PW, PY + PH / 2); ctx.stroke();
        ctx.beginPath(); ctx.arc(W / 2, PY + PH / 2, 9.15 * sx, 0, Math.PI * 2); ctx.stroke();
        for (const topGoal of [true, false]) {
          const box = (depth, width) => ctx.strokeRect(W / 2 - (width / 2) * sx, topGoal ? PY : PY + PH - depth * sy, width * sx, depth * sy);
          box(16.5, 40.32);
          box(5.5, 18.32);
        }
        ctx.restore();
        // Las porterías, más visibles: es a donde va todo.
        for (const side of ['home', 'away']) {
          const gy = goalLine(side), dir = side === 'home' ? -1 : 1;
          ctx.save();
          ctx.globalAlpha = lp;
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 6;
          ctx.strokeRect(W / 2 - GOAL_W / 2, Math.min(gy, gy + dir * 22), GOAL_W, 22);
          // La red se mueve con cada gol
          const ripple = Math.max(0, ...s.list.map((x, i) => (x.side === side && x.kind === 'goal' ? 1 - prog(t, land(i), 0.4) : 0)).filter(v => v < 1));
          if (ripple > 0) {
            ctx.fillStyle = rgba(marks[side], 0.55 * ripple);
            ctx.fillRect(W / 2 - GOAL_W / 2 - 10 * ripple, Math.min(gy, gy + dir * (22 + 20 * ripple)), GOAL_W + 20 * ripple, 22 + 20 * ripple);
          }
          ctx.restore();
        }
        // 1 · Las marcas, en el sitio del tiro, al llegar
        s.list.forEach((shot, i) => {
          const p = prog(t, land(i), 0.28);
          if (p <= 0) return;
          const kk = easeBack(p), f = flights[i], c = marks[shot.side];
          ctx.beginPath();
          if (shot.kind === 'goal') {
            ctx.arc(f.x0, f.y0, 17 * kk, 0, Math.PI * 2);
            ctx.fillStyle = c;
            ctx.fill();
            ctx.lineWidth = 4;
            ctx.strokeStyle = '#111111';
            ctx.stroke();
          } else if (shot.kind === 'on') {
            ctx.arc(f.x0, f.y0, 11 * kk, 0, Math.PI * 2);
            ctx.fillStyle = c;
            ctx.fill();
          } else {
            ctx.arc(f.x0, f.y0, 10 * kk, 0, Math.PI * 2);
            ctx.lineWidth = 4;
            ctx.strokeStyle = rgba(c, 0.8);
            ctx.stroke();
          }
        });
        // 2 · Los balones: en el aire, hacia la portería (con su sombra); al llegar, el gol se
        // queda en la red, la parada rebota y el que va fuera sigue y se pierde.
        s.list.forEach((shot, i) => {
          const f = flights[i];
          const p = (t - launch(i)) / FLIGHT;
          if (p < 0) return;
          const lq = prog(t, launch(i), 0.25);
          if (lq > 0 && lq < 1) {
            ctx.save();
            ctx.globalAlpha = 0.6 * (1 - lq);
            ctx.lineWidth = 3;
            ctx.strokeStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(f.x0, f.y0, 8 + 22 * easeOut(lq), 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
          }
          const pos = (u) => ({ x: f.x0 + (f.x1 - f.x0) * u, y: f.y0 + (f.y1 - f.y0) * u, h: Math.sin(Math.PI * Math.min(u, 1)) * f.h });
          if (p < 1) {
            for (let j = 3; j >= 1; j--) {
              const u = p - j * 0.07;
              if (u <= 0) continue;
              const q = pos(u);
              football(ctx, q.x, q.y - q.h, 8, 0.12 * (4 - j));
            }
            const b = pos(p);
            ctx.beginPath();
            ctx.ellipse(b.x, b.y, 12, 6, 0, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(0,0,0,0.25)';
            ctx.fill();
            football(ctx, b.x, b.y - b.h, 15 + 5 * Math.sin(Math.PI * p), 1, p * 6);
          } else {
            const q = prog(t, land(i), 0.4);
            if (q >= 1) return;
            const dir = shot.side === 'home' ? -1 : 1;
            if (shot.kind === 'goal') {
              football(ctx, f.x1, f.y1 + dir * 18 * easeOut(q), 14, 1 - q * 0.6);
            } else if (shot.kind === 'on') {
              // El portero la saca: rebota hacia el campo
              football(ctx, f.x1 + (rnd(i) - 0.5) * 120 * easeOut(q), f.y1 - dir * 90 * easeOut(q), 14, 1 - q);
            } else {
              football(ctx, f.x1 + (f.x1 - f.x0) * 0.25 * easeOut(q), f.y1 + dir * 70 * easeOut(q), 14, 1 - q);
            }
          }
        });
        // Leyenda
        ctx.save();
        ctx.globalAlpha = k;
        const ly = 1560;
        football(ctx, M + 18, ly - 14, 16);
        ctx.font = BARLOW(38);
        const lw = (str) => ctx.measureText(str).width;
        const [lg, lo, lf] = [d.t?.goal || 'GOL', d.t?.onTarget || 'A PUERTA', d.t?.offTarget || 'FUERA O BLOQUEADO'];
        const x2 = M + 46 + lw(lg) + 60, x3 = x2 + 22 + lw(lo) + 60;
        text(ctx, lg, M + 46, ly, BARLOW(38), '#ffffff');
        ctx.beginPath(); ctx.arc(x2 - 22, ly - 14, 11, 0, Math.PI * 2); ctx.fillStyle = '#ffffff'; ctx.fill();
        text(ctx, lo, x2, ly, BARLOW(38), '#ffffff');
        ctx.beginPath(); ctx.arc(x3 - 22, ly - 14, 10, 0, Math.PI * 2); ctx.lineWidth = 4; ctx.strokeStyle = '#ffffff'; ctx.stroke();
        text(ctx, lf, x3, ly, BARLOW(38), '#ffffff');
        ctx.restore();
      },
    };
  }

  // 4 · Jugador del partido: la foto (o su dorsal) sube, el nombre y sus 3 números uno a uno.
  // El radio del retrato: a 0,78 en pantalla sale de ~330 px, unas dos veces la cara de 150 px.
  const FACE_R = 210;
  function sceneJugador(d, A) {
    const m = d.jugador, st = m.style;
    const nums = m.stats.slice(0, 3);
    const statAt = (i) => (i + 1) * 2 * BEAT;
    const counts = (v) => /^\d+(\/\d+|%)?$/.test(String(v));
    return {
      id: 'jugador',
      dur: 3 * BAR,
      accent: st.acc,
      music: { energy: 'full' },
      cues: [
        ...nums.flatMap((s, i) => [{ t: statAt(i), kind: 'hit' }, ...(counts(s.v) ? ticks(statAt(i) + STEP, statAt(i) + 0.7, 0.6) : [])]),
        { t: 2 * BAR, kind: 'slam' },
      ],
      draw(ctx, t) {
        teamBg(ctx, st);
        // El escudo grande de fondo; con el retrato no (el escudo ya va en el retrato)
        if (A.jugadorPhoto || !A.jugadorFace) logo(ctx, A.jugadorLogo, W - 200, 520, 900 * (1 + 0.05 * prog(t, 0, 3 * BAR)), 0.12);
        const e = easeOut(prog(t, 0.05, 0.75));
        if (A.jugadorPhoto) {
          const pw = 1500 * (1 + 0.035 * prog(t, 0, 3 * BAR));
          imgBottom(ctx, A.jugadorPhoto, W - pw + 400, H + 40 + (1 - e) * 500, pw, e);
        } else if (A.jugadorFace) {
          // Su cara de API-Football en un retrato redondo (como en la slide), con el dorsal detrás
          if (m.number) {
            ctx.save();
            ctx.globalAlpha = 0.16 * e;
            ctx.lineWidth = 6;
            ctx.strokeStyle = st.fg;
            ctx.font = ANTON(1000);
            ctx.textAlign = 'right';
            ctx.strokeText(m.number, W + 40, 1700 + (1 - e) * 200);
            ctx.restore();
          }
          const r = FACE_R, cx = W - M - r - 10, cy = 1010 + (1 - e) * 120;
          ctx.save();
          ctx.globalAlpha = e;
          ctx.beginPath(); ctx.arc(cx, cy, r + 28, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(255,255,255,.1)'; ctx.fill();
          ctx.beginPath(); ctx.arc(cx, cy, r + 10, 0, Math.PI * 2);
          ctx.fillStyle = st.acc; ctx.fill();
          ctx.save();
          ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.clip();
          ctx.fillStyle = '#e6e3dc'; ctx.fillRect(cx - r, cy - r, 2 * r, 2 * r);
          ctx.drawImage(A.jugadorFace, cx - r, cy - r, 2 * r, 2 * r);
          ctx.restore();
          if (A.jugadorLogo) {
            const bx = cx + r * 0.72, by = cy + r * 0.72;
            ctx.beginPath(); ctx.arc(bx, by, 70, 0, Math.PI * 2);
            ctx.fillStyle = '#ffffff'; ctx.fill();
            ctx.lineWidth = 6; ctx.strokeStyle = st.acc; ctx.stroke();
            logo(ctx, A.jugadorLogo, bx, by, 88);
          }
          ctx.restore();
        } else if (m.number) {
          ctx.save();
          ctx.globalAlpha = 0.16 * e;
          text(ctx, m.number, W + 40, 1500 + (1 - e) * 200, ANTON(1000), st.fg, 'right');
          ctx.restore();
        }
        fadeBottom(ctx, st.lo, 560);
        const k = easeOut(prog(t, 0.15, 0.4));
        ctx.save();
        ctx.globalAlpha = k;
        ctx.translate((1 - k) * -80, 0);
        ctx.font = ANTON(64);
        const [kw, kr] = [d.t?.player || 'JUGADOR', d.t?.ofMatch || ' DEL PARTIDO'];
        text(ctx, kw, M, 230, ANTON(64), st.hl);
        text(ctx, kr, M + ctx.measureText(kw).width, 230, ANTON(64), st.fg);
        if (m.first) text(ctx, up(m.first), M, 312, BARLOW(54), st.fg);
        text(ctx, up(m.last), M, 470, ANTON(fit(ctx, up(m.last), ANTON, 160, W - 2 * M)), st.fg);
        ctx.restore();
        nums.forEach((s, i) => {
          const start = statAt(i);
          const a = easeOut(prog(t, start, 0.35));
          if (a <= 0) return;
          const y = 790 + i * 300;
          const size = String(s.v).length <= 2 ? 240 : String(s.v).length <= 4 ? 210 : 170;
          ctx.save();
          ctx.globalAlpha = a;
          ctx.translate((1 - a) * -60, 0);
          ctx.shadowColor = 'rgba(0,0,0,.25)';
          ctx.shadowBlur = 30;
          text(ctx, countText(s.v, easeOut(prog(t, start, 0.7))), M, y, ANTON(size), st.fg);
          ctx.shadowColor = 'transparent';
          chip(ctx, s.label, M, y + 22, st, 38);
          ctx.restore();
        });
        tape(ctx, m.scoreLine, W - M - 330, 1530, st, fit(ctx, up(m.scoreLine), ANTON, 54, 640), prog(t, 2 * BAR, 0.45));
      },
    };
  }

  // 5 · Estadísticas: cada equipo en su mitad y una fila por pulso, con los números subiendo;
  // el peor, apagado.
  function sceneStats(d, A) {
    const rows = d.stats.slice(0, 5);
    const rowAt = (i) => (i + 1) * BEAT;
    const TOP = 520, ROW = 190;
    return {
      id: 'stats',
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
        const k = easeOut(prog(t, 0.1, 0.4));
        ctx.save();
        ctx.globalAlpha = k;
        ctx.font = ANTON(56);
        const title = d.t?.stats || 'ESTADÍSTICAS';
        const tw = ctx.measureText(title).width + 40;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(W / 2 - tw / 2, 70, tw, 82);
        text(ctx, title, W / 2, 133, ANTON(56), '#111111', 'center');
        ctx.restore();
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
            ctx.globalAlpha = a * (worse ? 0.45 : 1);
            const val = r.pct ? `${countText(Math.round(r.v[j]), c)}%` : countText(r.v[j], c);
            text(ctx, val, j ? W - 200 : 200, y + 70, ANTON(130), st.fg, 'center');
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

  // 6 · Clasificación: las filas entran una a una y los dos equipos del partido, con su color.
  function sceneTable(d, A) {
    const rows = d.table.rows.slice(0, 11);
    const rowAt = (i) => BEAT + i * STEP;
    const TOP = 560, ROW = 84;
    return {
      id: 'tabla',
      dur: 2 * BAR,
      accent: (d.home.won ? d.home : d.away).style.acc,
      music: { energy: 'full' },
      cues: [{ t: BEAT, kind: 'whoosh', dur: 0.5, vel: 0.5 }, ...rows.map((r, i) => (r?.me ? { t: rowAt(i), kind: 'hit', vel: 0.9 } : null)).filter(Boolean)],
      draw(ctx, t) {
        const P = sheet(d);
        sheetBg(ctx, d);
        const k = easeOut(prog(t, 0.1, 0.4));
        ctx.save();
        ctx.globalAlpha = k;
        const lines = wrap(ctx, up(d.table.title), ANTON(110), W - 2 * M);
        lines.slice(0, 2).forEach((l, i) => text(ctx, l, M, 240 + i * 120, ANTON(110), P.ink));
        text(ctx, 'PTS', W - M - 20, TOP - 30, BARLOW(34), P.mute, 'center');
        ctx.restore();
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
          let fg = P.ink;
          if (r.me) {
            // Con su color (si no se vería sobre el fondo, el blanco en el claro o el negro en el
            // oscuro, con el del acento)
            const st = d[r.me].style;
            const hidden = d.dark ? contrastWith(st.bg, NIGHT) < 1.4 : contrastWith(st.bg, '#ece9e2') < 1.3;
            ctx.fillStyle = hidden ? st.acc : st.bg;
            fg = hidden ? st.on : st.fg;
            roundRect(ctx, M - 16, y, W - 2 * M + 32, ROW - 10, 16);
            ctx.fill();
          } else if (i % 2 === 0) {
            ctx.fillStyle = P.zebra;
            roundRect(ctx, M - 16, y, W - 2 * M + 32, ROW - 10, 16);
            ctx.fill();
          }
          text(ctx, String(r.rank), M + 30, y + 54, ANTON(46), fg, 'center');
          logo(ctx, A.tableLogos[i], M + 110, y + 37, 54);
          text(ctx, up(r.name), M + 160, y + 54, BARLOW(fit(ctx, up(r.name), (z) => BARLOW(z), 44, 620)), fg);
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
      music: { energy: 'outro' },
      cues: [{ t: 0.2, kind: 'riser', dur: BAR - 0.2, vel: 0.6 }, ...(d.brand || !d.sign ? [] : [{ t: BAR, kind: 'stab' }, { t: BAR, kind: 'impact', vel: 0.8 }])],
      draw(ctx, t) {
        teamBg(ctx, st);
        if (A.closingPhoto) {
          const pw = 1500 * (1 + 0.04 * prog(t, 0, 2 * BAR));
          imgBottom(ctx, A.closingPhoto, W - pw + 380, H + 40, pw, 0.3);
        } else {
          logo(ctx, A.closingLogo, W - 260, 1180, 820 * (1 + 0.04 * prog(t, 0, 2 * BAR)), 0.13);
        }
        fadeBottom(ctx, st.lo, 700);
        const size = wrap(ctx, up(c.question), ANTON(150), W - 2 * M).length > 4 ? 120 : 150;
        const ls = wrap(ctx, up(c.question), ANTON(size), W - 2 * M);
        ls.forEach((l, i) => {
          const e = easeOut(prog(t, 0.1 + i * 0.12, 0.45));
          ctx.save();
          ctx.globalAlpha = e;
          ctx.translate(0, (1 - e) * 60);
          text(ctx, l, M, 470 + i * size * 1.05, ANTON(size), st.fg);
          ctx.restore();
        });
        const after = 470 + ls.length * size * 1.05;
        const e1 = easeOut(prog(t, 0.6, 0.4));
        ctx.save();
        ctx.globalAlpha = e1;
        text(ctx, d.t?.comments || 'TE LEO EN COMENTARIOS', M, after + 30, BARLOW(48), st.hl);
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
        // El destello del golpe
        if (t >= HIT) fillAll(ctx, `rgba(255,255,255,${0.32 * (1 - prog(t, HIT, 0.2))})`);
        // Debajo, «Sígueme para más fútbol» y tu firma
        const e = easeOut(prog(t, HIT + 0.25, 0.35));
        if (e > 0) {
          ctx.save();
          ctx.globalAlpha = e;
          ctx.translate(0, (1 - e) * 40);
          text(ctx, up(d.t?.follow || 'Sígueme para más fútbol'), cx, cy + R + 150, BARLOW(46), ACCENT, 'center');
          if (d.sign) text(ctx, d.sign, cx, cy + R + 290, ANTON(fit(ctx, d.sign, ANTON, 120, W - 2 * M)), '#ffffff', 'center');
          ctx.restore();
        }
      },
    };
  }

  // 1b · El dato: la etiqueta, el número grande que sube, lo que significa y la frase entera.
  // Dura 3 compases, o 4 si la frase no cabe.
  function sceneDato(d, A) {
    const x = d.dato, st = x.style;
    const need = String(x.sentence || '').split(/\s+/).filter(Boolean).reduce((sum, w) => sum + sayTime(w), 0);
    const dur = need > 3 * BAR - SPEAK_FROM - SPEAK_END ? 4 * BAR : 3 * BAR;
    const counts = /^\d+(\/\d+)?$/.test(x.big);
    return {
      id: 'dato',
      dur,
      accent: st.acc,
      music: { energy: 'full' },
      cues: [{ t: BEAT, kind: 'slam' }, ...(counts ? ticks(BEAT + STEP, BEAT + 0.8, 0.6) : []), { t: 2 * BAR, kind: 'hit', vel: 0.8 }],
      draw(ctx, t) {
        teamBg(ctx, st);
        logo(ctx, x.side === 'away' ? A.awayLogo : A.homeLogo, W - 160, 640, 920 * (1 + 0.05 * prog(t, 0, dur)), 0.12);
        const k = easeOut(prog(t, 0.05, 0.4));
        ctx.save();
        ctx.globalAlpha = k;
        ctx.translate((1 - k) * -80, 0);
        chip(ctx, d.t?.dato || 'EL DATO', M, 190, st, 52);
        if (x.who) text(ctx, up(x.who), M, 380, BARLOW(fit(ctx, up(x.who), BARLOW, 60, W - 2 * M)), st.fg);
        ctx.restore();
        const big = up(x.big);
        const size = fit(ctx, big, ANTON, big.length <= 2 ? 560 : 440, W - 2 * M);
        const a = easeBack(prog(t, BEAT, 0.5));
        if (a > 0) {
          ctx.save();
          ctx.translate(M, 900);
          ctx.scale(a, a);
          ctx.shadowColor = 'rgba(0,0,0,.25)';
          ctx.shadowBlur = 40;
          text(ctx, countText(big, easeOut(prog(t, BEAT, 0.8))), 0, 0, ANTON(size), st.hl);
          ctx.restore();
        }
        const unit = wrap(ctx, up(x.unit), ANTON(84), W - 2 * M).slice(0, 3);
        unit.forEach((l, i) => {
          const e = easeOut(prog(t, 2 * BEAT + i * 0.1, 0.4));
          ctx.save();
          ctx.globalAlpha = e;
          ctx.translate((1 - e) * -60, 0);
          text(ctx, l, M, 1020 + i * 92, ANTON(84), st.fg);
          ctx.restore();
        });
        const top = 1020 + unit.length * 92 + 40;
        const lines = wrap(ctx, x.sentence, BARLOW(54, 700), W - 2 * M).slice(0, 4);
        const e = easeOut(prog(t, BAR, 0.5));
        ctx.save();
        ctx.globalAlpha = e;
        ctx.translate(0, (1 - e) * 40);
        lines.forEach((l, i) => text(ctx, l, M, top + i * 64, BARLOW(54, 700), st.fg));
        ctx.restore();
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

  // intro: con la apertura de los escudos (se quita en el Studio).
  function buildScenes(d, A, intro = true) {
    return [
      intro && sceneIntro(d, A),
      sceneScore(d, A),
      d.dato && sceneDato(d, A),
      d.goals?.length && sceneGoals(d, A),
      d.shots?.list.length >= 4 && sceneShots(d, A),
      d.jugador && sceneJugador(d, A),
      d.stats?.length >= 3 && sceneStats(d, A),
      d.table?.rows.length && sceneTable(d, A),
      sceneOutro(d, A),
      d.brand && sceneMarca(d, A),
    ].filter(Boolean);
  }
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
  const SPEAK_END = 0.3;
  // Lo que se tarda en decir una palabra, a ritmo de short (unas 170 por minuto): más cuanto
  // más larga, las cifras mucho más y una pausa corta tras un punto o una coma.
  const sayTime = (w) => 0.1 + 0.05 * (w.match(/\p{L}/gu) || []).length + 0.17 * (w.match(/\d/g) || []).length
    + (/[.,:;!?…]$/.test(w) ? 0.15 : 0);

  function captionWords(scenes, starts, script) {
    const words = [];
    scenes.forEach((sc, i) => {
      const tokens = String(script?.[sc.id] || '').trim().split(/\s+/).filter(Boolean);
      if (!tokens.length || sc.noScript) return;
      const room = sc.dur - SPEAK_FROM - SPEAK_END;
      const need = tokens.reduce((sum, w) => sum + sayTime(w), 0);
      const k = Math.min(1, room / need);
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
      return { id: sc.id, dur: sc.dur, words: tokens.length, speed: need / (sc.dur - SPEAK_FROM - SPEAK_END) };
    });
  }

  // Subtítulos de creador: mayúsculas gruesas con borde negro, de dos o tres palabras, y la
  // que suena sobre un recuadro verde lima que salta.
  const CAP_FONT = (size) => `900 ${size}px Montserrat, "Arial Black", sans-serif`;
  const CAP_Y = 1650;
  const CAP_SIZE = 84;
  const CAP_MAX_W = W - 2 * M - 40;
  const capUp = (w) => up(w).replace(/[,;:]$/, '');
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
        cur = { scene: w.scene, words: [] };
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
          drawScene(ctx, scenes[i - 1], scenes[i - 1].dur + t);
          const e = easeInOut(t / TRANSITION);
          const SL = 320;
          const edge = H + SL - e * (H + 2 * SL);
          ctx.save();
          ctx.beginPath();
          ctx.moveTo(0, H); ctx.lineTo(W, H); ctx.lineTo(W, edge - SL); ctx.lineTo(0, edge);
          ctx.closePath();
          ctx.clip();
          drawScene(ctx, scenes[i], t);
          ctx.restore();
          ctx.beginPath();
          ctx.moveTo(0, edge); ctx.lineTo(W, edge - SL); ctx.lineTo(W, edge - SL - 28); ctx.lineTo(0, edge - 28);
          ctx.closePath();
          ctx.fillStyle = scenes[i].accent;
          ctx.fill();
        } else {
          drawScene(ctx, scenes[i], t);
        }
        ctx.restore();
        inSafe(ctx, () => {
          if (brandImg && !['intro', 'outro', 'marca'].includes(scenes[i].id)) drawBrand(ctx, brandImg);
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

  async function loadAssets(d) {
    await Promise.all([
      document.fonts.load('100px Anton'),
      document.fonts.load('800 50px "Barlow Condensed"'),
      document.fonts.load('700 50px "Barlow Condensed"'),
      document.fonts.load('900 84px Montserrat'),
    ]);
    const [homeLogo, awayLogo, jugadorPhoto, jugadorFace, jugadorLogo, closingPhoto, brandImg, ...tableLogos] = await Promise.all([
      loadImage(d.home.logo), loadImage(d.away.logo), loadImage(d.jugador?.photo), loadImage(d.jugador?.face), loadImage(d.jugador?.logo),
      loadImage(d.closing.photo), loadImage(d.brand),
      ...(d.table?.rows || []).map(r => loadImage(r?.logo)),
    ]);
    const closingLogo = d.closing.side === 'away' ? awayLogo : homeLogo;
    return { homeLogo, awayLogo, jugadorPhoto, jugadorFace: crisp(jugadorFace, 2 * FACE_R), jugadorLogo, closingPhoto, closingLogo, brandImg, tableLogos };
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
  //     voiceShift, musicVolume, voiceVolume, musicStyle }) → { blob, ext, note, audio, mix }
  //     intro: con la apertura de los escudos. voiceLead: la apertura con la que se grabó la voz
  //     (prepare(…).lead). voiceShift: cuánto se mueve la voz (negativo = antes).
  //     musicStyle: 'trap' (la urbana, por defecto) o 'epica'.
  // · StudioVideo.prepare(datos, script, { intro }) → para grabarse: draw(ctx, t), la duración y
  //     cada palabra con su momento.
  // · StudioVideo.plan(datos, script) → las escenas con guion, lo que duran y a qué velocidad
  //     habría que decir cada frase (1 = ritmo normal).
  // · StudioVideo.audio(datos, { … }) → solo el sonido del vídeo en WAV, para ajustar el volumen.
  // · StudioVideo.measureVoiceLag(voz, palabras) → cuánto llega tarde la voz (segundos).
  // ============================================================
  async function render(data, onProgress = () => {}, {
    music = true, script = null, captions = true, voice = null, musicVolume = 1, voiceVolume = 1,
    intro = true, voiceLead = null, voiceShift = 0, musicStyle = 'trap',
  } = {}) {
    const live = ((music && window.StudioAudio) || voice) && typeof AudioContext !== 'undefined' ? new AudioContext() : null;
    try {
      const assets = await loadAssets(data);
      const scenes = buildScenes(data, assets, intro);
      const words = captionWords(scenes, sceneStarts(scenes), script);
      const withCaptions = !!(captions && words.length);
      const delay = (voiceLead == null ? 0 : leadOf(scenes) - voiceLead) + (voiceShift || 0);
      const drawer = makeDrawer(scenes, withCaptions ? captionPages(words) : null, assets.brandImg);
      let audioBuffer = null;
      if (music && window.StudioAudio) {
        onProgress(0, 'Componiendo la música…');
        audioBuffer = await window.StudioAudio.render(soundTimeline(drawer, seedOf(data), musicStyle));
      }
      const audioOut = audioBuffer ? window.StudioAudio.toWav(audioBuffer, drawer.duration) : null;
      if (voice || (audioBuffer && musicVolume !== 1)) {
        if (voice) onProgress(0, 'Mezclando tu voz…');
        audioBuffer = mixAudio(audioBuffer, voice && await decodeVoice(voice), drawer.duration, words, { musicVolume, voiceVolume, delay });
      }
      const mix = { music: !!(music && window.StudioAudio), captions: withCaptions, voice: !!voice, intro: leadOf(scenes) > 0, lead: leadOf(scenes) };
      const codec = await pickCodec();
      const acodec = audioBuffer ? await pickAudioCodec(audioBuffer.sampleRate) : null;
      if (codec && (!audioBuffer || acodec)) {
        const blob = await encodeWebCodecs(drawer, codec, onProgress, audioBuffer && { buffer: audioBuffer, codec: acodec });
        const notes = [];
        if (codec.muxer !== 'avc') notes.push('el vídeo va en VP9');
        if (acodec && acodec.muxer !== 'aac') notes.push('el sonido va en Opus');
        return {
          blob, ext: 'mp4', audio: audioOut, mix,
          note: notes.length ? `Tu navegador no tiene H.264/AAC: ${notes.join(' y ')}. Si TikTok no lo acepta, créalo con Chrome.` : '',
        };
      }
      const blob = await recordRealtime(drawer, onProgress, audioBuffer, live);
      const ext = blob.type.includes('mp4') ? 'mp4' : 'webm';
      return { blob, ext, audio: audioOut, mix, note: ext === 'webm' ? 'Este navegador solo graba WebM: TikTok e Instagram lo aceptan, pero el MP4 sale con Chrome.' : '' };
    } finally {
      live?.close();
    }
  }

  async function prepare(data, script, { intro = true } = {}) {
    const assets = await loadAssets(data);
    const scenes = buildScenes(data, assets, intro);
    const words = captionWords(scenes, sceneStarts(scenes), script);
    const drawer = makeDrawer(scenes, words.length ? captionPages(words) : null, assets.brandImg);
    return { duration: drawer.duration, draw: (ctx, t) => drawer.draw(ctx, t), words, lead: leadOf(scenes), W, H };
  }

  const plan = (data, script) => scriptFit(buildScenes(data, {}), script);

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

  window.StudioVideo = { render, prepare, plan, audio, measureVoiceLag, crisp, layerCount: () => layers.size };
})();
