// Atração principal do desapego: "Segure".
// Uma pintura presa numa tela de linho. Enquanto você segura (mouse, dedo ou espaço),
// a tela amassa como papel: dobras, sombra, cor que some. Quando você solta, ela se abre
// de novo com mola, e a imagem que estava presa se desfaz em lascas que o vento leva,
// revelando outra pintura, mais aberta. O paradoxo do vídeo em um gesto.
import * as THREE from 'three';

const W = 12, H = 7.5; // pinturas do vídeo são 16:9 recortadas; aqui 1.6:1
const SEQ = ['m05-punho', 'm16-bracos', 'm04-barba', 'm09-horizonte', 'm01-pano', 'm15-praia'];

const vert = /* glsl */`
  uniform float uGrip, uTime, uSeed;
  varying vec2 vUv; varying vec3 vN; varying float vH, vCrease;
  float hash(float n){ return fract(sin(n) * 43758.5453); }
  // papel amassado: soma de dobras retas em direções aleatórias + rugas finas
  float folds(vec2 p){
    float h = 0.;
    for (int k = 0; k < 11; k++) {
      float fk = float(k) + uSeed * 13.;
      vec2 c = vec2(hash(fk * 1.7) - .5, hash(fk * 2.3) - .5) * vec2(${W.toFixed(1)}, ${H.toFixed(1)}) * .8;
      float a = hash(fk * 3.1) * 6.2832;
      vec2 n = vec2(cos(a), sin(a));
      h += abs(dot(p - c, n)) * (.08 + hash(fk * 5.7) * .16) * (k < 4 ? 1. : .55);
    }
    h += sin(p.x * 3.1 + p.y * 1.7 + uSeed * 9.) * sin(p.y * 2.7 - p.x * .9) * .12;
    return h;
  }
  void main(){
    vUv = uv;
    vec2 p = position.xy;
    float g = uGrip;
    float gp = max(g, 0.);
    float e = .03;
    float h0 = folds(p), hx = folds(p + vec2(e, 0.)), hy = folds(p + vec2(0., e));
    float hxx = folds(p - vec2(e, 0.)), hyy = folds(p - vec2(0., e));
    vCrease = clamp(abs(hx + hxx - 2. * h0) / (e * e) * .04 + abs(hy + hyy - 2. * h0) / (e * e) * .04, 0., 1.);
    float H0 = h0 - 1.3;
    // a mão fecha: tudo puxa para o centro, mais forte nas bordas
    float r = length(p / vec2(${(W / 2).toFixed(1)}, ${(H / 2).toFixed(1)}));
    vec2 q = p * (1. - gp * (.38 + .22 * r)) + vec2(sin(p.y * 1.3 + uSeed), cos(p.x * 1.1)) * gp * .35;
    float z = H0 * g * 2.3 + sin(uTime * 1.1 + p.x * .4) * .05 * (1. - gp);
    vec3 pos = vec3(q, z);
    vec3 n = normalize(vec3(-(hx - h0) / e * g * 2.3, -(hy - h0) / e * g * 2.3, 1.));
    vN = normalize(normalMatrix * n);
    vH = H0 * g;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.);
  }`;

const frag = /* glsl */`
  uniform sampler2D tA, tB; uniform vec4 uCropA, uCropB; uniform float uGrip, uMix, uTime, uSeed;
  varying vec2 vUv; varying vec3 vN; varying float vH, vCrease;
  float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.-2.*f);
    return mix(mix(hash(i), hash(i+vec2(1.,0.)), f.x), mix(hash(i+vec2(0.,1.)), hash(i+1.), f.x), f.y); }
  void main(){
    vec3 a = texture2D(tA, uCropA.xy + vUv * uCropA.zw).rgb;
    vec3 b = texture2D(tB, uCropB.xy + vUv * uCropB.zw).rgb;
    // troca: a pintura presa se solta da esquerda para a direita em lascas
    float m = noise(vUv * vec2(5., 3.2) + uSeed * 7.) * .3 + noise(vUv * vec2(22., 14.)) * .08 + (1. - vUv.x) * .62;
    float th = 1.05 - uMix * 1.4;
    float k = smoothstep(th - .1, th + .1, m);
    vec3 col = mix(a, b, k);
    float g = max(uGrip, 0.);
    // segurar tira a cor: o mundo fica cinza quando a gente aperta
    float l = dot(col, vec3(.299, .587, .114));
    col = mix(col, vec3(l) * vec3(1., .97, .92), g * .75);
    // luz rasante: as dobras ganham volume
    vec3 L = normalize(vec3(-.5, .6, .65));
    float d = max(dot(normalize(vN), L), 0.);
    float shade = mix(1., .38 + .9 * d, min(1., g * 1.6));
    col *= shade;
    col *= 1. - vCrease * g * .55;
    vec3 Hh = normalize(L + vec3(0., 0., 1.));
    col += vec3(1., .96, .9) * pow(max(dot(normalize(vN), Hh), 0.), 40.) * g * .35;
    // trama do linho
    vec2 w = vUv * vec2(520., 330.);
    col *= .96 + .04 * sin(w.x) * sin(w.y);
    // vinheta suave na borda da tela
    vec2 e2 = min(vUv, 1. - vUv);
    col *= .82 + .18 * smoothstep(0., .08, min(e2.x * 1.6, e2.y));
    gl_FragColor = vec4(col, 1.);
  }`;

