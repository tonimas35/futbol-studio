// ============================================================
// MÚSICA DEL VÍDEO SHORT · una base de 150 BPM y un efecto para cada animación,
// sintetizados en el navegador con Web Audio (OfflineAudioContext). Dos estilos: «épica»
// (por defecto: taikos, cuerdas en semicorcheas, metales, coro y timbales, como un tráiler)
// y «urbana» (trap a medio tiempo).
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

  // La menor: Am | F | Dm | E. El mi mayor deja la tensión que se resuelve en Am.
  const CHORDS = [
    { bass: 33, notes: [57, 60, 64] }, // Am (bajo A1)
    { bass: 29, notes: [57, 60, 65] }, // F
    { bass: 38, notes: [57, 62, 65] }, // Dm (bajo D2: en D1 no se oye en un móvil)
    { bass: 40, notes: [56, 59, 64] }, // E
  ];
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
      // 808: seno saturado (armónicos) y una capa una octava arriba, porque el altavoz de
      // un móvil casi no da graves y así la línea de bajo se sigue oyendo.
      bass808(t, midi, dur, vel = 1) {
        const f = hz(midi);
        const o = osc(ctx, 'sine', f * 2, t, t + dur + 0.05);
        o.frequency.exponentialRampToValueAtTime(f, t + 0.05);
        const g = ctx.createGain();
        const decay = Math.max(0.08, dur * 0.45);
        env(g, t, 0.2 * vel, 0.006, decay, dur * 0.5);
        o.connect(saturation(ctx, 3.5)).connect(g).connect(bass);
        const up = osc(ctx, 'triangle', f * 2, t, t + dur + 0.05);
        const ug = ctx.createGain();
        env(ug, t, 0.14 * vel, 0.006, decay, dur * 0.5);
        up.connect(ug).connect(bass);
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
      // Campana FM para la melodía.
      bell(t, midi, vel = 1, dur = 0.9, side = 0) {
        const f = hz(midi);
        const car = osc(ctx, 'sine', f, t, t + dur + 0.1);
        const mod = osc(ctx, 'sine', f * 3.5, t, t + dur + 0.1);
        const mg = ctx.createGain();
        mg.gain.setValueAtTime(f * 2.4, t);
        mg.gain.exponentialRampToValueAtTime(f * 0.1, t + dur * 0.6);
        mod.connect(mg).connect(car.frequency);
        const g = ctx.createGain();
        env(g, t, 0.3 * vel, 0.004, dur);
        const p = pan(ctx, side);
        car.connect(g).connect(p);
        p.connect(keys);
        p.connect(verb);
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
  const KICKS = [0, 6, 10];              // semicorcheas del compás con bombo y 808
  const MOTIF = [[0, 2], [3, 1], [6, 0], [10, 1], [12, 2]]; // [semicorchea, nota del acorde]

  function playBar(kit, t, bar, energy, chord, rand, last) {
    const s = (n) => t + n * STEP;
    if (energy === 'tail') return;
    if (energy === 'intro' || energy === 'build') {
      // Platos que se aceleran: corcheas y, en la segunda mitad, semicorcheas.
      for (let n = 0; n < 16; n += n < 8 ? 2 : 1) kit.hat(s(n), 0.35 + 0.45 * (n / 16), false, n % 4 ? 0.3 : -0.3);
      if (energy === 'build') kit.bell(s(0), chord.notes[2] + 12, 0.8, 1.2, 0);
      return;
    }
    const full = energy === 'full';
    // Bombo y 808
    if (full) {
      KICKS.forEach((n, i) => {
        kit.kick(s(n), i === 0 ? 1 : 0.8);
        const next = KICKS[i + 1] ?? 16;
        kit.bass808(s(n), chord.bass, (next - n) * STEP * 0.95, i === 0 ? 1 : 0.85);
      });
      kit.clap(s(8));
    } else {
      kit.kick(s(0), 0.8);
      kit.bass808(s(0), chord.bass, BAR * 0.9, 0.8);
    }
    // Platos: corcheas y, al final de cada dos compases, el redoble de trap.
    for (let n = 0; n < 16; n += 2) kit.hat(s(n), n % 4 ? 0.45 : 0.75, false, n % 4 ? 0.3 : -0.2);
    if (full && bar % 2 === 1) {
      [13, 13.5, 14, 14.5, 15, 15.33, 15.66].forEach((n, i) => kit.hat(s(n), 0.35 + i * 0.06, false, 0.35));
    }
    if (full && bar % 4 === 2) kit.hat(s(14), 0.6, true, -0.35);
    // Melodía de campana: entera con toda la base y solo las dos primeras notas en 'light'.
    MOTIF.slice(0, full ? MOTIF.length : 2).forEach(([n, k], i) =>
      kit.bell(s(n), chord.notes[k] + 12, (i === 0 ? 1 : 0.75) * (full ? 1 : 0.7), 0.7, (k - 1) * 0.35));
    if (last && full) kit.hat(s(15), 0.8, true, 0);
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

  // timeline: { duration, scenes: [{ start, dur, energy, drop? }], cues: [{ t, kind, ... }], seed,
  //   style: 'epica' (por defecto) | 'trap' }
  async function render(timeline) {
    const length = Math.ceil((timeline.duration + 0.6) * RATE);
    const ctx = new OfflineAudioContext(2, length, RATE);
    const rand = rng(timeline.seed || 1);
    const epic = timeline.style !== 'trap';
    const CH = epic ? EPIC_CHORDS : CHORDS;

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
    for (const sc of timeline.scenes) {
      const n = Math.round(sc.dur / BAR);
      for (let b = 0; b < n; b++) {
        const local = b * BAR;
        const energy = sc.energy === 'outro' ? (b === 0 ? 'build' : 'tail')
          : sc.drop != null && local < sc.drop ? 'intro' : sc.energy;
        bars.push({ t: sc.start + local, energy, outro: sc.energy === 'outro', scene: b === 0, last: b === n - 1 });
      }
    }
    // La urbana cuenta los acordes desde el primer compás (el golpe cae en el segundo); la
    // épica, desde el golpe.
    const dropAt = epic ? Math.max(0, bars.findIndex(b => b.energy !== 'intro')) : 1;
    bars.forEach((b, i) => { b.k = b.outro ? 3 : (((i - dropAt) % 4) + 4) % 4; });
    if (epic) {
      const orch = makeOrchestra(ctx, buses, rand);
      bars.forEach((b, i) => playEpicBar(orch, bars, i, CH, dropAt));
    } else {
      bars.forEach((b, i) => {
        const chord = CH[b.k];
        if (b.energy === 'tail') kit.pad(b.t, CH[0].notes, BAR, 0.8);
        else kit.pad(b.t, chord.notes, BAR, b.energy === 'intro' || b.energy === 'build' ? 0.8 : 1);
        playBar(kit, b.t, i, b.energy, chord, rand, b.last);
      });
    }

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
        case 'slam': kit.slam(c.t, c.vel || 1); break;
        case 'impact': kit.impact(c.t, c.vel || 1); break;
        case 'whoosh': kit.whoosh(c.t, c.dur || 0.55, c.vel || 1); break;
        case 'riser': kit.riser(c.t, c.dur || 1, c.vel || 1); break;
        // En la épica, el acorde final ya lo dan todos (finale).
        case 'stab': if (!epic) { kit.stab(c.t, CHORDS[0].notes.map(n => n + 12)); kit.stab(c.t, [CHORDS[0].bass + 24]); } break;
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
