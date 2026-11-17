// Atração principal: o retrato que quebra.
// Um quadro de Míchkin trinca como vidro a partir do rosto. Os cacos voam girando
// e, ao virar, o verso de cada um mostra outro rosto: Rogójin. Na segunda quebra,
// os mesmos cacos se juntam em Nastássia. No fim eles voam contra a câmera.
// Tudo é uma malha só (um draw call); cada caco anima no vertex shader.
import * as THREE from 'three';

const W = 10.4, H = 13;          // quadro em pé, 4:5
const IMPACT = [0, 2.2];         // trinca começa no rosto

// recorta um polígono pelo retângulo do quadro (Sutherland–Hodgman)
function clipRect(poly) {
  const edges = [
    [p => p[0] >= -W / 2, (a, b) => { const t = (-W / 2 - a[0]) / (b[0] - a[0]); return [-W / 2, a[1] + (b[1] - a[1]) * t]; }],
    [p => p[0] <= W / 2, (a, b) => { const t = (W / 2 - a[0]) / (b[0] - a[0]); return [W / 2, a[1] + (b[1] - a[1]) * t]; }],
    [p => p[1] >= -H / 2, (a, b) => { const t = (-H / 2 - a[1]) / (b[1] - a[1]); return [a[0] + (b[0] - a[0]) * t, -H / 2]; }],
    [p => p[1] <= H / 2, (a, b) => { const t = (H / 2 - a[1]) / (b[1] - a[1]); return [a[0] + (b[0] - a[0]) * t, H / 2]; }],
  ];
  let out = poly;
  for (const [inside, cut] of edges) {
    const src = out; out = [];
    for (let i = 0; i < src.length; i++) {
      const a = src[i], b = src[(i + 1) % src.length];
      const ia = inside(a), ib = inside(b);
      if (ia) out.push(a);
      if (ia !== ib) out.push(cut(a, b));
    }
    if (!out.length) break;
  }
  return out;
}

function area(poly) { let s = 0; for (let i = 0; i < poly.length; i++) { const a = poly[i], b = poly[(i + 1) % poly.length]; s += a[0] * b[1] - b[0] * a[1]; } return s / 2; }

// teia de vidro: raios irregulares a partir do impacto + anéis tortos
function fracture(nAng) {
  const angs = [];
  for (let i = 0; i < nAng; i++) angs.push((i + .5 + (Math.random() - .5) * .7) / nAng * Math.PI * 2);
  const radii = [.55, 1.25, 2.2, 3.4, 5, 7.2, 10.5, 15];
  // raio de cada anel varia por raio de corte, para os cacos não ficarem iguais
  const R = radii.map(r => angs.map(() => r * (.82 + Math.random() * .36)));
  const shards = [];
  const pt = (ri, ai, a) => { const r = ri < 0 ? 0 : R[ri][ai % nAng]; return [IMPACT[0] + Math.cos(a) * r, IMPACT[1] + Math.sin(a) * r]; };
  for (let ri = -1; ri < radii.length - 1; ri++) {
    for (let ai = 0; ai < nAng; ai++) {
      const a0 = angs[ai], a1 = ai + 1 < nAng ? angs[ai + 1] : angs[0] + Math.PI * 2;
      const am = (a0 + a1) / 2;
      let poly;
      if (ri < 0) poly = [[IMPACT[0], IMPACT[1]], pt(0, ai, a0), pt(0, ai + 1, a1)];
      else {
        const rm0 = (R[ri][ai % nAng] + R[ri][(ai + 1) % nAng]) / 2, rm1 = (R[ri + 1][ai % nAng] + R[ri + 1][(ai + 1) % nAng]) / 2;
        poly = [pt(ri, ai, a0), [IMPACT[0] + Math.cos(am) * rm0, IMPACT[1] + Math.sin(am) * rm0], pt(ri, ai + 1, a1),
          pt(ri + 1, ai + 1, a1), [IMPACT[0] + Math.cos(am) * rm1, IMPACT[1] + Math.sin(am) * rm1], pt(ri + 1, ai, a0)];
      }
      // às vezes um caco grande se parte em dois
      const parts = ri > 1 && Math.random() < .45 ? [poly.slice(0, 3).concat([poly[5]]), poly.slice(2, 6)] : [poly];
      for (const pp of parts) {
        const c = clipRect(pp);
        if (c.length >= 3 && Math.abs(area(c)) > .015) shards.push({ poly: area(c) < 0 ? c.reverse() : c, ring: ri + 1 });
      }
    }
  }
  return shards;
}

