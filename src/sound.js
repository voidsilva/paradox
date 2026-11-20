// Trilha gerada no navegador (Web Audio), sem arquivos de áudio.
// Ré menor, lenta: cordas graves, piano esparso com muito eco, e o fogo estalando
// quando uma pintura queima. No final a harmonia se abre em Ré maior.
const CHORDS = [
  [38, 50, 53, 57, 62],  // Ré menor
  [34, 46, 50, 53, 58],  // Si bemol
  [31, 43, 46, 50, 55],  // Sol menor
  [33, 45, 49, 52, 57],  // Lá
];
const FINAL = [38, 50, 54, 57, 62]; // Ré maior
const MELODY = [74, 72, 69, 70, 69, 65, 67, 69, 62, 65, 64, 62];
const hz = m => 440 * Math.pow(2, (m - 69) / 12);

export function createSound(opts = {}) {
  const CH = opts.chords || CHORDS, FI = opts.final || FINAL, ME = opts.melody || MELODY;
  const FIRE = opts.fire !== false, ROOT = opts.root ?? 38, LIGHT = opts.lightScene ?? 5;
  let ctx = null, master, wet, dry, comp, on = false, timer = 0;
  let step = 0, chordI = 0, melI = 0, nextChord = 0, nextNote = 0;
  const st = { heat: 0, transit: 0, fin: 0, scene: 0, light: 0, grip: 0 };
  let lastScene = -1, crackleNext = 0;
  let pad = [], drone = null, whoosh = null, padFilter;

  function noiseBuffer(sec) {
    const b = ctx.createBuffer(1, ctx.sampleRate * sec, ctx.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return b;
  }
  function reverb(sec = 4.5) {
    const len = ctx.sampleRate * sec, b = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = b.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6);
    }
    const cv = ctx.createConvolver(); cv.buffer = b; return cv;
  }

  function init() {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain(); master.gain.value = 0;
    comp = ctx.createDynamicsCompressor(); comp.threshold.value = -18; comp.ratio.value = 3;
    master.connect(comp); comp.connect(ctx.destination);
    const rv = reverb(); wet = ctx.createGain(); wet.gain.value = .55; dry = ctx.createGain(); dry.gain.value = .7;
    rv.connect(wet); wet.connect(master); dry.connect(master);
    dry.rev = rv;

    // cordas: 5 vozes, 2 osciladores desafinados cada, filtro que respira
    padFilter = ctx.createBiquadFilter(); padFilter.type = 'lowpass'; padFilter.frequency.value = 520; padFilter.Q.value = .6;
    const padGain = ctx.createGain(); padGain.gain.value = .085;
    padFilter.connect(padGain); padGain.connect(dry); padGain.connect(rv);
    pad = CH[0].map((m, i) => {
      const g = ctx.createGain(); g.gain.value = 0; g.connect(padFilter);
      const oscs = [-7, 6].map(det => {
        const o = ctx.createOscillator(); o.type = i === 0 ? 'triangle' : 'sawtooth';
        o.frequency.value = hz(m); o.detune.value = det; o.connect(g); o.start(); return o;
      });
      return { g, oscs };
    });
    // vibrato lento nas cordas
    const lfo = ctx.createOscillator(), lfoG = ctx.createGain(); lfo.frequency.value = 4.6; lfoG.gain.value = 4;
    lfo.connect(lfoG); pad.forEach(v => v.oscs.forEach(o => lfoG.connect(o.detune))); lfo.start();

    // sopro de ar nas travessias
    whoosh = ctx.createBufferSource(); whoosh.buffer = noiseBuffer(3); whoosh.loop = true;
    const wf = ctx.createBiquadFilter(); wf.type = 'bandpass'; wf.frequency.value = 400; wf.Q.value = .8;
    const wg = ctx.createGain(); wg.gain.value = 0;
    whoosh.connect(wf); wf.connect(wg); wg.connect(dry); wg.connect(rv); whoosh.start();
    whoosh.f = wf; whoosh.g = wg;

    // fogo: rumor grave contínuo
    const fire = ctx.createBufferSource(); fire.buffer = noiseBuffer(4); fire.loop = true;
    const ff = ctx.createBiquadFilter(); ff.type = 'lowpass'; ff.frequency.value = 260;
    const fg = ctx.createGain(); fg.gain.value = 0;
    fire.connect(ff); ff.connect(fg); fg.connect(dry); fire.start();
    drone = fg;
  }

  function setChord(notes, t, glide = 2.5) {
    pad.forEach((v, i) => {
      v.oscs.forEach(o => o.frequency.setTargetAtTime(hz(notes[i]), t, glide / 4));
      v.g.gain.cancelScheduledValues(t);
      v.g.gain.setTargetAtTime(i === 0 ? .9 : .5, t, 1.2);
    });
  }

  function piano(m, t, vel = .5) {
    const f = hz(m);
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vel * .22, t + .008);
    g.gain.exponentialRampToValueAtTime(vel * .07, t + .5);
    g.gain.exponentialRampToValueAtTime(.0001, t + 4.5);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(f * 7, t); lp.frequency.exponentialRampToValueAtTime(f * 2, t + 2);
    [[1, 'triangle', 1], [2, 'sine', .35], [3, 'sine', .12], [4.01, 'sine', .06]].forEach(([k, type, a]) => {
      const o = ctx.createOscillator(); o.type = type; o.frequency.value = f * k;
      const og = ctx.createGain(); og.gain.value = a; o.connect(og); og.connect(lp);
      o.start(t); o.stop(t + 4.6);
    });
    lp.connect(g); g.connect(dry); g.connect(dry.rev);
  }

  function crack(t, amt) {
    const src = ctx.createBufferSource(); src.buffer = noiseBuffer(.06);
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1500 + Math.random() * 4000; bp.Q.value = 2;
    const g = ctx.createGain(); g.gain.setValueAtTime(amt * (.2 + Math.random() * .5), t); g.gain.exponentialRampToValueAtTime(.0001, t + .03 + Math.random() * .05);
    src.connect(bp); bp.connect(g); g.connect(dry); src.start(t);
  }

  function bell(t) { // entrada de cena: um sino grave e distante
    [[hz(ROOT), .2], [hz(ROOT) * 2.76, .06], [hz(ROOT) * 5.4, .03]].forEach(([f, a]) => {
      const o = ctx.createOscillator(); o.frequency.value = f; const g = ctx.createGain();
      g.gain.setValueAtTime(a, t); g.gain.exponentialRampToValueAtTime(.0001, t + 6);
      o.connect(g); g.connect(dry.rev); g.connect(dry); o.start(t); o.stop(t + 6);
    });
  }

  function tick() {
    if (!ctx) return;
    const t = ctx.currentTime;
    const finalMode = st.fin > .5;
    if (t >= nextChord) {
      setChord(finalMode ? FI : CH[chordI++ % CH.length], t);
      nextChord = t + (finalMode ? 12 : 8);
    }
    if (t >= nextNote) {
      const dense = (st.scene === LIGHT ? 1.3 : 1) * (1 - st.grip * .6);
      if (Math.random() < .8) piano(ME[melI++ % ME.length] + (FIRE && finalMode && ME[(melI - 1) % ME.length] % 12 === 5 ? 1 : 0), t, .35 + Math.random() * .3);
      if (Math.random() < .3) piano(ME[(melI + 3) % ME.length] - 12, t + .02, .25);
      nextNote = t + (1.6 + Math.random() * 1.6) / dense;
    }
    // cena nova = sino
    if (st.scene !== lastScene) { if (lastScene >= 0) bell(t + .05); lastScene = st.scene; }
    // cordas abrem com a luz e nas travessias
    padFilter.frequency.setTargetAtTime((480 + st.transit * 900 + (st.scene === LIGHT ? 700 : 0) + st.fin * 500) * (1 - st.grip * .55), t, .4);
    // segurar = as cordas desafinam e apertam
    pad.forEach(v => v.oscs.forEach((o, j) => o.detune.setTargetAtTime((j ? 6 : -7) * (1 + st.grip * 7), t, .25)));
    const wind = FIRE ? 0 : st.heat * .22;
    whoosh.g.gain.setTargetAtTime(st.transit * .16 + wind + st.grip * .05, t, .25);
    whoosh.f.frequency.setTargetAtTime(300 + st.transit * 1400, t, .3);
    drone.gain.setTargetAtTime(FIRE ? st.heat * .5 + (st.scene === 3 ? .12 : 0) : st.grip * .35, t, .2);
    // estalos do fogo
    const rate = FIRE ? st.heat * 26 + (st.scene === 3 ? 4 : 0) : 0;
    while (rate > .5 && crackleNext < t + .12) {
      crack(Math.max(t, crackleNext), Math.min(1, st.heat + .3));
      crackleNext = Math.max(t, crackleNext) + (-Math.log(Math.random()) / rate);
    }
    if (rate <= .5) crackleNext = t;
  }

  return {
    get on() { return on; },
    async start() {
      if (!ctx) init();
      if (ctx.state === 'suspended') await ctx.resume();
      on = true;
      master.gain.cancelScheduledValues(ctx.currentTime);
      master.gain.setTargetAtTime(.9, ctx.currentTime, .8);
      clearInterval(timer); timer = setInterval(tick, 50);
    },
    stop() {
      if (!ctx) return;
      on = false;
      master.gain.setTargetAtTime(0, ctx.currentTime, .3);
      setTimeout(() => { if (!on) { clearInterval(timer); ctx.suspend(); } }, 1200);
    },
    update(o) { Object.assign(st, o); },
    // soltar: um arpejo claro que sobe
    release() {
      if (!ctx || !on) return;
      const t = ctx.currentTime;
      FI.slice(1).concat(FI.slice(1).map(m => m + 12)).forEach((m, i) => piano(m + 12, t + i * .07, .32));
      setChord(FI, t, 1);
    },
  };
}
