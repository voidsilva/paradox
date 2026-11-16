// A galeria: as pinturas do vídeo flutuando em profundidade.
// Cada cena = uma pintura de fundo + figuras recortadas da própria pintura, soltas no ar.
// O scroll leva a câmera para dentro de uma pintura e para fora, rumo à próxima.
import * as THREE from 'three';

export const PAINTS = [
  'p01-retrato', 'p02-dostoievski', 'p03-trem', 'p04-dois-homens', 'p05-nastassia', 'p06-salao', 'p07-flor',
  'p08-jovem', 'p09-caveira', 'p10-dama', 'p11-cabisbaixo', 'p12-angustia', 'p13-perfil', 'p14-cafe',
  'p15-rua', 'p16-olhar', 'p17-lenco', 'p18-gola', 'p19-brinde', 'p20-duas', 'p21-jardim',
];
export const CUTS = [
  'p01-retrato', 'p02-dostoievski', 'p03-trem', 'p05-nastassia', 'p07-flor', 'p08-jovem',
  'p10-dama', 'p11-cabisbaixo', 'p17-lenco', 'p18-gola', 'p20-duas',
];

const SPACING = 64;  // distância entre cenas
const REST = 25;     // distância da câmera ao plano das figuras em repouso
const BG_BACK = 13;  // fundo fica atrás das figuras

// layout de cada cena: fundo, figuras {k, x, y, h, z}, enquadramento {lx} e brilho
const SCENES = [
  { bg: 'p15-rua', dim: .42, look: -1.5, cuts: [{ k: 'p01-retrato', x: 1.8, y: -1.2, h: 10.5, z: 2 }, { k: 'p05-nastassia', x: 8.8, y: -1.6, h: 12, z: 0 }] },
  { bg: 'p09-caveira', dim: .5, look: -3.5, cuts: [{ k: 'p02-dostoievski', x: 6.5, y: -1.8, h: 11.5, z: 1 }] },
  { bg: 'p03-trem', dim: .55, look: 3.5, cuts: [{ k: 'p03-trem', x: -6.5, y: -1.6, h: 11.5, z: 2.5 }] },
  { bg: 'p06-salao', dim: .5, look: -3.5, embers: true, cuts: [{ k: 'p05-nastassia', x: 6.8, y: -1.6, h: 12, z: 1.5 }, { k: 'p11-cabisbaixo', x: 13.5, y: -3.2, h: 7.5, z: -2 }] },
  { bg: 'p12-angustia', dim: .36, look: 0, cuts: [{ k: 'p08-jovem', x: -12, y: -3, h: 9.5, z: 0 }, { k: 'p18-gola', x: 12, y: 1.8, h: 6.5, z: 1 }] },
  { bg: 'p07-flor', dim: .5, look: 3.5, light: true, cuts: [{ k: 'p07-flor', x: -6, y: -1.8, h: 11, z: 2 }] },
  { bg: 'p19-brinde', dim: .6, look: -1, cuts: [{ k: 'p20-duas', x: 8.5, y: -1.6, h: 11.5, z: 1.5 }] },
];

const vert = /* glsl */`
  uniform float uBend, uTime, uSeed;
  varying vec2 vUv; varying float vDepth;
  void main(){
    vUv = uv;
    vec3 p = position;
    p.z += (sin(uv.x*3.14159) + sin(uv.y*3.14159)*.6) * uBend;
    vec4 mv = modelViewMatrix * vec4(p,1.);
    vDepth = -mv.z;
    gl_Position = projectionMatrix * mv;
  }`;
const frag = /* glsl */`
  uniform sampler2D map; uniform float uOpacity, uDim, uShift, uVig, uFrame, uCut, uNear, uFar, uAsp;
  uniform vec3 uFog, uGold;
  varying vec2 vUv; varying float vDepth;
  void main(){
    vec2 uv = vUv;
    vec4 c = texture2D(map, uv);
    if (uShift > .0001) {
      c.r = texture2D(map, uv + vec2(uShift, 0.)).r;
      c.b = texture2D(map, uv - vec2(uShift, 0.)).b;
    }
    float a = mix(1., c.a * smoothstep(.0, .22, uv.y), uCut); // recortes somem suaves na base
    if (a < .02) discard;
    vec3 col = c.rgb * uDim;
    // vinheta (fundo): bordas se dissolvem na escuridão
    float v = smoothstep(1.02, .3, length((uv - .5) * 2.) * .8);
    col *= mix(1., v, uVig);
    // moldura dourada fina (quadros soltos)
    vec2 e = min(uv, 1. - uv) * vec2(uAsp, 1.);
    float b = step(min(e.x, e.y), .035);
    col = mix(col, uGold * (.55 + .45 * fract(sin(dot(uv, vec2(91., 37.)))*999.)), b * uFrame);
    float f = smoothstep(uNear, uFar, vDepth);
    col = mix(col, uFog, f);
    gl_FragColor = vec4(col, a * uOpacity);
  }`;

