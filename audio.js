// ============================================================
// MÚSICA DEL VÍDEO SHORT · una base de 150 BPM y un efecto para cada animación,
// sintetizados en el navegador con Web Audio (OfflineAudioContext). Dos estilos: «urbana»
// (por defecto: phonk brasileño, con un cencerro y su eco, 808 saturado y palmas; va con los
// cortes de cámara: se para justo antes de cada corte y entra con todo en el corte, y cada
// golpe de cámara lleva su 808) y «épica» (taikos, cuerdas en semicorcheas, metales, coro y
// timbales, como un tráiler).
// Es música propia, sin derechos de nadie, que dura lo mismo que el vídeo y cae a tiempo:
// cada escena dura compases enteros (1 pulso = 0,4 s, lo mismo que la cortinilla) y
// video.js pasa en qué segundo pasa cada cosa (los puntos que suben, cada tiro, la cinta…).
// ============================================================
(function () {
  'use strict';

  const RATE = 48000;
  const BPM = 150;
  const BEAT = 60 / BPM;      // 0,4 s
  const STEP = BEAT / 4;      // semicorchea, 0,1 s
  const BAR = 4 * BEAT;       // 1,6 s

  // La épica: Am | F | C | G (i–VI–III–VII), la de los tráileres. El sol mayor sube a la menor.
  const EPIC_CHORDS = [
    { bass: 33, notes: [57, 60, 64] }, // Am
    { bass: 29, notes: [57, 60, 65] }, // F
    { bass: 36, notes: [55, 60, 64] }, // C
    { bass: 31, notes: [55, 59, 62] }, // G
  ];
  const hz = (m) => 440 * 2 ** ((m - 69) / 12);

  // Aleatorio con semilla: el mismo partido suena siempre igual.
  function rng(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ─── Piezas de Web Audio ───
  function env(g, t, peak, attack, decay, hold = 0) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t + attack);
    if (hold) g.gain.setValueAtTime(Math.max(peak, 0.0002), t + attack + hold);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + hold + decay);
  }
  function osc(ctx, type, freq, t, stop) {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    o.start(t);
    o.stop(stop);
    return o;
  }
  function filter(ctx, type, freq, q = 0.7) {
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    return f;
  }
  function saturation(ctx, drive) {
    const ws = ctx.createWaveShaper();
    const curve = new Float32Array(1024);
    for (let i = 0; i < curve.length; i++) {
      const x = (i / (curve.length - 1)) * 2 - 1;
      curve[i] = Math.tanh(drive * x) / Math.tanh(drive);
    }
    ws.curve = curve;
    return ws;
  }
  function pan(ctx, value) {
    const p = ctx.createStereoPanner();
    p.pan.value = value;
    return p;
  }

  // ============================================================
  // INSTRUMENTOS · cada uno pinta una nota en el momento t
  // ============================================================
  function makeKit(ctx, buses, rand) {
    const noise = ctx.createBuffer(1, RATE * 2, RATE);
    const nd = noise.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = rand() * 2 - 1;
    const noiseSrc = (t, dur) => {
      const s = ctx.createBufferSource();
      s.buffer = noise;
      s.start(t, rand() * 1.2, dur + 0.05);
      return s;
    };
    const { drums, bass, keys, sfx, verb } = buses;

    return {
      kick(t, vel = 1) {
        const o = osc(ctx, 'sine', 150, t, t + 0.4);
        o.frequency.exponentialRampToValueAtTime(46, t + 0.1);
        const g = ctx.createGain();
        env(g, t, 0.55 * vel, 0.003, 0.26);
        o.connect(g).connect(drums);
        const c = noiseSrc(t, 0.01);
        const cg = ctx.createGain();
        env(cg, t, 0.25 * vel, 0.001, 0.012);
        c.connect(filter(ctx, 'highpass', 2500)).connect(cg).connect(drums);
      },
      clap(t, vel = 1) {
        [0, 0.011, 0.022].forEach((d, i) => {
          const s = noiseSrc(t + d, 0.2);
          const g = ctx.createGain();
          env(g, t + d, 0.75 * vel, 0.001, i === 2 ? 0.17 : 0.012);
          s.connect(filter(ctx, 'bandpass', 1500, 0.9)).connect(g);
          g.connect(drums);
          g.connect(verb);
        });
        const o = osc(ctx, 'triangle', 190, t, t + 0.15);
        const g = ctx.createGain();
        env(g, t, 0.18 * vel, 0.002, 0.09);
        o.connect(g).connect(drums);
      },
      hat(t, vel = 0.3, open = false, side = 0.25) {
        const s = noiseSrc(t, open ? 0.3 : 0.06);
        const g = ctx.createGain();
        env(g, t, 0.32 * vel, 0.001, open ? 0.24 : 0.035);
        s.connect(filter(ctx, 'highpass', 7500)).connect(g).connect(pan(ctx, side)).connect(drums);
      },
      // Colchón: dos sierras desafinadas por nota, muy filtradas.
      pad(t, notes, dur, vel = 1) {
        notes.forEach((m, i) => {
          [-7, 7].forEach(detune => {
            const o = osc(ctx, 'sawtooth', hz(m), t, t + dur + 0.6);
            o.detune.value = detune;
            const g = ctx.createGain();
            g.gain.setValueAtTime(0.0001, t);
            g.gain.linearRampToValueAtTime(0.05 * vel, t + 0.25);
            g.gain.setValueAtTime(0.05 * vel, t + dur);
            g.gain.linearRampToValueAtTime(0.0001, t + dur + 0.5);
            o.connect(filter(ctx, 'lowpass', 1800)).connect(g).connect(pan(ctx, (i - 1) * 0.5)).connect(keys);
          });
        });
      },
      // Acorde corto (el golpe final).
      stab(t, notes, vel = 1) {
        notes.forEach((m, i) => {
          const o = osc(ctx, 'sawtooth', hz(m), t, t + 1.4);
          const lp = filter(ctx, 'lowpass', 4000, 2);
          lp.frequency.setValueAtTime(4000, t);
          lp.frequency.exponentialRampToValueAtTime(500, t + 0.6);
          const g = ctx.createGain();
          env(g, t, 0.07 * vel, 0.004, 1.2);
          const p = pan(ctx, (i - 1) * 0.4);
          o.connect(lp).connect(g).connect(p);
          p.connect(keys);
          p.connect(verb);
        });
      },

      snare(t, vel = 1, side = 0) {
        const s = noiseSrc(t, 0.12);
        const g = ctx.createGain();
        env(g, t, 0.42 * vel, 0.001, 0.08);
        s.connect(filter(ctx, 'bandpass', 1900, 0.8)).connect(g).connect(pan(ctx, side)).connect(drums);
      },
      // Platillo abierto: el corte de cámara.
      crash(t, vel = 1) {
        [-0.45, 0.45].forEach(side => {
          const s = noiseSrc(t, 1.6);
          const g = ctx.createGain();
          env(g, t, 0.13 * vel, 0.002, 1.3);
          s.connect(filter(ctx, 'highpass', 5200)).connect(g).connect(pan(ctx, side));
          g.connect(drums);
          g.connect(verb);
        });
      },
      // Ruido al revés: sube hasta el corte.
      swell(t, dur, vel = 1) {
        const s = noiseSrc(t, dur);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.16 * vel, t + dur);
        g.gain.linearRampToValueAtTime(0.0001, t + dur + 0.02);
        s.connect(filter(ctx, 'highpass', 3000)).connect(g).connect(drums);
      },

      // ─── Efectos ───
      // Golpe grave con platillo: la llegada del marcador o del momento clave.
      impact(t, vel = 1) {
        const o = osc(ctx, 'sine', 80, t, t + 1.2);
        o.frequency.exponentialRampToValueAtTime(32, t + 0.8);
        const g = ctx.createGain();
        env(g, t, 0.6 * vel, 0.004, 0.9);
        o.connect(saturation(ctx, 1.6)).connect(g).connect(sfx);
        const s = noiseSrc(t, 1.6);
        const sg = ctx.createGain();
        env(sg, t, 0.16 * vel, 0.003, 1.5);
        s.connect(filter(ctx, 'highpass', 4000)).connect(sg);
        sg.connect(sfx);
        sg.connect(verb);
      },
      // Barrido de ruido de un lado a otro: la cortinilla entre escenas.
      whoosh(t, dur = 0.55, vel = 1) {
        const s = noiseSrc(t, dur);
        const bp = filter(ctx, 'bandpass', 300, 1.4);
        bp.frequency.setValueAtTime(300, t);
        bp.frequency.exponentialRampToValueAtTime(3200, t + dur * 0.6);
        bp.frequency.exponentialRampToValueAtTime(900, t + dur);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.45 * vel, t + dur * 0.6);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        const p = ctx.createStereoPanner();
        p.pan.setValueAtTime(-0.7, t);
        p.pan.linearRampToValueAtTime(0.7, t + dur);
        s.connect(bp).connect(g).connect(p).connect(sfx);
      },
      // Subida de tensión (ruido que se abre y un tono que sube).
      riser(t, dur, vel = 1) {
        const s = noiseSrc(t, dur);
        const bp = filter(ctx, 'bandpass', 400, 1.2);
        bp.frequency.setValueAtTime(400, t);
        bp.frequency.exponentialRampToValueAtTime(7000, t + dur);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.18 * vel, t + dur);
        g.gain.linearRampToValueAtTime(0.0001, t + dur + 0.05);
        s.connect(bp).connect(g).connect(sfx);
        const o = osc(ctx, 'sawtooth', 220, t, t + dur + 0.05);
        o.frequency.exponentialRampToValueAtTime(880, t + dur);
        const og = ctx.createGain();
        og.gain.setValueAtTime(0.0001, t);
        og.gain.exponentialRampToValueAtTime(0.025 * vel, t + dur);
        og.gain.linearRampToValueAtTime(0.0001, t + dur + 0.05);
        o.connect(filter(ctx, 'lowpass', 2500)).connect(og).connect(sfx);
      },
      // Tic de contador: sube de tono a medida que sube el número.
      tick(t, p = 0, vel = 1) {
        const o = osc(ctx, 'sine', 900 + 900 * p, t, t + 0.05);
        const g = ctx.createGain();
        env(g, t, 0.07 * vel, 0.001, 0.03);
        o.connect(g).connect(sfx);
      },
      // Golpe seco: cada número o fila que aparece.
      hit(t, vel = 1) {
        const o = osc(ctx, 'sine', 160, t, t + 0.25);
        o.frequency.exponentialRampToValueAtTime(60, t + 0.12);
        const g = ctx.createGain();
        env(g, t, 0.55 * vel, 0.002, 0.16);
        o.connect(g).connect(sfx);
        const s = noiseSrc(t, 0.08);
        const sg = ctx.createGain();
        env(sg, t, 0.18 * vel, 0.001, 0.06);
        s.connect(filter(ctx, 'bandpass', 2500, 0.8)).connect(sg).connect(sfx);
      },
      // La cinta que se pega: palmada fuerte con un golpe grave.
      slam(t, vel = 1) {
        this.clap(t, 1.2 * vel);
        this.hit(t, 1.1 * vel);
      },
      // Un tiro al llegar a la portería: gol = nota del acorde, brillante; fallo = golpe
      // apagado y, si da en el palo (clank), su «clanc» metálico.
      pop(t, made, midi, side = 0, clank = true) {
        if (made) {
          const f = hz(midi);
          const o = osc(ctx, 'triangle', f * 1.5, t, t + 0.25);
          o.frequency.exponentialRampToValueAtTime(f, t + 0.03);
          const g = ctx.createGain();
          env(g, t, 0.22, 0.002, 0.18);
          const p = pan(ctx, side);
          o.connect(g).connect(p);
          p.connect(sfx);
          p.connect(verb);
        } else {
          const s = noiseSrc(t, 0.07);
          const g = ctx.createGain();
          env(g, t, 0.16, 0.001, 0.05);
          s.connect(filter(ctx, 'lowpass', 700)).connect(g).connect(pan(ctx, side)).connect(sfx);
          for (const [f, v] of clank ? [[587, 0.05], [1311, 0.03]] : []) {
            const o = osc(ctx, 'triangle', f, t, t + 0.18);
            const og = ctx.createGain();
            env(og, t, v, 0.001, 0.12);
            o.connect(og).connect(pan(ctx, side)).connect(sfx);
          }
        }
      },
    };
  }

  // Reverberación: una respuesta de ruido que se apaga (2 s; en la épica, una sala de 3).
  function reverb(ctx, rand, seconds = 2) {
    const len = Math.round(RATE * seconds);
    const ir = ctx.createBuffer(2, len, RATE);
    for (let c = 0; c < 2; c++) {
      const d = ir.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (rand() * 2 - 1) * (1 - i / len) ** 3;
    }
    const conv = ctx.createConvolver();
    conv.buffer = ir;
    return conv;
  }

  // ============================================================
  // LA ORQUESTA DE LA ÉPICA · cada instrumento pinta una nota en el momento t
  // ============================================================
  function makeOrchestra(ctx, buses, rand) {
    const noise = ctx.createBuffer(1, RATE * 3, RATE);
    const nd = noise.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = rand() * 2 - 1;
    const noiseSrc = (t, dur) => {
      const s = ctx.createBufferSource();
      s.buffer = noise;
      s.start(t, rand() * 0.8, dur + 0.05);
      return s;
    };
    const { drums, bass, keys, verb } = buses;
    // Cada sección pasa por sus propios filtros, compartidos por todas sus notas: un filtro por
    // nota (y más si se mueve) multiplica lo que tarda en componerse.
    const section = (dest, chain, wet = 0) => {
      const input = ctx.createGain();
      let node = input;
      for (const n of chain) { node.connect(n); node = n; }
      node.connect(dest);
      if (wet) { const w = ctx.createGain(); w.gain.value = wet; node.connect(w).connect(verb); }
      return input;
    };
    const strings = [-0.3, 0.3].map(side => section(keys, [filter(ctx, 'lowpass', 2600, 0.7), pan(ctx, side)], 0.12));
    const choir = [-0.45, 0, 0.45].map(side => {
      const input = ctx.createGain();
      const out = section(keys, [pan(ctx, side)], 0.6);
      [[750, 3, 1], [1180, 4, 0.6], [2700, 6, 0.2]].forEach(([fq, q, v]) => {
        const fg = ctx.createGain();
        fg.gain.value = v * 2.2;
        input.connect(filter(ctx, 'bandpass', fq, q)).connect(fg).connect(out);
      });
      return input;
    });
    const low = section(bass, [filter(ctx, 'lowpass', 520, 0.9)], 0.1);
    const horn = section(keys, [filter(ctx, 'lowpass', 1700, 0.9), pan(ctx, 0.1)], 0.4);
    const taikoBody = section(drums, [saturation(ctx, 1.4)], 0.35);
    const taikoSkin = section(drums, [filter(ctx, 'bandpass', 230, 1.1)], 0.3);
    const click = section(drums, [filter(ctx, 'highpass', 1800)]);
    const thump = section(drums, [filter(ctx, 'lowpass', 500)]);
    const timpBus = section(bass, [], 0.25);
    const snareBus = section(drums, [filter(ctx, 'bandpass', 1900, 0.7)], 0.55);
    const crashes = [-0.5, 0.5].map(side => section(drums, [filter(ctx, 'highpass', 5000), pan(ctx, side)], 0.4));
    const swellBus = section(drums, [filter(ctx, 'highpass', 3500)], 0.3);

    const voice = (type, midi, t, stop, detune, dest) => {
      const o = osc(ctx, type, hz(midi), t, stop);
      if (detune) o.detune.value = detune;
      o.connect(dest);
      return o;
    };
    const hit = (src, t, peak, decay, dest, attack = 0.001) => {
      const g = ctx.createGain();
      env(g, t, peak, attack, decay);
      src.connect(g).connect(dest);
    };
    // Una envolvente que entra, aguanta y se va (lineal: para las notas largas).
    const swellEnv = (t, peak, attack, dur, release) => {
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(peak, t + attack);
      g.gain.setValueAtTime(peak, t + Math.max(attack, dur));
      g.gain.linearRampToValueAtTime(0.0001, t + Math.max(attack, dur) + release);
      return g;
    };

    return {
      // Taiko: el golpe grave, el parche y un chasquido arriba (lo que se oye en un móvil).
      taiko(t, vel = 1, pitch = 1) {
        const o = osc(ctx, 'sine', 120 * pitch, t, t + 0.8);
        o.frequency.exponentialRampToValueAtTime(48 * pitch, t + 0.2);
        hit(o, t, 0.55 * vel, 0.6, taikoBody, 0.002);
        hit(noiseSrc(t, 0.3), t, 0.3 * vel, 0.22, taikoSkin);
        hit(noiseSrc(t, 0.05), t, 0.12 * vel, 0.035, click);
      },
      // Timbal afinado en la nota del acorde (en el redoble, sin el golpe de la maza).
      timp(t, midi, vel = 1, decay = 0.9, roll = false) {
        const f = hz(midi);
        const o = osc(ctx, 'sine', f * 1.04, t, t + decay + 0.2);
        o.frequency.exponentialRampToValueAtTime(f, t + 0.08);
        hit(o, t, 0.32 * vel, decay, timpBus, 0.003);
        if (roll) return;
        hit(osc(ctx, 'triangle', f * 2, t, t + decay), t, 0.1 * vel, decay * 0.5, timpBus, 0.003);
        hit(noiseSrc(t, 0.08), t, 0.2 * vel, 0.06, thump);
      },
      // Redoble de timbal que crece: de «from» a «to».
      timpRoll(t, dur, midi, from, to) {
        const n = Math.round(dur / 0.06);
        for (let i = 0; i < n; i++) this.timp(t + i * 0.06, midi, from + (to - from) * (i / (n - 1)), 0.2, true);
      },
      // Caja de orquesta, con mucha sala.
      snare(t, vel = 1) {
        hit(noiseSrc(t, 0.3), t, 0.42 * vel, 0.2, snareBus);
        hit(osc(ctx, 'triangle', 210, t, t + 0.12), t, 0.16 * vel, 0.08, drums, 0.002);
      },
      snareRoll(t, dur, from, to) {
        const n = Math.round(dur / (STEP / 2));
        for (let i = 0; i < n; i++) this.snare(t + i * STEP / 2, from + (to - from) * (i / Math.max(1, n - 1)));
      },
      // Platillo de choque, abierto a los dos lados.
      crash(t, vel = 1) {
        crashes.forEach(bus => hit(noiseSrc(t, 2), t, 0.12 * vel, 1.8, bus, 0.002));
      },
      // Platillo al revés: sube hasta el golpe.
      swell(t, dur, vel = 1) {
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.2 * vel, t + dur);
        g.gain.linearRampToValueAtTime(0.0001, t + dur + 0.03);
        noiseSrc(t, dur).connect(g).connect(swellBus);
      },
      // Cuerdas en «spiccato»: una semicorchea corta y con ataque.
      strings(t, midi, vel = 1, side = 0) {
        const g = ctx.createGain();
        env(g, t, 0.055 * vel, 0.004, 0.11);
        g.connect(strings[side < 0 ? 0 : 1]);
        [-9, 9].forEach(d => voice('sawtooth', midi, t, t + 0.2, d, g));
      },
      // Contrabajos y chelos: la nota del bajo, larga, con su octava.
      lowStrings(t, midi, dur, vel = 1) {
        const g = swellEnv(t, 0.09 * vel, 0.08, dur - 0.05, 0.2);
        g.connect(low);
        [-6, 6].forEach(d => voice('sawtooth', midi + 12, t, t + dur + 0.25, d, g));
        const sg = ctx.createGain();
        sg.gain.value = 1.3;
        sg.connect(g);
        voice('sine', midi, t, t + dur + 0.25, 0, sg);
      },
      // Metales: el acorde que se abre (de apagado a brillante) y aguanta el compás.
      brass(t, notes, dur, vel = 1, grow = false) {
        const lp = filter(ctx, 'lowpass', 300, 1.2);
        lp.frequency.setValueAtTime(300, t);
        lp.frequency.exponentialRampToValueAtTime(grow ? 900 : 2200, t + 0.22);
        lp.frequency.exponentialRampToValueAtTime(grow ? 2600 : 1300, t + dur);
        const peak = 0.03 * vel;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(grow ? peak * 0.3 : peak, t + 0.08);
        g.gain.linearRampToValueAtTime(grow ? peak * 1.2 : peak * 0.75, t + dur);
        g.gain.linearRampToValueAtTime(0.0001, t + dur + 0.25);
        lp.connect(saturation(ctx, 1.3)).connect(g).connect(keys);
        const w = ctx.createGain();
        w.gain.value = 0.3;
        g.connect(w).connect(verb);
        notes.forEach(m => [-10, 0, 10].forEach(d => voice('sawtooth', m, t, t + dur + 0.3, d, lp)));
      },
      // Trompas: la melodía, con vibrato cuando la nota se alarga.
      horn(t, midi, dur, vel = 1) {
        const g = swellEnv(t, 0.085 * vel, 0.05, dur, 0.3);
        g.connect(horn);
        const o = voice('sawtooth', midi, t, t + dur + 0.35, 0, g);
        const qg = ctx.createGain();
        qg.gain.value = 0.35;
        qg.connect(g);
        const q = voice('square', midi - 12, t, t + dur + 0.35, 0, qg);
        if (dur > 0.4) {
          const lfo = osc(ctx, 'sine', 5.3, t, t + dur + 0.35);
          const depth = ctx.createGain();
          depth.gain.setValueAtTime(0, t);
          depth.gain.linearRampToValueAtTime(9, t + 0.35);
          lfo.connect(depth);
          depth.connect(o.detune);
          depth.connect(q.detune);
        }
      },
      // Coro: «aaah» (sierras por tres formantes), que entra despacio.
      choir(t, notes, dur, vel = 1) {
        notes.forEach((m, i) => {
          const g = swellEnv(t, 0.085 * vel, 0.45, dur, 0.5);
          g.connect(choir[i % 3]);
          [-7, 7].forEach(d => voice('sawtooth', m, t, t + dur + 0.6, d, g));
        });
      },
      // «Braaam»: el golpe de metales graves de los tráileres.
      braam(t, midi, vel = 1, dur = 1.6) {
        const lp = filter(ctx, 'lowpass', 120, 2);
        lp.frequency.setValueAtTime(120, t);
        lp.frequency.exponentialRampToValueAtTime(1900, t + 0.3);
        lp.frequency.exponentialRampToValueAtTime(500, t + dur);
        const g = ctx.createGain();
        env(g, t, 0.06 * vel, 0.02, dur * 0.6, dur * 0.4);
        lp.connect(saturation(ctx, 2.2)).connect(g).connect(bass);
        const w = ctx.createGain();
        w.gain.value = 0.35;
        g.connect(w).connect(verb);
        [0, 7, 12].forEach(iv => [-14, 14].forEach(d => voice('sawtooth', midi + iv, t, t + dur + 0.2, d, lp)));
      },
      // El acorde final: todos a la vez y aguantan hasta el final.
      finale(t, chord, dur) {
        this.braam(t, chord.bass + 12, 0.9, Math.min(dur, 2.2));
        this.brass(t, [chord.bass + 24, ...chord.notes], dur - 0.3, 1);
        this.choir(t, chord.notes.map(n => n + 12), dur - 0.4, 0.9);
        this.lowStrings(t, chord.bass, dur - 0.3, 1);
        this.timp(t, chord.bass + 12, 1, 1.4);
        this.taiko(t, 1);
        this.crash(t, 1);
      },
    };
  }

  // ============================================================
  // LA BASE · compás a compás según la energía de cada escena
  // ============================================================
  // energy: 'intro' (antes del golpe del marcador), 'full', 'light' (los tiros y la
  // probabilidad: los efectos llevan el ritmo), 'build' (el compás que lleva al acorde final)
  // y 'tail' (solo suena lo que queda del acorde final).

  // ============================================================
  // LA URBANA · phonk brasileño (el de los edits de fútbol): un cencerro con la melodía y su eco,
  // un 808 saturado que se desliza, palmas y platos rápidos, en fa menor (Fm | D♭ | E♭ | C).
  // ============================================================
  const PHONK_CHORDS = [
    { bass: 41, notes: [65, 68, 72] }, // Fm (el 808 en fa2, 87 Hz: con la saturación se oye en un móvil)
    { bass: 37, notes: [65, 68, 73] }, // D♭
    { bass: 39, notes: [67, 70, 75] }, // E♭
    { bass: 36, notes: [64, 67, 72] }, // C (el mi natural tira hacia fa menor)
  ];
  // El riff del cencerro, uno por acorde: [semicorchea, nota]. La segunda vuelta (respuesta)
  // remata más arriba.
  const COWBELL = [
    [[0, 72], [2, 72], [3, 68], [6, 65], [8, 68], [10, 72], [11, 73], [12, 72], [14, 68]],
    [[0, 73], [2, 73], [3, 70], [6, 65], [8, 70], [10, 73], [11, 75], [12, 73], [14, 70]],
    [[0, 75], [2, 75], [3, 72], [6, 67], [8, 72], [10, 75], [11, 77], [12, 75], [14, 72]],
    [[0, 72], [2, 72], [3, 67], [6, 64], [8, 67], [10, 70], [11, 72], [12, 70], [14, 67]],
  ];
  const ANSWER = [[12, 77], [13, 75], [14, 72], [15, 68]]; // el remate de la segunda vuelta
  // Dos ritmos que se turnan por escena, para que cada corte se note: el funk (3 + 3 + 2, palmas
  // en el 2 y el 4) y uno a medio tiempo (palma en el 3). [bombos, 808 (semicorchea, duración),
  // palmas]
  const PHONK_GROOVES = {
    funk: { kicks: [0, 3, 6, 8, 11, 14], bass: [[0, 3], [3, 3], [6, 5], [11, 5]], claps: [4, 12] },
    half: { kicks: [0, 7, 10], bass: [[0, 7], [7, 3], [10, 6]], claps: [8] },
  };
  const PHONK_OF = { score: 'funk', dato: 'half', goals: 'funk', jugador: 'half', stats: 'funk', tabla: 'half', outro: 'funk' };

  function makePhonk(ctx, buses, rand) {
    const { bass, keys, verb } = buses;
    // El cencerro va por su filtro (cerrado en la apertura, abierto con el golpe) y un eco de
    // tres semicorcheas.
    const bellIn = ctx.createGain();
    const tone = filter(ctx, 'lowpass', 6000, 0.8);
    const delay = ctx.createDelay(1);
    delay.delayTime.value = 3 * STEP;
    const fb = ctx.createGain();
    fb.gain.value = 0.32;
    const wet = ctx.createGain();
    wet.gain.value = 0.38;
    bellIn.connect(tone);
    tone.connect(keys);
    tone.connect(delay);
    delay.connect(filter(ctx, 'lowpass', 3200)).connect(fb).connect(delay);
    // El eco, a un lado y al otro (más ancho que el golpe, que va casi al centro)
    const wetL = pan(ctx, -0.7), wetR = pan(ctx, 0.7);
    const delay2 = ctx.createDelay(1);
    delay2.delayTime.value = 1.5 * STEP;
    delay.connect(wet).connect(wetL).connect(keys);
    wet.connect(delay2).connect(wetR).connect(keys);
    const vg = ctx.createGain();
    vg.gain.value = 0.15;
    tone.connect(vg).connect(verb);
    // El 808 saturado: seno con su caída de tono, por una distorsión fuerte y un filtro; debajo,
    // el seno limpio para el peso.
    const dist = saturation(ctx, 6);
    const dlp = filter(ctx, 'lowpass', 2400, 0.7);
    const dg = ctx.createGain();
    dg.gain.value = 0.25;
    dist.connect(dlp).connect(dg).connect(bass);
    return {
      tone,
      // El cencerro del 808: dos cuadradas (f y 1,48·f) por un paso banda, cortas y con pegada.
      cowbell(t, midi, vel = 1, side = 0) {
        const f = hz(midi);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.5 * vel, t + 0.002);
        g.gain.exponentialRampToValueAtTime(0.17 * vel, t + 0.05);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.32);
        const bp = filter(ctx, 'bandpass', f * 2.2, 0.9);
        [1, 1.48].forEach(r => osc(ctx, 'square', f * r, t, t + 0.35).connect(bp));
        bp.connect(g).connect(pan(ctx, side)).connect(bellIn);
      },
      // El 808 (to: nota a la que se desliza al final).
      bass808(t, midi, dur, vel = 1, to = null) {
        const f = hz(midi);
        const o = osc(ctx, 'sine', f * 2, t, t + dur + 0.08);
        o.frequency.exponentialRampToValueAtTime(f, t + 0.04);
        if (to != null) {
          o.frequency.setValueAtTime(f, t + dur * 0.45);
          o.frequency.exponentialRampToValueAtTime(hz(to), t + dur);
        }
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.5 * vel, t + 0.005);
        g.gain.setValueAtTime(0.5 * vel, t + dur * 0.6);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.06);
        o.connect(g);
        g.connect(dist);
        const sg = ctx.createGain();
        sg.gain.value = 0.12;
        g.connect(sg).connect(bass);
      },
    };
  }

  function playPhonkBar(kit, p, bars, i, CH, dropAt) {
    const b = bars[i], prev = bars[i - 1], next = bars[i + 1];
    const { t, energy } = b;
    const chord = CH[b.k];
    const s = (n) => t + n * STEP;
    const rel = i - dropAt;
    const riff = (vel, until = 16, answer = false) => {
      COWBELL[b.k].filter(([n]) => n < until && !(answer && n >= 12))
        .forEach(([n, m], j) => p.cowbell(s(n), m, (n % 4 === 0 ? 1 : 0.8) * vel, j % 2 ? 0.25 : -0.25));
      if (answer) ANSWER.filter(([n]) => n < until).forEach(([n, m]) => p.cowbell(s(n), m, 0.85 * vel, 0.3));
    };
    // El final: el 808 largo en fa, el cencerro con su eco y el platillo.
    if (energy === 'tail') {
      if (prev?.energy !== 'tail') {
        let dur = 0;
        for (let j = i; bars[j]?.energy === 'tail'; j++) dur += BAR;
        kit.kick(t, 1);
        p.bass808(t, CH[0].bass, Math.min(dur, 2.6) - 0.1, 1);
        kit.pad(t, CH[0].notes.map(n => n - 12), dur, 0.7);
        p.cowbell(t, 77, 1);
        p.cowbell(s(3), 72, 0.7);
        kit.crash(t, 0.9);
      }
      return;
    }
    // El filtro del cencerro: cerrado antes del golpe, se abre en el compás que lleva a él.
    const rising = (energy === 'intro' && next?.energy !== 'intro') || energy === 'build';
    if (energy === 'intro') {
      p.tone.frequency.setValueAtTime(rising ? 900 : 700, t);
      if (rising) p.tone.frequency.exponentialRampToValueAtTime(5000, t + BAR);
    } else p.tone.frequency.setValueAtTime(energy === 'light' ? 2600 : 6000, t);
    kit.pad(t, chord.notes.map(n => n - 12), BAR, energy === 'full' ? 0.55 : 0.45);
    if (energy === 'intro' || energy === 'build') {
      riff(rising ? 0.9 : 0.7);
      if (!rising) {
        for (let n = 0; n < 16; n += 4) kit.hat(s(n), 0.25, false, -0.2);
        return;
      }
      for (let n = 0; n < 16; n += n < 8 ? 2 : n < 12 ? 1 : 0.5) kit.hat(s(n), 0.3 + 0.5 * (n / 16), false, n % 2 ? 0.3 : -0.3);
      for (let n = 8; n < 16; n += n < 12 ? 1 : 0.5) kit.snare(s(n), 0.15 + 0.6 * ((n - 8) / 8), (n % 2) * 0.4 - 0.2);
      kit.swell(s(6), 10 * STEP, 0.9);
      if (energy === 'build') p.bass808(t, chord.bass, BAR - 0.05, 0.9, chord.bass + 12);
      return;
    }
    const full = energy === 'full';
    const cut = b.scene && prev && prev.energy !== 'intro';
    const drop = b.scene || prev?.energy === 'intro';
    // Antes de cada corte: todo se para en las dos últimas semicorcheas, sube un redoble y el
    // 808 se desliza a la nota de la escena siguiente.
    const stop = b.last && next && next.energy !== 'tail';
    const end = stop ? 14 : 16;
    if (!full) {
      // 'light' (los tiros): el cencerro, bombo en el 1 y el 3 y platos a negras.
      riff(0.75, end);
      kit.kick(s(0), drop ? 1 : 0.75);
      p.bass808(s(0), chord.bass, 7 * STEP, 0.7);
      if (!stop) kit.kick(s(8), 0.6);
      for (let n = 0; n < end; n += 4) kit.hat(s(n), 0.3, false, n % 8 ? 0.3 : -0.3);
    } else {
      const gr = PHONK_GROOVES[PHONK_OF[b.id] || (b.sceneIndex % 2 ? 'half' : 'funk')];
      gr.kicks.filter(n => n < end).forEach((n, j) => kit.kick(s(n), j === 0 ? 1 : 0.85));
      gr.bass.filter(([n]) => n < end).forEach(([n, d], j) => p.bass808(s(n), chord.bass, Math.min(d, end - n) * STEP * 0.95, j === 0 ? 1 : 0.85));
      gr.claps.filter(n => n < end).forEach(n => { kit.clap(s(n), 0.9); kit.snare(s(n), 0.5, 0); });
      // Platos: corcheas con el contratiempo marcado; en el minuto a minuto, semicorcheas, y un
      // tresillo rápido al final de cada dos compases.
      const step = b.id === 'goals' ? 1 : 2;
      for (let n = 0; n < end; n += step) kit.hat(s(n), n % 4 === 2 ? 0.7 : 0.4, false, n % 4 ? 0.3 : -0.2);
      if (!stop && rel % 2 === 1) [12, 12.67, 13.33, 14, 14.67, 15.33].forEach((n, j) => kit.hat(s(n), 0.35 + j * 0.07, false, 0.35));
      if (!stop) kit.hat(s(6), 0.55, true, -0.3);
      riff(1, end, rel % 2 === 1);
    }
    // El corte: bombo, 808 y platillo en el primer tiempo.
    if (cut || drop) kit.crash(t, cut ? 0.75 : 1);
    if (stop) {
      const to = CH[next.k] || chord;
      for (let n = 12; n < 16; n += 0.5) kit.snare(s(n), 0.2 + 0.5 * ((n - 12) / 4), (n * 2) % 2 ? 0.3 : -0.3);
      kit.swell(s(10), 6 * STEP, 0.8);
      p.bass808(s(12), chord.bass, 4 * STEP, 0.9, to.bass);
    }
  }

  // La épica, compás a compás. Los acordes se cuentan desde el golpe del marcador, que cae
  // siempre en la menor (antes, do y sol: C | G | Am).
  const OSTINATO = [0, 0, 12, 0, 0, 7, 12, 0, 0, 0, 12, 0, 7, 0, 12, 7]; // sobre el bajo +2 octavas
  const ACCENTS = new Set([0, 3, 6, 8, 11, 14]);                      // 3 + 3 + 2
  const TAIKO = [[0, 1, 1], [3, 0.55, 1.15], [6, 0.75, 1], [8, 0.9, 0.85], [11, 0.55, 1.15], [14, 0.7, 1]];
  const TAIKO_FILL = [[12, 0.5, 1.3], [13, 0.6, 1.25], [14, 0.75, 1.15], [15, 0.9, 1.05]];
  // La melodía de las trompas, una frase por acorde: [semicorchea, nota, duración en semicorcheas].
  const MELODY = [
    [[0, 69, 6], [6, 72, 2], [8, 76, 8]],             // Am: la – do – mi
    [[0, 77, 6], [6, 76, 2], [8, 72, 8]],             // F: fa – mi – do
    [[0, 79, 6], [6, 76, 2], [8, 72, 6], [14, 74, 2]], // C: sol – mi – do – re
    [[0, 74, 6], [6, 71, 2], [8, 67, 8]],             // G: re – si – sol
  ];

  function playEpicBar(o, bars, i, CH, dropAt) {
    const { t, energy, k } = bars[i];
    const chord = CH[k];
    const prev = bars[i - 1]?.energy, next = bars[i + 1]?.energy;
    const s = (n) => t + n * STEP;
    const root = chord.bass + 24;
    const rel = i - dropAt;
    if (energy === 'tail') {
      if (prev !== 'tail') {
        let dur = 0;
        for (let j = i; bars[j]?.energy === 'tail'; j++) dur += BAR;
        o.finale(t, CH[0], dur);
      }
      return;
    }
    // Antes del golpe y el compás que lleva al final: el redoble y las cuerdas que crecen.
    if (energy === 'intro' || energy === 'build') {
      const rising = energy === 'build' || next !== 'intro';
      o.lowStrings(t, chord.bass, BAR, rising ? 0.6 : 0.35);
      o.choir(t, chord.notes, BAR, rising ? 0.55 : 0.3);
      if (!rising) {
        o.timp(s(0), chord.bass + 12, 0.7);
        o.timp(s(8), chord.bass + 12, 0.4);
        return;
      }
      o.timpRoll(t, BAR, chord.bass + 12, 0.12, 0.85);
      o.swell(t + BAR * 0.3, BAR * 0.7, 0.8);
      OSTINATO.forEach((iv, n) => o.strings(s(n), root + iv, 0.25 + 0.6 * (n / 15), n % 2 ? 0.3 : -0.3));
      if (energy === 'build') {
        o.brass(t, [chord.bass + 12, ...chord.notes], BAR, 0.8, true);
        o.snareRoll(t + BAR / 2, BAR / 2, 0.15, 0.7);
      }
      return;
    }
    const full = energy === 'full';
    o.lowStrings(t, chord.bass, BAR, full ? 1 : 0.5);
    o.choir(t, chord.notes, BAR, full ? 0.6 : 0.35);
    OSTINATO.forEach((iv, n) => o.strings(s(n), root + iv, (ACCENTS.has(n) ? 0.95 : 0.55) * (full ? 1 : 0.45), n % 2 ? 0.3 : -0.3));
    // 'light' (los tiros): solo cuerdas y dos taikos, que los efectos llevan el ritmo.
    if (!full) {
      o.taiko(s(0), 0.6);
      o.taiko(s(8), 0.4, 1.1);
      return;
    }
    if (prev === 'intro' || prev == null) {
      o.braam(t, chord.bass + 12, 1);
      o.crash(t, 1);
    } else if (bars[i].scene) o.crash(t, 0.4);
    o.brass(t, [chord.bass + 12, ...chord.notes], BAR, 0.7);
    o.timp(s(0), chord.bass + 12, 0.9);
    const fill = rel % 2 === 1;
    TAIKO.forEach(([n, v, p]) => { if (!(fill && n >= 12)) o.taiko(s(n), v, p); });
    if (fill) TAIKO_FILL.forEach(([n, v, p]) => o.taiko(s(n), v, p));
    o.snare(s(8), 0.8);
    if (rel % 4 === 3) o.snareRoll(s(12), 4 * STEP, 0.3, 0.75);
    // La melodía, una frase de cuatro compases sí y otra no (empieza con el golpe).
    if (Math.floor(rel / 4) % 2 === 0) MELODY[k].forEach(([n, m, d]) => o.horn(s(n), m, d * STEP, 0.85));
  }

  // timeline: { duration, scenes: [{ id, start, dur, energy, drop? }], cues: [{ t, kind, ... }], seed,
  //   style: 'trap' (la urbana, por defecto) | 'epica' }
  async function render(timeline) {
    const length = Math.ceil((timeline.duration + 0.6) * RATE);
    const ctx = new OfflineAudioContext(2, length, RATE);
    const rand = rng(timeline.seed || 1);
    const epic = timeline.style === 'epica';
    const CH = epic ? EPIC_CHORDS : PHONK_CHORDS;

    // Buses: batería, bajo, teclas y efectos, con algo de reverberación, a un compresor.
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.knee.value = 6;
    comp.ratio.value = 4;
    comp.attack.value = 0.004;
    comp.release.value = 0.18;
    const master = ctx.createGain();
    master.gain.value = 0.9;
    comp.connect(filter(ctx, 'highpass', 30)).connect(master).connect(ctx.destination);
    const bus = (v) => { const g = ctx.createGain(); g.gain.value = v; g.connect(comp); return g; };
    const buses = { drums: bus(0.8), bass: bus(0.75), keys: bus(0.7), sfx: bus(0.9) };
    const conv = reverb(ctx, rand, epic ? 3 : 2);
    const verbIn = ctx.createGain();
    verbIn.gain.value = epic ? 0.3 : 0.22;
    verbIn.connect(conv).connect(bus(0.7));
    buses.verb = verbIn;
    const kit = makeKit(ctx, buses, rand);

    // La base, escena a escena (todas duran compases enteros). En el marcador, la base de
    // verdad entra con el golpe (sc.drop). El cierre: un compás en el último acorde (mi mayor
    // o sol) que sube y el acorde final en la menor.
    const bars = [];
    for (const [sceneIndex, sc] of timeline.scenes.entries()) {
      const n = Math.round(sc.dur / BAR);
      for (let b = 0; b < n; b++) {
        const local = b * BAR;
        const energy = sc.energy === 'outro' ? (b === 0 ? 'build' : 'tail')
          : sc.drop != null && local < sc.drop ? 'intro' : sc.energy;
        bars.push({ t: sc.start + local, energy, outro: sc.energy === 'outro', scene: b === 0, last: b === n - 1, id: sc.id, sceneIndex });
      }
    }
    // Los acordes se cuentan desde el golpe del marcador, que cae siempre en la menor.
    const dropAt = Math.max(0, bars.findIndex(b => b.energy !== 'intro'));
    bars.forEach((b, i) => { b.k = b.outro ? 3 : (((i - dropAt) % 4) + 4) % 4; });
    if (epic) {
      const orch = makeOrchestra(ctx, buses, rand);
      bars.forEach((b, i) => playEpicBar(orch, bars, i, CH, dropAt));
    }
    const phonk = epic ? null : makePhonk(ctx, buses, rand);
    if (phonk) bars.forEach((b, i) => playPhonkBar(kit, phonk, bars, i, CH, dropAt));

    // Los efectos de las animaciones.
    const chordForPops = (t) => {
      const b = bars.findLast(x => x.t <= t + 1e-6) || bars[0];
      return CH[b?.k ?? 0];
    };
    let popIndex = 0;
    for (const c of timeline.cues) {
      switch (c.kind) {
        case 'tick': kit.tick(c.t, c.p || 0, c.vel || 1); break;
        case 'hit': kit.hit(c.t, c.vel || 1); break;
        case 'slam':
          kit.slam(c.t, c.vel || 1);
          // En la urbana, cada golpe de cámara lleva su 808 y un cencerro en la nota del acorde.
          if (phonk) {
            phonk.bass808(c.t, chordForPops(c.t).bass, 0.45, 0.9);
            phonk.cowbell(c.t, chordForPops(c.t).notes[2] + 12, 0.8);
          }
          break;
        case 'impact': kit.impact(c.t, c.vel || 1); break;
        case 'whoosh': kit.whoosh(c.t, c.dur || 0.55, c.vel || 1); break;
        case 'riser': kit.riser(c.t, c.dur || 1, c.vel || 1); break;
        // En la épica, el acorde final ya lo dan todos (finale).
        case 'stab': if (!epic) { kit.stab(c.t, CH[0].notes); kit.stab(c.t, [CH[0].bass + 24]); } break;
        case 'pop': {
          const ch = chordForPops(c.t);
          const note = ch.notes[popIndex % 3] + (popIndex % 2 ? 24 : 12);
          kit.pop(c.t, c.made, note, ((popIndex % 5) - 2) * 0.2, c.clank !== false);
          popIndex++;
          break;
        }
        default: break;
      }
    }

    const buffer = await ctx.startRendering();
    // Al final, que no sature: el pico a -1 dB.
    let peak = 0;
    for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
      const d = buffer.getChannelData(ch);
      for (let i = 0; i < d.length; i++) peak = Math.max(peak, Math.abs(d[i]));
    }
    const k = peak > 0 ? 0.89 / peak : 1;
    // Un fundido de medio segundo al final para que no corte en seco.
    const fadeFrom = Math.round(timeline.duration * RATE) - RATE / 2;
    for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
      const d = buffer.getChannelData(ch);
      for (let i = 0; i < d.length; i++) {
        const f = i < fadeFrom ? 1 : Math.max(0, 1 - (i - fadeFrom) / (RATE / 2));
        d[i] *= k * f;
      }
    }
    return buffer;
  }

  // WAV de 16 bits para descargar solo el audio.
  function toWav(buffer, duration) {
    const ch = buffer.numberOfChannels;
    const frames = Math.min(buffer.length, Math.round(duration * buffer.sampleRate));
    const data = new DataView(new ArrayBuffer(44 + frames * ch * 2));
    const str = (o, s) => [...s].forEach((c, i) => data.setUint8(o + i, c.charCodeAt(0)));
    str(0, 'RIFF'); data.setUint32(4, 36 + frames * ch * 2, true); str(8, 'WAVE');
    str(12, 'fmt '); data.setUint32(16, 16, true); data.setUint16(20, 1, true); data.setUint16(22, ch, true);
    data.setUint32(24, buffer.sampleRate, true); data.setUint32(28, buffer.sampleRate * ch * 2, true);
    data.setUint16(32, ch * 2, true); data.setUint16(34, 16, true);
    str(36, 'data'); data.setUint32(40, frames * ch * 2, true);
    const chans = [...Array(ch)].map((_, c) => buffer.getChannelData(c));
    let o = 44;
    for (let i = 0; i < frames; i++) {
      for (let c = 0; c < ch; c++) {
        const v = Math.max(-1, Math.min(1, chans[c][i]));
        data.setInt16(o, v < 0 ? v * 0x8000 : v * 0x7fff, true);
        o += 2;
      }
    }
    return new Blob([data], { type: 'audio/wav' });
  }

  window.StudioAudio = { render, toWav, BEAT, BAR, STEP, RATE };
})();
