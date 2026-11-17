// Atração principal: o rosto do paradoxo.
// Três retratos do vídeo (Míchkin, Nastássia, Rogójin) feitos de dezenas de milhares
// de partículas com relevo. A rolagem faz cada rosto explodir em brasa e se refazer
// no seguinte, até virar a palavra "idiota", que pega fogo e sobe como cinza.
import * as THREE from 'three';

const FACES = ['p01-retrato', 'p05-nastassia', 'p03-trem'];

function loadImg(src) {
  return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
}

// amostra N pontos de uma imagem (alfa > 0) → posições com relevo + cores
function sample(img, N, height, { word = false } = {}) {
  const H = word ? 260 : 240;
  const W = Math.round(H * img.width / img.height);
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.drawImage(img, 0, 0, W, H);
  const d = g.getImageData(0, 0, W, H).data;
  const ok = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const a = d[(y * W + x) * 4 + 3];
    if (a > 140) ok.push(y * W + x);
  }
  const pos = new Float32Array(N * 3), col = new Float32Array(N * 3);
  const s = height / H;
  for (let i = 0; i < N; i++) {
    const k = ok[(Math.random() * ok.length) | 0];
    const x = k % W, y = (k / W) | 0, o = k * 4;
    const r = d[o] / 255, gg = d[o + 1] / 255, b = d[o + 2] / 255;
    const lum = r * .3 + gg * .59 + b * .11;
    pos[i * 3] = (x + Math.random() - W / 2) * s;
    pos[i * 3 + 1] = (H / 2 - y - Math.random()) * s;
    pos[i * 3 + 2] = word ? (Math.random() - .5) * .6 : (lum - .35) * 2.2 + (Math.random() - .5) * .25;
    // um pouco mais de luz nos retratos para lerem bem como pontos
    const lift = word ? 1 : 1.38;
    col[i * 3] = Math.min(1, r * lift); col[i * 3 + 1] = Math.min(1, gg * lift); col[i * 3 + 2] = Math.min(1, b * lift);
  }
  return { pos, col };
}

function wordImage() {
  const c = document.createElement('canvas'); c.width = 1400; c.height = 420;
  const g = c.getContext('2d');
  const grd = g.createLinearGradient(0, 0, 1400, 0);
  grd.addColorStop(0, '#f1e8d8'); grd.addColorStop(.5, '#e9c88a'); grd.addColorStop(1, '#f1e8d8');
  g.fillStyle = grd; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = 'italic 400 330px "Bodoni Moda", Georgia, serif';
  g.fillText('idiota', 700, 200);
  return c;
}