export async function createWorld({ canvas, base = '', tier = 'high', still = false, onProgress = () => {} }) {
  const HIGH = tier === 'high';
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: HIGH, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: still });
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace; // trabalhamos direto em sRGB
  renderer.setPixelRatio(HIGH ? Math.min(devicePixelRatio || 1, 1.75) : 1);
  const FOG = new THREE.Color(0x0d0907);
  renderer.setClearColor(FOG, 1);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, .1, 400);

  // ---------- texturas ----------
  const manager = new THREE.LoadingManager();
  let done = 0; const total = PAINTS.length + CUTS.length;
  const loader = new THREE.TextureLoader(manager);
  const tex = {};
  const resolve = u => (window.__ASSETS && window.__ASSETS[u]) || base + u;
  const load = (key, url) => new Promise(res => loader.load(resolve(url), t => {
    t.colorSpace = THREE.NoColorSpace; t.anisotropy = 4; t.generateMipmaps = true;
    tex[key] = t; onProgress(++done / total); res();
  }, undefined, () => { onProgress(++done / total); res(); }));
  await Promise.all([
    ...PAINTS.map(k => load('p:' + k, 'img/paint/' + k + '.jpg')),
    ...CUTS.map(k => load('c:' + k, 'img/cut/' + k + '.webp')),
  ]);

  const planes = [];
  function makePlane(t, h, o = {}) {
    const img = t.image; const asp = img.width / img.height;
    const seg = o.bend ? 24 : 1;
    const mat = new THREE.ShaderMaterial({
      vertexShader: vert, fragmentShader: frag, transparent: true, depthWrite: !o.cut,
      uniforms: {
        map: { value: t }, uOpacity: { value: 1 }, uDim: { value: o.dim ?? 1 }, uShift: { value: 0 },
        uVig: { value: o.vig ? 1 : 0 }, uFrame: { value: o.frame ? 1 : 0 }, uCut: { value: o.cut ? 1 : 0 },
        uNear: { value: o.near ?? 40 }, uFar: { value: o.far ?? 120 }, uAsp: { value: asp },
        uFog: { value: FOG }, uGold: { value: new THREE.Color(0xb8893a) },
        uBend: { value: 0 }, uTime: { value: 0 }, uSeed: { value: Math.random() },
      },
    });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(h * asp, h, seg, seg), mat);
    m.userData = { baseOpacity: 1, ...o };
    planes.push(m);
    return m;
  }

  // ---------- cenas ----------
  const stages = SCENES.map((s, i) => {
    const g = new THREE.Group();
    g.position.z = -i * SPACING;
    const bgT = tex['p:' + s.bg];
    const bg = makePlane(bgT, 29, { dim: s.dim, vig: true, bend: true, near: 60, far: 150 });
    bg.position.set(s.look * .4, 0, -BG_BACK);
    g.add(bg);
    const cuts = s.cuts.filter(c => tex['c:' + c.k]).map((c, j) => {
      const m = makePlane(tex['c:' + c.k], c.h, { cut: true, near: 50, far: 140, dim: .96, bend: true });
      m.position.set(c.x, c.y, c.z);
      m.userData.home = m.position.clone();
      m.userData.desk = m.position.clone();
      m.userData.phase = i * 1.7 + j * 2.3;
      m.renderOrder = 2; // mesma ordem: o three ordena de trás para frente
      g.add(m);
      return m;
    });
    scene.add(g);
    return { g, bg, cuts, s };
  });

  // ---------- quadros soltos pelo caminho ----------
  const nFill = HIGH ? 54 : 26;
  const fillers = [];
  for (let i = 0; i < nFill; i++) {
    const k = PAINTS[(i * 7 + 3) % PAINTS.length];
    const h = 2.8 + Math.random() * 4.2;
    const m = makePlane(tex['p:' + k], h, { frame: true, dim: .82, near: 30, far: 105 });
    const side = i % 2 ? 1 : -1;
    const z = 20 - Math.random() * (SPACING * (SCENES.length - 1) + 60);
    m.position.set(side * (14 + Math.random() * 14), -6 + Math.random() * 16, z);
    m.rotation.y = -side * (.25 + Math.random() * .35);
    m.rotation.z = (Math.random() - .5) * .08;
    m.userData.phase = Math.random() * 6.28;
    m.userData.home = m.position.clone();
    scene.add(m);
    fillers.push(m);
  }

  // ---------- pó dourado e brasas ----------
  function dust(n, spread, color, size, rise) {
    const geo = new THREE.BufferGeometry();
    const p = new Float32Array(n * 3), r = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      p.set([(Math.random() - .5) * spread.x, (Math.random() - .5) * spread.y, spread.z0 - Math.random() * spread.z], i * 3);
      r[i] = Math.random();
    }
    geo.setAttribute('position', new THREE.BufferAttribute(p, 3));
    geo.setAttribute('aR', new THREE.BufferAttribute(r, 1));
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: 0 }, uPx: { value: renderer.getPixelRatio() }, uCol: { value: new THREE.Color(color) }, uSize: { value: size }, uRise: { value: rise }, uH: { value: spread.y }, uAmt: { value: 1 } },
      vertexShader: `attribute float aR; uniform float uTime,uPx,uSize,uRise,uH; varying float vA;
        void main(){ vec3 p = position;
          p.y = mod(p.y + uTime*uRise*(.4+aR) + uH*.5, uH) - uH*.5;
          p.x += sin(uTime*.4 + aR*20.)*.5;
          vec4 mv = modelViewMatrix*vec4(p,1.); float d = -mv.z;
          vA = (.35 + .65*pow(.5+.5*sin(uTime*(1.5+aR*2.)+aR*40.), 3.)) * smoothstep(1.,6.,d) * (1.-smoothstep(40.,90.,d));
          gl_PointSize = clamp(uSize*uPx*(.4+aR)*30./d, 1., 22.); gl_Position = projectionMatrix*mv; }`,
      fragmentShader: `uniform vec3 uCol; uniform float uAmt; varying float vA;
        void main(){ float r = length(gl_PointCoord-.5); float a = exp(-r*r*30.) + .5*exp(-r*r*400.);
          float star = max(0., 1.-abs(gl_PointCoord.x-.5)*30.) + max(0., 1.-abs(gl_PointCoord.y-.5)*30.);
          gl_FragColor = vec4(uCol*(a + star*exp(-r*r*12.)*.6)*vA*uAmt, 1.); }`,
    });
    const pts = new THREE.Points(geo, mat);
    pts.frustumCulled = false;
    return pts;
  }
  const gold = dust(HIGH ? 1600 : 600, { x: 60, y: 30, z0: 30, z: SPACING * SCENES.length + 40 }, 0xe8c27a, 2.2, .25);
  scene.add(gold);
  const embers = dust(HIGH ? 500 : 220, { x: 34, y: 26, z0: 8, z: 24 }, 0xff6a2a, 3, 2.2);
  embers.position.z = stages[3].g.position.z;
  scene.add(embers);

  // luz da cena V: um disco suave atrás da figura
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(26, 26), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uA: { value: 1 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: `uniform float uA; varying vec2 vUv; void main(){ float r = length(vUv-.5)*2.; vec3 c = vec3(1.,.86,.62)*(exp(-r*r*5.)*.55 + exp(-r*r*40.)*.5); gl_FragColor = vec4(c*uA, 1.); }`,
  }));
  glow.position.set(-3, 2, -4);
  stages[5].g.add(glow);

  // ---------- câmera ----------
  const state = { u: 0, mx: 0, my: 0, vel: 0 };
  const cur = { u: 0, mx: 0, my: 0, vel: 0 };
  let mobile = false;

  function resize() {
    const w = canvas.clientWidth || innerWidth, h = canvas.clientHeight || innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    mobile = w / h < .85;
    camera.fov = mobile ? 39 : 38;
    camera.updateProjectionMatrix();
    // celular: a pintura de fundo cobre a tela (corta nas laterais) e as figuras vêm para perto do centro
    stages.forEach(st => st.cuts.forEach(m => {
      const d = m.userData.desk;
      m.userData.home.set(mobile ? d.x * .38 : d.x, mobile ? d.y - .6 : d.y, d.z);
      m.scale.setScalar(mobile ? .86 : 1);
    }));
  }
  resize();

  const ease = x => (x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));

  // posição da câmera ao longo do caminho para um u (0..N-1, com repouso na 1ª metade de cada trecho)
  function camAt(u) {
    const last = SCENES.length - 1;
    const i = Math.min(Math.floor(u), last);
    const f = u - i;
    const t = i >= last ? 0 : ease(clamp((f - .42) / .58));
    const z0 = -i * SPACING + REST, z1 = -(i + 1) * SPACING + REST;
    const lx0 = SCENES[i].look, lx1 = SCENES[Math.min(i + 1, last)].look;
    return { z: z0 + (z1 - z0) * t, look: lx0 + (lx1 - lx0) * t, i, t, f };
  }

  const tmp = new THREE.Vector3();
  let time = 0;

  function frame(dt, snap = false) {
    time += dt;
    const k = snap ? 1 : 1 - Math.pow(.004, dt);
    cur.u += (state.u - cur.u) * k;
    cur.mx += (state.mx - cur.mx) * (snap ? 1 : k * .5);
    cur.my += (state.my - cur.my) * (snap ? 1 : k * .5);
    cur.vel += (state.vel - cur.vel) * (snap ? 1 : k * .8);

    const c = camAt(cur.u);
    const back = mobile ? 2 : 0;
    camera.position.set(c.look * .25 + cur.mx * 1.2, cur.my * .7 + 0, c.z + back);
    tmp.set(c.look + cur.mx * .4, cur.my * .3 + 0, c.z - 40);
    camera.lookAt(tmp);

    const bend = clamp(cur.vel * .035, -2.2, 2.2);
    const shift = Math.min(.012, Math.abs(cur.vel) * .00025);

    // cenas: atravessar a pintura = ela se desfaz ao chegar perto
    stages.forEach((st, i) => {
      const zg = st.g.position.z;
      const dBg = camera.position.z - (zg - BG_BACK);
      st.bg.material.uniforms.uOpacity.value = clamp((dBg - 3) / 10);
      st.bg.visible = dBg > 2.5 && dBg < 170;
      st.bg.material.uniforms.uBend.value = bend * 1.6;
      st.bg.material.uniforms.uShift.value = shift;
      st.cuts.forEach((m, j) => {
        const h = m.userData.home;
        const ph = m.userData.phase;
        m.position.set(h.x + Math.sin(time * .35 + ph) * .25, h.y + Math.sin(time * .5 + ph) * .35, h.z);
        m.rotation.z = Math.sin(time * .3 + ph) * .015;
        const dz = camera.position.z - (zg + h.z);
        m.material.uniforms.uOpacity.value = clamp((dz - 2) / 7);
        m.visible = dz > 1.5 && dz < 160;
        m.material.uniforms.uBend.value = bend;
        m.material.uniforms.uShift.value = shift;
      });
    });
    fillers.forEach(m => {
      const h = m.userData.home;
      m.position.y = h.y + Math.sin(time * .4 + m.userData.phase) * .4;
      const dz = camera.position.z - m.position.z;
      m.visible = dz > -2 && dz < 120;
      m.material.uniforms.uOpacity.value = clamp(dz / 6);
    });

    gold.material.uniforms.uTime.value = time;
    embers.material.uniforms.uTime.value = time;
    glow.material.uniforms.uA.value = .8 + Math.sin(time * .8) * .2;

    renderer.render(scene, camera);
  }

  let raf = 0, running = false, last = performance.now(), visible = true;
  function loop(now) {
    raf = requestAnimationFrame(loop);
    const dt = Math.min(.1, (now - last) / 1000); last = now;
    state.vel *= Math.pow(.02, dt);
    frame(dt);
  }
  function start() { if (running || still) return; running = true; last = performance.now(); raf = requestAnimationFrame(loop); }
  function stop() { running = false; cancelAnimationFrame(raf); }
  const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; visible && !document.hidden ? start() : stop(); });
  io.observe(canvas);
  document.addEventListener('visibilitychange', () => (document.hidden || !visible ? stop() : start()));
  addEventListener('resize', resize);

  frame(0, true);

  return {
    scenes: SCENES.length,
    set(o) { Object.assign(state, o); },
    pointer(x, y) { state.mx = x; state.my = y; },
    kick(v) { state.vel = v; },
    settle() { state.vel = 0; cur.vel = 0; frame(0, true); frame(0, true); },
    start, stop, resize,
  };
}
