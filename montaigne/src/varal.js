/*
  O varal do Montaigne.
  Um fio atravessa a névoa clara. Em cada capítulo há uma pintura impressa numa folha de papel, presa
  por dois prendedores de madeira. O vento mexe as folhas; quando o capítulo acaba, os prendedores
  saltam e a folha é solta: o vento a leva para cima e para longe enquanto a câmera segue para a próxima.
  No fim, a última folha também vai e a névoa fica branca.

  Tudo é função da rolagem (u) e do tempo: voltar a rolagem devolve as folhas ao fio, sem estado escondido.

  API (a mesma que main.js usava com o livro):
    set({ u, intro })  settle()  pointer(x, y)  kick(dy)  start()  pause()  progress  stats
*/
import * as THREE from 'three';

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const mix = (a, b, t) => a + (b - a) * t;
const easeIO = x => (x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const easeOut = x => 1 - Math.pow(1 - x, 3);
const easeBack = x => { const c = 1.5; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };
const PI = Math.PI;

const SP = 3.4;          // distância entre as folhas no fio
const PW = 1.7, PH = 1.36; // tamanho de cada folha
const LY = 1;            // altura do fio

const SHEET_VS = /* glsl */`
uniform float uTime, uAmp, uRel, uSeed;
varying vec2 vUv; varying vec3 vW;
void main(){
  vUv = uv;
  vec3 p = position;
  float a = 1. - uv.y;                       // 0 no fio, 1 na barra de baixo
  float t = uTime + uSeed * 7.;
  float w = sin(p.x * 2.1 + t * 2.2 + p.y * 1.4) * .6 + sin(p.x * 4.7 - t * 3.3 + p.y * 2.) * .3 + sin(t * .9 + uSeed) * .4;
  p.z += uAmp * a * a * w;
  // solta: a folha enrola um pouco pelas pontas
  p.z += uRel * (sin(uv.x * 3.14159) - .5) * .35 * (.5 + a);
  p.y += uAmp * .3 * a * sin(t * 1.7 + p.x);
  vec4 wp = modelMatrix * vec4(p, 1.);
  vW = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;
const SHEET_FS = /* glsl */`
uniform sampler2D uMap; uniform vec3 uFog, uPaper, uSun; uniform float uFogN, uFogF;
varying vec2 vUv; varying vec3 vW;
void main(){
  vec4 c = texture2D(uMap, vUv);
  if (c.a < .5) discard;
  vec3 n = normalize(cross(dFdx(vW), dFdy(vW)));
  if (!gl_FrontFacing) n = -n;
  vec3 col = gl_FrontFacing ? c.rgb : uPaper * .93;
  float l = .78 + .3 * abs(dot(n, uSun));
  col *= l;
  float d = distance(vW, cameraPosition);
  col = mix(col, uFog, smoothstep(uFogN, uFogF, d));
  gl_FragColor = vec4(col, 1.);
  #include <colorspace_fragment>
}`;

const SKY_FS = /* glsl */`
uniform vec3 uTop, uLow; uniform float uTime, uFin; uniform vec2 uOff;
varying vec2 vUv;
float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f); return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + 1.), f.x), f.y); }
void main(){
  vec2 q = vUv + uOff;
  vec3 col = mix(uLow, uTop, smoothstep(.0, 1., vUv.y));
  float c = n(q * vec2(2.2, 4.) + vec2(uTime * .02, 0.)) * .6 + n(q * vec2(5., 9.) - vec2(uTime * .035, 0.)) * .4;
  col += (c - .5) * .035;
  // uma faixa de sol baixo, de leve
  col += vec3(.05, .035, .01) * exp(-pow((vUv.y - .38) * 5., 2.));
  col = mix(col, vec3(.937, .922, .886), uFin);
  gl_FragColor = vec4(col, 1.);
  #include <colorspace_fragment>
}`;

function loadImg(src) {
  return new Promise((res, rej) => { const i = new Image(); i.decoding = 'async'; i.onload = () => res(i); i.onerror = rej; i.src = src; });
}
function cover(g, img, x, y, w, h, fx = .5, fy = .5) {
  const r = Math.max(w / img.width, h / img.height);
  const sw = w / r, sh = h / r;
  g.drawImage(img, (img.width - sw) * fx, (img.height - sh) * fy, sw, sh, x, y, w, h);
}
// borda de papel rasgado à mão
function deckle(g, x, y, w, h, j) {
  g.beginPath();
  const pts = [];
  const side = (ax, ay, bx, by) => { const n = Math.max(8, Math.round(Math.hypot(bx - ax, by - ay) / 6)); for (let i = 0; i < n; i++) { const t = i / n; pts.push([ax + (bx - ax) * t + (Math.random() - .5) * j, ay + (by - ay) * t + (Math.random() - .5) * j]); } };
  side(x, y, x + w, y); side(x + w, y, x + w, y + h); side(x + w, y + h, x, y + h); side(x, y + h, x, y);
  pts.forEach(([a, b], i) => (i ? g.lineTo(a, b) : g.moveTo(a, b)));
  g.closePath();
}

export async function createVaral({ canvas, tier = 'high', still = false, scenes, labels = [], dir = 'montaigne/img/', asset = u => u, onProgress = () => {} }) {
  const low = tier === 'low';
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !low, alpha: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, low ? 1.25 : 1.75));
  const FOG = new THREE.Color(0xe2dfd6), PAPER = new THREE.Color(0xefebe2);
  renderer.setClearColor(FOG);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(26, 1, .05, 80);
  scene.add(new THREE.HemisphereLight(0xfffaf0, 0xcfc8b8, 2.2));
  const sun = new THREE.DirectionalLight(0xfff1dc, 1.4); sun.position.set(-2, 4, 3); scene.add(sun);
  const SUN = new THREE.Vector3(-.4, .6, .7).normalize();
  const fogC = FOG.clone();
  const U = { uFog: { value: fogC }, uPaper: { value: PAPER }, uSun: { value: SUN }, uFogN: { value: 6 }, uFogF: { value: 16 }, uTime: { value: 0 } };

  // ---------- imagens ----------
  const N = scenes.length, LAST = N - 1;
  const imgs = [];
  let done = 0;
  await Promise.all(scenes.map(async (s, i) => { imgs[i] = await loadImg(asset(dir + 'paint/' + s.bg + '.jpg')); onProgress(++done / (N + 1)); }));
  const maxA = renderer.capabilities.getMaxAnisotropy();
  const serif = '"EB Garamond", Garamond, Georgia, serif', sans = '"Instrument Sans", "Helvetica Neue", Arial, sans-serif';

  // ---------- céu: um plano grande que acompanha a câmera ----------
  const skyU = { uTop: { value: new THREE.Color(0xe9e6de) }, uLow: { value: new THREE.Color(0xd6d0c3) }, uTime: U.uTime, uFin: { value: 0 }, uOff: { value: new THREE.Vector2() } };
  const sky = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.ShaderMaterial({
    uniforms: skyU, depthWrite: false, depthTest: false,
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy * 2., 1., 1.); }`,
    fragmentShader: SKY_FS,
  }));
  sky.frustumCulled = false; sky.renderOrder = -10; scene.add(sky);

  // ---------- o fio ----------
  const X0 = -6, X1 = LAST * SP + 9;
  const lineY = x => {
    // reto entre os prendedores de cada folha, com barriga entre uma folha e outra
    const k = (x + SP / 2) / SP, f = k - Math.floor(k);
    const local = Math.abs(f - .5) * SP;       // distância ao centro da folha mais perto
    if (local < PW * .42) return LY;
    const span = SP - PW * .84, s = (local - PW * .42) / span; // 0..0.5 até o meio do vão
    return LY - Math.sin(clamp(s, 0, .5) * PI) * .16;
  };
  const pts = [];
  for (let x = X0; x <= X1; x += .05) pts.push(new THREE.Vector3(x, lineY(x), 0));
  const line = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), pts.length, .0055, 5, false), new THREE.MeshLambertMaterial({ color: 0x8b7d6a }));
  scene.add(line);

  // ---------- folhas ----------
  const TW = low ? 768 : 1280, TH = Math.round(TW * PH / PW);
  const sheets = scenes.map((s, i) => {
    const c = document.createElement('canvas'); c.width = TW; c.height = TH;
    const g = c.getContext('2d');
    deckle(g, 4, 4, TW - 8, TH - 8, 5);
    const pg = g.createLinearGradient(0, 0, 0, TH); pg.addColorStop(0, '#f5f1e8'); pg.addColorStop(1, '#ebe5d8');
    g.fillStyle = pg; g.fill();
    const m = TW * .055, capH = TH * .13;
    const px = m, py = m, pw = TW - 2 * m, ph = TH - m - capH - m * .3;
    g.save(); deckle(g, px, py, pw, ph, 2); g.clip();
    cover(g, imgs[i], px, py, pw, ph, .5, .42);
    // impressão em papel: um pouco de cor do papel por cima
    g.globalCompositeOperation = 'multiply'; g.fillStyle = 'rgba(244,236,220,.35)'; g.fillRect(px, py, pw, ph);
    g.restore();
    // legenda
    const lab = (labels[i] || '').split('—');
    g.textBaseline = 'middle';
    g.fillStyle = '#b0391f'; g.font = `italic 400 ${Math.round(capH * .42)}px ${serif}`; g.textAlign = 'left';
    g.fillText(i === 0 ? 'Quanto mais segura' : (lab[1] || '').trim(), px, TH - capH * .62);
    g.fillStyle = 'rgba(31,35,42,.65)'; g.font = `600 ${Math.round(capH * .17)}px ${sans}`; g.textAlign = 'right';
    if ('letterSpacing' in g) g.letterSpacing = `${Math.round(capH * .05)}px`;
    g.fillText(i === 0 ? 'MONTAIGNE · ENSAIOS' : ('CAPÍTULO ' + (lab[0] || '').trim()), px + pw, TH - capH * .6);
    // grão
    const d = g.getImageData(0, 0, TW, TH), a = d.data;
    for (let k = 0; k < a.length; k += 4) { const v = (Math.random() - .5) * 14; a[k] += v; a[k + 1] += v; a[k + 2] += v; }
    g.putImageData(d, 0, 0);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = Math.min(8, maxA);
    const mat = new THREE.ShaderMaterial({ vertexShader: SHEET_VS, fragmentShader: SHEET_FS, side: THREE.DoubleSide,
      uniforms: { ...U, uMap: { value: t }, uAmp: { value: .05 }, uRel: { value: 0 }, uSeed: { value: i * 1.7 } } });
    // a folha pende do fio: o topo fica em y = 0 do grupo
    const geo = new THREE.PlaneGeometry(PW, PH, low ? 18 : 28, low ? 14 : 22).translate(0, -PH / 2, 0);
    const mesh = new THREE.Mesh(geo, mat);
    const grp = new THREE.Group(); grp.add(mesh); scene.add(grp);
    const pegs = [-1, 1].map(sd => {
      const p = new THREE.Group();
      const wood = new THREE.MeshLambertMaterial({ color: 0xb08a5e });
      const a = new THREE.Mesh(new THREE.BoxGeometry(.045, .17, .02), wood); a.position.z = .013;
      const b = new THREE.Mesh(new THREE.BoxGeometry(.045, .17, .02), wood); b.position.z = -.013;
      const spring = new THREE.Mesh(new THREE.TorusGeometry(.016, .004, 4, 10), new THREE.MeshLambertMaterial({ color: 0x9aa0a6 })); spring.rotation.y = PI / 2; spring.position.y = .01;
      p.add(a, b, spring); scene.add(p);
      return { g: p, sd };
    });
    return { grp, mat, pegs, x: i * SP, seed: Math.random() };
  });

  // ---------- papéis soltos no vento ----------
  const NS = low ? 22 : 44;
  const scrapC = document.createElement('canvas'); scrapC.width = 64; scrapC.height = 80;
  { const g = scrapC.getContext('2d'); deckle(g, 3, 3, 58, 74, 4); g.fillStyle = '#f2eee5'; g.fill(); g.strokeStyle = 'rgba(31,35,42,.25)'; g.lineWidth = 1; for (let y = 16; y < 70; y += 7) { g.beginPath(); g.moveTo(10, y); g.lineTo(54 - (y % 3) * 6, y); g.stroke(); } }
  const scrapT = new THREE.CanvasTexture(scrapC); scrapT.colorSpace = THREE.SRGBColorSpace;
  const scraps = new THREE.InstancedMesh(new THREE.PlaneGeometry(.09, .115), new THREE.MeshLambertMaterial({ map: scrapT, side: THREE.DoubleSide, alphaTest: .5 }), NS);
  scraps.frustumCulled = false; scene.add(scraps);
  const SC = Array.from({ length: NS }, () => ({ ph: Math.random(), sp: .5 + Math.random() * .9, y: -1.2 + Math.random() * 3, z: -2.5 + Math.random() * 3.4, r: Math.random(), sx: Math.random() * 6 }));
  const dummy = new THREE.Object3D();

  // ---------- enquadramento ----------
  // sx/sy deslocam a folha na tela (fração da largura/altura), size = quanto da largura a folha ocupa
  const SIDE = {
    hero: { sx: .23, sy: .13, size: .36, yaw: -.16 },
    l: { sx: .24, sy: .02, size: .4, yaw: -.2 },
    r: { sx: -.24, sy: .02, size: .4, yaw: .2 },
    c: { sx: 0, sy: -.2, size: .36, yaw: 0 },
  };
  const MOB = { sx: 0, sy: .2, size: .84, yaw: 0 };
  const kinds = scenes.map(s => s.side || 'c');
  let W_ = 1, H_ = 1, asp = 1;
  const key = i => (asp < .9 ? MOB : SIDE[kinds[clamp(i, 0, LAST)]] || SIDE.c);
  function resize() {
    W_ = canvas.clientWidth || innerWidth; H_ = canvas.clientHeight || innerHeight;
    asp = W_ / H_;
    camera.aspect = asp; camera.fov = asp < .9 ? 34 : 26; camera.updateProjectionMatrix();
    renderer.setSize(W_, H_, false);
  }
  resize();
  addEventListener('resize', resize);

  const st = { u: 0, prog: 0, intro: still ? 1 : 0, kick: 0, gust: 0, t: 0, fin: 0, transit: 0 };
  const pointer = { x: 0, y: 0, sx: 0, sy: 0 };
  const tgt = new THREE.Vector3(), cpos = new THREE.Vector3();

  // quanto a folha i já foi solta (0 presa, 1 longe)
  const rel = (i, u) => i === LAST ? clamp((u - (LAST + .22)) / .5) : clamp((u - (i + .32)) / .62);

  function layout(dt) {
    const k = still ? 1 : 1 - Math.pow(.02, dt);
    st.prog += (st.u - st.prog) * k;
    pointer.sx += (pointer.x - pointer.sx) * (still ? 1 : 1 - Math.pow(.05, dt));
    pointer.sy += (pointer.y - pointer.sy) * (still ? 1 : 1 - Math.pow(.05, dt));
    const u = st.prog, intro = easeOut(clamp(st.intro));
    st.kick *= Math.pow(.3, dt);
    st.gust += (clamp(st.kick) - st.gust) * (still ? 1 : 1 - Math.pow(.1, dt));
    st.fin = clamp((u - (LAST + .2)) / .4);
    const t = st.t;

    // folhas
    sheets.forEach((s, i) => {
      const r = rel(i, u), e = r * r;
      // entrada: as folhas descem até o fio, a primeira por último (é a que a gente vê)
      const drop = (1 - easeBack(clamp(st.intro * 1.3 - .25 - (i === 0 ? .15 : 0)))) * 2.6;
      const x = s.x + e * 5.5 + Math.sin(t * .7 + i) * .05 * r;
      const y = LY + drop + e * 3.6 + Math.sin(r * PI) * .25;
      const z = -e * 3;
      s.grp.position.set(x, y, z);
      s.grp.rotation.set(-r * 1.1 + Math.sin(t * .6 + s.seed * 9) * .03, r * (1.6 + s.seed), Math.sin(t * .5 + s.seed * 5) * .012 - r * .7);
      s.mat.uniforms.uAmp.value = .045 + st.gust * .1 + r * .2 + (1 - intro) * .08;
      s.mat.uniforms.uRel.value = Math.sin(r * PI) * (1 - r * .4);
      s.grp.visible = r < .999;
      // prendedores: saltam primeiro e caem
      const pr = clamp(r * 3);
      s.pegs.forEach(p => {
        const px = s.x + p.sd * PW * .36;
        p.g.position.set(px + p.sd * pr * .4, LY + drop * (1 - Math.min(1, r * 20)) + .03 + pr * .35 - pr * pr * 1.6, .01 + pr * .3);
        p.g.rotation.set(pr * 2.2, 0, p.sd * pr * 2.5 + (drop > .001 ? 0 : Math.sin(t * 2 + i) * .02 * (1 - pr)));
        p.g.visible = pr < .999;
      });
    });

    // câmera: segura na folha enquanto o texto é lido, depois anda pelo fio
    const i0 = Math.floor(clamp(u, 0, LAST)), i1 = Math.min(LAST, i0 + 1);
    const fr = easeIO(clamp((u - i0 - .3) / .7));
    st.transit = Math.sin(fr * PI);
    const a = key(i0), b = key(i1);
    const sx = mix(a.sx, b.sx, fr), sy = mix(a.sy, b.sy, fr), yaw0 = mix(a.yaw, b.yaw, fr);
    let size = mix(a.size, b.size, fr) * (1 - st.transit * .18);
    size *= mix(.7, 1, intro);
    const fin = easeIO(st.fin);
    size *= 1 - fin * .4;
    const tanV = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)), tanH = tanV * asp;
    let dist = (PW / 2) / (tanH * size);
    if (asp < .9) dist = Math.max(dist, (PH * .5) / (tanV * .36));
    tgt.set(mix(i0, i1, fr) * SP + pointer.sx * .06, LY - PH * .5 + fin * 1.2, 0);
    const yaw = yaw0 + pointer.sx * .05, pitch = .04 + pointer.sy * .03 + fin * .25;
    cpos.set(tgt.x + Math.sin(yaw) * Math.cos(pitch) * dist, tgt.y + Math.sin(pitch) * dist, Math.cos(yaw) * Math.cos(pitch) * dist);
    camera.position.copy(cpos); camera.lookAt(tgt);
    camera.setViewOffset(W_, H_, -sx * W_, sy * H_, W_, H_);
    skyU.uOff.value.set(tgt.x * .02, 0); skyU.uFin.value = fin;

    // névoa: as folhas vizinhas somem; no fim, tudo vira papel
    U.uFogN.value = dist * mix(1.05, .3, fin); U.uFogF.value = dist * mix(2.4, .9, fin);
    fogC.copy(FOG).lerp(PAPER, fin);
    renderer.setClearColor(fogC);

    // papéis soltos: atravessam a cena da esquerda para a direita, mais quando a rolagem puxa
    const vis0 = clamp(.25 + st.gust * 1.5 + st.transit * .6 + fin);
    SC.forEach((s, i) => {
      const tau = (t * .07 * s.sp + s.ph) % 1;
      const vis = clamp(vis0 * 1.6 - s.r) * Math.sin(tau * PI);
      dummy.position.set(tgt.x - 4.5 + tau * 9, tgt.y + s.y + tau * 1.2 + Math.sin(tau * 8 + s.sx) * .18, s.z + Math.sin(tau * 5 + s.sx) * .3);
      dummy.rotation.set(tau * 8 * s.sp + s.sx, tau * 6 + s.sx, Math.sin(tau * 11 + s.sx) * 1.2);
      dummy.scale.setScalar(vis > .01 ? vis : 0);
      dummy.updateMatrix(); scraps.setMatrixAt(i, dummy.matrix);
    });
    scraps.instanceMatrix.needsUpdate = true;
  }

  let raf = 0, last = performance.now(), running = false, visible = true;
  const io = new IntersectionObserver(es => { visible = es[0].isIntersecting; });
  io.observe(canvas);
  function frame(now) {
    raf = requestAnimationFrame(frame);
    if (!visible || document.hidden) { last = now; return; }
    const dt = Math.min(.05, (now - last) / 1000); last = now;
    st.t += dt; U.uTime.value = st.t;
    layout(dt);
    renderer.render(scene, camera);
  }
  onProgress(1);
  await renderer.compileAsync(scene, camera);
  layout(1); renderer.render(scene, camera);

  return {
    start() { if (running) return; running = true; last = performance.now(); raf = requestAnimationFrame(frame); },
    pause() { cancelAnimationFrame(raf); running = false; },
    set(o) {
      if ('u' in o) st.u = o.u;
      if ('intro' in o) st.intro = o.intro;
      if (still) { st.prog = st.u; layout(1); renderer.render(scene, camera); }
    },
    settle() { st.prog = st.u; layout(1); renderer.render(scene, camera); },
    pointer(x, y) { pointer.x = x; pointer.y = y; },
    kick(dy) { st.kick = clamp(st.kick + Math.abs(dy) * .0012, 0, .8); },
    get progress() { return st.prog; },
    get stats() { return { heat: 0, transit: st.transit, fin: st.fin, scene: Math.min(LAST, Math.round(st.prog)) }; },
    destroy() { cancelAnimationFrame(raf); io.disconnect(); renderer.dispose(); },
  };
}
