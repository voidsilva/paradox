/*
  Pó de pintura — a cena do Montaigne.
  Cada pintura é feita de dezenas de milhares de grãos de pigmento, cada um com a cor de um ponto do quadro.
  Parada, ela se lê como uma impressão fina. Quando o capítulo acaba, o vento sopra da esquerda e solta
  os grãos: eles voam numa corrente, trocam de cor no ar e pousam formando a próxima pintura.
  Quanto mais segura, mais escapa: o cursor também desprende alguns grãos por onde passa.

  Tudo é função da rolagem (u), do tempo e do cursor: não existe estado que possa travar.

  API: set({ u, intro })  settle()  pointer(x, y)  kick(dy)  start()  pause()  progress  stats
*/
import * as THREE from 'three';

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const mix = (a, b, t) => a + (b - a) * t;
const easeIO = x => (x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const easeOut = x => 1 - Math.pow(1 - x, 3);

const PW = 2, PH = 1.25;   // o quadro, em unidades do mundo (16:10)

const VS = /* glsl */`
uniform sampler2D uA, uB;
uniform float uM, uTime, uIntro, uFin, uPx, uKick, uTex;
uniform vec3 uPtr;          // cursor no plano do quadro (x, y) e força (z)
attribute vec2 aG;          // posição na grade 0..1
attribute vec4 aR;          // aleatórios
varying vec3 vC; varying float vA;

vec3 hash3(vec3 p){ p = fract(p * vec3(.1031, .1030, .0973)); p += dot(p, p.yxz + 33.33); return fract((p.xxy + p.yxx) * p.zyx) * 2. - 1.; }
float noise(vec3 p){
  vec3 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
  return mix(mix(mix(dot(hash3(i), f), dot(hash3(i + vec3(1,0,0)), f - vec3(1,0,0)), f.x),
                 mix(dot(hash3(i + vec3(0,1,0)), f - vec3(0,1,0)), dot(hash3(i + vec3(1,1,0)), f - vec3(1,1,0)), f.x), f.y),
             mix(mix(dot(hash3(i + vec3(0,0,1)), f - vec3(0,0,1)), dot(hash3(i + vec3(1,0,1)), f - vec3(1,0,1)), f.x),
                 mix(dot(hash3(i + vec3(0,1,1)), f - vec3(0,1,1)), dot(hash3(i + vec3(1,1,1)), f - vec3(1,1,1)), f.x), f.y), f.z);
}
// corrente de vento sem divergência (curl de um campo de ruído)
vec3 curl(vec3 p){
  const float e = .1;
  float n1 = noise(p + vec3(0, e, 0)), n2 = noise(p - vec3(0, e, 0));
  float n3 = noise(p + vec3(0, 0, e)), n4 = noise(p - vec3(0, 0, e));
  float n5 = noise(p + vec3(e, 0, 0)), n6 = noise(p - vec3(e, 0, 0));
  float m1 = noise(p + vec3(0, 0, e) + 31.), m2 = noise(p - vec3(0, 0, e) + 31.);
  float m3 = noise(p + vec3(0, e, 0) + 31.), m4 = noise(p - vec3(0, e, 0) + 31.);
  return vec3((n1 - n2) - (n3 - n4), (m1 - m2) - (n5 - n6), (n5 - n6) - (m3 - m4)) / (2. * e);
}
float lum(vec3 c){ return dot(c, vec3(.299, .587, .114)); }

void main(){
  vec2 uv = aG;
  vec3 ca = texture2D(uA, uv).rgb, cb = texture2D(uB, uv).rgb;
  vec3 home = vec3((uv.x - .5) * ${PW.toFixed(2)}, (uv.y - .5) * ${PH.toFixed(2)}, 0.);

  // a frente do vento varre da esquerda para a direita, com franja irregular
  float front = uv.x * .55 + aR.x * .3 + noise(vec3(uv * 3., 1.7)) * .15;
  float m = clamp((uM * 1.55 - front) / .55, 0., 1.);
  float s = sin(m * 3.14159);                 // 0 pousado, 1 no meio do voo
  s = s * s * (3. - 2. * s);

  // entrada e final: os grãos chegam / vão embora no mesmo vento
  float ii = clamp((uIntro * 1.6 - (1. - uv.x) * .45 - aR.y * .25) / .9, 0., 1.);
  float into = 1. - ii * ii * (3. - 2. * ii);
  float ff = clamp((uFin * 1.6 - uv.x * .4 - aR.z * .3) / .9, 0., 1.);
  float gone = ff * ff * (3. - 2. * ff);
  float fly = max(s, max(into, gone));

  vec3 q = home * 1.3 + vec3(0., 0., aR.w * 2.);
  vec3 c1 = curl(q + vec3(uTime * .06, 0., uTime * .03));
  vec3 p = home;
  // a corrente: leva para a direita e para cima, com redemoinhos
  p += (vec3(1.5 + aR.y * 1.2, .35 + aR.z * .5, (aR.w - .5) * 1.4) + c1 * .55) * s;
  p += (vec3(-2.2 - aR.y * 1.5, .5 * aR.z - .2, (aR.w - .5) * 2.) + c1 * .7) * into;
  p += (vec3(2.6 + aR.y * 2.5, 1.1 + aR.z * 1.4, (aR.w - .5) * 3.) + c1 * .9) * gone;
  // relevo: o claro sai um pouco do papel, como tinta grossa
  vec3 col = mix(ca, cb, smoothstep(.35, .65, m));
  p.z += (lum(col) - .5) * .05 * (1. - fly);
  // respiração leve em repouso + vento da rolagem
  p += curl(q * 2.3 + uTime * .15) * (.0025 + uKick * .03) * (1. - fly);

  // o cursor desprende grãos por onde passa
  vec2 d = p.xy - uPtr.xy;
  float pr = exp(-dot(d, d) / .03) * uPtr.z * (1. - fly);
  p += vec3(normalize(d + 1e-4) * .08 + vec2(.06, .05), .12) * pr * (.4 + aR.x);

  vec4 mv = modelViewMatrix * vec4(p, 1.);
  gl_Position = projectionMatrix * mv;
  float sz = uPx * (1. + fly * (.25 + aR.y * .75) + pr * .8);
  gl_PointSize = sz * (3.2 / -mv.z);
  vC = col;
  vA = (1. - gone) * (1. - into * .6) * (1. - fly * .15);
}`;

const FS = /* glsl */`
varying vec3 vC; varying float vA;
void main(){
  vec2 q = gl_PointCoord - .5;
  float r = dot(q, q);
  if (r > .25) discard;
  gl_FragColor = vec4(vC, vA * smoothstep(.25, .17, r));
  #include <colorspace_fragment>
}`;

const BG_FS = /* glsl */`
uniform float uTime, uFin; uniform vec2 uRes, uC; varying vec2 vUv;
float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
void main(){
  vec2 p = vUv;
  vec3 a = vec3(.902, .886, .851), b = vec3(.835, .812, .765);
  vec2 q = (p - uC) * vec2(uRes.x / uRes.y, 1.);
  float g = exp(-dot(q, q) * 1.4);
  vec3 col = mix(b, a, g);
  col += (h(floor(p * uRes)) - .5) * .018;
  col = mix(col, vec3(.937, .922, .886), uFin);
  gl_FragColor = vec4(col, 1.);
  #include <colorspace_fragment>
}`;

function loadImg(src) {
  return new Promise((res, rej) => { const i = new Image(); i.decoding = 'async'; i.onload = () => res(i); i.onerror = rej; i.src = src; });
}

export async function createDust({ canvas, tier = 'high', still = false, scenes, dir = 'montaigne/img/', asset = u => u, onProgress = () => {} }) {
  const low = tier === 'low';
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance' });
  const DPR = Math.min(devicePixelRatio || 1, low ? 1.5 : 2);
  renderer.setPixelRatio(DPR);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, .05, 50);
  const N = scenes.length, LAST = N - 1;

  // pinturas recortadas em 16:10, já com um leve tom de impressão
  const TW = 512, TH = 320;
  let done = 0;
  const texs = await Promise.all(scenes.map(async s => {
    const img = await loadImg(asset(dir + 'paint/' + s.bg + '.jpg'));
    const c = document.createElement('canvas'); c.width = TW; c.height = TH;
    const g = c.getContext('2d');
    const r = Math.max(TW / img.width, TH / img.height), sw = TW / r, sh = TH / r;
    g.drawImage(img, (img.width - sw) / 2, (img.height - sh) * .42, sw, sh, 0, 0, TW, TH);
    g.globalCompositeOperation = 'soft-light'; g.fillStyle = 'rgba(240,226,200,.35)'; g.fillRect(0, 0, TW, TH);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.flipY = true;
    onProgress(++done / (N + 1));
    return t;
  }));

  // fundo: papel com uma luz suave atrás do quadro
  const bgU = { uTime: { value: 0 }, uFin: { value: 0 }, uRes: { value: new THREE.Vector2(1, 1) }, uC: { value: new THREE.Vector2(.5, .5) } };
  const bg = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
    uniforms: bgU, depthTest: false, depthWrite: false,
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 1., 1.); }`, fragmentShader: BG_FS,
  }));
  bg.frustumCulled = false; bg.renderOrder = -1; scene.add(bg);

  // a grade de grãos
  const COLS = low ? 230 : 380, ROWS = Math.round(COLS * PH / PW);
  const NP = COLS * ROWS;
  const aG = new Float32Array(NP * 2), aR = new Float32Array(NP * 4), pos = new Float32Array(NP * 3);
  for (let y = 0, k = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++, k++) {
    aG[k * 2] = (x + .5 + (Math.random() - .5) * .5) / COLS; aG[k * 2 + 1] = (y + .5 + (Math.random() - .5) * .5) / ROWS;
    aR.set([Math.random(), Math.random(), Math.random(), Math.random()], k * 4);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aG', new THREE.BufferAttribute(aG, 2));
  geo.setAttribute('aR', new THREE.BufferAttribute(aR, 4));
  const U = {
    uA: { value: texs[0] }, uB: { value: texs[0] }, uM: { value: 0 }, uTime: { value: 0 }, uIntro: { value: still ? 1 : 0 }, uFin: { value: 0 },
    uPx: { value: 1 }, uKick: { value: 0 }, uTex: { value: 0 }, uPtr: { value: new THREE.Vector3(0, 0, 0) },
  };
  const pts = new THREE.Points(geo, new THREE.ShaderMaterial({ uniforms: U, vertexShader: VS, fragmentShader: FS, transparent: true, depthWrite: false, depthTest: false }));
  pts.frustumCulled = false;
  const art = new THREE.Group(); art.add(pts); scene.add(art);

  // ---------- enquadramento ----------
  // sx/sy deslocam o quadro na tela (fração da largura/altura); size = fração da largura que o quadro ocupa
  const SIDE = {
    hero: { sx: .22, sy: .1, size: .43 },
    l: { sx: .26, sy: 0, size: .42 },
    r: { sx: -.26, sy: 0, size: .42 },
    c: { sx: 0, sy: -.2, size: .4 },
  };
  const MOB = { sx: 0, sy: .19, size: .92 };
  const kinds = scenes.map(s => s.side || 'c');
  let W_ = 1, H_ = 1, asp = 1;
  const key = i => (asp < .9 ? MOB : SIDE[kinds[clamp(i, 0, LAST)]] || SIDE.c);
  function resize() {
    W_ = canvas.clientWidth || innerWidth; H_ = canvas.clientHeight || innerHeight;
    asp = W_ / H_;
    camera.aspect = asp; camera.updateProjectionMatrix();
    renderer.setSize(W_, H_, false);
    bgU.uRes.value.set(W_, H_);
  }
  resize();
  addEventListener('resize', resize);

  const st = { u: 0, prog: 0, intro: still ? 1 : 0, kick: 0, t: 0, fin: 0, transit: 0 };
  const pointer = { x: 0, y: 0, sx: 0, sy: 0, on: 0, last: 0 };
  const ray = new THREE.Raycaster(), plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), hit = new THREE.Vector3();
  const inv = new THREE.Matrix4();

  function layout(dt) {
    const k = still ? 1 : 1 - Math.pow(.015, dt);
    st.prog += (st.u - st.prog) * k;
    const sm = still ? 1 : 1 - Math.pow(.04, dt);
    pointer.sx += (pointer.x - pointer.sx) * sm; pointer.sy += (pointer.y - pointer.sy) * sm;
    st.kick *= Math.pow(.25, dt);
    const u = st.prog;
    st.fin = clamp((u - (LAST + .18)) / .42);

    // qual par de pinturas e quanto do vento já passou
    const i0 = Math.floor(clamp(u, 0, LAST)), i1 = Math.min(LAST, i0 + 1);
    const m = i0 === LAST ? 0 : clamp((u - i0 - .3) / .7);
    U.uA.value = texs[i0]; U.uB.value = texs[i1]; U.uM.value = m;
    U.uIntro.value = easeOut(clamp(st.intro)); U.uFin.value = st.fin; U.uKick.value = clamp(st.kick);
    st.transit = Math.sin(clamp(m * 1.2) * Math.PI);

    // câmera: o quadro anda de um lado da tela para o outro enquanto o pó voa
    const fr = easeIO(clamp((u - i0 - .3) / .7));
    const a = key(i0), b = key(i1);
    const sx = mix(a.sx, b.sx, fr), sy = mix(a.sy, b.sy, fr), size = mix(a.size, b.size, fr);
    const tanV = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)), tanH = tanV * asp;
    let dist = (PW / 2) / (tanH * size);
    // nunca mais alto que uma fração da tela (telas largas e baixas)
    dist = Math.max(dist, (PH / 2) / (tanV * (asp < .9 ? .4 : .5)));
    camera.position.set(0, 0, dist);
    camera.lookAt(0, 0, 0);
    camera.setViewOffset(W_, H_, -sx * W_, sy * H_, W_, H_);
    // o quadro inclina devagar com a mão
    art.rotation.set(-pointer.sy * .07, pointer.sx * .1, 0);
    // tamanho do grão: cobre o espaço da grade na tela
    const pxPerUnit = H_ / (2 * tanV * dist);
    U.uPx.value = Math.max(1.4, (PW / COLS) * pxPerUnit * 2.1) * DPR * (dist / 3.2);
    bgU.uC.value.set(.5 + sx, .5 + sy); bgU.uFin.value = st.fin;

    // cursor sobre o quadro
    pointer.on *= Math.pow(.2, dt);
    if (!still) {
      ray.setFromCamera({ x: pointer.x, y: pointer.y }, camera);
      inv.copy(art.matrixWorld).invert();
      if (ray.ray.intersectPlane(plane, hit)) { hit.applyMatrix4(inv); U.uPtr.value.set(hit.x, hit.y, clamp(pointer.on)); }
    } else U.uPtr.value.z = 0;
  }

  let raf = 0, last = performance.now(), running = false, visible = true;
  const io = new IntersectionObserver(es => { visible = es[0].isIntersecting; });
  io.observe(canvas);
  function frame(now) {
    raf = requestAnimationFrame(frame);
    if (!visible || document.hidden) { last = now; return; }
    const dt = Math.min(.05, (now - last) / 1000); last = now;
    st.t += dt; U.uTime.value = st.t; bgU.uTime.value = st.t;
    layout(dt);
    renderer.render(scene, camera);
  }
  onProgress(1);
  layout(1);
  await renderer.compileAsync(scene, camera);
  renderer.render(scene, camera);

  return {
    start() { if (running) return; running = true; last = performance.now(); raf = requestAnimationFrame(frame); },
    pause() { cancelAnimationFrame(raf); running = false; },
    set(o) {
      if ('u' in o) st.u = o.u;
      if ('intro' in o) st.intro = o.intro;
      if (still) { st.prog = st.u; U.uIntro.value = easeOut(clamp(st.intro)); layout(1); renderer.render(scene, camera); }
    },
    settle() { st.prog = st.u; layout(1); renderer.render(scene, camera); },
    pointer(x, y) {
      const dx = x - pointer.x, dy = y - pointer.y;
      pointer.on = clamp(pointer.on + Math.hypot(dx, dy) * 6);
      pointer.x = x; pointer.y = y;
    },
    kick(dy) { st.kick = clamp(st.kick + Math.abs(dy) * .0012, 0, .8); },
    get progress() { return st.prog; },
    get stats() { return { heat: 0, transit: st.transit, fin: st.fin, scene: Math.min(LAST, Math.round(st.prog)) }; },
    destroy() { cancelAnimationFrame(raf); io.disconnect(); renderer.dispose(); },
  };
}