function loadTex(url) {
  return new Promise(res => new THREE.TextureLoader().load(url, t => { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; res(t); }, undefined, () => res(null)));
}

export async function createHold({ canvas, tier = 'high', still = false, asset = u => u, onRelease = () => {} }) {
  const HIGH = tier === 'high';
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: still });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, HIGH ? 2 : 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, .1, 200);

  const texs = await Promise.all(SEQ.map(k => loadTex(asset('montaigne/img/paint/' + k + '.jpg'))));
  const crop = t => { const a = t.image.width / t.image.height, w = Math.min(1, (W / H) / a), h = Math.min(1, a / (W / H)); return new THREE.Vector4((1 - w) / 2, (1 - h) / 2, w, h); };

  const uni = {
    tA: { value: texs[0] }, tB: { value: texs[1] }, uCropA: { value: crop(texs[0]) }, uCropB: { value: crop(texs[1]) },
    uGrip: { value: 0 }, uMix: { value: 0 }, uTime: { value: 0 }, uSeed: { value: .37 },
  };
  const seg = HIGH ? [200, 125] : [120, 75];
  const sheet = new THREE.Mesh(new THREE.PlaneGeometry(W, H, ...seg), new THREE.ShaderMaterial({ vertexShader: vert, fragmentShader: frag, uniforms: uni, side: THREE.DoubleSide }));
  scene.add(sheet);

  // sombra de contato: um borrão escuro atrás que encolhe com a tela
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(W * 1.25, H * 1.35), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, uniforms: { uS: { value: 1 }, uA: { value: .5 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
    fragmentShader: `uniform float uS, uA; varying vec2 vUv; void main(){ vec2 q = (vUv - .5) / uS; float d = length(max(abs(q) - vec2(.36, .33), 0.)); vec2 e = abs(vUv - .5); gl_FragColor = vec4(.06, .07, .09, exp(-d * d * 60.) * uA * smoothstep(.5, .36, max(e.x, e.y))); }`,
  }));
  shadow.position.set(.5, -.6, -1.6);
  scene.add(shadow);

  // lascas: quando você solta, a pintura presa vira centenas de pedaços que o vento leva
  const N = HIGH ? 900 : 380;
  const flakeGeo = new THREE.PlaneGeometry(1, 1);
  const aU = new Float32Array(N * 2), aR = new Float32Array(N * 4);
  for (let i = 0; i < N; i++) { aU.set([Math.random(), Math.random()], i * 2); aR.set([Math.random(), Math.random(), Math.random(), Math.random()], i * 4); }
  flakeGeo.setAttribute('aU', new THREE.InstancedBufferAttribute(aU, 2));
  flakeGeo.setAttribute('aR', new THREE.InstancedBufferAttribute(aR, 4));
  const flakeU = { tA: { value: texs[0] }, uCropA: { value: crop(texs[0]) }, uT: { value: 0 }, uTime: { value: 0 } };
  const flakes = new THREE.InstancedMesh(flakeGeo, new THREE.ShaderMaterial({
    transparent: true, side: THREE.DoubleSide, depthWrite: false, uniforms: flakeU,
    vertexShader: `attribute vec2 aU; attribute vec4 aR; uniform float uT, uTime; varying vec2 vU; varying float vA, vL;
      mat3 rx(float a){ float c=cos(a), s=sin(a); return mat3(1.,0.,0., 0.,c,s, 0.,-s,c); }
      mat3 ry(float a){ float c=cos(a), s=sin(a); return mat3(c,0.,-s, 0.,1.,0., s,0.,c); }
      void main(){
        vU = aU;
        // cada lasca sai na hora em que a borda da troca passa por ela
        float t0 = (1. - aU.x) * .55 + aR.w * .12;
        float t = clamp((uT - t0) / (1. - t0 * .6), 0., 1.);
        vec3 o = vec3((aU - .5) * vec2(${W.toFixed(1)}, ${H.toFixed(1)}), .05);
        float s = (.1 + aR.x * .26) * (1. - t * .5);
        vec3 p = rx(t * (4. + aR.y * 9.)) * ry(t * (3. + aR.z * 7.)) * (position * vec3(s, s * (.5 + aR.z * .8), 1.));
        vec3 w = vec3(t * (9. + aR.x * 22.), t * (2. + aR.y * 7.) + sin(t * 8. + aR.z * 6.) * .6 * t, t * (4. + aR.z * 14.));
        vA = step(.0001, t) * (1. - smoothstep(.65, 1., t));
        vL = .75 + .5 * sin(t * 10. + aR.y * 20.);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(o + w + p, 1.);
      }`,
    fragmentShader: `uniform sampler2D tA; uniform vec4 uCropA; varying vec2 vU; varying float vA, vL;
      void main(){ if (vA < .01) discard; vec3 c = texture2D(tA, uCropA.xy + vU * uCropA.zw).rgb * vL; gl_FragColor = vec4(c, vA); }`,
  }), N);
  flakes.frustumCulled = false;
  const dummy = new THREE.Matrix4();
  for (let i = 0; i < N; i++) flakes.setMatrixAt(i, dummy);
  scene.add(flakes);

  let mobile = false;
  function resize() {
    const w = canvas.clientWidth || innerWidth, h = canvas.clientHeight || innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h; mobile = w / h < .85;
    camera.updateProjectionMatrix();
  }
  resize();

  const state = { p: 0, hold: false, mx: 0, my: 0 };
  let grip = 0, gv = 0, auto = 0, idx = 0, mix = 1, mixT = 0, peak = 0, releases = 0, time = 0;
  const AUTO = [[.1, .42, .5], [.56, .82, .88]]; // rolar sem segurar também aperta e solta
  let autoDone = [false, false];

  function release() {
    // a imagem presa vira lascas; a próxima se abre por baixo
    flakeU.tA.value = uni.tA.value = texs[idx % SEQ.length];
    flakeU.uCropA.value = uni.uCropA.value = crop(texs[idx % SEQ.length]);
    idx++;
    uni.tB.value = texs[idx % SEQ.length]; uni.uCropB.value = crop(texs[idx % SEQ.length]);
    mix = 0; mixT = 0; releases++;
    uni.uSeed.value = Math.random();
    onRelease(releases);
  }

  function frame(dt, snap = false) {
    time += dt;
    // alvo: segurando, a mão fecha devagar; sem segurar, a rolagem decide
    let target = 0;
    auto = 0;
    AUTO.forEach(([a, b, c], k) => {
      if (state.p > a && state.p < c) auto = Math.max(auto, state.p < b ? Math.pow((state.p - a) / (b - a), 1.3) : 1);
      if (state.p >= c && !autoDone[k] && !snap) { autoDone[k] = true; if (peak > .3) { release(); peak = 0; } }
      if (state.p < a) autoDone[k] = false;
    });
    if (state.hold) target = Math.min(1, grip + dt * .45 + .02);
    else target = auto;
    if (snap) { grip = target; gv = 0; }
    else if (state.hold || target > grip) { grip += (target - grip) * (1 - Math.pow(.02, dt)); gv = 0; }
    else {
      // solta com mola: passa do ponto e volta, como tecido que se abre
      gv += ((target - grip) * 70 - gv * 7) * dt;
      grip += gv * dt;
    }
    peak = Math.max(peak, grip);
    if (!state.hold && auto === 0 && peak > .3 && grip < .2) { release(); peak = 0; }
    if (mix < 1) { mixT += dt; mix = Math.min(1, mixT / 1.8); }
    if (snap && state.p > .5) mix = 1;
    if (mix >= 1 && uni.tA.value !== uni.tB.value) { uni.tA.value = uni.tB.value; uni.uCropA.value = uni.uCropB.value; }
    uni.uGrip.value = Math.max(-.12, Math.min(1, grip));
    uni.uMix.value = mix; uni.uTime.value = time;
    flakeU.uT.value = mix < 1 ? mix * 1.05 : 0; flakeU.uTime.value = time;
    flakes.visible = mix < 1;
    const gp = Math.max(0, grip);
    shadow.material.uniforms.uS.value = 1 - gp * .45;
    shadow.material.uniforms.uA.value = .55 - gp * .2;
    sheet.rotation.set(-state.my * .08 + gp * .25, state.mx * .12 + Math.sin(time * .3) * .03, gp * .12 + Math.sin(time * 9) * gp * gp * .012);
    sheet.position.set(mobile ? 0 : 2.7, mobile ? .9 : .3, 0);
    shadow.position.x = sheet.position.x + .5;
    camera.position.set(state.mx * .6, state.my * .4, (mobile ? 27 : 20.5) - gp * 2);
    camera.lookAt(mobile ? 0 : .6, mobile ? .6 : 0, 0);
    renderer.render(scene, camera);
  }

  let raf = 0, running = false, last = 0, visible = false;
  function loop(now) { raf = requestAnimationFrame(loop); const dt = Math.min(.05, (now - last) / 1000); last = now; frame(dt); }
  function start() { if (running || still) return; running = true; last = performance.now(); raf = requestAnimationFrame(loop); }
  function stop() { running = false; cancelAnimationFrame(raf); }
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; visible && !document.hidden ? start() : stop(); }).observe(canvas);
  document.addEventListener('visibilitychange', () => (document.hidden || !visible ? stop() : start()));
  addEventListener('resize', resize);
  frame(0, true);

  return {
    set(o) { Object.assign(state, o); },
    get grip() { return grip; },
    get releases() { return releases; },
    settle(g) { if (g != null) { grip = g; gv = 0; } frame(0, true); frame(0, true); },
    debug(o) { if (o.grip != null) { grip = o.grip; uni.uGrip.value = o.grip; } if (o.mix != null) { mix = o.mix; uni.uMix.value = o.mix; flakeU.uT.value = o.mix; flakes.visible = o.mix < 1; } renderer.render(scene, camera); },
  };
}
