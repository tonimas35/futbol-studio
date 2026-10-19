// EL CAMPO EN 3D · el mundo de la escena del partido del vídeo, con Three.js (licencia MIT, de
// jsDelivr): el estadio como una maqueta que flota sobre el fondo (con su sombra), con su grada (la
// afición de cada equipo, que salta en sus goles), las cubiertas y las vallas; el césped con sus
// briznas y franjas, el territorio de cada equipo teñido en el césped hasta la frontera (la ola), las porterías con sus postes y la red que se hunde con el balón, el
// balón con sus paneles, luces, sombras y el confeti de cada gol. Sin tarjeta gráfica (WebGL por
// software, como en el robot), todo más ligero. Se dibuja en su propio canvas (WebGL) y el vídeo lo pega en el
// suyo y pone encima lo de siempre (el marcador, los rótulos…). Sin WebGL, o si Three.js no carga,
// el vídeo sigue con el campo en 2D.
//
//   const mundo = await Campo3D.create({ W, H, grass, home, away, accent, dark })
//   mundo.frame({ cam, front, terr, cover, ball, trail, nets, burst, cheer, ripples, focus })   → un fotograma
//   mundo.project([x, y, z])  → dónde cae ese punto en la pantalla (de -1 a 1, como en WebGL)
//
// El campo: x a lo ancho (de -34 a 34), y hacia arriba, z a lo largo (de -52,5 a 52,5); el local
// ataca hacia z = +52,5.
(() => {
  const THREE_URL = 'https://cdn.jsdelivr.net/npm/three@0.186.1/build/three.module.js';
  const PL = 105, PW = 68, HL = PL / 2;
  // El césped de fuera de las líneas: a los lados y detrás de las porterías (con sitio para la red)
  const MX = 7, MZ = 7, XW = PW + 2 * MX, ZL = PL + 2 * MZ;
  const GW = 7.32, GH = 2.44, POST = 0.06;
  const BALL = 0.11;
  // La grada: empieza a 1 m del césped; 16 filas de 1,6 m de fondo y 0,95 m de alto sobre un muro de
  // 2 m; la cubierta, a 25 m
  const ST_X = PW / 2 + MX + 1, ST_Z = PL / 2 + MZ + 1, ROWS = 16, ROW_D = 1.6, ROW_H = 0.95, WALL = 2;
  const ST_D = ROWS * ROW_D, ROOF_Y = 25;
  // Los puntos de la frontera (la ola), de banda a banda
  const N_FRONT = 33;
  // Un número para GLSL (siempre con decimales)
  const glf = (x) => (Number.isInteger(x) ? `${x}.0` : String(x));

  let lib = null;
  const load = () => (lib ||= import(THREE_URL).catch((e) => { console.warn('Campo3D: no carga Three.js', e); return null; }));

  async function create(o) {
    const THREE = await load();
    if (!THREE) return null;
    try {
      return build(THREE, o);
    } catch (e) {
      console.warn('Campo3D: sin 3D', e);
      return null;
    }
  }

  // ─── Texturas, hechas en el navegador ───
  function canvasOf(w, h, draw) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    return c;
  }
  // Las líneas del campo, blancas sobre negro, de todo el césped (con el margen)
  function linesCanvas() {
    const ppm = 24;
    return canvasOf(Math.round(XW * ppm), Math.round(ZL * ppm), (g, w, h) => {
      g.fillStyle = '#000';
      g.fillRect(0, 0, w, h);
      const X = (x) => (x + XW / 2) * ppm, Z = (z) => (z + ZL / 2) * ppm;
      g.strokeStyle = '#fff';
      g.fillStyle = '#fff';
      g.lineWidth = 0.12 * ppm;
      const line = (pts) => { g.beginPath(); pts.forEach(([x, z], i) => (i ? g.lineTo(X(x), Z(z)) : g.moveTo(X(x), Z(z)))); g.stroke(); };
      const arc = (x, z, r, a0, a1) => { g.beginPath(); g.arc(X(x), Z(z), r * ppm, a0, a1); g.stroke(); };
      const spot = (x, z) => { g.beginPath(); g.arc(X(x), Z(z), 0.16 * ppm, 0, Math.PI * 2); g.fill(); };
      line([[-PW / 2, -HL], [PW / 2, -HL], [PW / 2, HL], [-PW / 2, HL], [-PW / 2, -HL]]);
      line([[-PW / 2, 0], [PW / 2, 0]]);
      arc(0, 0, 9.15, 0, Math.PI * 2);
      spot(0, 0);
      for (const s of [-1, 1]) {
        const gz = s * HL;
        line([[-20.16, gz], [-20.16, gz - s * 16.5], [20.16, gz - s * 16.5], [20.16, gz]]);
        line([[-9.16, gz], [-9.16, gz - s * 5.5], [9.16, gz - s * 5.5], [9.16, gz]]);
        spot(0, gz - s * 11);
        // El arco del área: la parte del círculo de 9,15 m del penalti que queda fuera
        const a = Math.acos(5.5 / 9.15), c = s > 0 ? -Math.PI / 2 : Math.PI / 2;
        arc(0, gz - s * 11, 9.15, c - a, c + a);
      }
      // Los córners: un cuarto de círculo, el de dentro del campo
      g.save();
      g.beginPath();
      g.rect(X(-PW / 2), Z(-HL), PW * ppm, PL * ppm);
      g.clip();
      for (const x of [-PW / 2, PW / 2]) for (const z of [-HL, HL]) arc(x, z, 1, 0, Math.PI * 2);
      g.restore();
    });
  }
  // El grano del césped: ruido suave que se repite
  function noiseCanvas() {
    return canvasOf(256, 256, (g, w, h) => {
      const im = g.createImageData(w, h);
      let seed = 7;
      const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
      for (let i = 0; i < w * h; i++) {
        const v = 110 + rnd() * 90;
        im.data[i * 4] = im.data[i * 4 + 1] = im.data[i * 4 + 2] = v;
        im.data[i * 4 + 3] = 255;
      }
      g.putImageData(im, 0, 0);
      // Un poco borroso: grano de césped, no de televisión
      g.filter = 'blur(1px)';
      g.drawImage(g.canvas, 0, 0);
    });
  }
  // Las briznas de hierba: trazos cortos, casi verticales, más claros y más oscuros (en gris: el
  // color lo pone el equipo). Se repite sin costuras.
  function bladesCanvas() {
    return canvasOf(512, 512, (g, w, h) => {
      g.fillStyle = 'rgb(128,128,128)';
      g.fillRect(0, 0, w, h);
      let seed = 11;
      const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
      g.lineCap = 'round';
      for (let i = 0; i < 14000; i++) {
        const x = rnd() * w, y = rnd() * h, l = 5 + rnd() * 11, a = (rnd() - 0.5) * 0.7, v = Math.round(70 + rnd() * 120);
        g.strokeStyle = `rgb(${v},${v},${v})`;
        g.lineWidth = 0.8 + rnd() * 1.4;
        for (const dx of [-w, 0, w]) for (const dy of [-h, 0, h]) {
          g.beginPath();
          g.moveTo(x + dx, y + dy);
          g.lineTo(x + dx + Math.sin(a) * l, y + dy - Math.cos(a) * l);
          g.stroke();
        }
      }
    });
  }
  // La red: hilos blancos en rombo sobre transparente
  function netCanvas() {
    return canvasOf(128, 128, (g, w, h) => {
      g.clearRect(0, 0, w, h);
      g.strokeStyle = '#fff';
      g.lineWidth = 4;
      g.beginPath();
      g.moveTo(0, h / 2); g.lineTo(w / 2, 0); g.lineTo(w, h / 2); g.lineTo(w / 2, h); g.closePath();
      g.stroke();
    });
  }
  // El balón de siempre (el icosaedro truncado): 12 pentágonos negros, 20 hexágonos blancos y las
  // costuras. Cada punto de la esfera es del panel cuyo plano corta antes el rayo desde el centro.
  function ballCanvas() {
    const f = (1 + Math.sqrt(5)) / 2;
    const norm = (v) => { const l = Math.hypot(...v); return v.map(x => x / l); };
    const ico = [[0, 1, f], [0, -1, f], [0, 1, -f], [0, -1, -f], [1, f, 0], [-1, f, 0], [1, -f, 0], [-1, -f, 0], [f, 0, 1], [-f, 0, 1], [f, 0, -1], [-f, 0, -1]].map(norm);
    const faces = [];
    for (let i = 0; i < 12; i++) for (let j = i + 1; j < 12; j++) for (let k = j + 1; k < 12; k++) {
      const d = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
      if (d(ico[i], ico[j]) > 0.4 && d(ico[j], ico[k]) > 0.4 && d(ico[i], ico[k]) > 0.4) faces.push(norm([0, 1, 2].map(c => ico[i][c] + ico[j][c] + ico[k][c])));
    }
    // La distancia de cada plano al centro (los pentágonos, algo más lejos: paneles más pequeños)
    const centers = [...ico.map(n => ({ n, d: 2.327, pent: true })), ...faces.map(n => ({ n, d: 2.267, pent: false }))];
    return canvasOf(1024, 512, (g, w, h) => {
      const im = g.createImageData(w, h);
      for (let y = 0; y < h; y++) {
        const phi = ((y + 0.5) / h) * Math.PI, sp = Math.sin(phi), cp = Math.cos(phi);
        for (let x = 0; x < w; x++) {
          const th = ((x + 0.5) / w) * Math.PI * 2;
          const p = [-sp * Math.cos(th), cp, sp * Math.sin(th)];
          let b1 = -1, b2 = -1, best = null;
          for (const c of centers) {
            const s = (p[0] * c.n[0] + p[1] * c.n[1] + p[2] * c.n[2]) / c.d;
            if (s > b1) { b2 = b1; b1 = s; best = c; } else if (s > b2) b2 = s;
          }
          const seam = (b1 - b2) / b1 < 0.012;
          const v = seam ? 120 : best.pent ? 28 : 246;
          const i = (y * w + x) * 4;
          im.data[i] = im.data[i + 1] = im.data[i + 2] = v;
          im.data[i + 3] = 255;
        }
      }
      g.putImageData(im, 0, 0);
    });
  }

  // ¿Hay tarjeta gráfica? Sin ella (como en el robot de GitHub), WebGL va por software (SwiftShader) y
  // cada fotograma cuesta mucho: entonces el campo se dibuja más ligero (sin antialiasing, sombras
  // más simples, la afición en cubos y a 3/4 de resolución)
  function software() {
    try {
      const gl = document.createElement('canvas').getContext('webgl2');
      const ext = gl?.getExtension('WEBGL_debug_renderer_info');
      const name = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : '';
      gl?.getExtension('WEBGL_lose_context')?.loseContext();
      return /swiftshader|llvmpipe|software/i.test(name);
    } catch (e) {
      return false;
    }
  }

  function build(THREE, o) {
    const LOW = o.low ?? software(), SC = LOW ? 0.75 : 1;
    const W = Math.round(o.W * SC), H = Math.round(o.H * SC);
    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: !LOW, alpha: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(1);
    renderer.setSize(W, H, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NoToneMapping;
    renderer.shadowMap.enabled = !LOW;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.setClearColor(0x000000, 0);
    const aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, W / H, 0.3, 700);
    const color = (c) => new THREE.Color(c);
    const tex = (c, srgb = true) => {
      const t = new THREE.CanvasTexture(c);
      if (srgb) t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = aniso;
      return t;
    };

    // ─── Luces: el cielo y un sol alto, de lado, con sombras suaves ───
    scene.add(new THREE.HemisphereLight(0xffffff, o.dark ? 0x2a3a30 : 0xb8c4b0, o.dark ? 1.2 : 1.85));
    const sun = new THREE.DirectionalLight(o.dark ? 0xeef3ff : 0xffffff, o.dark ? 1.75 : 1.3);
    sun.castShadow = true;
    sun.shadow.mapSize.set(LOW ? 1024 : 2048, LOW ? 1024 : 2048);
    sun.shadow.bias = -0.0012;
    sun.shadow.normalBias = 0.08;
    sun.shadow.radius = 4;
    scene.add(sun, sun.target);
    const SUN_DIR = new THREE.Vector3(-0.45, 1, -0.3).normalize();

    // ─── El césped: las franjas, el grano, el territorio de cada equipo, las líneas y la frontera ───
    const linesTex = tex(linesCanvas(), false);
    const noiseTex = tex(noiseCanvas(), false);
    noiseTex.wrapS = noiseTex.wrapT = THREE.RepeatWrapping;
    const bladesTex = tex(bladesCanvas(), false);
    bladesTex.wrapS = bladesTex.wrapT = THREE.RepeatWrapping;
    const U = {
      uGrassA: { value: color(o.grass[0]) }, uGrassB: { value: color(o.grass[1]) },
      uHome: { value: color(o.home.bg) }, uAway: { value: color(o.away.bg) },
      uLineHome: { value: color(o.home.line) }, uLineAway: { value: color(o.away.line) },
      uAccent: { value: color(o.accent) },
      uLines: { value: linesTex }, uNoise: { value: noiseTex }, uBlades: { value: bladesTex },
      uFront: { value: new Float32Array(N_FRONT) }, uTerr: { value: 0 }, uHalves: { value: 0 },
    };
    const groundMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
    groundMat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, U);
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', `#include <common>
          varying vec3 vWPos;
          uniform vec3 uGrassA, uGrassB, uHome, uAway, uLineHome, uLineAway, uAccent;
          uniform sampler2D uLines, uNoise, uBlades;
          uniform float uFront[${N_FRONT}];
          uniform float uTerr, uHalves;
          float frontAt(float x) {
            float fx = clamp((x + ${glf(PW / 2)}) / ${glf(PW)}, 0.0, 1.0) * ${glf(N_FRONT - 1)};
            int i = int(floor(fx));
            int j = min(i + 1, ${N_FRONT - 1});
            return mix(uFront[i], uFront[j], fract(fx));
          }
`)
        .replace('#include <map_fragment>', `
          float stripe = mod(floor((vWPos.z + ${glf(HL)}) / ${glf(PL / 12)}), 2.0);
          // La hierba: briznas, manchas y las franjas del corte; el color del equipo lleva el mismo tono
          float blade = texture2D(uBlades, vWPos.xz * vec2(0.55, 0.9)).r;
          float patchy = texture2D(uNoise, vWPos.xz / 23.0).r;
          float lum = 1.0 + (blade - 0.5) * 0.6 + (patchy - 0.5) * 0.4 + (stripe - 0.5) * 0.18;
          vec3 grass = mix(uGrassA, uGrassB, stripe) * lum;
          float inside = step(abs(vWPos.x), ${glf(PW / 2)}) * step(abs(vWPos.z), ${glf(HL)});
          vec3 base = grass, lineCol = vec3(1.0);
          // La portada: cada mitad del color de su equipo (el local, hacia z < 0)
          bool homeHalf = vWPos.z < 0.0;
          base = mix(base, (homeHalf ? uHome : uAway) * lum, uHalves * inside);
          lineCol = mix(lineCol, homeHalf ? uLineHome : uLineAway, step(0.5, uHalves * inside));
          // El territorio: el campo de cada uno, de su portería a la frontera (el local, hacia z < 0)
          float zf = frontAt(vWPos.x);
          float home = step(vWPos.z, zf), on = uTerr * inside;
          base = mix(base, mix(uAway, uHome, home) * lum, on);
          lineCol = mix(lineCol, mix(uLineAway, uLineHome, home), step(0.5, on));
          vec2 luv = vec2((vWPos.x + ${glf(XW / 2)}) / ${glf(XW)}, 0.5 - vWPos.z / ${glf(ZL)});
          float L = texture2D(uLines, clamp(luv, 0.0, 1.0)).r * step(0.0, luv.x) * step(luv.x, 1.0) * step(0.0, luv.y) * step(luv.y, 1.0);
          base = mix(base, lineCol, L * 0.92);
          // La frontera: una línea verde lima con un filo oscuro a cada lado, para que se vea sobre
          // cualquier color
          float dz = vWPos.z - zf, adz = abs(dz);
          base = mix(base, base * 0.55, on * 0.55 * (1.0 - smoothstep(0.42, 0.75, adz)) * smoothstep(0.18, 0.36, adz));
          base = mix(base, uAccent, on * (1.0 - smoothstep(0.2, 0.34, adz)));
          diffuseColor.rgb *= base;`)
        .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
          float glow = 0.35 * exp(-dz * dz / 0.08) + 0.1 * exp(-dz * dz / 2.5);
          totalEmissiveRadiance += uAccent * glow * on;`);
    };
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(XW, ZL, 1, 1), groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);
    // La maqueta: la base del estadio y su sombra sobre el fondo
    const SLAB = 1.6;
    const BASE_X = 2 * (ST_X + ST_D + 3), BASE_Z = 2 * (ST_Z + ST_D + 3);
    const concrete = color(o.dark ? '#262a33' : '#e2ded6');
    const slab = new THREE.Mesh(new THREE.BoxGeometry(BASE_X, SLAB, BASE_Z), new THREE.MeshLambertMaterial({ color: concrete }));
    slab.position.y = -SLAB / 2 - 0.06;
    slab.receiveShadow = true;
    scene.add(slab);
    // Su sombra en el fondo: un rectángulo difuminado, algo desplazado (una sombra de verdad del canto
    // haría sombra también sobre el césped de encima)
    const shadowTex = tex(canvasOf(256, 384, (g, w, h) => {
      g.fillStyle = '#000';
      g.fillRect(0, 0, w, h);
      g.filter = 'blur(18px)';
      g.fillStyle = '#fff';
      g.fillRect(40, 40, w - 80, h - 80);
    }), false);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(BASE_X * 256 / 176, BASE_Z * 384 / 304), new THREE.MeshBasicMaterial({ color: 0x000000, alphaMap: shadowTex, transparent: true, opacity: o.dark ? 0.55 : 0.22, depthWrite: false }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(9, -SLAB - 5, 7);
    scene.add(floor);
    // ─── La grada ───
    // El perfil escalonado (de lado): el muro y las 16 filas; se estira a lo largo de cada tribuna
    const standShape = new THREE.Shape();
    standShape.moveTo(0, -0.06);
    standShape.lineTo(0, WALL);
    for (let i = 0; i < ROWS; i++) { standShape.lineTo(i * ROW_D + ROW_D, WALL + i * ROW_H); standShape.lineTo(i * ROW_D + ROW_D, WALL + (i + 1) * ROW_H); }
    standShape.lineTo(ST_D + 1.2, WALL + ROWS * ROW_H);
    standShape.lineTo(ST_D + 1.2, -0.06);
    standShape.closePath();
    const standMat = new THREE.MeshLambertMaterial({ color: concrete });
    const roofMat = new THREE.MeshLambertMaterial({ color: color(o.dark ? '#1b1f27' : '#f4f2ee') });
    const lightMat = new THREE.MeshBasicMaterial({ color: color(o.dark ? '#fff6dc' : '#ffffff') });
    // Cada tribuna: dónde empieza, hacia dónde mira (ang) y lo larga que es
    const stands = [
      { x: ST_X, z: 0, ang: 0, len: PL + 2 * MZ - 2 }, { x: -ST_X, z: 0, ang: Math.PI, len: PL + 2 * MZ - 2 },
      { x: 0, z: ST_Z, ang: -Math.PI / 2, len: PW + 2 * MX - 2 }, { x: 0, z: -ST_Z, ang: Math.PI / 2, len: PW + 2 * MX - 2 },
    ];
    // La afición: un cubo por persona, con los colores de su equipo (y algo de gente de calle); los del
    // visitante, en media tribuna de un fondo
    const fanColors = (st) => [st.bg, st.bg, st.acc || st.bg, st.bg, o.dark ? '#3a3f4a' : '#c9c4ba', o.dark ? '#59606d' : '#8e8a83'];
    const fans = [];
    let fseed = 3;
    const frnd = () => ((fseed = (fseed * 16807) % 2147483647) / 2147483647);
    for (const st of stands) {
      const g = new THREE.Group();
      g.position.set(st.x, 0, st.z);
      g.rotation.y = st.ang;
      const geo = new THREE.ExtrudeGeometry(standShape, { depth: st.len, bevelEnabled: false });
      geo.translate(0, 0, -st.len / 2);
      // (la forma va en x-y y se estira en z: x, hacia fuera; z, a lo largo)
      const mesh = new THREE.Mesh(geo, standMat);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      g.add(mesh);
      // La cubierta, con la línea de luz en el borde de delante
      const roof = new THREE.Mesh(new THREE.BoxGeometry(ST_D + 6, 0.7, st.len + 4), roofMat);
      roof.position.set((ST_D + 6) / 2 - 3.5, ROOF_Y, 0);
      roof.castShadow = true;
      g.add(roof);
      const strip = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.25, st.len + 4), lightMat);
      strip.position.set(-3.6, ROOF_Y - 0.45, 0);
      g.add(strip);
      // Los pilares de atrás
      for (let k = -2; k <= 2; k++) {
        const p = new THREE.Mesh(new THREE.BoxGeometry(0.6, ROOF_Y - WALL - ROWS * ROW_H, 0.6), roofMat);
        p.position.set(ST_D + 0.6, WALL + ROWS * ROW_H + (ROOF_Y - WALL - ROWS * ROW_H) / 2, (k * st.len) / 5);
        g.add(p);
      }
      scene.add(g);
      g.updateMatrixWorld(true);
      const end = Math.abs(st.ang) === Math.PI / 2;
      for (let i = 0; i < ROWS; i++) {
        for (let zz = -st.len / 2 + 0.5; zz < st.len / 2 - 0.4; zz += LOW ? 1.1 : 0.75) {
          if (frnd() < 0.07) continue;
          const local = new THREE.Vector3(i * ROW_D + 0.55 + frnd() * 0.5, WALL + i * ROW_H + 0.39, zz + (frnd() - 0.5) * 0.2);
          const wp = local.applyMatrix4(g.matrixWorld);
          // Los del visitante: en el fondo de z > 0, en la mitad de x < 0
          const side = end && st.z > 0 && wp.x < 0 ? 'away' : 'home';
          const pal = fanColors(o[side]);
          fans.push({ p: wp, side, c: pal[Math.floor(frnd() * pal.length)], h: 0.85 + frnd() * 0.3, ph: frnd() * 6.28, ang: st.ang });
        }
      }
    }
    const crowd = new THREE.InstancedMesh(LOW ? new THREE.BoxGeometry(0.4, 0.78, 0.36) : new THREE.CapsuleGeometry(0.19, 0.4, 3, 8), new THREE.MeshLambertMaterial({ color: 0xffffff }), fans.length);
    const dm = new THREE.Object3D();
    const placeFan = (f, i, jump) => {
      dm.position.set(f.p.x, f.p.y + jump, f.p.z);
      dm.rotation.set(0, f.ang, 0);
      dm.scale.set(1, f.h, 1);
      dm.updateMatrix();
      crowd.setMatrixAt(i, dm.matrix);
    };
    fans.forEach((f, i) => { placeFan(f, i, 0); crowd.setColorAt(i, color(f.c)); });
    crowd.instanceMatrix.needsUpdate = true;
    scene.add(crowd);
    let cheering = false;
    // Las vallas de LED alrededor del césped: «JORNADA90» en verde lima sobre negro
    const boardTex = tex(canvasOf(1024, 64, (g, w, h) => {
      g.fillStyle = '#0b0d12';
      g.fillRect(0, 0, w, h);
      g.font = '900 40px "Anton", "Arial Black", sans-serif';
      g.textBaseline = 'middle';
      for (let k = 0; k < 2; k++) {
        g.fillStyle = o.accent;
        g.fillText('JORNADA90', 22 + k * 512, h / 2 + 2);
        g.fillStyle = '#ffffff';
        g.fillText('@JORNADA90FC', 236 + k * 512, h / 2 + 2);
      }
    }));
    boardTex.wrapS = THREE.RepeatWrapping;
    const boards = [
      { x: PW / 2 + 4, z: 0, len: PL + 6, rot: -Math.PI / 2 }, { x: -PW / 2 - 4, z: 0, len: PL + 6, rot: Math.PI / 2 },
      { x: 0, z: HL + 5, len: PW + 4, rot: Math.PI }, { x: 0, z: -HL - 5, len: PW + 4, rot: 0 },
    ];
    for (const b of boards) {
      const t2 = boardTex.clone();
      t2.repeat.set(b.len / 16, 1);
      t2.needsUpdate = true;
      const m = new THREE.Mesh(new THREE.BoxGeometry(b.len, 0.9, 0.15), [0, 1, 2, 3, 4, 5].map(f => (f === 4 ? new THREE.MeshBasicMaterial({ map: t2 }) : new THREE.MeshLambertMaterial({ color: 0x0b0d12 }))));
      m.position.set(b.x, 0.45, b.z);
      m.rotation.y = b.rot;
      m.castShadow = true;
      scene.add(m);
    }

    // ─── Las porterías: postes y larguero redondos, el armazón de atrás y la red ───
    const white = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.35, metalness: 0.05 });
    const frameMat = new THREE.MeshStandardMaterial({ color: 0xd9dde2, roughness: 0.6 });
    const netTex = tex(netCanvas());
    netTex.wrapS = netTex.wrapT = THREE.RepeatWrapping;
    const netMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x666666, map: netTex, transparent: true, depthWrite: false, side: THREE.DoubleSide, roughness: 0.9 });
    const CELL = 0.14;
    // El perfil de la red (de lado): del larguero hacia atrás 1 m arriba y luego baja al suelo a 2 m
    const DEPTH_TOP = 1.0, DEPTH = 2.0;
    const profile = (s) => (s < 0.3 ? [GH, (s / 0.3) * DEPTH_TOP] : [GH * (1 - (s - 0.3) / 0.7), DEPTH_TOP + ((s - 0.3) / 0.7) * (DEPTH - DEPTH_TOP)]);
    const PROFILE_LEN = DEPTH_TOP + Math.hypot(GH, DEPTH - DEPTH_TOP);
    const tube = (a, b, r, mat) => {
      const va = new THREE.Vector3(...a), vb = new THREE.Vector3(...b);
      const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, va.distanceTo(vb), 14), mat);
      m.position.copy(va).add(vb).multiplyScalar(0.5);
      m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), vb.clone().sub(va).normalize());
      m.castShadow = true;
      return m;
    };
    const goals = {};
    for (const sg of [1, -1]) {
      const g = new THREE.Group();
      g.position.z = sg * HL;
      g.rotation.y = sg > 0 ? 0 : Math.PI; // la red, siempre hacia fuera del campo
      const X = GW / 2 + POST;
      g.add(tube([-X, 0, 0], [-X, GH + POST, 0], POST, white), tube([X, 0, 0], [X, GH + POST, 0], POST, white), tube([-X - POST, GH + POST, 0], [X + POST, GH + POST, 0], POST, white));
      // El armazón: arriba hacia atrás, abajo hacia el suelo, y la barra del suelo de atrás
      for (const x of [-X, X]) g.add(tube([x, GH, 0], [x, GH, DEPTH_TOP], 0.025, frameMat), tube([x, GH, DEPTH_TOP], [x, 0, DEPTH], 0.025, frameMat));
      g.add(tube([-X, 0.02, DEPTH], [X, 0.02, DEPTH], 0.025, frameMat));
      // La red de atrás y de arriba, en una pieza que se puede hundir
      const SX = 46, SY = 26;
      const back = new THREE.PlaneGeometry(1, 1, SX, SY);
      const uv = back.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * GW) / CELL, (uv.getY(i) * PROFILE_LEN) / CELL);
      const net = new THREE.Mesh(back, netMat);
      net.frustumCulled = false;
      g.add(net);
      // Las redes de los lados (quietas)
      for (const x of [-X, X]) {
        const side = new THREE.BufferGeometry();
        const pts = [[x, 0, 0], [x, GH, 0], [x, GH, DEPTH_TOP], [x, 0, DEPTH]];
        side.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pts.flat()), 3));
        side.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(pts.flatMap(([, y, z]) => [z / CELL, y / CELL])), 2));
        side.setIndex([0, 1, 2, 0, 2, 3]);
        side.computeVertexNormals();
        g.add(new THREE.Mesh(side, netMat));
      }
      scene.add(g);
      goals[sg] = { group: g, net, SX, SY };
    }
    // La red, hundida donde entra el balón: hit = [x, s] (s, a lo largo del perfil) y amp en metros
    function shapeNet(goal, hit, amp) {
      const pos = goal.net.geometry.attributes.position;
      const { SX, SY } = goal;
      for (let j = 0; j <= SY; j++) {
        const s = 1 - j / SY; // (la fila de arriba del plano, el suelo de atrás: s = 1)
        const [y, z] = profile(s);
        // La normal del perfil, hacia fuera
        const [y2, z2] = profile(Math.min(1, s + 0.01)), [y1, z1] = profile(Math.max(0, s - 0.01));
        let ny = -(z2 - z1), nz = y2 - y1;
        const l = Math.hypot(ny, nz) || 1;
        ny /= l; nz /= l;
        if (nz < 0) { ny = -ny; nz = -nz; }
        for (let i = 0; i <= SX; i++) {
          const x = -GW / 2 + (GW * i) / SX;
          let d = 0;
          if (hit && amp) {
            const ds = (s - hit[1]) * PROFILE_LEN, dx = x - hit[0];
            // Fija en los bordes (el armazón)
            const edge = Math.min(1, (GW / 2 - Math.abs(x)) / 0.6) * Math.min(1, s / 0.15, (1 - s) / 0.15);
            d = amp * Math.exp(-(dx * dx + ds * ds) / 0.9) * Math.max(0, edge);
          }
          pos.setXYZ(j * (SX + 1) + i, x, y + ny * d, z + nz * d);
        }
      }
      pos.needsUpdate = true;
      goal.net.geometry.computeVertexNormals();
    }
    shapeNet(goals[1], null, 0);
    shapeNet(goals[-1], null, 0);
    // El punto de la red donde para un balón que entra a esa altura (en el perfil, s)
    const netHit = (h) => (h >= GH - 0.05 ? 0.15 : 0.3 + 0.7 * (1 - h / GH));
    const netPoint = (sg, x, s) => { const [y, z] = profile(s); return [x, y, sg * (HL + z)]; };

    // ─── La portada: el número de cada equipo, gigante y de pie sobre su mitad, con su escudo ───
    const cover = [];
    for (const [side, sz] of [['home', -1], ['away', 1]]) {
      const c = o.cover?.[side];
      if (!c) continue;
      // El cartel: el escudo arriba y la cifra debajo
      const numTex = tex(canvasOf(640, 840, (g, w, h) => {
        g.clearRect(0, 0, w, h);
        if (c.logo) {
          const k = Math.min(250 / (c.logo.naturalWidth || 250), 250 / (c.logo.naturalHeight || 250));
          const lw = (c.logo.naturalWidth || 250) * k, lh = (c.logo.naturalHeight || 250) * k;
          g.shadowColor = 'rgba(0,0,0,.3)';
          g.shadowBlur = 24;
          g.drawImage(c.logo, (w - lw) / 2, 10 + (250 - lh) / 2, lw, lh);
        }
        g.font = '700px "Anton", "Arial Black", sans-serif';
        g.textAlign = 'center';
        g.textBaseline = 'alphabetic';
        g.shadowColor = 'rgba(0,0,0,.35)';
        g.shadowBlur = 40;
        g.shadowOffsetY = 18;
        g.fillStyle = c.fg;
        g.fillText(String(c.n), w / 2, h - 30);
      }));
      const num = new THREE.Sprite(new THREE.SpriteMaterial({ map: numTex, transparent: true, depthWrite: false }));
      num.center.set(0.5, 0);
      scene.add(num);
      // (cada uno sobre su mitad y a un lado, para que no se tapen)
      cover.push({ num, x: sz * 13, z: sz * HL * 0.42 });
    }
    const showCover = (cv) => {
      for (const c of cover) {
        const k = cv ? cv.nums : 0;
        c.num.visible = k > 0.01;
        if (!(k > 0.01)) continue;
        const hgt = 44 * k;
        c.num.position.set(c.x, 0.5, c.z);
        c.num.scale.set(hgt * (640 / 840), hgt, 1);
        c.num.material.opacity = cv.alpha ?? 1;
      }
    };
    showCover(null);

    // ─── El balón ───
    const ballTex = tex(ballCanvas());
    const ball = new THREE.Mesh(new THREE.SphereGeometry(BALL, 48, 32), new THREE.MeshStandardMaterial({ map: ballTex, roughness: 0.38, metalness: 0 }));
    ball.castShadow = true;
    scene.add(ball);
    // Sin sombras calculadas (modo ligero), una sombra pintada debajo del balón
    const blobTex = tex(canvasOf(64, 64, (g, w, h) => {
      const r = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
      r.addColorStop(0, 'rgba(255,255,255,1)');
      r.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = '#000';
      g.fillRect(0, 0, w, h);
      g.fillStyle = r;
      g.fillRect(0, 0, w, h);
    }), false);
    const blob = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.5), new THREE.MeshBasicMaterial({ color: 0x000000, alphaMap: blobTex, transparent: true, opacity: 0.45, depthWrite: false }));
    blob.rotation.x = -Math.PI / 2;
    blob.visible = false;
    if (LOW) scene.add(blob);
    // La estela del balón: una cinta que mira a la cámara y se apaga hacia atrás
    const TRAIL = 24;
    const trailGeo = new THREE.BufferGeometry();
    const trailPos = new Float32Array(TRAIL * 2 * 3), trailA = new Float32Array(TRAIL * 2), tIdx = [];
    for (let i = 0; i < TRAIL; i++) {
      trailA[i * 2] = trailA[i * 2 + 1] = i / (TRAIL - 1);
      if (i < TRAIL - 1) { const a = i * 2; tIdx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    }
    trailGeo.setAttribute('position', new THREE.BufferAttribute(trailPos, 3));
    trailGeo.setAttribute('ta', new THREE.BufferAttribute(trailA, 1));
    trailGeo.setIndex(tIdx);
    const trail = new THREE.Mesh(trailGeo, new THREE.ShaderMaterial({
      uniforms: { uColor: { value: color('#ffffff') }, uAlpha: { value: 0.55 } },
      vertexShader: 'attribute float ta; varying float vA; void main() { vA = ta; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'uniform vec3 uColor; uniform float uAlpha; varying float vA; void main() { gl_FragColor = vec4(uColor, uAlpha * vA * vA); }',
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
    }));
    trail.frustumCulled = false;
    scene.add(trail);

    // ─── El confeti del gol: papelitos de los colores del equipo ───
    const BITS = 280;
    const confetti = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.11, 0.065), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }), BITS);
    confetti.frustumCulled = false;
    confetti.visible = false;
    for (let i = 0; i < BITS; i++) confetti.setColorAt(i, color(o.accent));
    scene.add(confetti);
    // ─── Los pulsos del partido: un anillo verde lima que se abre y se apaga donde pasa algo ───
    const PULSES = 24;
    const pulseAge = new THREE.InstancedBufferAttribute(new Float32Array(PULSES), 1);
    const pulseGeo = new THREE.RingGeometry(0.82, 1, 48);
    pulseGeo.rotateX(-Math.PI / 2);
    pulseGeo.setAttribute('aAge', pulseAge);
    const pulses = new THREE.InstancedMesh(pulseGeo, new THREE.ShaderMaterial({
      uniforms: { uColor: { value: color(o.accent) } },
      vertexShader: 'attribute float aAge; varying float vA; void main() { vA = aAge; gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0); }',
      fragmentShader: 'uniform vec3 uColor; varying float vA; void main() { gl_FragColor = vec4(uColor, 0.95 * (1.0 - vA) * (1.0 - vA)); }',
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
    }), PULSES);
    pulses.frustumCulled = false;
    pulses.count = 0;
    scene.add(pulses);
    const rnd = (i) => { const v = Math.sin(i * 12.9898 + 78.233) * 43758.5453; return v - Math.floor(v); };
    const dummy = new THREE.Object3D();

    const v3 = (p) => new THREE.Vector3(p[0], p[1], p[2]);
    function frame(s) {
      // La cámara
      camera.fov = s.cam.fov || 40;
      camera.position.copy(v3(s.cam.pos));
      camera.up.set(0, 1, 0);
      camera.lookAt(v3(s.cam.target));
      if (s.cam.roll) camera.rotateZ(s.cam.roll);
      camera.updateProjectionMatrix();
      camera.updateMatrixWorld();
      // El sol sigue a lo que se ve, para que la sombra tenga detalle donde hace falta
      const fc = s.focus || { at: [0, 0, 0], size: 70 };
      sun.target.position.set(fc.at[0], 0, fc.at[2]);
      sun.position.copy(sun.target.position).addScaledVector(SUN_DIR, 120);
      const sc = sun.shadow.camera;
      sc.left = -fc.size; sc.right = fc.size; sc.top = fc.size; sc.bottom = -fc.size; sc.near = 1; sc.far = 300;
      sc.updateProjectionMatrix();
      // La portada
      U.uHalves.value = s.cover?.halves ?? 0;
      showCover(s.cover);
      // El territorio: la frontera
      U.uTerr.value = s.front ? s.terr ?? 1 : 0;
      if (s.front) U.uFront.value.set(s.front);
      // El balón y su estela
      ball.visible = !!s.ball;
      blob.visible = !!s.ball;
      if (s.ball) {
        ball.position.copy(v3(s.ball.pos));
        blob.position.set(s.ball.pos[0], 0.03, s.ball.pos[2]);
        blob.scale.setScalar((s.ball.scale || 1) * (1 + s.ball.pos[1] * 0.25));
        ball.scale.setScalar(s.ball.scale || 1);
        ball.rotation.set(s.ball.spin * 0.7, s.ball.spin, 0);
      }
      trail.visible = !!(s.trail && s.trail.length > 1);
      if (trail.visible) {
        const pts = s.trail.map(v3), eye = camera.position, w = (s.ball?.scale || 1) * BALL * 0.9;
        for (let i = 0; i < TRAIL; i++) {
          const k = (i / (TRAIL - 1)) * (pts.length - 1), a = Math.floor(k), f = k - a;
          const p = pts[a].clone().lerp(pts[Math.min(pts.length - 1, a + 1)], f);
          const q = pts[Math.min(pts.length - 1, a + 1)].clone().sub(pts[Math.max(0, a - 1)]).normalize();
          const side = q.clone().cross(eye.clone().sub(p)).normalize().multiplyScalar(w * (0.25 + 0.75 * (i / (TRAIL - 1))));
          trailPos.set([p.x - side.x, p.y - side.y, p.z - side.z], i * 6);
          trailPos.set([p.x + side.x, p.y + side.y, p.z + side.z], i * 6 + 3);
        }
        trailGeo.attributes.position.needsUpdate = true;
      }
      // Las redes
      for (const sg of [1, -1]) {
        const n = s.nets?.[sg];
        const g = goals[sg];
        if (n && n.amp > 0.001) { shapeNet(g, [n.x * sg, n.s], n.amp); g.bent = true; }
        else if (g.bent) { shapeNet(g, null, 0); g.bent = false; }
      }
      // Los pulsos: cada uno crece de 0 a su tamaño (en metros) mientras se apaga
      const rp = (s.ripples || []).slice(0, PULSES);
      rp.forEach((r, i) => {
        const sc = r.size * (0.25 + 2.2 * (1 - (1 - r.age) ** 3));
        dummy.position.set(r.x, 0.04, r.z);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(sc, 1, sc);
        dummy.updateMatrix();
        pulses.setMatrixAt(i, dummy.matrix);
        pulseAge.setX(i, r.age);
      });
      pulses.count = rp.length;
      pulses.instanceMatrix.needsUpdate = true;
      pulseAge.needsUpdate = true;
      // La afición del que marca salta (cada uno a su ritmo) y se va calmando
      const ch = s.cheer;
      if (ch && ch.age >= 0 && ch.age < 3) {
        const k = Math.exp(-ch.age * 0.9);
        fans.forEach((f, i) => placeFan(f, i, f.side === ch.side ? 0.55 * k * Math.abs(Math.sin(ch.age * 8.5 + f.ph)) : 0));
        crowd.instanceMatrix.needsUpdate = true;
        cheering = true;
      } else if (cheering) {
        fans.forEach((f, i) => placeFan(f, i, 0));
        crowd.instanceMatrix.needsUpdate = true;
        cheering = false;
      }
      // El confeti
      const b = s.burst;
      confetti.visible = !!b;
      if (b) {
        const cols = b.colors.map(color);
        for (let i = 0; i < BITS; i++) {
          const a = rnd(i) * Math.PI * 2, up = 4 + rnd(i + 1) * 7, out = 2 + rnd(i + 2) * 6;
          const tau = Math.max(0, b.age - rnd(i + 3) * 0.12);
          const drag = (1 - Math.exp(-tau * 1.6)) / 1.6;
          dummy.position.set(b.at[0] + Math.cos(a) * out * drag, Math.max(0.03, b.at[1] + up * drag - 4.9 * tau * tau * 0.55), b.at[2] + Math.sin(a) * out * drag - b.dir * out * 0.6 * drag);
          dummy.rotation.set(tau * (3 + rnd(i + 4) * 9), tau * (2 + rnd(i + 5) * 7), rnd(i + 6) * 6);
          const k = b.age < 1.6 ? 1 : Math.max(0, 1 - (b.age - 1.6) / 0.5);
          dummy.scale.setScalar(k);
          dummy.updateMatrix();
          confetti.setMatrixAt(i, dummy.matrix);
          confetti.setColorAt(i, cols[i % cols.length]);
        }
        confetti.instanceMatrix.needsUpdate = true;
        if (confetti.instanceColor) confetti.instanceColor.needsUpdate = true;
      }
      renderer.render(scene, camera);
      return canvas;
    }
    const tmp = new THREE.Vector3();
    const project = (p) => { tmp.set(p[0], p[1], p[2]).project(camera); return [tmp.x, tmp.y, tmp.z]; };
    const dispose = () => { renderer.dispose(); renderer.forceContextLoss?.(); };
    return { canvas, frame, project, dispose, netHit, netPoint, PL, PW, HL, GH, BALL };
  }

  window.Campo3D = { create, load };
})();
