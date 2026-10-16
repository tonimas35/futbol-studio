// ============================================================
// MÚSICA DEL VÍDEO SHORT · una base de 150 BPM (trap a medio tiempo) y un efecto para
// cada animación, sintetizados en el navegador con Web Audio (OfflineAudioContext).
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

  // Reverberación: una respuesta de ruido que se apaga (2 s).
  function reverb(ctx, rand) {
    const len = Math.round(RATE * 2);
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

  // timeline: { duration, scenes: [{ start, dur, energy, drop? }], cues: [{ t, kind, ... }], seed }
  async function render(timeline) {
    const length = Math.ceil((timeline.duration + 0.6) * RATE);
    const ctx = new OfflineAudioContext(2, length, RATE);
    const rand = rng(timeline.seed || 1);

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
    const conv = reverb(ctx, rand);
    const verbIn = ctx.createGain();
    verbIn.gain.value = 0.22;
    verbIn.connect(conv).connect(bus(0.7));
    buses.verb = verbIn;
    const kit = makeKit(ctx, buses, rand);

    // La base, escena a escena (todas duran compases enteros).
    let globalBar = 0;
    for (const sc of timeline.scenes) {
      const bars = Math.round(sc.dur / BAR);
      for (let b = 0; b < bars; b++) {
        const t = sc.start + b * BAR;
        const local = b * BAR;
        // En el marcador, la base de verdad entra con el golpe (sc.drop). El cierre: un
        // compás en mi mayor que sube y el acorde final en la menor (lo pone video.js).
        const energy = sc.energy === 'outro' ? (b === 0 ? 'build' : 'tail')
          : sc.drop != null && local < sc.drop ? 'intro' : sc.energy;
        const chord = sc.energy === 'outro' ? CHORDS[3] : CHORDS[(globalBar + 3) % 4];
        if (energy === 'tail') kit.pad(t, CHORDS[0].notes, BAR, 0.8);
        else kit.pad(t, chord.notes, BAR, energy === 'intro' || energy === 'build' ? 0.8 : 1);
        playBar(kit, t, globalBar, energy, chord, rand, b === bars - 1);
        globalBar++;
      }
    }

    // Los efectos de las animaciones.
    const chordForPops = (t) => {
      let acc = 0, bar = 0;
      for (const sc of timeline.scenes) {
        if (t < sc.start + sc.dur) { bar = acc + Math.floor((t - sc.start) / BAR); break; }
        acc += Math.round(sc.dur / BAR);
      }
      return CHORDS[(bar + 3) % 4];
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
        case 'stab': kit.stab(c.t, CHORDS[0].notes.map(n => n + 12)); kit.stab(c.t, [CHORDS[0].bass + 24]); break;
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
