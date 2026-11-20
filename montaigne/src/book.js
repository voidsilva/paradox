/*
  O livro pop-up do Montaigne.
  Um livro de capa dura sobre uma mesa na névoa. A capa abre na entrada; cada cena é uma página dupla
  com a pintura impressa e uma figura recortada que se levanta do papel quando a página abre e se
  dobra quando a página vira. As folhas viram com curvatura (o canto da frente vai antes), o vento
  levanta papéis soltos quando uma folha passa, e no fim todas as folhas se soltam e voam para a luz.

  API (a mesma que main.js usava com o mundo antigo):
    set({ u, intro })  pointer(x, y)  kick(dy)  start()  progress  stats
*/
import * as THREE from 'three';

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const mix = (a, b, t) => a + (b - a) * t;
const easeIO = x => (x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const easeOut = x => 1 - Math.pow(1 - x, 3);
const easeBack = x => { const c = 1.9; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const PI = Math.PI;

// medidas do livro (unidades do mundo)
const W = 1.25;        // largura de uma página
const D = 1.0;         // altura da página (eixo z, de trás para a frente)
const M = .045;        // a capa sobra em volta das páginas
const H = .04;         // espessura da capa
const B = .07;         // espessura total do miolo
const E = .0016;       // espaço entre folhas

const LEAF_VS = /* glsl */`
uniform float uA, uY0, uY1, uK, uFly, uFull;
uniform vec3 uSeed;
uniform float uTime;
varying vec2 vUv;
varying vec3 vN;
varying vec3 vW;
mat3 rx(float a){ float c=cos(a), s=sin(a); return mat3(1.,0.,0., 0.,c,s, 0.,-s,c); }
mat3 ry(float a){ float c=cos(a), s=sin(a); return mat3(c,0.,-s, 0.,1.,0., s,0.,c); }
mat3 rz(float a){ float c=cos(a), s=sin(a); return mat3(c,s,0., -s,c,0., 0.,0.,1.); }
void main(){
  float x = position.x;
  float z = position.z;
  vUv = vec2(x / ${W.toFixed(3)}, .5 - z / ${D.toFixed(3)});
  // o canto da frente vai antes (a mão pega a folha embaixo, à direita)
  float th = uA + uK * .32 * sin(uA) * (z / ${D.toFixed(3)});
  float c = -uK * 1.15 * sin(uA) / ${W.toFixed(3)};
  vec2 p;
  if (abs(c) < 1e-4) p = vec2(x * cos(th), x * sin(th));
  else p = vec2((sin(th + c * x) - sin(th)) / c, (cos(th) - cos(th + c * x)) / c);
  float phi = th + c * x;
  vec3 n = vec3(-sin(phi), cos(phi), 0.);
  // a folha ondula um pouco no ar
  p.y += sin(x * 5. + uTime * 2.) * .012 * sin(uA) * uK;
  vec3 pos = vec3(p.x, p.y + mix(uY0, uY1, uA / 3.14159265), z);
  if (uFly > 0.) {
    float f = uFly;
    vec3 ctr = vec3(-${(W / 2).toFixed(3)}, pos.y, 0.);
    mat3 r = ry(f * (1.2 + uSeed.x * 1.6)) * rx(f * (1.5 + uSeed.y * 2.5)) * rz(-f * (1. + uSeed.z * 2.));
    vec3 q = r * (pos - ctr);
    n = r * n;
    q.y += sin(x * 4. + f * 14. + uSeed.x * 6.) * .1 * f;
    pos = ctr + q + vec3(f * f * (4.5 + uSeed.x * 3.), f * (2.4 + uSeed.y * 1.8) + f * f * 1.5, -f * (2.6 + uSeed.z * 2.6));
  }
  vN = normalize(mat3(modelMatrix) * n);
  vec4 wp = modelMatrix * vec4(pos, 1.);
  vW = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;

const LEAF_FS = /* glsl */`
uniform sampler2D uFront, uBack;
uniform float uFull, uA;
uniform vec3 uFog, uL;
uniform float uFogN, uFogF;
varying vec2 vUv;
varying vec3 vN;
varying vec3 vW;
void main(){
  vec3 n = normalize(vN);
  vec4 t;
  if (gl_FrontFacing) {
    vec2 uv = uFull > .5 ? vUv : vec2(.5 + .5 * vUv.x, vUv.y);
    t = texture2D(uFront, uv);
  } else {
    n = -n;
    t = texture2D(uBack, vec2(.5 - .5 * vUv.x, vUv.y));
  }
  float dif = max(dot(n, normalize(uL)), 0.);
  float l = .6 + .48 * dif;
  // dobra perto da lombada e sombra dentro da curva
  float g = mix(.74, 1., smoothstep(0., .16, vUv.x));
  vec3 col = t.rgb * l * g;
  // brilho de papel na borda que vira
  col += vec3(.05) * pow(1. - abs(n.y), 3.) * dif;
  float d = distance(vW, cameraPosition);
  col = mix(col, uFog, smoothstep(uFogN, uFogF, d));
  gl_FragColor = vec4(col, 1.);
  #include <colorspace_fragment>
}`;

const FIG_VS = /* glsl */`
varying vec2 vUv; varying vec3 vW; varying vec3 vN;
void main(){ vUv = uv; vN = normalize(mat3(modelMatrix) * normal); vec4 wp = modelMatrix * vec4(position, 1.); vW = wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp; }`;

// figura recortada: borda branca de papel em volta (como um recorte colado num cartão)
const FIG_FS = /* glsl */`
uniform sampler2D uMap;
uniform vec2 uPx;
uniform vec3 uFog, uL, uPaper;
uniform float uFogN, uFogF, uO;
varying vec2 vUv; varying vec3 vW; varying vec3 vN;
void main(){
  vec4 t = texture2D(uMap, vUv);
  float a = t.a;
  float rim = 0.;
  for (int i = 0; i < 12; i++) {
    float an = float(i) * 0.5236;
    rim = max(rim, texture2D(uMap, vUv + vec2(cos(an), sin(an)) * uPx * 9.).a);
  }
  float edge = max(a, smoothstep(.25, .6, rim));
  if (edge < .5) discard;
  vec3 n = normalize(vN);
  vec3 col;
  if (gl_FrontFacing) col = mix(uPaper, t.rgb, smoothstep(.45, .8, a));
  else { n = -n; col = uPaper * .86; }
  float l = .62 + .46 * max(dot(n, normalize(uL)), 0.);
  col *= l;
  float d = distance(vW, cameraPosition);
  col = mix(col, uFog, smoothstep(uFogN, uFogF, d));
  gl_FragColor = vec4(col, uO);
  #include <colorspace_fragment>
}`;

// sombra macia da figura sobre a página
const SH_FS = /* glsl */`
uniform sampler2D uMap; uniform float uO;
varying vec2 vUv;
void main(){
  float a = texture2D(uMap, vUv, 3.5).a;
  a *= smoothstep(1., .55, vUv.y) * smoothstep(0., .08, vUv.x) * smoothstep(1., .92, vUv.x);
  gl_FragColor = vec4(vec3(.16, .14, .12), a * uO);
}`;

const TABLE_FS = /* glsl */`
uniform vec3 uFog, uTab;
uniform vec4 uRect;
uniform float uFogN, uFogF, uLift;
varying vec3 vW;
float sdBox(vec2 p, vec2 b){ vec2 d = abs(p) - b; return length(max(d, 0.)) + min(max(d.x, d.y), 0.); }
float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
void main(){
  vec2 p = vW.xz;
  float s = sdBox(p - uRect.xy, uRect.zw);
  float sh = exp(-max(s, 0.) * 7.) * .26 + exp(-max(s, 0.) * 1.6) * .12;
  sh *= 1. - uLift;
  float lin = (h(floor(p * 220.)) - .5) * .025 + sin(p.x * 260. + sin(p.y * 7.) * 2.) * .006;
  vec3 col = uTab * (1. - sh) + lin;
  float d = distance(vW, cameraPosition);
  col = mix(col, uFog, smoothstep(uFogN * .8, uFogF, d));
  gl_FragColor = vec4(col, 1.);
  #include <colorspace_fragment>
}`;
const TABLE_VS = /* glsl */`varying vec3 vW; void main(){ vec4 wp = modelMatrix * vec4(position, 1.); vW = wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp; }`;

function loadImg(src) {
  return new Promise((res, rej) => { const i = new Image(); i.decoding = 'async'; i.onload = () => res(i); i.onerror = rej; i.src = src; });
}

// grão de papel, desenhado uma vez e reaproveitado
function grain(n = 256) {
  const c = document.createElement('canvas'); c.width = c.height = n;
  const g = c.getContext('2d'), d = g.createImageData(n, n);
  for (let i = 0; i < n * n; i++) { const v = 200 + Math.random() * 55; d.data[i * 4] = v; d.data[i * 4 + 1] = v * .985; d.data[i * 4 + 2] = v * .95; d.data[i * 4 + 3] = 255; }
  g.putImageData(d, 0, 0);
  return c;
}

function cover(g, img, x, y, w, h, fx = .5, fy = .5) {
  const r = Math.max(w / img.width, h / img.height);
  const sw = w / r, sh = h / r;
  g.drawImage(img, (img.width - sw) * fx, (img.height - sh) * fy, sw, sh, x, y, w, h);
}

export async function createBook({ canvas, tier = 'high', still = false, scenes, labels = [], dir = 'montaigne/img/', asset = u => u, onProgress = () => {} }) {
  const low = tier === 'low';
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !low, alpha: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, low ? 1.25 : 1.75));
  const FOG = new THREE.Color(0xe2dfd6), PAPER = new THREE.Color(0xefebe2), TAB = new THREE.Color(0xd9d4c8);
  renderer.setClearColor(FOG);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(28, 1, .05, 60);
  const L = new THREE.Vector3(-.35, .85, .45);

  scene.add(new THREE.HemisphereLight(0xfffaf0, 0xcfc8b8, 2.1));
  const sun = new THREE.DirectionalLight(0xfff1dc, 1.6); sun.position.set(-2, 5, 3); scene.add(sun);
  scene.fog = new THREE.Fog(FOG, 8, 18);

  // ---------- imagens ----------
  const N = scenes.length;
  const need = new Set();
  scenes.forEach(s => { need.add('paint/' + s.bg + '.jpg'); s.cuts.slice(0, 1).forEach(c => need.add('cut/' + c.k + '.webp')); });
  const imgs = {};
  let done = 0;
  await Promise.all([...need].map(async k => {
    imgs[k] = await loadImg(asset(dir + k));
    onProgress(++done / (need.size + 1));
  }));

  const maxA = renderer.capabilities.getMaxAnisotropy();
  const tex = c => { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = Math.min(8, maxA); return t; };
  const GR = grain();
  const serif = '"EB Garamond", Garamond, Georgia, serif', sans = '"Instrument Sans", "Helvetica Neue", Arial, sans-serif';

  // ---------- páginas duplas: pintura impressa, títulos correntes, legenda e número ----------
  const TW = low ? 1400 : 2048, TH = Math.round(TW * D / (2 * W));
  const spreads = scenes.map((s, i) => {
    const c = document.createElement('canvas'); c.width = TW; c.height = TH;
    const g = c.getContext('2d');
    g.fillStyle = '#efebe2'; g.fillRect(0, 0, TW, TH);
    const k = TW / 2048;
    const mx = 70 * k, mt = 74 * k, mb = 96 * k;
    // a pintura atravessa as duas páginas, como numa prancha
    g.save();
    g.beginPath(); g.rect(mx, mt, TW - 2 * mx, TH - mt - mb); g.clip();
    cover(g, imgs['paint/' + s.bg + '.jpg'], mx, mt, TW - 2 * mx, TH - mt - mb, .5, .45);
    g.restore();
    // tinta no papel: o grão passa por cima da imagem
    g.globalCompositeOperation = 'multiply'; g.globalAlpha = .55;
    const pat = g.createPattern(GR, 'repeat'); g.fillStyle = pat; g.fillRect(0, 0, TW, TH);
    g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    // filete em volta da prancha
    g.strokeStyle = 'rgba(26,30,37,.55)'; g.lineWidth = 1.5 * k; g.strokeRect(mx - 9 * k, mt - 9 * k, TW - 2 * mx + 18 * k, TH - mt - mb + 18 * k);
    // títulos correntes
    g.fillStyle = 'rgba(26,30,37,.62)'; g.font = `600 ${15 * k}px ${sans}`;
    if ('letterSpacing' in g) g.letterSpacing = `${4 * k}px`;
    g.textBaseline = 'alphabetic';
    g.textAlign = 'left'; g.fillText('MONTAIGNE', mx, mt - 30 * k);
    g.textAlign = 'right'; g.fillText('ENSAIOS · LIVRO III', TW - mx, mt - 30 * k);
    if ('letterSpacing' in g) g.letterSpacing = '0px';
    // legenda em vermelho e número das páginas
    g.font = `italic 400 ${30 * k}px ${serif}`; g.fillStyle = '#b0391f'; g.textAlign = 'left';
    g.fillText(labels[i] || '', mx, TH - mb + 52 * k);
    g.font = `400 ${26 * k}px ${serif}`; g.fillStyle = 'rgba(26,30,37,.7)';
    g.textAlign = 'center';
    g.fillText(String(12 + i * 2), TW * .25, TH - 26 * k);
    g.fillText(String(13 + i * 2), TW * .75, TH - 26 * k);
    return tex(c);
  });

  // capa: pano vermelho-escuro, filetes dourados, título
  const CW = low ? 900 : 1300, CH = Math.round(CW * (D + 2 * M) / (W + M));
  const coverC = document.createElement('canvas'); coverC.width = CW; coverC.height = CH;
  {
    const g = coverC.getContext('2d'), k = CW / 1300;
    g.fillStyle = '#7a2c1d'; g.fillRect(0, 0, CW, CH);
    g.globalCompositeOperation = 'multiply'; g.globalAlpha = .5;
    g.fillStyle = g.createPattern(GR, 'repeat'); g.fillRect(0, 0, CW, CH);
    g.globalAlpha = .08; g.strokeStyle = '#000';
    for (let y = 0; y < CH; y += 3) { g.beginPath(); g.moveTo(0, y); g.lineTo(CW, y + Math.random() * 2); g.stroke(); }
    g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    const gold = g.createLinearGradient(0, 0, CW, CH); gold.addColorStop(0, '#d9b56e'); gold.addColorStop(.5, '#f3dc9e'); gold.addColorStop(1, '#b98d45');
    g.strokeStyle = gold; g.lineWidth = 3 * k; g.strokeRect(70 * k, 70 * k, CW - 140 * k, CH - 140 * k);
    g.lineWidth = 1.2 * k; g.strokeRect(86 * k, 86 * k, CW - 172 * k, CH - 172 * k);
    g.fillStyle = gold; g.textAlign = 'center';
    g.font = `600 ${22 * k}px ${sans}`; if ('letterSpacing' in g) g.letterSpacing = `${9 * k}px`;
    g.fillText('MICHEL DE MONTAIGNE', CW / 2, CH * .3);
    if ('letterSpacing' in g) g.letterSpacing = '0px';
    g.font = `italic 400 ${168 * k}px ${serif}`; g.fillText('Ensaios', CW / 2, CH * .55);
    g.font = `400 ${36 * k}px ${serif}`; g.fillText('Paradoxo  ·  II', CW / 2, CH * .68);
    g.beginPath(); g.arc(CW / 2, CH * .79, 7 * k, 0, PI * 2); g.fill();
  }
  const coverT = tex(coverC);
  const blankC = document.createElement('canvas'); blankC.width = blankC.height = 256;
  { const g = blankC.getContext('2d'); g.fillStyle = '#efebe2'; g.fillRect(0, 0, 256, 256); g.globalCompositeOperation = 'multiply'; g.globalAlpha = .4; g.drawImage(GR, 0, 0); }
  const blankT = tex(blankC);

  const book = new THREE.Group(); scene.add(book);
  const fogC = FOG.clone();
  const fogU = { uFog: { value: fogC }, uL: { value: L }, uFogN: { value: 8 }, uFogF: { value: 18 }, uTime: { value: 0 } };

  // ---------- capa (dura, gira inteira) ----------
  const cloth = new THREE.MeshLambertMaterial({ color: 0x6a2618 });
  const edgeM = new THREE.MeshLambertMaterial({ color: 0xe8e2d4 });
  const coverG = new THREE.Group(); book.add(coverG);
  {
    const box = new THREE.Mesh(new THREE.BoxGeometry(W + M, H, D + 2 * M), cloth);
    box.position.set((W + M) / 2, H / 2, 0); coverG.add(box);
    const top = new THREE.Mesh(new THREE.PlaneGeometry(W + M, D + 2 * M).rotateX(-PI / 2), new THREE.MeshLambertMaterial({ map: coverT }));
    top.position.set((W + M) / 2, H + .0008, 0); coverG.add(top);
    // por dentro: a metade esquerda da primeira página dupla (a guarda)
    const g = new THREE.PlaneGeometry(W, D).rotateX(PI / 2);
    const uv = g.attributes.uv, pos = g.attributes.position;
    for (let i = 0; i < uv.count; i++) { const x = pos.getX(i) + W / 2, z = pos.getZ(i); uv.setXY(i, .5 - .5 * x / W, .5 - z / D); }
    const inner = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ map: spreads[0] }));
    inner.position.set(W / 2, -.0008, 0); coverG.add(inner);
  }
  // contracapa e miolo
  const back = new THREE.Mesh(new THREE.BoxGeometry(W + M, H, D + 2 * M), cloth);
  back.position.set((W + M) / 2, H / 2, 0); book.add(back);
  const blockGeo = new THREE.BoxGeometry(W - .012, 1, D - .004).translate(0, .5, 0);
  // o topo do miolo não aparece: em cima dele estão as folhas (e, no começo, a guarda)
  const hid = new THREE.MeshBasicMaterial({ visible: false });
  const blockMats = [edgeM, edgeM, hid, edgeM, edgeM, edgeM];
  const blockR = new THREE.Mesh(blockGeo, blockMats); blockR.position.set((W - .012) / 2 + .004, H, 0); book.add(blockR);
  const blockL = new THREE.Mesh(blockGeo, blockMats); blockL.position.set(-(W - .012) / 2 - .004, H, 0); book.add(blockL);

  // ---------- folhas ----------
  const leafGeo = new THREE.PlaneGeometry(W, D, low ? 28 : 48, low ? 4 : 8).rotateX(-PI / 2).translate(W / 2, 0, 0);
  const leaves = [];
  for (let k = 0; k < N; k++) {
    const m = new THREE.ShaderMaterial({
      vertexShader: LEAF_VS, fragmentShader: LEAF_FS, side: THREE.DoubleSide,
      uniforms: {
        ...fogU, uFront: { value: spreads[k] }, uBack: { value: k < N - 1 ? spreads[k + 1] : blankT },
        uA: { value: 0 }, uY0: { value: 0 }, uY1: { value: 0 }, uK: { value: 1 }, uFly: { value: 0 }, uFull: { value: 0 },
        uSeed: { value: new THREE.Vector3(Math.random(), Math.random(), Math.random()) },
      },
    });
    const mesh = new THREE.Mesh(leafGeo, m); mesh.frustumCulled = false; book.add(mesh);
    leaves.push(mesh);
  }

  // ---------- figuras que se levantam ----------
  const figs = scenes.map((s, i) => {
    const c = s.cuts[0]; if (!c) return null;
    const img = imgs['cut/' + c.k + '.webp'];
    const t = new THREE.Texture(img); t.colorSpace = THREE.SRGBColorSpace; t.needsUpdate = true; t.anisotropy = Math.min(4, maxA);
    const fh = D * .54 * clamp(c.h / 12, .7, 1.05), fw = fh * img.width / img.height;
    const pivot = new THREE.Group();
    const half = Math.min(W * .92, Math.max(W * .3, Math.abs(c.x) / 12.5 * W * 1.05));
    pivot.position.set(Math.sign(c.x || 1) * Math.min(half, W - fw / 2 - .05), 0, -D * .06);
    const mat = new THREE.ShaderMaterial({
      vertexShader: FIG_VS, fragmentShader: FIG_FS, side: THREE.DoubleSide, transparent: true,
      uniforms: { ...fogU, uMap: { value: t }, uPx: { value: new THREE.Vector2(1 / img.width, 1 / img.height) }, uPaper: { value: PAPER }, uO: { value: 1 } },
    });
    const fig = new THREE.Mesh(new THREE.PlaneGeometry(fw, fh).translate(0, fh / 2, 0), mat);
    pivot.add(fig);
    const shm = new THREE.ShaderMaterial({ vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`, fragmentShader: SH_FS, transparent: true, depthWrite: false, uniforms: { uMap: { value: t }, uO: { value: 0 } } });
    const sh = new THREE.Mesh(new THREE.PlaneGeometry(fw * 1.08, fh * .7).rotateX(-PI / 2).translate(.05, 0, -fh * .35), shm);
    book.add(pivot, sh);
    return { pivot, fig, sh, shm, mat, fh, fw };
  });

  // ---------- papéis soltos no vento ----------
  const NS = low ? 26 : 54;
  const sheetC = document.createElement('canvas'); sheetC.width = 128; sheetC.height = 168;
  {
    const g = sheetC.getContext('2d'); g.fillStyle = '#f2eee6'; g.fillRect(0, 0, 128, 168);
    g.strokeStyle = 'rgba(26,30,37,.55)'; g.lineWidth = 1.4;
    for (let y = 26; y < 150; y += 11) { g.beginPath(); g.moveTo(14, y); let x = 14; while (x < 112) { x += 4 + Math.random() * 6; g.lineTo(x, y + (Math.random() - .5) * 3); } g.stroke(); }
    g.fillStyle = '#b0391f'; g.font = 'italic 30px Georgia'; g.fillText('Q', 12, 26);
  }
  const sheets = new THREE.InstancedMesh(new THREE.PlaneGeometry(.11, .145), new THREE.MeshLambertMaterial({ map: tex(sheetC), side: THREE.DoubleSide }), NS);
  sheets.frustumCulled = false; book.add(sheets);
  const SH = Array.from({ length: NS }, (_, i) => ({ ph: Math.random(), sp: .6 + Math.random() * .8, z: (Math.random() - .5) * 2.6, r: Math.random(), y: Math.random() * .6, sx: Math.random() * 6 }));
  const dummy = new THREE.Object3D();

  // ---------- mesa ----------
  const tableU = { ...fogU, uTab: { value: TAB }, uRect: { value: new THREE.Vector4(W / 2, 0, W / 2 + M, D / 2 + M) }, uLift: { value: 0 } };
  const table = new THREE.Mesh(new THREE.PlaneGeometry(60, 60).rotateX(-PI / 2), new THREE.ShaderMaterial({ vertexShader: TABLE_VS, fragmentShader: TABLE_FS, uniforms: tableU }));
  table.position.y = -.001; scene.add(table);

  // ---------- câmera por cena ----------
  // enquadramento em fração da tela: sx/sy = onde fica o centro do livro (+ direita, + para cima),
  // size = quanto da largura da tela o livro aberto ocupa, el = elevação da câmera.
  // O livro vai sempre para o lado oposto ao texto; o deslocamento é de lente (setViewOffset),
  // então o livro nunca é cortado nem invade a coluna do texto.
  const SIDE = {
    hero: { sx: .2, sy: .17, size: .46, el: .68 },
    l: { sx: .24, sy: .03, size: .42, el: .62 },
    r: { sx: -.24, sy: .03, size: .42, el: .62 },
    c: { sx: 0, sy: -.2, size: .44, el: .74 },
  };
  const MOB = { sx: 0, sy: .17, size: .97, el: .95 };
  const kinds = labels.map((_, i) => scenes[i].side || 'c');
  let W_ = 1, H_ = 1, asp = 1;
  const pointer = { x: 0, y: 0, sx: 0, sy: 0 };
  const st = { u: 0, intro: still ? 1 : 0, prog: 0, gust: 0, kick: 0, fin: 0, t: 0, transit: 0 };
  const key = i => (asp < .9 ? MOB : SIDE[kinds[Math.max(0, Math.min(N - 1, i))]] || SIDE.c);

  function resize() {
    W_ = canvas.clientWidth || innerWidth; H_ = canvas.clientHeight || innerHeight;
    asp = W_ / H_;
    camera.aspect = asp; camera.fov = asp < .9 ? 34 : 26; camera.updateProjectionMatrix();
    renderer.setSize(W_, H_, false);
  }
  resize();
  addEventListener('resize', resize);

  const tgt = new THREE.Vector3(), cpos = new THREE.Vector3();
  function layout(dt) {
    const k = still ? 1 : 1 - Math.pow(.02, dt);
    st.prog += (st.u - st.prog) * k;
    pointer.sx += (pointer.x - pointer.sx) * (still ? 1 : 1 - Math.pow(.05, dt));
    pointer.sy += (pointer.y - pointer.sy) * (still ? 1 : 1 - Math.pow(.05, dt));
    const u = st.prog, intro = easeIO(clamp(st.intro));
    const LAST = N - 1;

    // ângulos: a capa abre na entrada; a folha k vira entre a cena k e a k+1
    const cov = PI * easeIO(clamp(st.intro * 1.25 - .18));
    const ang = leaves.map((_, k) => k < LAST ? PI * easeIO(clamp((u - (k + .44)) / .5)) : 0);
    const p = clamp(u / LAST);
    const Br = B * (1 - p), Bl = B * p;
    const topR = H + Br, topL = H + Bl;
    blockR.scale.y = Math.max(Br, .0005); blockL.scale.y = Math.max(Bl, .0005);
    blockL.visible = cov > .5 && Bl > .001;

    // capa
    coverG.rotation.z = cov;
    coverG.position.y = mix(topR + N * E + E, H, cov / PI);

    // folhas
    let turning = 0;
    leaves.forEach((m, k) => {
      const U = m.material.uniforms;
      U.uA.value = ang[k];
      U.uY0.value = topR + (N - 1 - k) * E + E;
      U.uY1.value = topL + k * E + E * 2;
      turning = Math.max(turning, Math.sin(ang[k]));
    });
    st.transit = turning;

    // final: o vento leva as folhas, uma depois da outra
    st.fin = clamp((u - (LAST + .08)) / .48);
    leaves.forEach((m, k) => { m.material.uniforms.uFly.value = still && st.fin === 0 ? 0 : easeIO(clamp(st.fin * 1.9 - (N - 1 - k) * .13)); });
    tableU.uLift.value = st.fin;

    // figuras: sobem quando a página termina de abrir, deitam antes de a folha passar
    figs.forEach((f, s) => {
      if (!f) return;
      const prev = s === 0 ? cov : ang[s - 1];
      const next = s < LAST ? ang[s] : 0;
      const up = clamp((prev - PI * .72) / (PI * .28));
      const down = 1 - clamp(next / (PI * .3));
      let r = Math.min(easeBack(up), easeOut(down));
      if (s === LAST) r = Math.min(easeBack(up), 1);
      const y = Math.max(s === 0 ? H + .001 : topL, topR) + N * E + E * 3;
      f.pivot.position.y = y;
      const wob = Math.sin(st.t * 1.7 + s) * .012 * r;
      f.pivot.rotation.x = -(PI / 2 - .015) * (1 - r) + wob;
      f.pivot.visible = r > .002 && (prev > PI * .5);
      f.sh.visible = f.pivot.visible;
      f.sh.position.set(f.pivot.position.x, y + .0006, f.pivot.position.z);
      f.sh.scale.z = Math.max(.01, Math.sin(clamp(r) * PI / 2));
      f.shm.uniforms.uO.value = .5 * clamp(r) * (1 - st.fin);
      if (s === LAST && st.fin > 0) {
        const fl = easeIO(clamp(st.fin * 1.6));
        f.pivot.position.y += fl * 2.6; f.pivot.position.x += fl * 1.2; f.pivot.rotation.z = -fl * .9; f.pivot.rotation.y = fl * 1.4;
        f.mat.uniforms.uO.value = 1 - clamp(st.fin * 1.4 - .4);
      }
    });

    // vento: papéis soltos levantam quando uma folha vira ou a rolagem dá um puxão
    st.kick *= Math.pow(.25, dt);
    const gTarget = clamp(turning * 1.1 + st.kick + st.fin * 1.4 + (st.intro < 1 ? Math.sin(cov) * .6 : 0));
    st.gust += (gTarget - st.gust) * (still ? 1 : 1 - Math.pow(.15, dt));
    SH.forEach((s, i) => {
      const tau = (st.t * .16 * s.sp + s.ph) % 1;
      const vis = clamp(st.gust * 1.7 - s.r) * Math.sin(tau * PI);
      dummy.position.set(-2.9 + tau * 6.6, .12 + s.y + tau * (1.3 + st.fin * 2) + Math.sin(tau * 9 + s.sx) * .16, s.z + Math.sin(tau * 5 + s.sx) * .35);
      dummy.rotation.set(tau * 7 * s.sp + s.sx, tau * 5 + s.sx, Math.sin(tau * 11 + s.sx) * 1.3);
      dummy.scale.setScalar(vis > .01 ? vis : 0);
      dummy.updateMatrix(); sheets.setMatrixAt(i, dummy.matrix);
    });
    sheets.instanceMatrix.needsUpdate = true;

    // sombra na mesa acompanha o livro aberto ou fechado
    const open = cov / PI;
    tableU.uRect.value.set(mix(W / 2 + M / 2, 0, open), 0, mix(W / 2 + M / 2, W + M, open), D / 2 + M);

    // câmera
    const i0 = Math.floor(clamp(u, 0, LAST)), i1 = Math.min(LAST, i0 + 1), fr = easeIO(clamp(u - i0));
    const a = key(i0), b = key(i1);
    let sx = mix(a.sx, b.sx, fr), sy = mix(a.sy, b.sy, fr), size = mix(a.size, b.size, fr), el = mix(a.el, b.el, fr);
    // a folha que passa chega um pouco mais perto
    size *= 1 + turning * .04;
    // entrada: de cima, sobre o livro fechado, que depois abre
    const cx = mix((W + M) / 2, 0, open);           // o centro do que está sobre a mesa
    const half = mix((W + M) / 2, W + M, open) + .06;
    size = mix(asp < .9 ? .62 : .3, size, intro) * (half / (W + M + .06));
    el = mix(1.2, el, intro);
    // final: sobe e se afasta, o branco toma tudo
    const fin = easeIO(st.fin);
    el += fin * .3; size *= 1 - fin * .3;
    const tanH = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * asp;
    let dist = half / (tanH * Math.max(.05, size));
    // no celular, o livro também precisa caber na altura de cima
    tgt.set(cx + pointer.sx * .05, 0, -pointer.sy * .04);
    const yaw = pointer.sx * .06, pitch = el + pointer.sy * .035;
    cpos.set(tgt.x + Math.sin(yaw) * Math.cos(pitch) * dist, Math.sin(pitch) * dist, tgt.z + Math.cos(yaw) * Math.cos(pitch) * dist);
    camera.position.copy(cpos); camera.lookAt(tgt);
    camera.setViewOffset(W_, H_, -sx * W_, sy * H_, W_, H_);

    // névoa: depende da distância; no final engole tudo
    const fn = dist * mix(1.15, .2, fin), ff = dist * mix(2.6, .75, fin);
    fogU.uFogN.value = fn; fogU.uFogF.value = ff;
    scene.fog.near = fn; scene.fog.far = ff;
    fogC.copy(FOG).lerp(PAPER, fin);
    scene.fog.color.copy(fogC); renderer.setClearColor(fogC);
  }

  let raf = 0, last = performance.now(), running = false, visible = true;
  function frame(now) {
    raf = requestAnimationFrame(frame);
    if (!visible) { last = now; return; }
    const dt = Math.min(.05, (now - last) / 1000); last = now;
    st.t += dt; fogU.uTime.value = st.t;
    layout(dt);
    renderer.render(scene, camera);
  }
  const io = new IntersectionObserver(es => { visible = es[0].isIntersecting; }, { threshold: 0 });
  io.observe(canvas);

  await renderer.compileAsync(scene, camera);
  onProgress(1);
  layout(1); renderer.render(scene, camera);

  return {
    start() { if (running) return; running = true; last = performance.now(); raf = requestAnimationFrame(frame); },
    pause() { cancelAnimationFrame(raf); running = false; },
    set(o) {
      if ('u' in o) st.u = o.u;
      if ('intro' in o) st.intro = o.intro;
      if (still) { layout(1); renderer.render(scene, camera); }
    },
    settle() { st.prog = st.u; layout(1); renderer.render(scene, camera); },
    pointer(x, y) { pointer.x = x; pointer.y = y; },
    kick(dy) { st.kick = clamp(st.kick + Math.abs(dy) * .0012, 0, .8); },
    get progress() { return st.prog; },
    get stats() { return { heat: 0, transit: st.transit, fin: st.fin, scene: Math.min(N - 1, Math.round(st.prog)) }; },
    destroy() { cancelAnimationFrame(raf); io.disconnect(); renderer.dispose(); },
  };
}
