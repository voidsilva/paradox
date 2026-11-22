// A galeria: as pinturas do vídeo flutuando em profundidade.
// Cada cena = uma pintura de fundo + figuras recortadas da própria pintura, soltas no ar.
// O scroll leva a câmera para dentro de uma pintura e para fora, rumo à próxima.
import * as THREE from 'three';

// Configuração padrão: O Idiota. Outro paradoxo passa a própria configuração em createWorld({ config }).
const PAINTS = [
  'p01-retrato', 'p02-dostoievski', 'p03-trem', 'p04-dois-homens', 'p05-nastassia', 'p06-salao', 'p07-flor',
  'p08-jovem', 'p09-caveira', 'p10-dama', 'p11-cabisbaixo', 'p12-angustia', 'p13-perfil', 'p14-cafe',
  'p15-rua', 'p16-olhar', 'p17-lenco', 'p18-gola', 'p19-brinde', 'p20-duas', 'p21-jardim',
];
const CUTS = [
  'p01-retrato', 'p02-dostoievski', 'p03-trem', 'p05-nastassia', 'p07-flor', 'p08-jovem',
  'p10-dama', 'p11-cabisbaixo', 'p17-lenco', 'p18-gola', 'p20-duas',
];

export const IDIOTA = { paints: PAINTS, cuts: CUTS, scenes: null, dir: 'img/', fog: 0x0d0907, gold: 0xb8893a, mode: 'burn', notes: 3, rays: 5, glow: 5, finale: 'wall' };

const SPACING = 64;  // distância entre cenas
const REST = 25;     // distância da câmera ao plano das figuras em repouso
const BG_BACK = 13;  // fundo fica atrás das figuras