export async function createCore({ canvas, tier = 'high', still = false, asset = u => u }) {
  const HIGH = tier === 'high';
  const N = HIGH ? 38000 : 15000;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: true, preserveDrawingBuffer: still, powerPreference: 'high-performance' });
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  renderer.setPixelRatio(HIGH ? Math.min(devicePixelRatio || 1, 2) : Math.min(devicePixelRatio || 1, 1.5));
  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 1, .1, 200);

  const imgs = await Promise.all(FACES.map(k => loadImg(asset('img/cut/' + k + '.webp'))));
  const faces = imgs.map(im => sample(im, N, 11.5));
  const word = sample(wordImage(), N, 4.4, { word: true });

  // alvos: 0 nuvem → 1 Míchkin → 2 Nastássia → 3 Rogójin → 4 "idiota" → 5 cinzas subindo
  const cloud = new Float32Array(N * 3), ash = new Float32Array(N * 3), rnd = new Float32Array(N * 4);
  for (let i = 0; i < N; i++) {
    const u = Math.random() * 6.283, v = Math.acos(Math.random() * 2 - 1), r = 9 + Math.random() * 14;
    cloud.set([Math.sin(v) * Math.cos(u) * r, Math.cos(v) * r * .6 - 4, Math.sin(v) * Math.sin(u) * r - 6], i * 3);
    const wx = word.pos[i * 3], wy = word.pos[i * 3 + 1];
    ash.set([wx * 1.4 + (Math.random() - .5) * 8, wy + 9 + Math.random() * 16, (Math.random() - .5) * 10 + 3], i * 3);
    rnd.set([Math.random(), Math.random(), Math.random(), Math.random()], i * 4);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(cloud, 3));
  geo.setAttribute('aP1', new THREE.BufferAttribute(faces[0].pos, 3));
  geo.setAttribute('aP2', new THREE.BufferAttribute(faces[1].pos, 3));
  geo.setAttribute('aP3', new THREE.BufferAttribute(faces[2].pos, 3));
  geo.setAttribute('aP4', new THREE.BufferAttribute(word.pos, 3));
  geo.setAttribute('aP5', new THREE.BufferAttribute(ash, 3));
  geo.setAttribute('aC1', new THREE.BufferAttribute(faces[0].col, 3));
  geo.setAttribute('aC2', new THREE.BufferAttribute(faces[1].col, 3));
  geo.setAttribute('aC3', new THREE.BufferAttribute(faces[2].col, 3));
  geo.setAttribute('aC4', new THREE.BufferAttribute(word.col, 3));
  geo.setAttribute('aR', new THREE.BufferAttribute(rnd, 4));

  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: {
      uSeg: { value: 0 }, uT: { value: 0 }, uTime: { value: 0 }, uPx: { value: renderer.getPixelRatio() },
      uMouse: { value: new THREE.Vector3(99, 99, 0) }, uPush: { value: 0 }, uSize: { value: HIGH ? 1.2 : 1.7 }, uH: { value: 800 },
    },
    vertexShader: /* glsl */`
      attribute vec3 aP1, aP2, aP3, aP4, aP5, aC1, aC2, aC3, aC4; attribute vec4 aR;
      uniform float uSeg, uT, uTime, uPx, uPush, uSize, uH; uniform vec3 uMouse;
      varying vec3 vCol; varying float vA, vHot;
      vec3 P(float i){ if (i < .5) return position; if (i < 1.5) return aP1; if (i < 2.5) return aP2; if (i < 3.5) return aP3; if (i < 4.5) return aP4; return aP5; }
      vec3 C(float i){ vec3 em = vec3(1., .45, .12);
        if (i < .5) return em * .9; if (i < 1.5) return aC1; if (i < 2.5) return aC2; if (i < 3.5) return aC3; if (i < 4.5) return aC4; return vec3(1., .5, .15); }
      void main(){
        float lt = clamp((uT - aR.x * .38) / .62, 0., 1.);
        float e = lt * lt * (3. - 2. * lt);
        vec3 a = P(uSeg), b = P(uSeg + 1.);
        vec3 p = mix(a, b, e);
        float mid = sin(lt * 3.14159);
        // no meio da troca: redemoinho de brasa e calor subindo
        float ang = aR.y * 6.283 + uTime * (1. + aR.z);
        p += vec3(cos(ang), sin(ang * 1.3) * .6 + 1.2, sin(ang)) * mid * (2. + aR.z * 6.);
        p.y += mid * mid * aR.w * 3.;
        // respiração
        p += vec3(sin(uTime * .9 + aR.x * 40.), cos(uTime * .7 + aR.y * 30.), sin(uTime * .5 + aR.z * 20.)) * .035;
        // mouse empurra os pontos
        vec3 d = p - uMouse; float r = length(d.xy);
        float f = (1. - smoothstep(0., 2.6, r)) * uPush;
        p += normalize(vec3(d.xy, .6) + 1e-4) * f * (1.4 + aR.z);
        vec3 ca = C(uSeg), cb = C(uSeg + 1.);
        vCol = mix(mix(ca, cb, e), vec3(1., .5, .16) * (.6 + aR.w * .7), mid * .6 + f * .5);
        vHot = mid;
        vA = uSeg > 4.5 ? 1. : 1.;
        if (uSeg > 3.5) { vA = 1. - smoothstep(.55, 1., lt) * (.4 + aR.w * .6); vCol = mix(vCol, vec3(1., .42, .1), e); }
        vec4 mv = modelViewMatrix * vec4(p, 1.);
        gl_PointSize = clamp(uSize * (1. + mid * .7) * (.75 + aR.w * .6) * uPx * uH * .00275 * 22. / -mv.z, 1., 18.);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */`
      varying vec3 vCol; varying float vA, vHot;
      void main(){
        vec2 q = gl_PointCoord - .5; float r = dot(q, q);
        if (r > .25) discard;
        float a = smoothstep(.25, .05, r);
        gl_FragColor = vec4(vCol * (1. + vHot * .35), a * vA * (1. - vHot * .35));
      }`,
  });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  scene.add(pts);

  const state = { p: 0, mx: 0, my: 0 }, cur = { p: 0, mx: 0, my: 0 };
  let mobile = false;
  function resize() {
    const w = canvas.clientWidth || innerWidth, h = canvas.clientHeight || innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    mobile = w / h < .85;
    camera.fov = mobile ? 52 : 34;
    camera.updateProjectionMatrix();
    mat.uniforms.uH.value = h;
  }
  resize();

  // linha do tempo: [início, fim] de cada troca, e o segmento correspondente
  const SEG = [[0, .08], [.2, .32], [.44, .56], [.68, .78], [.86, 1]];
  const ray = new THREE.Raycaster(), plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), hit = new THREE.Vector3();
  let time = 0, push = 0;
  function frame(dt, snap = false) {
    time += dt;
    const k = snap ? 1 : 1 - Math.pow(.002, dt);
    cur.p += (state.p - cur.p) * k;
    cur.mx += (state.mx - cur.mx) * (snap ? 1 : k * .6);
    cur.my += (state.my - cur.my) * (snap ? 1 : k * .6);
    let seg = 0, t = 0;
    for (let i = SEG.length - 1; i >= 0; i--) if (cur.p >= SEG[i][0]) { seg = i; t = Math.min(1, (cur.p - SEG[i][0]) / (SEG[i][1] - SEG[i][0])); break; }
    const u = mat.uniforms;
    u.uSeg.value = seg; u.uT.value = t; u.uTime.value = time;
    // câmera orbita devagar e segue o mouse: o relevo dos rostos aparece
    const orbit = Math.sin(time * .18) * .22 + cur.mx * .38;
    const dist = (mobile ? 30 : 22) - Math.sin(t * Math.PI) * 2.5;
    camera.position.set(Math.sin(orbit) * dist, cur.my * 2.2 + (mobile ? 1.5 : 0), Math.cos(orbit) * dist);
    camera.lookAt(mobile ? 0 : -2.2, mobile ? 1.5 : 0, 0);
    // mouse → ponto no plano z=0
    ray.setFromCamera({ x: cur.mx, y: cur.my }, camera);
    if (ray.ray.intersectPlane(plane, hit)) u.uMouse.value.copy(hit);
    push += ((state.active ? 1 : 0) - push) * Math.min(1, dt * 4);
    u.uPush.value = push;
    renderer.render(scene, camera);
    return { seg, t };
  }

  let raf = 0, running = false, last = 0, visible = false;
  function loop(now) {
    raf = requestAnimationFrame(loop);
    const dt = Math.min(.1, (now - last) / 1000); last = now;
    frame(dt);
  }
  function start() { if (running || still) return; running = true; last = performance.now(); raf = requestAnimationFrame(loop); }
  function stop() { running = false; cancelAnimationFrame(raf); }
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; visible && !document.hidden ? start() : stop(); }).observe(canvas);
  document.addEventListener('visibilitychange', () => (document.hidden || !visible ? stop() : start()));
  addEventListener('resize', resize);
  frame(0, true);

  return {
    set(o) { Object.assign(state, o); },
    settle() { frame(0, true); frame(0, true); },
    get segment() { return SEG; },
  };
}