function buildGeometry(shards) {
  const pos = [], nor = [], uv = [], cen = [], rnd = [], side = [];
  const T = .09;
  const U = (x, y) => [x / W + .5, y / H + .5];
  shards.forEach(s => {
    const p = s.poly;
    let cx = 0, cy = 0; p.forEach(q => { cx += q[0]; cy += q[1]; }); cx /= p.length; cy /= p.length;
    const d = Math.hypot(cx - IMPACT[0], cy - IMPACT[1]);
    const r = [Math.min(1, d / 9) * .7 + Math.random() * .3, Math.random(), Math.random(), Math.random()];
    const push = (x, y, z, n, sd, uvx) => {
      pos.push(x, y, z); nor.push(...n); cen.push(cx, cy, 0); rnd.push(...r); side.push(sd);
      const u = U(x, y);
      uv.push(u[0], u[1]);
    };
    for (let i = 1; i < p.length - 1; i++) {
      const tri = [p[0], p[i], p[i + 1]];
      tri.forEach(q => push(q[0], q[1], T, [0, 0, 1], 0));
      [tri[0], tri[2], tri[1]].forEach(q => push(q[0], q[1], -T, [0, 0, -1], 1));
    }
    for (let i = 0; i < p.length; i++) {
      const a = p[i], b = p[(i + 1) % p.length];
      const nx = b[1] - a[1], ny = -(b[0] - a[0]), l = Math.hypot(nx, ny) || 1;
      const n = [nx / l, ny / l, 0];
      [[a, T], [b, T], [b, -T], [a, T], [b, -T], [a, -T]].forEach(([q, z]) => push(q[0], q[1], z, n, 2));
    }
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('aCen', new THREE.Float32BufferAttribute(cen, 3));
  g.setAttribute('aR', new THREE.Float32BufferAttribute(rnd, 4));
  g.setAttribute('aSide', new THREE.Float32BufferAttribute(side, 1));
  return g;
}

const vert = /* glsl */`
  attribute vec3 aCen; attribute vec4 aR; attribute float aSide;
  uniform float uS1, uS2, uS3, uCrack, uTime;
  varying vec2 vUv; varying vec3 vN, vV; varying float vSide, vHot, vFade, vIdx;
  mat3 rx(float a){ float c = cos(a), s = sin(a); return mat3(1.,0.,0., 0.,c,s, 0.,-s,c); }
  mat3 ry(float a){ float c = cos(a), s = sin(a); return mat3(c,0.,-s, 0.,1.,0., s,0.,c); }
  mat3 rz(float a){ float c = cos(a), s = sin(a); return mat3(c,s,0., -s,c,0., 0.,0.,1.); }
  float lt(float s){ float t = clamp((s - aR.x * .38) / .62, 0., 1.); return t; }
  float ez(float t){ return t < .5 ? 4.*t*t*t : 1. - pow(-2.*t + 2., 3.) / 2.; }
  void main(){
    vUv = uv; vSide = aSide;
    float t1 = lt(uS1), t2 = lt(uS2), t3 = clamp((uS3 - aR.x * .3) / .7, 0., 1.);
    float f1 = sin(t1 * 3.14159), f2 = sin(t2 * 3.14159), e3 = t3 * t3;
    float fly = f1 + f2;
    vec3 local = position - aCen;
    // trinca: os cacos encolhem um fio e a luz aparece entre eles
    local.xy *= 1. - uCrack * .045 - fly * .05;
    vec2 dir = normalize(aCen.xy - vec2(${IMPACT[0].toFixed(2)}, ${IMPACT[1].toFixed(2)}) + 1e-3);
    // cada voo é uma volta inteira: o caco some de lado, o verso de tela crua passa,
    // e quando a frente volta já é outro rosto (troca feita enquanto ela está de costas)
    float turn = 6.28318 * (ez(t1) + ez(t2));
    vIdx = floor((turn + 3.14159) / 6.28318);
    float rotY = turn + e3 * (aR.w - .5) * 9.;
    mat3 R = ry(rotY) * rx(fly * (aR.y - .5) * 2.6 + e3 * (aR.z - .5) * 7.) * rz(fly * (aR.z - .5) * 1.8);
    vec3 off = vec3(dir * (1.6 + aR.y * 5.5), 1.5 + aR.z * 11.) * fly;
    off.y += fly * fly * (aR.w - .3) * 1.5;
    off += vec3(dir * (5. + aR.y * 14.), 20. + aR.z * 40.) * e3;
    // respiração mínima dos cacos soltos
    off += vec3(sin(uTime * .8 + aR.y * 30.), cos(uTime * .7 + aR.z * 20.), 0.) * .08 * fly;
    vec3 p = aCen + off + R * local;
    vN = normalize(R * normal);
    vec4 mv = modelViewMatrix * vec4(p, 1.);
    vV = normalize(-mv.xyz);
    vN = normalize(normalMatrix * vN);
    vHot = fly;
    vFade = 1. - smoothstep(.55, 1., t3);
    gl_Position = projectionMatrix * mv;
  }`;

const frag = /* glsl */`
  uniform sampler2D tA, tB, tC; uniform float uFront, uCrack; uniform vec4 uCropA, uCropB, uCropC;
  uniform vec3 uGold;
  varying vec2 vUv; varying vec3 vN, vV; varying float vSide, vHot, vFade, vIdx;
  vec3 tex(sampler2D t, vec4 c, vec2 uv){ return texture2D(t, c.xy + uv * c.zw).rgb; }
  void main(){
    vec3 L = normalize(vec3(-.45, .55, .7));
    vec3 n = normalize(vN);
    if (!gl_FrontFacing) n = -n;
    vec3 col;
    if (vSide < .5) col = vIdx < .5 ? tex(tA, uCropA, vUv) : vIdx < 1.5 ? tex(tB, uCropB, vUv) : tex(tC, uCropC, vUv);
    else if (vSide < 1.5) {
      // verso da pintura: tela crua de linho
      vec2 w = vUv * vec2(260., 330.);
      float weave = .5 + .25 * sin(w.x * 3.14159) * sin(w.y * 3.14159) + .1 * sin(w.x * .7 + w.y * .3);
      col = vec3(.42, .33, .22) * (.75 + weave * .4);
    }
    else col = uGold * (1.1 + uCrack * .8);
    float dif = .62 + .38 * max(dot(n, L), 0.);
    float spec = pow(max(dot(reflect(-L, n), normalize(vV)), 0.), 36.);
    col = col * dif + vec3(1., .9, .72) * spec * (.25 + vHot * .5);
    // verniz: leve brilho quente nos cacos que estão girando
    col += vec3(1., .55, .2) * vHot * .05;
    gl_FragColor = vec4(col, vFade);
  }`;

function loadTex(url) {
  return new Promise(res => new THREE.TextureLoader().load(url, t => { t.colorSpace = THREE.NoColorSpace; t.anisotropy = 8; res(t); }, undefined, () => res(null)));
}

export async function createCore({ canvas, tier = 'high', still = false, asset = u => u }) {
  const HIGH = tier === 'high';
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: still, powerPreference: 'high-performance' });
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  renderer.setPixelRatio(HIGH ? Math.min(devicePixelRatio || 1, 2) : Math.min(devicePixelRatio || 1, 1.5));
  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, .1, 300);

  const [tA, tB, tC] = await Promise.all(['p01-retrato', 'p16-olhar', 'p05-nastassia'].map(k => loadTex(asset('img/paint/' + k + '.jpg'))));
  // recorte "cover" 4:5 de cada pintura, centrado no rosto: [x0, y0, largura, altura] em uv
  const crop = (t, cx) => { const a = t.image.width / t.image.height, w = (W / H) / a; return new THREE.Vector4(Math.min(1 - w, Math.max(0, cx - w / 2)), 0, w, 1); };

  const geo = buildGeometry(fracture(HIGH ? 20 : 14));
  const mat = new THREE.ShaderMaterial({
    vertexShader: vert, fragmentShader: frag, transparent: true, side: THREE.DoubleSide,
    uniforms: {
      tA: { value: tA }, tB: { value: tB }, tC: { value: tC },
      uCropA: { value: crop(tA, .5) }, uCropB: { value: crop(tB, .6) }, uCropC: { value: crop(tC, .5) },
      uS1: { value: 0 }, uS2: { value: 0 }, uS3: { value: 0 }, uCrack: { value: 0 }, uFront: { value: 0 }, uTime: { value: 0 },
      uGold: { value: new THREE.Color(0xd9ad62) },
    },
  });
  const pane = new THREE.Mesh(geo, mat);
  if (still) window.__coreMat = mat;
  pane.frustumCulled = false;
  const group = new THREE.Group();
  group.add(pane);
  scene.add(group);

  // luz atrás do vidro: aparece pelas trincas
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(W * 1.6, H * 1.6), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    // soma só a cor: não escurece o fundo da página (o canvas é transparente)
    blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor,
    uniforms: { uA: { value: 0 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
    fragmentShader: `uniform float uA; varying vec2 vUv; void main(){ vec2 q = (vUv - vec2(.5, .62)) * vec2(1., 1.25); float r = length(q);
      gl_FragColor = vec4(vec3(1., .78, .45) * (exp(-r * r * 9.) * .6 + exp(-r * r * 60.) * .45) * uA, 1.); }`,
  }));
  glow.position.z = -.6;
  group.add(glow);

  const state = { p: 0, mx: 0, my: 0 }, cur = { p: 0, mx: 0, my: 0 };
  let mobile = false;
  function resize() {
    const w = canvas.clientWidth || innerWidth, h = canvas.clientHeight || innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    mobile = w / h < .85;
    camera.updateProjectionMatrix();
  }
  resize();

  const cl = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  // linha do tempo da seção (0..1)
  const TL = { crack1: [.07, .13], fly1: [.12, .42], crack2: [.5, .55], fly2: [.54, .84], out: [.9, 1] };
  const seg = ([a, b], p) => cl((p - a) / (b - a));
  let time = 0;
  function frame(dt, snap = false) {
    time += dt;
    const k = snap ? 1 : 1 - Math.pow(.003, dt);
    cur.p += (state.p - cur.p) * k;
    cur.mx += (state.mx - cur.mx) * (snap ? 1 : k * .5);
    cur.my += (state.my - cur.my) * (snap ? 1 : k * .5);
    const p = cur.p, u = mat.uniforms;
    u.uS1.value = seg(TL.fly1, p);
    u.uS2.value = seg(TL.fly2, p);
    u.uS3.value = seg(TL.out, p);
    u.uFront.value = u.uS2.value > 0 ? 1 : 0;
    const c1 = seg(TL.crack1, p) * (1 - seg(TL.fly1, p)), c2 = seg(TL.crack2, p) * (1 - seg(TL.fly2, p));
    u.uCrack.value = Math.max(c1, c2);
    u.uTime.value = time;
    const fly = Math.sin(u.uS1.value * Math.PI) + Math.sin(u.uS2.value * Math.PI);
    glow.material.uniforms.uA.value = Math.max(u.uCrack.value, fly * .7) * (1 - u.uS3.value);
    // o quadro entra de longe, girando de leve; depois segue o mouse
    const enter = 1 - seg([0, .06], p);
    group.rotation.set(-cur.my * .12 + enter * .35, cur.mx * .22 + Math.sin(time * .2) * .05 - enter * .5, enter * .08);
    group.position.set(mobile ? 0 : 2.6, enter * -2, -enter * 18);
    const dist = mobile ? 47 : 27;
    camera.position.set(cur.mx * .8, cur.my * .5, dist - fly * 3);
    camera.lookAt(mobile ? 0 : 1.2, 0, 0);
    renderer.render(scene, camera);
  }

  let raf = 0, running = false, last = 0, visible = false;
  function loop(now) { raf = requestAnimationFrame(loop); const dt = Math.min(.1, (now - last) / 1000); last = now; frame(dt); }
  function start() { if (running || still) return; running = true; last = performance.now(); raf = requestAnimationFrame(loop); }
  function stop() { running = false; cancelAnimationFrame(raf); }
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; visible && !document.hidden ? start() : stop(); }).observe(canvas);
  document.addEventListener('visibilitychange', () => (document.hidden || !visible ? stop() : start()));
  addEventListener('resize', resize);
  frame(0, true);

  return {
    set(o) { Object.assign(state, o); },
    settle() { frame(0, true); frame(0, true); },
  };
}
