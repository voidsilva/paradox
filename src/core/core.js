// Atração principal: o retrato que quebra.
// Um quadro de Míchkin, coberto por verniz de vidro e moldado em ouro nas bordas,
// trinca a partir do rosto. A luz vaza pelas trincas, centenas de cacos dão uma volta
// inteira no ar (passando o verso de linho cru) e se juntam em Rogójin; na segunda quebra,
// em Nastássia. No fim voam contra a câmera junto com o pó de vidro.
// Material físico (PBR) com reflexo de um estúdio de luz gerado aqui, bloom, tom fílmico e grão.
import * as THREE from 'three';

const W = 10.4, H = 13;          // quadro em pé, 4:5
const T = .16;                   // espessura do vidro
const IMPACT = [0, 2.2];         // a trinca nasce no rosto

// ---------- geometria da quebra ----------
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
const area = poly => { let s = 0; for (let i = 0; i < poly.length; i++) { const a = poly[i], b = poly[(i + 1) % poly.length]; s += a[0] * b[1] - b[0] * a[1]; } return s / 2; };

// corta um polígono convexo por uma reta que passa em (px,py) com ângulo a
function split(poly, px, py, a) {
  const nx = -Math.sin(a), ny = Math.cos(a);
  const side = q => (q[0] - px) * nx + (q[1] - py) * ny;
  const A = [], B = [];
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i], q = poly[(i + 1) % poly.length];
    const sp = side(p), sq = side(q);
    (sp >= 0 ? A : B).push(p);
    if ((sp >= 0) !== (sq >= 0)) {
      const t = sp / (sp - sq), m = [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];
      A.push(m); B.push(m);
    }
  }
  return [A, B].filter(x => x.length >= 3);
}

// teia de vidro: raios tortos a partir do impacto, anéis irregulares e cortes secundários
function fracture(nAng, extraCuts) {
  const angs = [];
  for (let i = 0; i < nAng; i++) angs.push((i + .5 + (Math.random() - .5) * .8) / nAng * Math.PI * 2);
  const radii = [.35, .8, 1.4, 2.15, 3.1, 4.3, 5.8, 7.8, 10.5, 15];
  const R = radii.map(r => angs.map(() => r * (.8 + Math.random() * .4)));
  const pt = (ri, ai, a) => { const r = R[ri][ai % nAng]; return [IMPACT[0] + Math.cos(a) * r, IMPACT[1] + Math.sin(a) * r]; };
  const cells = [];
  for (let ai = 0; ai < nAng; ai++) {
    const a0 = angs[ai], a1 = ai + 1 < nAng ? angs[ai + 1] : angs[0] + Math.PI * 2;
    cells.push({ poly: [[IMPACT[0], IMPACT[1]], pt(0, ai, a0), pt(0, ai + 1, a1)], ring: 0 });
    for (let ri = 0; ri < radii.length - 1; ri++) {
      cells.push({ poly: [pt(ri, ai, a0), pt(ri, ai + 1, a1), pt(ri + 1, ai + 1, a1), pt(ri + 1, ai, a0)], ring: ri + 1 });
    }
  }
  const out = [];
  cells.forEach(c => {
    let polys = [clipRect(c.poly)].filter(p => p.length >= 3);
    const n = c.ring > 1 ? (Math.random() < extraCuts ? 2 : 1) : 0;
    for (let k = 0; k < n; k++) {
      polys = polys.flatMap(p => {
        if (Math.abs(area(p)) < .08) return [p];
        let cx = 0, cy = 0; p.forEach(q => { cx += q[0]; cy += q[1]; }); cx /= p.length; cy /= p.length;
        return split(p, cx + (Math.random() - .5) * .3, cy + (Math.random() - .5) * .3, Math.random() * Math.PI);
      });
    }
    polys.forEach(p => { if (Math.abs(area(p)) > .006) out.push({ poly: area(p) < 0 ? p.reverse() : p, ring: c.ring }); });
  });
  return out;
}