// layout de cada cena: fundo, figuras {k, x, y, h, z}, enquadramento {lx} e brilho
IDIOTA.scenes = [
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
  uniform sampler2D map; uniform float uOpacity, uDim, uShift, uVig, uFrame, uCut, uNear, uFar, uAsp, uBurn, uSeed, uSheen, uMode;
  uniform vec3 uFog, uGold; uniform vec2 uLight;
  varying vec2 vUv; varying float vDepth;
  float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.-2.*f);
    return mix(mix(hash(i), hash(i+vec2(1.,0.)), f.x), mix(hash(i+vec2(0.,1.)), hash(i+1.), f.x), f.y); }
  float fbm(vec2 p){ float v = 0., a = .5; for (int i = 0; i < 4; i++){ v += a*noise(p); p *= 2.03; a *= .5; } return v; }
  void main(){
    vec2 uv = vUv;
    vec4 c = texture2D(map, uv);
    if (uShift > .0001) {
      c.r = texture2D(map, uv + vec2(uShift, 0.)).r;
      c.b = texture2D(map, uv - vec2(uShift, 0.)).b;
    }
    float a = mix(1., c.a * smoothstep(.0, .22, uv.y) * smoothstep(1., .95, uv.y), uCut); // recortes somem suaves na base
    if (a < .02) discard;
    vec3 col = c.rgb * uDim;
    // vinheta (fundo): bordas se dissolvem na escuridão
    float v = smoothstep(1.02, .3, length((uv - .5) * 2.) * .8);
    if (uMode > .5) col = mix(col, uFog, (1. - v) * uVig); else col *= mix(1., v, uVig);
    // moldura dourada fina (quadros soltos)
    vec2 e = min(uv, 1. - uv) * vec2(uAsp, 1.);
    float b = step(min(e.x, e.y), .035);
    col = mix(col, uGold * (.55 + .45 * fract(sin(dot(uv, vec2(91., 37.)))*999.)), b * uFrame);
    // verniz: um brilho largo que segue o mouse
    float sh = dot(uv - uLight, normalize(vec2(1., .55)));
    col += vec3(1., .9, .72) * exp(-sh*sh*38.) * .07 * uSheen;
    // queima: ao chegar perto, a tela pega fogo do centro para fora e abre passagem
    if (uBurn > .001 && uMode > .5) {
      // desapego: a tela se solta em lascas levadas pelo vento, da esquerda para a direita, e vira luz
      vec2 q = (uv - .5) * vec2(uAsp, 1.);
      float m = fbm(q * vec2(5., 9.) + uSeed * 17.) * .55 + noise(q * 40. + uSeed * 5.) * .12 + (1. - uv.x) * .5 + (1. - abs(uv.y - .5) * 2.) * .08;
      float th = 1.12 - uBurn * 1.4;
      if (m > th) discard;
      col = mix(col, col * 1.25 + vec3(.06, .05, .04), smoothstep(th - .2, th - .02, m));
      col += vec3(1., .93, .8) * smoothstep(th - .03, th, m) * 1.1;
    } else if (uBurn > .001) {
      vec2 q = (uv - .5) * vec2(uAsp, 1.);
      float r = length(q) / (.5 * max(uAsp, 1.));
      float m = fbm(q * 6. + uSeed * 17.) * .5 + noise(q * 30. + uSeed * 5.) * .1 + (1. - r) * .4;
      float th = 1.02 - uBurn * 1.25;
      if (m > th) discard;
      col *= 1. - .9 * smoothstep(th - .09, th - .015, m);          // chamuscado
      col += vec3(1., .38, .08) * smoothstep(th - .022, th, m) * 1.3;  // borda em brasa
      col += vec3(1., .82, .5) * smoothstep(th - .005, th, m) * 1.2;
    }
    float f = smoothstep(uNear, uFar, vDepth);
    col = mix(col, uFog, f);
    gl_FragColor = vec4(col, a * uOpacity);
  }`;

export async function createWorld({ canvas, base = '', tier = 'high', still = false, onProgress = () => {}, config = IDIOTA }) {
  const HIGH = tier === 'high';
  const C = { ...IDIOTA, ...config };
  const SCENES = C.scenes, PAINTS = C.paints, CUTS = C.cuts, WIND = C.mode === 'wind';
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: HIGH, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: still });
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace; // trabalhamos direto em sRGB
  renderer.setPixelRatio(HIGH ? Math.min(devicePixelRatio || 1, 2) : Math.min(devicePixelRatio || 1, 1.25));
  const FOG = new THREE.Color(C.fog), FOG0 = FOG.clone(), DAWN = new THREE.Color(C.dawn ?? C.fog);
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
    t.colorSpace = THREE.NoColorSpace; t.anisotropy = renderer.capabilities.getMaxAnisotropy ? Math.min(8, renderer.capabilities.getMaxAnisotropy()) : 4; t.generateMipmaps = true;
    tex[key] = t; onProgress(++done / total); res();
  }, undefined, () => { onProgress(++done / total); res(); }));
  await Promise.all([
    ...PAINTS.map(k => load('p:' + k, C.dir + 'paint/' + k + '.webp')),
    ...CUTS.map(k => load('c:' + k, C.dir + 'cut/' + k + '.webp')),
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
        uFog: { value: FOG }, uGold: { value: new THREE.Color(C.gold) },
        uBend: { value: 0 }, uTime: { value: 0 }, uSeed: { value: Math.random() },
        uBurn: { value: 0 }, uSheen: { value: o.cut ? .5 : 1 }, uLight: { value: new THREE.Vector2(.5, .5) }, uMode: { value: WIND ? 1 : 0 },
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
    const bg = makePlane(bgT, 33, { dim: s.dim, vig: true, bend: true, near: 60, far: 150 });
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
  const nFill = HIGH ? 34 : 22;
  const fillers = [];
  for (let i = 0; i < nFill; i++) {
    const k = PAINTS[(i * 5 + 3) % PAINTS.length];
    const h = 2.8 + Math.random() * 4.2;
    const m = makePlane(tex['p:' + k], h, { frame: true, dim: .82, near: 30, far: 105 });
    const side = i % 2 ? 1 : -1;
    const z = 20 - Math.random() * (SPACING * (SCENES.length - 1) + 60);
    m.position.set(side * (14 + Math.random() * 14), -6 + Math.random() * 16, z);
    m.rotation.y = -side * (.25 + Math.random() * .35);
    m.rotation.z = (Math.random() - .5) * .08;
    m.userData.ry = m.rotation.y; m.userData.rz = m.rotation.z;
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
  gold.visible = false; // tela limpa: sem poeira
  const embers = dust(HIGH ? 500 : 220, { x: 34, y: 26, z0: 8, z: 24 }, 0xff6a2a, 3, 2.2);
  embers.position.z = stages[Math.max(0, C.notes)].g.position.z;
  embers.visible = false;

  // luz da cena V: um disco suave atrás da figura
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(26, 26), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uA: { value: 1 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: `uniform float uA; varying vec2 vUv; void main(){ float r = length(vUv-.5)*2.; vec3 c = vec3(1.,.86,.62)*(exp(-r*r*5.)*.55 + exp(-r*r*40.)*.5); gl_FragColor = vec4(c*uA, 1.); }`,
  }));
  glow.position.set(-3, 2, -4);
  if (C.glow >= 0) stages[C.glow].g.add(glow);

  // ---------- faíscas: saem da borda da pintura que está queimando ----------
  const sparks = (() => {
    const n = HIGH ? 900 : 360;
    const geo = new THREE.BufferGeometry();
    const p = new Float32Array(n * 3), a = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) a.set([Math.random() * 6.2832, Math.random(), Math.random()], i * 3);
    geo.setAttribute('position', new THREE.BufferAttribute(p, 3));
    geo.setAttribute('aR', new THREE.BufferAttribute(a, 3));
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, depthTest: false,
      uniforms: { uBurn: { value: 0 }, uAmt: { value: 0 }, uTime: { value: 0 }, uPx: { value: renderer.getPixelRatio() }, uW: { value: 30 }, uWind: { value: WIND ? 1 : 0 } },
      blending: WIND ? THREE.NormalBlending : THREE.AdditiveBlending,
      vertexShader: `attribute vec3 aR; uniform float uBurn, uTime, uPx, uW, uWind; varying float vA, vS;
        void main(){
          float life = fract(aR.y + uTime * (.35 + aR.z * .5));
          float R = uBurn * uW * (.55 + aR.z * .5);
          vec3 p = vec3(cos(aR.x) * R, sin(aR.x) * R * .62, 0.);
          if (uWind > .5) {
            // lascas de tela: nascem na borda que se solta e o vento leva para a direita e para cima
            p = vec3((uBurn * 2. - 1.) * uW * (.9 + aR.z * .3), (aR.y - .5) * uW * 1.15, 0.);
            p += vec3(life * (8. + aR.z * 16.), life * (2. + aR.y * 5.) + sin(life * 6. + aR.x * 3.) * .8, life * (3. + aR.y * 9.));
          } else {
            p += vec3(cos(aR.x) * life * 2.5, life * life * (3. + aR.z * 4.), life * (4. + aR.y * 10.));
            p.x += sin(life * 9. + aR.x * 5.) * .4;
          }
          vec4 mv = modelViewMatrix * vec4(p, 1.);
          vA = (1. - life) * smoothstep(0., .08, life); vS = aR.x;
          gl_PointSize = clamp((1.2 + aR.z * 2.6) * uPx * (uWind > .5 ? 44. : 26.) / -mv.z, 1., uWind > .5 ? 22. : 14.);
          gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `uniform float uAmt, uWind; varying float vA, vS;
        void main(){ float r = length(gl_PointCoord - .5); float a = exp(-r * r * 26.);
          if (uWind > .5) {
            vec2 q = gl_PointCoord - .5; float c = cos(vS * 3.), s = sin(vS * 3.); q = mat2(c, s, -s, c) * q;
            float f = step(abs(q.x), .38) * step(abs(q.y), .14 + .1 * fract(vS * 7.));
            if (f < .5) discard; gl_FragColor = vec4(mix(vec3(.2, .22, .26), vec3(.62, .22, .14), step(.8, fract(vS * 3.))), vA * uAmt * 1.1); return; }
          gl_FragColor = vec4(vec3(1., .55, .2) * a * vA * uAmt * 1.6 + vec3(1., .9, .7) * exp(-r * r * 120.) * vA * uAmt, 1.); }`,
    });
    const pts = new THREE.Points(geo, mat);
    pts.frustumCulled = false; pts.renderOrder = 9;
    scene.add(pts);
    return pts;
  })();

  // ---------- cena III: notas de cem rublos caindo e pegando fogo ----------
  const noteTex = (() => {
    const c = document.createElement('canvas'); c.width = 512; c.height = 240;
    const g = c.getContext('2d');
    const grd = g.createLinearGradient(0, 0, 512, 240);
    grd.addColorStop(0, '#e6d6ad'); grd.addColorStop(.5, '#d4c193'); grd.addColorStop(1, '#c9b07c');
    g.fillStyle = grd; g.fillRect(0, 0, 512, 240);
    g.strokeStyle = 'rgba(74,52,30,.75)'; g.lineWidth = 3; g.strokeRect(12, 12, 488, 216);
    g.lineWidth = 1; g.strokeRect(20, 20, 472, 200);
    for (let i = 0; i < 46; i++) { g.beginPath(); g.ellipse(256, 120, 60 + i * 4, 30 + i * 2.1, 0, 0, 6.283); g.strokeStyle = `rgba(90,64,36,${.05 + (i % 3) * .02})`; g.stroke(); }
    g.fillStyle = 'rgba(70,48,28,.9)'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = 'italic 700 64px "Bodoni Moda", Georgia, serif'; g.fillText('100', 82, 66); g.fillText('100', 430, 176);
    g.font = '700 30px Georgia, serif'; g.fillText('СТО РУБЛЕЙ', 300, 112);
    g.font = '400 15px Georgia, serif'; g.fillText('ГОСУДАРСТВЕННЫЙ КРЕДИТНЫЙ БИЛЕТЪ', 300, 150);
    g.beginPath(); g.ellipse(150, 128, 44, 56, 0, 0, 6.283); g.fillStyle = 'rgba(120,90,58,.35)'; g.fill(); g.stroke();
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.NoColorSpace; t.anisotropy = 4;
    return t;
  })();
  const notes = (() => {
    const n = HIGH ? 90 : 36;
    const geo = new THREE.PlaneGeometry(2.6, 1.22, 8, 1);
    const off = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) off.set([(Math.random() - .5) * 34, Math.random(), -9 + Math.random() * 15, Math.random()], i * 4);
    geo.setAttribute('aOff', new THREE.InstancedBufferAttribute(off, 4));
    const mat = new THREE.ShaderMaterial({
      transparent: true, side: THREE.DoubleSide, depthWrite: false,
      uniforms: { map: { value: noteTex }, uTime: { value: 0 }, uFog: { value: FOG }, uAmt: { value: 1 } },
      vertexShader: `attribute vec4 aOff; uniform float uTime; varying vec2 vUv; varying float vY, vD, vS;
        mat3 rotX(float a){ float c=cos(a), s=sin(a); return mat3(1.,0.,0., 0.,c,s, 0.,-s,c); }
        mat3 rotY(float a){ float c=cos(a), s=sin(a); return mat3(c,0.,-s, 0.,1.,0., s,0.,c); }
        mat3 rotZ(float a){ float c=cos(a), s=sin(a); return mat3(c,s,0., -s,c,0., 0.,0.,1.); }
        void main(){
          vUv = uv; vS = aOff.w;
          float H = 30.;
          float y = mod(aOff.y * H - uTime * (1.1 + aOff.w * .9), H) - H * .45;
          vec3 p = position;
          p.z += sin(uv.x * 3.14159 + uTime * 3. + aOff.w * 9.) * .22;
          float t = uTime * (.8 + aOff.w) + aOff.w * 20.;
          p = rotZ(sin(t) * .6) * rotX(t * 1.3) * rotY(sin(t * .7) * 1.2) * p;
          vec3 w = vec3(aOff.x + sin(t * .5) * 1.5, y, aOff.z) + p;
          vY = y;
          vec4 mv = modelViewMatrix * vec4(w, 1.);
          vD = -mv.z;
          gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `uniform sampler2D map; uniform vec3 uFog; uniform float uAmt; varying vec2 vUv; varying float vY, vD, vS;
        float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float nz(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.-2.*f);
          return mix(mix(h(i), h(i+vec2(1.,0.)), f.x), mix(h(i+vec2(0.,1.)), h(i+1.), f.x), f.y); }
        void main(){
          vec3 c = texture2D(map, vUv).rgb;
          float burn = clamp((-vY - 2.) / 9., 0., 1.);
          float m = nz(vUv * vec2(9., 4.) + vS * 30.) * .7 + (1. - vUv.x) * .3;
          float th = 1.05 - burn * 1.2;
          if (m > th) discard;
          c *= 1. - .85 * smoothstep(th - .14, th - .03, m);
          c += vec3(1., .4, .08) * smoothstep(th - .05, th, m) * 1.6 * step(.01, burn);
          c = mix(c, uFog, smoothstep(26., 70., vD));
          gl_FragColor = vec4(c * .92, uAmt); }`,
    });
    const im = new THREE.InstancedMesh(geo, mat, n);
    im.frustumCulled = false; im.renderOrder = 5;
    if (C.notes >= 0) stages[C.notes].g.add(im);
    return im;
  })();

  // ---------- cena V: feixes de luz ----------
  const rays = new THREE.Group();
  const rayMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { uTime: { value: 0 }, uA: { value: 1 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
    fragmentShader: `uniform float uTime, uA; varying vec2 vUv;
      void main(){ float e = smoothstep(0., .5, vUv.x) * smoothstep(1., .5, vUv.x);
        float l = smoothstep(1., .55, vUv.y) * smoothstep(0., .5, vUv.y);
        float f = .7 + .3 * sin(uTime * 1.3 + vUv.y * 6.);
        gl_FragColor = vec4(vec3(1., .88, .66) * e * e * l * f * .16 * uA, 1.); }`,
  });
  for (let i = 0; i < 6; i++) {
    const r = new THREE.Mesh(new THREE.PlaneGeometry(3 + i * .9, 46), rayMat);
    r.position.set(-12 + i * 3.6, 6, -6 + i * 1.2);
    r.rotation.z = -.42 + i * .03;
    r.userData.ph = i * 1.7;
    rays.add(r);
  }
  if (C.rays >= 0) stages[C.rays].g.add(rays);

  // ---------- final: os quadros soltos se juntam numa parede de museu ----------
  {
    const cols = 9, rows = 7, cw = 9.2, ch = 7.4;
    const cells = [];
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      if (c >= 3 && c <= 5 && r >= 2 && r <= 4) continue; // vão no meio: a última pintura
      const x = (c - (cols - 1) / 2) * cw + (Math.random() - .5) * 1.2;
      const y = (r - (rows - 1) / 2) * ch + (Math.random() - .5) * .9;
      cells.push({ x, y, d: Math.hypot(x / cw, y / ch) });
    }
    cells.sort((a, b) => a.d - b.d);
    const sz = stages[SCENES.length - 1].g.position.z;
    if (C.finale === 'release') fillers.forEach((m, i) => {
      // os quadros são soltos: sobem devagar como lanternas e somem na luz
      m.userData.wall = new THREE.Vector3(m.userData.home.x * 1.6, 26 + Math.random() * 30, m.userData.home.z);
      m.userData.wallScale = .7;
      m.userData.delay = Math.random() * .4;
    });
    else fillers.forEach((m, i) => {
      const cell = cells[i % cells.length];
      const hgt = m.geometry.parameters.height;
      m.userData.wall = new THREE.Vector3(cell.x, cell.y, sz - 10 - (i % 3) * .6);
      m.userData.wallScale = (ch * (.62 + (i % 4) * .06)) / hgt;
      m.userData.delay = Math.min(.45, cell.d * .09) + (i % 5) * .02;
    });
  }

  // ---------- pós: lente (aberração, distorção, calor) ----------
  const rt = new THREE.WebGLRenderTarget(2, 2, { samples: HIGH ? 4 : 0 });
  const post = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
    depthTest: false, depthWrite: false,
    uniforms: { tD: { value: rt.texture }, uCA: { value: 0 }, uWarp: { value: 0 }, uHaze: { value: 0 }, uTime: { value: 0 }, uFlash: { value: 0 }, uWind: { value: WIND ? 1 : 0 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }`,
    fragmentShader: `uniform sampler2D tD; uniform float uCA, uWarp, uHaze, uTime, uFlash, uWind; varying vec2 vUv;
      void main(){
        vec2 d = vUv - .5; float r2 = dot(d, d);
        vec2 uv = .5 + d * (1. - uWarp * r2 * .5);
        uv += uHaze * (1. - uWind) * .0045 * vec2(sin(uv.y * 70. + uTime * 7.), cos(uv.x * 55. + uTime * 6.));
        uv.x -= uHaze * uWind * .006 * sin(uv.y * 9. + uTime * 2.);
        vec2 o = d * uCA * (.35 + r2 * 3.);
        vec3 c = vec3(texture2D(tD, uv + o).r, texture2D(tD, uv).g, texture2D(tD, uv - o).b);
        float vg = smoothstep(.18, .75, r2);
        c = mix(c * (1. - vg * .55), mix(c, vec3(.9, .89, .86), vg * .55), uWind);
        c += mix(vec3(1., .5, .2), vec3(.9, .85, .8), uWind) * uHaze * .06 * (1. - r2 * 2.);
        c = mix(c, vec3(1., .94, .84), uFlash);
        gl_FragColor = vec4(c, 1.); }`,
  }));
  post.frustumCulled = false;
  const postScene = new THREE.Scene(); postScene.add(post);
  const postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  // ---------- câmera ----------
  const state = { u: 0, mx: 0, my: 0, vel: 0, intro: 1 };
  const cur = { u: 0, mx: 0, my: 0, vel: 0, intro: 1 };
  const light = new THREE.Vector2(.5, .5);
  const stats = { heat: 0, transit: 0, fin: 0, scene: 0 };
  // fogo com tempo próprio: cada pintura leva BURN_T segundos para queimar,
  // e a câmera só atravessa quando o fogo já abriu passagem
  const BURN_T = 5, LASTI = SCENES.length - 1;
  const burns = SCENES.map(() => 0);
  let eff = 0;
  let mobile = false, baseFov = 38;

  function resize() {
    const w = canvas.clientWidth || innerWidth, h = canvas.clientHeight || innerHeight;
    renderer.setSize(w, h, false);
    const pr = renderer.getPixelRatio();
    rt.setSize(Math.round(w * pr), Math.round(h * pr));
    camera.aspect = w / h;
    mobile = w / h < .85;
    baseFov = mobile ? 39 : 38;
    camera.fov = baseFov;
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
    cur.intro = state.intro;

    const target = cur.u;
    if (snap) {
      eff = target;
      burns.forEach((_, i) => { const f = target - i; burns[i] = f >= 1 ? 1 : f > .42 ? .42 + .58 * clamp((f - .42) / .58) : 0; });
    } else {
      burns.forEach((b, i) => {
        if (i >= LASTI) return;
        if (target > i + .42 && eff >= i + .4) burns[i] = Math.min(1, b + dt / BURN_T);
        else if (target < i + .42) burns[i] = Math.max(0, b - dt / 1.3);
      });
      let limit = Infinity;
      for (let i = 0; i < LASTI; i++) {
        const cap = i + .42 + .58 * clamp((burns[i] - .42) / .58);
        if (cap < i + 1 - 1e-4) { limit = cap; break; }
      }
      eff += (Math.min(target, limit) - eff) * k;
    }

    const c = camAt(eff);
    const back = mobile ? 2 : 0;
    // abertura: a câmera chega de longe, descendo
    const io = 1 - cur.intro, ie = io * io * (3 - 2 * io);
    // final: depois da última cena a câmera recua e a parede inteira aparece
    const fin = clamp((eff - (SCENES.length - 1) - .02) / .5), fe = ease(fin);
    camera.position.set(c.look * .25 * (1 - fe) + cur.mx * 1.2, cur.my * .7 + ie * 4, c.z + back + ie * 46 + fe * (mobile ? 70 : 44));
    tmp.set(c.look + cur.mx * .4, cur.my * .3, c.z - 40);
    camera.lookAt(tmp);
    camera.rotateZ(ie * .06 + Math.sin(c.t * Math.PI) * .025 * (c.i % 2 ? -1 : 1));
    // no meio da travessia a lente abre um pouco: sensação de velocidade
    camera.fov = baseFov + Math.sin(c.t * Math.PI) * 5 + ie * 6;
    camera.updateProjectionMatrix();
    light.set(.5 + cur.mx * .45, .5 + cur.my * .45);

    const bend = clamp(cur.vel * .035, -2.2, 2.2);
    const shift = Math.min(.012, Math.abs(cur.vel) * .00025);

    // cenas: atravessar a pintura = ela se desfaz ao chegar perto
    let hot = 0, hotZ = 0, hotX = 0, hotW = 30;
    stages.forEach((st, i) => {
      // no recuo final, as cenas anteriores saem do caminho da câmera
      st.g.visible = !(fin > 0 && i < SCENES.length - 1);
      if (!st.g.visible) return;
      const zg = st.g.position.z;
      const dBg = camera.position.z - (zg - BG_BACK);
      st.bg.material.uniforms.uOpacity.value = clamp((dBg - 1) / 4);
      const bb = i < LASTI ? burns[i] : 0;
      st.bg.material.uniforms.uBurn.value = bb;
      const heat = bb * (1 - bb) * 4;
      if (heat > hot) { hot = heat; hotZ = zg - BG_BACK + .3; hotX = st.bg.position.x; hotW = st.bg.geometry.parameters.width * .5; sparks.material.uniforms.uBurn.value = bb; }
      st.bg.material.uniforms.uLight.value = light;
      st.bg.visible = dBg > 1 && dBg < 170;
      st.bg.material.uniforms.uBend.value = bend * 1.6;
      st.bg.material.uniforms.uShift.value = shift;
      st.cuts.forEach((m, j) => {
        const h = m.userData.home;
        const ph = m.userData.phase;
        const dz = camera.position.z - (zg + h.z);
        // chegada: as figuras deslizam de fora para dentro da cena enquanto a câmera se aproxima
        const a = clamp(1 - (dz - 24) / 42), ae = 1 - Math.pow(1 - a, 3);
        const sd = Math.sign(h.x) || 1;
        m.position.set(h.x + sd * (1 - ae) * 9 + Math.sin(time * .35 + ph) * .25, h.y - (1 - ae) * 3 + Math.sin(time * .5 + ph) * .35, h.z);
        m.rotation.set(-cur.my * .07, -sd * (1 - ae) * .7 + cur.mx * .16, Math.sin(time * .3 + ph) * .015);
        m.material.uniforms.uOpacity.value = clamp((dz - 1.5) / 3) * clamp(a * 1.6);
        m.material.uniforms.uBurn.value = Math.max(1 - clamp((dz - 3) / 13), i < LASTI ? clamp((burns[i] - .3) / .55) : 0);
        m.material.uniforms.uLight.value = light;
        m.visible = dz > 1.5 && dz < 160;
        m.material.uniforms.uBend.value = bend;
        m.material.uniforms.uShift.value = shift;
      });
    });
    fillers.forEach(m => {
      const h = m.userData.home, wl = m.userData.wall;
      const wf = ease(clamp((fin - m.userData.delay) / .5));
      const fy = h.y + Math.sin(time * .4 + m.userData.phase) * .4 * (1 - wf);
      m.position.set(h.x + (wl.x - h.x) * wf, fy + (wl.y - fy) * wf, h.z + (wl.z - h.z) * wf);
      m.rotation.y = m.userData.ry * (C.finale === 'release' ? 1 + wf : 1 - wf);
      m.rotation.z = m.userData.rz * (1 - wf) + (C.finale === 'release' ? Math.sin(m.userData.phase) * wf * .5 : 0);
      m.scale.setScalar(1 + (m.userData.wallScale - 1) * wf);
      m.material.uniforms.uNear.value = 30 + fe * 55;
      m.material.uniforms.uFar.value = 105 + fe * 90;
      m.material.uniforms.uDim.value = .82 + wf * .12;
      const dz = camera.position.z - m.position.z;
      m.visible = dz > -2 && dz < 120;
      m.material.uniforms.uOpacity.value = clamp(dz / 6) * (C.finale === 'release' ? 1 - wf * .85 : 1);
      m.material.uniforms.uLight.value = light;
    });
    // no fim do desapego o escuro vira manhã
    if (C.dawn != null) { FOG.copy(FOG0).lerp(DAWN, fe); renderer.setClearColor(FOG, 1); }

    sparks.position.set(hotX, 0, hotZ);
    sparks.material.uniforms.uAmt.value = Math.min(.6, hot * .8);
    sparks.material.uniforms.uW.value = hotW;
    sparks.material.uniforms.uTime.value = time;
    sparks.visible = hot > .01;
    notes.material.uniforms.uTime.value = time;
    rays.children.forEach(r => { r.rotation.z = -.42 + Math.sin(time * .25 + r.userData.ph) * .05; });
    rayMat.uniforms.uTime.value = time;
    gold.material.uniforms.uTime.value = time;
    embers.material.uniforms.uTime.value = time;
    glow.material.uniforms.uA.value = .8 + Math.sin(time * .8) * .2;

    const pu = post.material.uniforms;
    const tr = Math.sin(c.t * Math.PI);
    pu.uCA.value = Math.min(.03, Math.abs(cur.vel) * .0006) + tr * .014 + ie * .011;
    pu.uWarp.value = tr * .9 + ie * .6 + fe * (1 - fe) * 1.2;
    pu.uHaze.value = hot;
    pu.uTime.value = time;
    pu.uFlash.value = Math.max(0, hot - .85) * .8;
    stats.heat = hot; stats.transit = tr; stats.fin = fe; stats.scene = c.t > .5 ? c.i + 1 : c.i;
    renderer.setRenderTarget(rt);
    renderer.render(scene, camera);
    renderer.setRenderTarget(null);
    renderer.render(postScene, postCam);
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
    get progress() { return eff; },
    stats,
    scenes: SCENES.length,
    set(o) { Object.assign(state, o); },
    pointer(x, y) { state.mx = x; state.my = y; },
    kick(v) { state.vel = v; },
    settle() { state.vel = 0; cur.vel = 0; frame(0, true); frame(0, true); },
    start, stop, resize,
  };
}
