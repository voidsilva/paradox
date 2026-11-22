/* Som do início, todo gerado: um zumbido grave de salão vazio, brasa perto da porta do Idiota,
   vento perto da porta do Montaigne, um sino quando o objeto fecha e um sopro ao entrar. */
export function createLobbySound() {
  let ac = null, master, drone, ember, wind, windF, emberF, droneF;
  const s = { on: false };

  function noiseBuf(sec = 2) {
    const b = ac.createBuffer(1, ac.sampleRate * sec, ac.sampleRate), d = b.getChannelData(0);
    let last = 0;
    for (let i = 0; i < d.length; i++) { const w = Math.random() * 2 - 1; last = (last + .02 * w) / 1.02; d[i] = last * 3.5; }
    return b;
  }
  function loopNoise(buf) { const n = ac.createBufferSource(); n.buffer = buf; n.loop = true; n.start(); return n; }

  function build() {
    ac = new (window.AudioContext || window.webkitAudioContext)();
    master = ac.createGain(); master.gain.value = 0; master.connect(ac.destination);
    const comp = ac.createDynamicsCompressor(); comp.connect(master);

    // zumbido: lá grave com quinta, levemente desafinado
    droneF = ac.createBiquadFilter(); droneF.type = 'lowpass'; droneF.frequency.value = 260; droneF.Q.value = .7;
    drone = ac.createGain(); drone.gain.value = .16; droneF.connect(drone); drone.connect(comp);
    [[55, -6], [55, 5], [82.4, 3], [110, -4], [164.8, 7]].forEach(([f, dt], i) => {
      const o = ac.createOscillator(); o.type = i < 2 ? 'sawtooth' : 'triangle'; o.frequency.value = f; o.detune.value = dt;
      const g = ac.createGain(); g.gain.value = i < 2 ? .35 : .18; o.connect(g); g.connect(droneF); o.start();
      // respira devagar
      const l = ac.createOscillator(), lg = ac.createGain(); l.frequency.value = .05 + i * .021; lg.gain.value = g.gain.value * .5; l.connect(lg); lg.connect(g.gain); l.start();
    });

    const nb = noiseBuf();
    // brasa: ruído grave com estalos
    emberF = ac.createBiquadFilter(); emberF.type = 'bandpass'; emberF.frequency.value = 900; emberF.Q.value = .8;
    ember = ac.createGain(); ember.gain.value = 0; loopNoise(nb).connect(emberF); emberF.connect(ember); ember.connect(comp);
    // vento: ruído agudo que passeia
    windF = ac.createBiquadFilter(); windF.type = 'bandpass'; windF.frequency.value = 1400; windF.Q.value = 2.2;
    wind = ac.createGain(); wind.gain.value = .015; loopNoise(nb).connect(windF); windF.connect(wind); wind.connect(comp);
    const wl = ac.createOscillator(), wg = ac.createGain(); wl.frequency.value = .09; wg.gain.value = 700; wl.connect(wg); wg.connect(windF.frequency); wl.start();
  }

  let crackT = 0;
  function crackle() {
    if (!s.on || ember.gain.value < .01) return;
    const t = ac.currentTime, o = ac.createBufferSource(), g = ac.createGain(), f = ac.createBiquadFilter();
    o.buffer = noiseBuf(.05); f.type = 'highpass'; f.frequency.value = 1800 + Math.random() * 3000;
    g.gain.setValueAtTime(ember.gain.value * (2 + Math.random() * 4), t); g.gain.exponentialRampToValueAtTime(.0001, t + .04);
    o.connect(f); f.connect(g); g.connect(master); o.start(t); o.stop(t + .06);
  }

  s.start = () => {
    if (!ac) build();
    ac.resume();
    s.on = true;
    master.gain.cancelScheduledValues(ac.currentTime);
    master.gain.setTargetAtTime(.9, ac.currentTime, .8);
    clearInterval(crackT); crackT = setInterval(() => { if (Math.random() < .45) crackle(); }, 90);
  };
  s.stop = () => {
    s.on = false; clearInterval(crackT);
    if (!ac) return;
    master.gain.setTargetAtTime(0, ac.currentTime, .25);
  };
  // porta em foco muda o ar
  s.hover = id => {
    if (!ac) return;
    const t = ac.currentTime;
    ember.gain.setTargetAtTime(id === 'idiota' ? .05 : 0, t, .4);
    wind.gain.setTargetAtTime(id === 'montaigne' ? .07 : .015, t, .5);
    droneF.frequency.setTargetAtTime(id ? 520 : 260, t, .6);
  };
  // o objeto fecha: um sino
  s.chime = () => {
    if (!ac || !s.on) return;
    const t = ac.currentTime;
    [[440, .12], [659.3, .07], [880, .05], [1318.5, .03], [1760 * 1.003, .02]].forEach(([f, a], i) => {
      const o = ac.createOscillator(), g = ac.createGain(); o.type = 'sine'; o.frequency.value = f;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(a, t + .005 + i * .002); g.gain.exponentialRampToValueAtTime(.0001, t + 2.8 - i * .35);
      o.connect(g); g.connect(master); o.start(t); o.stop(t + 3);
    });
  };
  // atravessar uma porta: sopro que sobe
  s.enter = () => {
    if (!ac || !s.on) return;
    const t = ac.currentTime, o = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    o.buffer = noiseBuf(2); f.type = 'bandpass'; f.Q.value = 1.4;
    f.frequency.setValueAtTime(200, t); f.frequency.exponentialRampToValueAtTime(4000, t + 1.3);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.5, t + .9); g.gain.linearRampToValueAtTime(0, t + 1.4);
    o.connect(f); f.connect(g); g.connect(master); o.start(t); o.stop(t + 1.5);
    droneF.frequency.setTargetAtTime(1600, t, .4);
  };
  return s;
}