function buildGeometry(shards) {
  const pos = [], nor = [], uv = [], cen = [], rnd = [], side = [];
  const U = (x, y) => [x / W + .5, y / H + .5];
  const B = .035; // chanfro: a borda do vidro é inclinada e pega luz como lapidação
  shards.forEach(s => {
    const p = s.poly;
    let cx = 0, cy = 0; p.forEach(q => { cx += q[0]; cy += q[1]; }); cx /= p.length; cy /= p.length;
    const d = Math.hypot(cx - IMPACT[0], cy - IMPACT[1]);
    const r = [Math.min(1, d / 9) * .72 + Math.random() * .28, Math.random(), Math.random(), Math.random()];
    const push = (x, y, z, n, sd) => {
      pos.push(x, y, z); nor.push(n[0], n[1], n[2]); cen.push(cx, cy, 0); rnd.push(...r); side.push(sd);
      const u = U(x, y); uv.push(u[0], u[1]);
    };
    const inset = p.map(q => { const dx = q[0] - cx, dy = q[1] - cy, l = Math.hypot(dx, dy) || 1; const k = Math.max(0, l - B) / l; return [cx + dx * k, cy + dy * k]; });
    for (let i = 1; i < p.length - 1; i++) {
      [inset[0], inset[i], inset[i + 1]].forEach(q => push(q[0], q[1], T, [0, 0, 1], 0));
      [p[0], p[i + 1], p[i]].forEach(q => push(q[0], q[1], -T, [0, 0, -1], 1));
    }
    for (let i = 0; i < p.length; i++) {
      const a = p[i], b = p[(i + 1) % p.length], ia = inset[i], ib = inset[(i + 1) % p.length];
      const nx = b[1] - a[1], ny = -(b[0] - a[0]), l = Math.hypot(nx, ny) || 1;
      const n = [nx / l, ny / l, 0];
      const nb = [nx / l * .6, ny / l * .6, .8];
      [[ia, T], [b, T * .55], [ib, T], [ia, T], [a, T * .55], [b, T * .55]].forEach(([q, z]) => push(q[0], q[1], z, nb, 2));
      [[a, T * .55], [b, T * .55], [b, -T], [a, T * .55], [b, -T], [a, -T]].forEach(([q, z]) => push(q[0], q[1], z, n, 3));
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

// ---------- estúdio de luz para os reflexos ----------
function studioEnv(renderer) {
  const s = new THREE.Scene();
  s.background = new THREE.Color(0x050302);
  const box = (w, h, color, x, y, z, ry = 0, rx = 0) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide }));
    m.position.set(x, y, z); m.rotation.set(rx, ry, 0); s.add(m);
  };
  box(14, 6, new THREE.Color(2.4, 1.9, 1.3), -8, 9, 6, .6, -.7);           // softbox quente grande, alto à esquerda
  box(2, 14, new THREE.Color(.9, 1, 1.2), 11, 1, 2, -1.2);           // tira fria à direita
  box(5, 5, new THREE.Color(3, 2, .9), 4, 6, -9, 2.6);                  // contraluz dourada
  box(30, 3, new THREE.Color(.5, .38, .26), 0, -9, 0, 0, Math.PI / 2);  // rebatedor no chão
  const pm = new THREE.PMREMGenerator(renderer);
  const env = pm.fromScene(s, .02).texture;
  pm.dispose();
  return env;
}

// ---------- pós: bloom + tom fílmico + grão ----------
const FS_VERT = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }`;
function makePass(frag, uniforms) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({ vertexShader: FS_VERT, fragmentShader: frag, uniforms, depthTest: false, depthWrite: false }));
  m.frustumCulled = false;
  const sc = new THREE.Scene(); sc.add(m);
  return { scene: sc, u: uniforms };
}

function loadTex(url) {
  return new Promise(res => new THREE.TextureLoader().load(url, t => { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; res(t); }, undefined, () => res(null)));
}

export async function createCore({ canvas, tier = 'high', still = false, asset = u => u }) {
  const HIGH = tier === 'high';
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: true, preserveDrawingBuffer: still, powerPreference: 'high-performance' });
  renderer.setPixelRatio(HIGH ? Math.min(devicePixelRatio || 1, 2) : Math.min(devicePixelRatio || 1, 1.5));
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace; // o tom fílmico e o sRGB saem no composite
  renderer.toneMapping = THREE.NoToneMapping;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, .1, 300);
  scene.environment = studioEnv(renderer);

  const [tA, tB, tC] = await Promise.all(['p01-retrato', 'p16-olhar', 'p05-nastassia'].map(k => loadTex(asset('img/paint/' + k + '.webp'))));
  const crop = (t, cx) => { const a = t.image.width / t.image.height, w = (W / H) / a; return new THREE.Vector4(Math.min(1 - w, Math.max(0, cx - w / 2)), 0, w, 1); };

  const uni = {
    tA: { value: tA }, tB: { value: tB }, tC: { value: tC },
    uCropA: { value: crop(tA, .5) }, uCropB: { value: crop(tB, .6) }, uCropC: { value: crop(tC, .5) },
    uS1: { value: 0 }, uS2: { value: 0 }, uS3: { value: 0 }, uCrack: { value: 0 }, uTime: { value: 0 }, uOpen: { value: 0 },
  };
  const mat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff, roughness: .5, metalness: 0, clearcoat: 1, clearcoatRoughness: .04,
    envMapIntensity: .9, side: THREE.DoubleSide, transparent: true,
  });
  mat.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, uni);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
        attribute vec3 aCen; attribute vec4 aR; attribute float aSide;
        uniform float uS1, uS2, uS3, uCrack, uTime, uOpen;
        varying vec2 cUv; varying float cSide, cIdx, cHot, cFade, cOpen;
        mat3 rx(float a){ float c = cos(a), s = sin(a); return mat3(1.,0.,0., 0.,c,s, 0.,-s,c); }
        mat3 ry(float a){ float c = cos(a), s = sin(a); return mat3(c,0.,-s, 0.,1.,0., s,0.,c); }
        mat3 rz(float a){ float c = cos(a), s = sin(a); return mat3(c,s,0., -s,c,0., 0.,0.,1.); }
        float ez(float t){ return t < .5 ? 4.*t*t*t : 1. - pow(-2.*t + 2., 3.) / 2.; }`)
      .replace('#include <beginnormal_vertex>', `
        float t1 = clamp((uS1 - aR.x * .4) / .6, 0., 1.), t2 = clamp((uS2 - aR.x * .4) / .6, 0., 1.);
        float t3 = clamp((uS3 - aR.x * .3) / .7, 0., 1.);
        float f1 = sin(t1 * 3.14159), f2 = sin(t2 * 3.14159), e3 = t3 * t3, fly = f1 + f2;
        // cada voo é uma volta inteira; a frente troca de rosto enquanto está de costas
        float turn = 6.28318 * (ez(t1) + ez(t2));
        cIdx = floor((turn + 3.14159) / 6.28318);
        mat3 cR = ry(turn + e3 * (aR.w - .5) * 10.) * rx(fly * (aR.y - .5) * 3.2 + e3 * (aR.z - .5) * 8.) * rz(fly * (aR.z - .5) * 2.4);
        vec2 dir = normalize(aCen.xy - vec2(${IMPACT[0].toFixed(2)}, ${IMPACT[1].toFixed(2)}) + 1e-3);
        vec3 cOff = vec3(dir * (1.4 + aR.y * 5.), 1.2 + aR.z * 9.) * fly;
        cOff.y += fly * fly * (aR.w - .35) * 1.6;
        cOff += vec3(sin(uTime * .6 + aR.y * 30.), cos(uTime * .5 + aR.z * 20.), sin(uTime * .4 + aR.w * 9.)) * .1 * fly;
        cOff += vec3(dir * (5. + aR.y * 14.), 22. + aR.z * 40.) * e3;
        float cScale = 1. - uCrack * .03 - fly * .04;
        cHot = fly; cFade = 1. - smoothstep(.55, 1., t3);
        cUv = uv; cSide = aSide;
        cOpen = clamp(uOpen + fly * 4. + t3 * 4., 0., 1.);
        // chanfro fechado = vidro liso; quando trinca, ele inclina e pega luz
        vec3 objectNormal = cR * normalize(mix(normal, vec3(0., 0., 1.), aSide > 1.5 && aSide < 2.5 ? 1. - cOpen : 0.));
        #ifdef USE_TANGENT
          vec3 objectTangent = vec3( tangent.xyz );
        #endif`)
      .replace('#include <begin_vertex>', `vec3 transformed = aCen + cOff + cR * ((position - aCen) * vec3(cScale, cScale, 1.));`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform sampler2D tA, tB, tC; uniform vec4 uCropA, uCropB, uCropC; uniform float uCrack;
        varying vec2 cUv; varying float cSide, cIdx, cHot, cFade, cOpen;
        vec3 paint(sampler2D t, vec4 c){ return texture2D(t, c.xy + cUv * c.zw).rgb; }`)
      .replace('#include <map_fragment>', `
        vec3 face = cIdx < .5 ? paint(tA, uCropA) : cIdx < 1.5 ? paint(tB, uCropB) : paint(tC, uCropC);
        // antes da primeira trinca o chanfro some na pintura: o quadro parece inteiro
        float gEdge = cSide > 2.5 ? 1. : cSide > 1.5 ? cOpen : 0.;
        if (cSide < .5) diffuseColor.rgb = face;
        else if (cSide > 1.5 && cSide < 2.5) diffuseColor.rgb = mix(face, vec3(1., .74, .36), cOpen);
        else if (cSide < 1.5) {
          vec2 w = cUv * vec2(240., 300.);
          float weave = .5 + .3 * sin(w.x * 3.14159) * sin(w.y * 3.14159);
          diffuseColor.rgb = vec3(.62, .5, .36) * (.75 + weave * .4);
        } else diffuseColor.rgb = vec3(1., .72, .32);
        diffuseColor.a *= cFade;`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor = cSide < .5 ? .55 : cSide < 1.5 ? .9 : cSide < 2.5 ? mix(.55, .14, cOpen) : .26;`)
      .replace('#include <metalnessmap_fragment>', `#include <metalnessmap_fragment>
        metalnessFactor = gEdge;`)
      .replace('material.clearcoat = clearcoat;', 'material.clearcoat = (cSide > .5 && cSide < 1.5) ? 0. : clearcoat;')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        // a luz que vaza pela trinca acende as bordas de ouro
        if (cSide > 1.5) totalEmissiveRadiance += vec3(1., .62, .25) * (uCrack * 1.1 + cHot * .2) * gEdge;`);
  };
  const geo = buildGeometry(fracture(HIGH ? 30 : 20, HIGH ? .7 : .35));
  const pane = new THREE.Mesh(geo, mat);
  pane.frustumCulled = false;
  const group = new THREE.Group();
  group.add(pane);
  scene.add(group);

  // luz atrás do vidro: aparece pelas trincas (e o bloom espalha)
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(W * .97, H * .97), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor,
    uniforms: { uA: { value: 0 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
    fragmentShader: `uniform float uA; varying vec2 vUv; void main(){ vec2 q = (vUv - vec2(.5, .67)) * vec2(1., 1.25); float r = length(q);
      gl_FragColor = vec4(vec3(1., .7, .38) * (exp(-r * r * 14.) * .8 + exp(-r * r * 120.) * 3.) * uA * smoothstep(0., .18, min(min(vUv.x, 1. - vUv.x), min(vUv.y, 1. - vUv.y))), 1.); }`,
  }));
  glow.position.set(IMPACT[0], 0, -.9);
  group.add(glow);

  // luzes de cena (o estúdio faz os reflexos; estas dão volume)
  const key = new THREE.DirectionalLight(0xffe2b8, 1.6); key.position.set(-6, 8, 10); scene.add(key);
  const rim = new THREE.DirectionalLight(0x9fb7ff, .8); rim.position.set(9, -2, -4); scene.add(rim);
  const back = new THREE.PointLight(0xffb060, 0, 30, 1.6); back.position.set(IMPACT[0], IMPACT[1], -2.5); group.add(back);

  // pó de vidro: lascas minúsculas que brilham no ar durante a quebra
  const NDUST = HIGH ? 700 : 260;
  const dust = new THREE.InstancedMesh(new THREE.TetrahedronGeometry(.07, 0), new THREE.MeshPhysicalMaterial({
    color: 0xffffff, roughness: .05, metalness: .2, clearcoat: 1, envMapIntensity: 1.6, transparent: true, opacity: .9,
  }), NDUST);
  dust.frustumCulled = false;
  const dustD = Array.from({ length: NDUST }, () => {
    const a = Math.random() * 6.283, r = Math.pow(Math.random(), 1.6) * 6;
    return {
      o: new THREE.Vector3(IMPACT[0] + Math.cos(a) * r, IMPACT[1] + Math.sin(a) * r, 0),
      v: new THREE.Vector3(Math.cos(a) * (2 + Math.random() * 9), Math.sin(a) * (2 + Math.random() * 9) + 1, 3 + Math.random() * 16),
      s: .4 + Math.random() * 1.6, sp: new THREE.Vector3(Math.random(), Math.random(), Math.random()).multiplyScalar(9), d: Math.random() * .3,
    };
  });
  group.add(dust);
  const dm = new THREE.Matrix4(), dq = new THREE.Quaternion(), de = new THREE.Euler(), dp = new THREE.Vector3(), ds = new THREE.Vector3();

  // ---------- pós ----------
  const rtScene = new THREE.WebGLRenderTarget(2, 2, { type: THREE.HalfFloatType, depthBuffer: true, samples: HIGH ? 4 : 0 });
  const rtA = new THREE.WebGLRenderTarget(2, 2, { type: THREE.HalfFloatType, depthBuffer: false });
  const rtB = new THREE.WebGLRenderTarget(2, 2, { type: THREE.HalfFloatType, depthBuffer: false });
  const bright = makePass(`uniform sampler2D t; varying vec2 vUv; void main(){ vec3 c = texture2D(t, vUv).rgb; float l = max(c.r, max(c.g, c.b));
      gl_FragColor = vec4(c * smoothstep(1.1, 2.6, l), 1.); }`, { t: { value: null } });
  const blur = makePass(`uniform sampler2D t; uniform vec2 dir; varying vec2 vUv; void main(){
      vec3 c = texture2D(t, vUv).rgb * .2270;
      c += (texture2D(t, vUv + dir * 1.3846).rgb + texture2D(t, vUv - dir * 1.3846).rgb) * .3162;
      c += (texture2D(t, vUv + dir * 3.2308).rgb + texture2D(t, vUv - dir * 3.2308).rgb) * .0703;
      gl_FragColor = vec4(c, 1.); }`, { t: { value: null }, dir: { value: new THREE.Vector2() } });
  const comp = makePass(`uniform sampler2D tS, tB; uniform float uTime, uBloom, uCA; varying vec2 vUv;
      vec3 aces(vec3 x){ return clamp((x * (2.51 * x + .03)) / (x * (2.43 * x + .59) + .14), 0., 1.); }
      float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      void main(){
        vec2 d = vUv - .5;
        vec4 s = texture2D(tS, vUv);
        vec3 c = vec3(texture2D(tS, vUv + d * uCA).r, s.g, texture2D(tS, vUv - d * uCA).b);
        c += texture2D(tB, vUv).rgb * uBloom;
        c = aces(c * 1.35);
        c = pow(c, vec3(1. / 2.2));
        float a = clamp(max(s.a, max(c.r, max(c.g, c.b)) * 1.4), 0., 1.);
        c += (h(vUv * 913. + uTime) - .5) * .035 * a;
        gl_FragColor = vec4(c, a); }`, { tS: { value: rtScene.texture }, tB: { value: rtA.texture }, uTime: { value: 0 }, uBloom: { value: 1 }, uCA: { value: .004 } });
  comp.scene.children[0].material.premultipliedAlpha = false;
  const fsCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  const state = { p: 0, mx: 0, my: 0 }, cur = { p: 0, mx: 0, my: 0 };
  let mobile = false;
  function resize() {
    const w = canvas.clientWidth || innerWidth, h = canvas.clientHeight || innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    mobile = w / h < .85;
    camera.updateProjectionMatrix();
    const pr = renderer.getPixelRatio();
    const vw = Math.round(w * pr), vh = Math.round(h * pr);
    rtScene.setSize(vw, vh);
    rtA.setSize(Math.max(1, vw >> 2), Math.max(1, vh >> 2));
    rtB.setSize(Math.max(1, vw >> 2), Math.max(1, vh >> 2));
  }
  resize();

  const cl = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const TL = { crack1: [.06, .14], fly1: [.13, .43], crack2: [.5, .56], fly2: [.55, .85], out: [.9, 1] };
  const seg = ([a, b], p) => cl((p - a) / (b - a));
  let time = 0;

  function render() {
    renderer.setClearColor(0x000000, 0);
    renderer.setRenderTarget(rtScene); renderer.clear(); renderer.render(scene, camera);
    bright.u.t.value = rtScene.texture; renderer.setRenderTarget(rtA); renderer.render(bright.scene, fsCam);
    for (let i = 0; i < 3; i++) {
      const r = 1 + i * 1.5;
      blur.u.t.value = rtA.texture; blur.u.dir.value.set(r / rtA.width, 0); renderer.setRenderTarget(rtB); renderer.render(blur.scene, fsCam);
      blur.u.t.value = rtB.texture; blur.u.dir.value.set(0, r / rtA.height); renderer.setRenderTarget(rtA); renderer.render(blur.scene, fsCam);
    }
    renderer.setRenderTarget(null); renderer.clear(); renderer.render(comp.scene, fsCam);
  }

  function frame(dt, snap = false) {
    time += dt;
    const k = snap ? 1 : 1 - Math.pow(.003, dt);
    cur.p += (state.p - cur.p) * k;
    cur.mx += (state.mx - cur.mx) * (snap ? 1 : k * .5);
    cur.my += (state.my - cur.my) * (snap ? 1 : k * .5);
    const p = cur.p;
    const s1 = seg(TL.fly1, p), s2 = seg(TL.fly2, p), s3 = seg(TL.out, p);
    uni.uS1.value = s1; uni.uS2.value = s2; uni.uS3.value = s3;
    const crack = Math.max(seg(TL.crack1, p) * (1 - s1), seg(TL.crack2, p) * (1 - s2));
    uni.uCrack.value = crack; uni.uTime.value = time;
    const fly = Math.sin(s1 * Math.PI) + Math.sin(s2 * Math.PI);
    glow.material.uniforms.uA.value = Math.max(crack, fly * .18) * (1 - s3);
    uni.uOpen.value = seg(TL.crack1, p);
    back.intensity = (crack * 14 + fly * 6) * (1 - s3);
    comp.u.uBloom.value = .45 + crack * .5 + fly * .2;
    comp.u.uCA.value = .002 + fly * .006 + s3 * .02;
    comp.u.uTime.value = time;

    // pó de vidro
    const ph = s1 > 0 && s1 < 1 ? s1 : s2 > 0 && s2 < 1 ? s2 : s3;
    dust.visible = Math.max(fly, s3) > .01;
    if (dust.visible) {
      dustD.forEach((d, i) => {
        const tt = cl((ph - d.d) / .7);
        const f = Math.sin(tt * Math.PI) + (s3 > 0 ? tt * 2 : 0);
        dp.copy(d.o).addScaledVector(d.v, f * .9);
        dp.y -= f * f * .6;
        de.set(d.sp.x * tt + time, d.sp.y * tt, d.sp.z * tt); dq.setFromEuler(de);
        ds.setScalar(d.s * Math.min(1, f * 3));
        dm.compose(dp, dq, ds); dust.setMatrixAt(i, dm);
      });
      dust.instanceMatrix.needsUpdate = true;
    }

    // o quadro entra de longe; depois respira e segue o mouse
    const enter = 1 - seg([0, .06], p);
    const ee = enter * enter;
    group.rotation.set(-cur.my * .1 + ee * .4, cur.mx * .2 + Math.sin(time * .2) * .05 - ee * .6, ee * .1);
    group.position.set(mobile ? 0 : 2.6, -ee * 2, -ee * 22);
    const dist = mobile ? 47 : 27;
    camera.position.set(cur.mx * .8, cur.my * .5, dist - fly * 3.5);
    camera.lookAt(mobile ? 0 : 1.2, 0, 0);
    render();
  }

  let raf = 0, running = false, last = 0, visible = false;
  function loop(now) { raf = requestAnimationFrame(loop); const dt = Math.min(.1, (now - last) / 1000); last = now; frame(dt); }
  function start() { if (running || still) return; running = true; last = performance.now(); raf = requestAnimationFrame(loop); }
  function stop() { running = false; cancelAnimationFrame(raf); }
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; visible && !document.hidden ? start() : stop(); }).observe(canvas);
  document.addEventListener('visibilitychange', () => (document.hidden || !visible ? stop() : start()));
  addEventListener('resize', resize);
  if (still) window.__coreMat = mat;
  frame(0, true);

  return {
    set(o) { Object.assign(state, o); },
    settle() { frame(0, true); frame(0, true); },
  };
}
