/*
  Paradoxo — o lobby é um objeto impossível.
  Um triângulo de Penrose feito de três galerias: cada viga é um corredor de pinturas de um paradoxo.
  Ele só fecha de um ângulo. Gire e ele se abre, revelando o truque; solte e ele volta a ser impossível.
  Cada porta fica numa gravidade diferente, como numa gravura de Escher.

  O truque: câmera ortográfica olhando por (1,1,1). A terceira viga termina em (L,L,L), que cai exatamente
  sobre a origem na tela. Quando a câmera está alinhada, a terceira viga é desenhada antes e o resto
  por cima (o buffer de profundidade é limpo entre as duas passadas), e a ilusão se fecha.
*/
import * as THREE from 'three';

const L = 14, T = 2.6;
const D = new THREE.Vector3(1, 1, 1).normalize();
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

export async function createLobby({ canvas, asset = u => u, portals, still = false, low = false, onHover = () => {}, onClose = () => {}, onEnter = () => {}, onIntro = () => {} }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, preserveDrawingBuffer: still });
  renderer.setPixelRatio(Math.min(devicePixelRatio, low ? 1.25 : 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = !low;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.autoClear = false;

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, .1, 400);
  const pivot = new THREE.Group(); scene.add(pivot);       // gira em torno do eixo de visão: a ilusão continua fechada
  const root = new THREE.Group(); pivot.add(root);
  {   // centraliza pela caixa do triângulo na tela (não pelo centróide), para caber inteiro
    const R = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), D).normalize(), U = new THREE.Vector3().crossVectors(D, R);
    let a = [1e9, -1e9, 1e9, -1e9]; const v = new THREE.Vector3();
    for (const [x, y, z] of [[0, 0, 0], [L, 0, 0], [L, L, 0]]) for (let i = 0; i < 8; i++) { v.set(x + (i & 1 ? 1 : -1) * T / 2, y + (i & 2 ? 1 : -1) * T / 2, z + (i & 4 ? 1 : -1) * T / 2); const r = v.dot(R), u = v.dot(U); a = [Math.min(a[0], r), Math.max(a[1], r), Math.min(a[2], u), Math.max(a[3], u)]; }
    root.position.copy(R.multiplyScalar(-(a[0] + a[1]) / 2)).addScaledVector(U, -(a[2] + a[3]) / 2);
    // em profundidade (ao longo da visão) o deslocamento não muda a imagem fechada, mas faz o giro ser em volta do meio do objeto
    const c = new THREE.Vector3(5 * L / 6, L / 2, L / 6);
    root.position.addScaledVector(D, -c.dot(D));
  }

  // ---------- luz ----------
  scene.add(new THREE.HemisphereLight(0xfff1dc, 0x1a1418, .55));
  const key = new THREE.DirectionalLight(0xffe6c4, 2.6);
  key.position.set(-6, 30, 14); key.target.position.set(0, 0, 0);
  key.castShadow = !low;
  key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -22, right: 22, top: 22, bottom: -22, near: 1, far: 90 });
  key.shadow.bias = -.0006; key.shadow.normalBias = .02;
  scene.add(key, key.target);
  const rim = new THREE.DirectionalLight(0xa9c4ff, .9); rim.position.set(20, 4, -10); scene.add(rim);
  const torch = new THREE.PointLight(0xffc98a, 0, 0, 1.6); scene.add(torch);
  const torchAt = new THREE.Vector3(), torchTo = new THREE.Vector3();
  let torchOn = 0;
  scene.environment = studioEnv(renderer);

  // céu dividido: brasa embaixo à esquerda, névoa em cima à direita (é desenhado na primeira passada)
  const sky = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
    depthTest: false, depthWrite: false,
    uniforms: { uT: { value: 0 }, uYaw: { value: 0 }, uAsp: { value: 1 }, uOpen: { value: 0 }, uM: { value: new THREE.Vector3(.5, .5, 0) } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, .999, 1.); }',
    fragmentShader: `uniform float uT, uYaw, uAsp, uOpen; uniform vec3 uM; varying vec2 vUv;
      float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f); return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + 1.), f.x), f.y); }
      float fbm(vec2 p){ float s = 0., a = .5; for (int i = 0; i < 5; i++) { s += a * n(p); p *= 2.03; a *= .5; } return s; }
      void main(){
        vec2 p = vUv; p.x += uYaw * .06;
        vec2 q = vec2((p.x - .5) * uAsp, p.y - .5);
        float w = fbm(q * 2.2 + vec2(uT * .02, -uT * .015));
        float diag = clamp((p.x + p.y) * .5 + (w - .5) * .35, 0., 1.);
        vec3 night = vec3(.055, .045, .05);
        vec3 ember = vec3(.42, .14, .045) * (.65 + .7 * fbm(q * 5. - vec2(0., uT * .05)));
        vec3 mist = vec3(.34, .39, .44) * (.7 + .5 * fbm(q * 3. + vec2(uT * .03, 0.)));
        vec3 c = night;
        c = mix(c, ember, smoothstep(.62, 1.05, 1. - diag) * .9);
        c = mix(c, mist, smoothstep(.62, 1.05, diag) * .75);
        c *= 1. - .35 * length(q) * (1. - uOpen * .3);
        vec2 mq = vec2((vUv.x - uM.x) * uAsp, vUv.y - uM.y);
        c += vec3(.2, .11, .05) * exp(-dot(mq, mq) * 9.) * uM.z;
        c += (h(vUv * 1000. + uT) - .5) * .015;
        gl_FragColor = vec4(c, 1.);
      }`,
  }));
  sky.frustumCulled = false; sky.renderOrder = -10; sky.layers.set(1);
  scene.add(sky);

  const ND = low ? 260 : 700;
  const dGeo = new THREE.BufferGeometry();
  const dP = new Float32Array(ND * 3), dR = new Float32Array(ND);
  for (let i = 0; i < ND; i++) { dP.set([(Math.random() - .5) * 46, (Math.random() - .5) * 46, (Math.random() - .5) * 46], i * 3); dR[i] = Math.random(); }
  dGeo.setAttribute('position', new THREE.BufferAttribute(dP, 3));
  dGeo.setAttribute('aR', new THREE.BufferAttribute(dR, 1));
  const dustU = { uT: { value: 0 }, uLp: { value: torchAt }, uOn: { value: 0 }, uPx: { value: renderer.getPixelRatio() }, uZ: { value: 1 } };
  const dust = new THREE.Points(dGeo, new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, uniforms: dustU,
    vertexShader: `attribute float aR; uniform float uT, uOn, uPx, uZ; uniform vec3 uLp; varying float vA;
      void main(){
        vec3 p = position;
        p.y = mod(p.y + uT * (.25 + aR * .5) + 23., 46.) - 23.;
        p.x += sin(uT * .3 + aR * 20.) * 1.2; p.z += cos(uT * .23 + aR * 13.) * 1.2;
        vec4 mv = modelViewMatrix * vec4(p, 1.);
        float d = distance(p, uLp);
        vA = (.12 + .5 * aR) * (.35 + 2.6 * uOn * exp(-d * d / 30.)) * (.6 + .4 * sin(uT * 2. + aR * 40.));
        gl_PointSize = (1.2 + aR * 2.6) * uPx * mix(1., uZ, .5);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `varying float vA; void main(){ vec2 q = gl_PointCoord - .5; float a = smoothstep(.5, 0., length(q)); gl_FragColor = vec4(vec3(1., .82, .55) * a * vA, 1.); }`,
  }));
  dust.frustumCulled = false; dust.renderOrder = 10; scene.add(dust);

  // ---------- texturas ----------
  const loader = new THREE.TextureLoader();
  const img = src => new Promise(res => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = asset(src); });
  const tex = src => new Promise(res => loader.load(asset(src), t => { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; res(t); }, undefined, () => res(null)));
  const [thI, thM] = await Promise.all([
    Promise.all([...Array(10).keys()].map(k => img(`lobby/img/i${k}.webp`))),
    Promise.all([...Array(10).keys()].map(k => img(`lobby/img/m${k}.webp`))),
  ]);

  // cada viga é uma galeria com a identidade do seu paradoxo
  const WALLS = [
    { pics: thI, wall: '#2b1d15', wall2: '#1d130d', frame: ['#c99a4a', '#f2d590', '#7d561c'], mat: 6, light: 'warm' },   // O Idiota: nogueira e ouro
    { pics: thM, wall: '#d9d5cb', wall2: '#c9c4b8', frame: ['#2a2f36', '#59606a', '#15191e'], mat: 3, light: 'cool' },    // Montaigne: pedra calcária, molduras finas
    { pics: null, wall: '#b9ad97', wall2: '#a99d86', frame: ['#6d6355', '#8d826f', '#4d463c'], mat: 2, light: 'raw' },   // o próximo: linho cru, só esboços
  ];
  function galleryTex(w, seed) {
    const cv = document.createElement('canvas'); cv.width = 2048; cv.height = 512;
    const g = cv.getContext('2d');
    const gr = g.createLinearGradient(0, 0, 0, 512); gr.addColorStop(0, w.wall); gr.addColorStop(1, w.wall2);
    g.fillStyle = gr; g.fillRect(0, 0, 2048, 512);
    // textura de parede
    for (let i = 0; i < 2600; i++) { g.fillStyle = `rgba(${Math.random() < .5 ? '0,0,0' : '255,255,255'},${Math.random() * .035})`; g.fillRect(Math.random() * 2048, Math.random() * 512, 2 + Math.random() * 40, 1 + Math.random() * 3); }
    // rodapé e friso
    g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(0, 470, 2048, 42); g.fillRect(0, 0, 2048, 22);
    let x = 70 + (seed * 137) % 90, k = seed * 3;
    while (x < 1990) {
      const p = w.pics ? w.pics[k++ % w.pics.length] : null;
      const h = 250 + ((k * 53) % 70);
      const ww = p ? Math.min(560, h * p.width / p.height) : 170 + ((k * 71) % 160);
      if (x + ww > 1990) break;
      const y = 245 - h / 2 + 10, m = w.mat;
      // sombra projetada na parede
      g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(x + 10, y + 14, ww + m * 2, h + m * 2);
      const fg = g.createLinearGradient(x, y, x + ww, y + h);
      fg.addColorStop(0, w.frame[0]); fg.addColorStop(.35, w.frame[1]); fg.addColorStop(.6, w.frame[2]); fg.addColorStop(1, w.frame[0]);
      g.fillStyle = fg; g.fillRect(x - m, y - m, ww + m * 4, h + m * 4);
      if (p) g.drawImage(p, x + m, y + m, ww, h);
      else { // tela em branco com esboço a carvão: este ainda vai ser pintado
        g.fillStyle = '#e9e1d0'; g.fillRect(x + m, y + m, ww, h);
        g.strokeStyle = 'rgba(40,34,28,.55)'; g.lineWidth = 2;
        for (let s = 0; s < 7; s++) { g.beginPath(); g.moveTo(x + m + Math.random() * ww, y + m + Math.random() * h); g.bezierCurveTo(x + Math.random() * ww, y + Math.random() * h, x + Math.random() * ww, y + Math.random() * h, x + m + Math.random() * ww, y + m + Math.random() * h); g.stroke(); }
      }
      g.fillStyle = 'rgba(255,255,255,.08)'; g.fillRect(x + m, y + m, ww, 3);
      x += ww + 80 + ((k * 29) % 60);
    }
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
    return t;
  }

  // ---------- as três vigas ----------
  const stone = (c, r = .78) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: 0, envMapIntensity: .5 });
  const gold = new THREE.MeshStandardMaterial({ color: 0xc9a056, roughness: .32, metalness: 1, envMapIntensity: 1.2 });
  const BEHIND = 1; // camada da terceira viga (desenhada antes)
  const beams = [];
  const loopU = { uPhase: { value: 0 }, uA: { value: 0 } };
  // viga ao longo de x de comprimento len, depois girada para o eixo certo
  function beam(i, len, rot, pos) {
    const w = WALLS[i];
    const g = new THREE.Group();
    const faceMat = s => { const m = stone(0xffffff, .85); m.map = galleryTex(w, s); return m; };
    const end = stone(new THREE.Color(w.wall).multiplyScalar(.9));
    const mats = [end, end, faceMat(i * 4 + 1), faceMat(i * 4 + 2), faceMat(i * 4 + 3), faceMat(i * 4 + 4)];
    const m = new THREE.Mesh(new THREE.BoxGeometry(len, T, T), mats);
    m.castShadow = m.receiveShadow = true; g.add(m);
    // frisos de metal nas quatro arestas, como molduras corridas
    const eg = new THREE.BoxGeometry(len, .09, .09);
    const em = i === 1 ? new THREE.MeshStandardMaterial({ color: 0x2b3038, roughness: .35, metalness: .9 }) : gold;
    for (const [y, z] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) { const e = new THREE.Mesh(eg, em); e.position.set(0, y * T / 2, z * T / 2); g.add(e); }
    // a luz que percorre o laço infinito: corre pelas três vigas e nunca chega
    const lm = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uPhase: loopU.uPhase, uA: loopU.uA, uI: { value: i }, uLen: { value: len } },
      vertexShader: 'uniform float uLen; varying float vX; void main(){ vX = position.x / uLen + .5; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
      fragmentShader: `uniform float uPhase, uA, uI; varying float vX;
        void main(){ float s = (uI + clamp(vX, 0., 1.)) / 3.; float d = fract(uPhase - s);
          float g = exp(-d * 10.) * 2.6 + exp(-pow((1. - d) * 90., 2.)) * 2.4 + .1;
          gl_FragColor = vec4(vec3(1., .82, .55) * g * uA, 1.); }`,
    });
    const strip = new THREE.Mesh(new THREE.BoxGeometry(len, .22, .22), lm);
    strip.position.set(0, T / 2 + .02, T / 2 + .02); g.add(strip);
    g.rotation.copy(rot); g.position.copy(pos);
    root.add(g); beams.push(g);
    return g;
  }
  const len = L - T;
  beam(0, len, new THREE.Euler(0, 0, 0), new THREE.Vector3(L / 2, 0, 0));
  beam(1, len, new THREE.Euler(0, 0, Math.PI / 2), new THREE.Vector3(L, L / 2, 0));
  const b3 = beam(2, len, new THREE.Euler(0, -Math.PI / 2, 0), new THREE.Vector3(L, L, L / 2));
  // cantos de pedra
  const cornerMat = stone(0x8f877b, .7);
  const corners = [[0, 0, 0], [L, 0, 0], [L, L, 0]].map(([x, y, z]) => {
    const c = new THREE.Mesh(new THREE.BoxGeometry(T, T, T), cornerMat);
    c.position.set(x, y, z); c.castShadow = c.receiveShadow = true; root.add(c);
    return c;
  });

  // ---------- portas: uma moldura com a pintura em camadas, de pé numa face, cada uma com seu "chão" ----------
  const FW = 3.1, FH = 4.1, FD = .55;
  const P = [];
  async function portal(cfg) {
    const g = new THREE.Group();
    const [bg, cut] = await Promise.all([cfg.paint ? tex(cfg.paint) : null, cfg.cut ? tex(cfg.cut) : null]);
    const tone = new THREE.Color(cfg.tone);
    const inner = new THREE.Group(); g.add(inner);
    inner.position.y = FH / 2 + .5;
    // pedestal
    const ped = new THREE.Mesh(new THREE.BoxGeometry(FW * .78, .5, FD * 1.6), stone(cfg.ped || 0x6f675d, .6));
    ped.position.y = .25; ped.castShadow = ped.receiveShadow = true; g.add(ped);
    // moldura
    const fm = cfg.frameMat || gold;
    const bar = (w, h, x, y) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, FD), fm); b.position.set(x, y, 0); b.castShadow = true; inner.add(b); };
    const bw = .28;
    bar(FW, bw, 0, FH / 2 - bw / 2); bar(FW, bw, 0, -FH / 2 + bw / 2); bar(bw, FH, -FW / 2 + bw / 2, 0); bar(bw, FH, FW / 2 - bw / 2, 0);
    // fundo da caixa e laterais internas
    const back = new THREE.Mesh(new THREE.BoxGeometry(FW, FH, .06), stone(0x0d0b0a));
    back.position.z = -FD / 2; inner.add(back);
    const iw = FW - bw * 2, ih = FH - bw * 2;
    // a pintura, recortada no formato retrato
    let paint;
    if (bg) {
      const a = bg.image.width / bg.image.height, want = iw / ih;
      bg.repeat.set(want / a, 1); bg.offset.set((1 - want / a) * (cfg.fx === 'wind' ? .35 : .5), 0);
      paint = new THREE.Mesh(new THREE.PlaneGeometry(iw, ih), new THREE.MeshBasicMaterial({ map: bg, color: new THREE.Color(.62, .62, .62), toneMapped: true }));
    } else {
      paint = new THREE.Mesh(new THREE.PlaneGeometry(iw, ih), new THREE.MeshBasicMaterial({ map: lockedTex(), color: 0x9a9a9a }));
    }
    paint.position.z = -FD / 2 + .05; inner.add(paint);
    // o recorte flutua para fora da tela; o topo some em degradê
    let fig = null;
    if (cut) {
      const a = cut.image.width / cut.image.height;
      const fh = ih * (cfg.figH || .82), fw = fh * a;
      fig = new THREE.Mesh(new THREE.PlaneGeometry(fw, fh), new THREE.ShaderMaterial({
        transparent: true, depthWrite: false,
        uniforms: { map: { value: cut }, uB: { value: .62 }, uFade: { value: cfg.fade ?? .2 } },
        vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
        fragmentShader: `uniform sampler2D map; uniform float uB, uFade; varying vec2 vUv;
          void main(){ vec4 c = texture2D(map, vUv); c.a *= smoothstep(1., 1. - uFade, vUv.y) * smoothstep(0., .06, vUv.y); if (c.a < .02) discard;
            gl_FragColor = vec4(c.rgb * uB, c.a);
            #include <colorspace_fragment>
          }`,
      }));
      fig.position.set((cfg.figX || 0) * iw, -ih / 2 + fh / 2, .12);
      inner.add(fig);
    }
    // portas de verdade: duas folhas entreabertas na frente da pintura; com o cursor elas se abrem
    // e a luz do outro lado sai. A porta trancada só treme.
    const doorCol = cfg.door ?? (cfg.locked ? 0x5d554b : 0x2b1c13);
    const dm = new THREE.MeshStandardMaterial({ color: doorCol, roughness: .55, metalness: .1 });
    const doors = [-1, 1].map(sd => {
      const piv = new THREE.Group(); piv.position.set(sd * iw / 2, 0, FD / 2 - .1);
      const leaf = new THREE.Mesh(new THREE.BoxGeometry(iw / 2 - .02, ih - .02, .08).translate(-sd * (iw / 4), 0, 0), dm);
      piv.add(leaf);
      // puxador dourado
      const knob = new THREE.Mesh(new THREE.SphereGeometry(.07, 12, 8), gold); knob.position.set(-sd * (iw / 2 - .16), 0, .08);
      piv.add(knob);
      inner.add(piv);
      return piv;
    });
    // luz da porta e poça de luz no chão
    const pl = new THREE.PointLight(tone, 0, 9, 1.6); pl.position.set(0, FH / 2, 1.6); g.add(pl);
    const pool = new THREE.Mesh(new THREE.PlaneGeometry(5.5, 5.5), new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uC: { value: tone }, uA: { value: .25 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
      fragmentShader: 'uniform vec3 uC; uniform float uA; varying vec2 vUv; void main(){ float d = length(vUv - .5) * 2.; gl_FragColor = vec4(uC * uA * pow(1. - clamp(d, 0., 1.), 2.), 1.); }',
    }));
    pool.rotation.x = -Math.PI / 2; pool.position.set(0, .02, .8); g.add(pool);
    // área de clique
    const hit = new THREE.Mesh(new THREE.BoxGeometry(FW, FH + .6, FD * 2), new THREE.MeshBasicMaterial({ visible: false }));
    hit.position.y = FH / 2 + .3; g.add(hit);
    // efeito próprio de cada paradoxo
    const fx = cfg.fx === 'ember' ? embers(tone) : cfg.fx === 'wind' ? flakes() : null;
    if (fx) g.add(fx.obj);

    // pôr de pé na face: "up" = normal da face, "frente" = para onde ela olha
    const up = new THREE.Vector3(...cfg.up), fwd = new THREE.Vector3(...cfg.fwd).normalize();
    const right = new THREE.Vector3().crossVectors(up, fwd).normalize();
    fwd.crossVectors(right, up).normalize();
    g.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(right, up, fwd));
    g.position.set(...cfg.at);
    root.add(g);
    g.traverse(o => { if (o.isMesh && o !== hit && o !== pool && o.material.transparent !== true) { o.castShadow = true; o.receiveShadow = true; } });
    if (cfg.behind) g.traverse(o => o.layers.set(BEHIND));
    hit.userData.portal = cfg.id;
    const p = { cfg, g, inner, paint, fig, pl, pool, hit, fx, doors, open: 0, hov: 0, center: new THREE.Vector3() };
    P.push(p);
    return p;
  }
  function lockedTex() {
    const cv = document.createElement('canvas'); cv.width = 512; cv.height = 680;
    const g = cv.getContext('2d');
    g.fillStyle = '#e6decd'; g.fillRect(0, 0, 512, 680);
    for (let i = 0; i < 4000; i++) { g.fillStyle = `rgba(90,70,40,${Math.random() * .06})`; g.fillRect(Math.random() * 512, Math.random() * 680, 1, 6); }
    g.strokeStyle = 'rgba(40,32,24,.5)'; g.lineWidth = 3;
    for (let s = 0; s < 14; s++) { g.beginPath(); const y = 160 + Math.random() * 380; g.moveTo(60 + Math.random() * 60, y); g.quadraticCurveTo(256, y - 80 + Math.random() * 160, 380 + Math.random() * 70, y + Math.random() * 60 - 30); g.stroke(); }
    g.fillStyle = 'rgba(40,32,24,.8)'; g.font = 'italic 64px "Bodoni Moda", Georgia, serif'; g.textAlign = 'center'; g.fillText('em breve', 256, 110);
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
  }
  // brasas que sobem da porta do Idiota
  function embers(tone) {
    const n = low ? 40 : 90, pos = new Float32Array(n * 3), r = new Float32Array(n);
    for (let i = 0; i < n; i++) { pos[i * 3] = (Math.random() - .5) * FW; pos[i * 3 + 1] = Math.random() * 7; pos[i * 3 + 2] = .4 + Math.random() * 1.4; r[i] = Math.random(); }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('aR', new THREE.BufferAttribute(r, 1));
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uT: { value: 0 }, uA: { value: .4 }, uPx: { value: renderer.getPixelRatio() }, uZ: { value: 1 } },
      vertexShader: `attribute float aR; uniform float uT, uPx, uZ; varying float vA;
        void main(){ vec3 p = position; float t = fract(aR + uT * (.05 + aR * .05)); p.y = .6 + t * 8.; p.x += sin(uT * 1.3 + aR * 20.) * .4 * t;
          vA = sin(t * 3.14159); gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.); gl_PointSize = (2. + aR * 3.) * uPx * uZ; }`,
      fragmentShader: `uniform float uA; varying float vA; void main(){ float d = length(gl_PointCoord - .5); if (d > .5) discard; gl_FragColor = vec4(vec3(1., .55, .2) * pow(1. - d * 2., 1.5) * vA * uA * 2., 1.); }`,
    });
    const obj = new THREE.Points(geo, mat); obj.frustumCulled = false;
    return { obj, mat };
  }
  // folhas de papel que o vento leva para fora da porta do Montaigne
  function flakes() {
    const n = low ? 24 : 50, pos = new Float32Array(n * 3), r = new Float32Array(n);
    for (let i = 0; i < n; i++) { pos[i * 3] = 0; pos[i * 3 + 1] = .8 + Math.random() * FH; pos[i * 3 + 2] = Math.random() * .6; r[i] = Math.random(); }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('aR', new THREE.BufferAttribute(r, 1));
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      uniforms: { uT: { value: 0 }, uA: { value: .5 }, uPx: { value: renderer.getPixelRatio() }, uZ: { value: 1 } },
      vertexShader: `attribute float aR; uniform float uT, uPx, uZ; varying float vA, vR;
        void main(){ vec3 p = position; float t = fract(aR * 7.3 + uT * (.04 + aR * .04)); p.x = -FW_ + t * 11.; p.y += sin(t * 6. + aR * 9.) * .7 + t * 1.5; p.z += t * 2.;
          vA = smoothstep(0., .15, t) * (1. - smoothstep(.6, 1., t)); vR = aR; gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.); gl_PointSize = (4. + aR * 5.) * uPx * uZ; }`.replace('FW_', (FW / 2).toFixed(2)),
      fragmentShader: `uniform float uA, uT; varying float vA, vR; void main(){ vec2 q = gl_PointCoord - .5; float a = uT * (1. + vR) + vR * 6.; q = mat2(cos(a), -sin(a), sin(a), cos(a)) * q; q.y *= 2.2 + sin(uT * 3. + vR * 9.) * 1.5;
        if (abs(q.x) > .42 || abs(q.y) > .42) discard; gl_FragColor = vec4(vec3(.95, .93, .88) * (.75 + .25 * sign(q.x)), vA * uA * 1.6); }`,
    });
    const obj = new THREE.Points(geo, mat); obj.frustumCulled = false;
    return { obj, mat };
  }

  await Promise.all(portals.map(portal));
  b3.traverse(o => o.layers.set(BEHIND));

  // ---------- entrada: as peças chegam soltas, de longe, e se encaixam no impossível ----------
  const pieces = [...beams, ...corners, ...P.map(p => p.g)].map((o, i) => {
    const home = { p: o.position.clone(), q: o.quaternion.clone() };
    const dir = new THREE.Vector3(Math.sin(i * 2.4), Math.cos(i * 1.7) * .8 + .3, Math.sin(i * 3.1 + 1)).normalize();
    const spinQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.sin(i) * 1.6, Math.cos(i * 1.3) * 1.9, Math.sin(i * 2.2) * 1.2));
    const delay = i < 3 ? i * .18 : i < 6 ? .55 + (i - 3) * .12 : 1.5 + (i - 6) * .15;
    return { o, home, dir, spinQ, delay, dur: i < 6 ? 1.6 : 1.1 };
  });
  let introT = still ? 99 : 0, introDone = still, flash = 0, intro0 = 0;
  const tq = new THREE.Quaternion();
  function intro() {
    // só começa quando a página aparece (begin), senão a montagem acontece escondida atrás do carregamento
    introT = intro0 ? Math.max(0, (performance.now() - intro0) / 1000) : 0;
    let done = true;
    for (const k of pieces) {
      const e = clamp((introT - k.delay) / k.dur);
      if (e < 1) done = false;
      const s = 1 - Math.pow(1 - e, 4);
      k.o.position.copy(k.home.p).addScaledVector(k.dir, (1 - s) * 34);
      tq.copy(k.spinQ).multiply(k.home.q);
      k.o.quaternion.slerpQuaternions(tq, k.home.q, s);
      k.o.visible = e > 0;
    }
    if (done) { introDone = true; flash = 1; onIntro(); }
  }
  if (!still) intro();
  scene.traverse(o => { if (o.isLight) o.layers.enableAll(); });

  // ---------- câmera ----------
  let W = 1, H = 1, base = 1;
  function resize() {
    W = canvas.clientWidth; H = canvas.clientHeight;
    renderer.setSize(W, H, false);
    const asp = W / H;
    // enquadra o triângulo (raio ~ 0.95 L na tela) com folga
    const r = L;
    base = asp < 1 ? r * .74 / asp : r * .7;
    applyCam();
  }
  const cMid = new THREE.Vector3(5 * L / 6, L / 2, L / 6);
  const cam = { yaw: 0, pitch: 0, vy: 0, vp: 0, zoom: 1, target: new THREE.Vector3(), look: null, k: 0 };
  const tmpQ = new THREE.Quaternion();
  function camDir() {
    const d = D.clone();
    const upW = new THREE.Vector3(0, 1, 0);
    const right = new THREE.Vector3().crossVectors(upW, d).normalize();
    d.applyAxisAngle(upW, cam.yaw);
    d.applyAxisAngle(right, -cam.pitch);
    if (cam.look) d.lerp(cam.look, cam.k).normalize();
    return d;
  }
  function applyCam() {
    const asp = W / H, h = base / cam.zoom;
    Object.assign(camera, { left: -h * asp, right: h * asp, top: h, bottom: -h });
    camera.position.copy(cam.target).addScaledVector(camDir(), 120);
    camera.up.set(0, 1, 0);
    camera.lookAt(cam.target);
    camera.updateProjectionMatrix();
  }
  resize();
  addEventListener('resize', resize);

  // ---------- interação ----------
  const ray = new THREE.Raycaster(); ray.layers.enableAll();
  const ptr = new THREE.Vector2(9, 9);
  let drag = null, lastMove = 0, hover = null, closed = still, entering = null;
  const hits = P.map(p => p.hit);
  function pick(x, y) {
    const r = canvas.getBoundingClientRect();
    ptr.set(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ptr, camera);
    const h = ray.intersectObjects(hits, false)[0];
    return h ? P.find(p => p.hit === h.object) : null;
  }
  const raw = { y: 0, p: 0 }, vel = { y: 0, p: 0 };
  const band = (v, m) => m * Math.tanh(v / m);
  canvas.addEventListener('pointerdown', e => {
    if (!introDone || entering) return;
    // continua de onde o objeto está (se ainda estava voltando)
    raw.y = Math.atanh(clamp(cam.yaw / .62, -.999, .999)) * .62; raw.p = Math.atanh(clamp(cam.pitch / .36, -.999, .999)) * .36;
    vel.y = vel.p = 0;
    drag = { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t: performance.now(), moved: 0 };
    canvas.style.cursor = "grabbing";
    try { canvas.setPointerCapture(e.pointerId); } catch (_) { /* segue */ }
  });
  canvas.addEventListener('pointermove', e => {
    lastMove = performance.now();
    if (drag) {
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      drag.x = e.clientX; drag.y = e.clientY; drag.moved += Math.abs(dx) + Math.abs(dy);
      raw.y -= dx * .0048; raw.p += dy * .0038;
      cam.yaw = band(raw.y, .62); cam.pitch = band(raw.p, .36);
      const r = canvas.getBoundingClientRect();
      ptr.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      return;
    }
    const p = pick(e.clientX, e.clientY);
    setHover(p);
    torchOn = 1;
  });
  const up = e => {
    if (!drag) return;
    const tap = drag.moved < 8;
    drag = null; lastMove = performance.now();
    if (tap) { const p = pick(e.clientX, e.clientY); if (p) enter(p); }
  };
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', () => { drag = null; });
  canvas.addEventListener('pointerleave', () => { if (!drag) setHover(null); torchOn = 0; });
  function setHover(p) {
    if (p === hover) return;
    hover = p;
    canvas.style.cursor = p && !p.cfg.locked ? 'pointer' : drag ? 'grabbing' : 'grab';
    onHover(p ? p.cfg.id : null);
  }
  function enter(p) {
    if (entering || p.cfg.locked) return;
    entering = { p, t0: performance.now() };
    p.g.updateMatrixWorld(true);
    // olhar a porta de frente enquanto voa para dentro dela
    const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(p.g.getWorldQuaternion(tmpQ)).normalize();
    cam.look = fwd; entering.from = cam.target.clone();
    p.paint.getWorldPosition(entering.to = new THREE.Vector3());
    onEnter(p.cfg.id);
    return p.cfg;
  }

  // ---------- quadro ----------
  const clock = new THREE.Clock();
  let raf = 0, running = false, t = 0, spin = 0, closeT = 0;
  const v3 = new THREE.Vector3();
  function frame(dt) {
    t += dt;
    // sem arrastar, o objeto volta sozinho ao único ângulo em que é impossível
    if (!drag && !entering && (cam.yaw || cam.pitch)) {
      // mola criticamente amortecida: volta firme e encaixa sem pular
      const w = 5.5;
      for (const [k, v] of [['yaw', 'y'], ['pitch', 'p']]) {
        vel[v] += (-w * w * cam[k] - 2 * w * vel[v]) * dt;
        cam[k] += vel[v] * dt;
      }
      if (Math.abs(cam.yaw) < .0015 && Math.abs(cam.pitch) < .0015 && Math.abs(vel.y) + Math.abs(vel.p) < .02) { cam.yaw = 0; cam.pitch = 0; vel.y = vel.p = 0; }
    }
    // gira devagar em torno do eixo de visão: continua fechado
    if (!entering) spin += dt * .035;
    pivot.quaternion.setFromAxisAngle(D, spin);
    if (!introDone) intro();
    // o laço de luz corre sempre; quando o objeto fecha, ele acende
    flash = Math.max(0, flash - dt * .7);
    loopU.uPhase.value = t * .16;
    loopU.uA.value += (((closed ? .9 : .25) + flash * 2.5) * (introDone ? 1 : .2) - loopU.uA.value) * (1 - Math.pow(.02, dt));
    const isClosed = cam.yaw === 0 && cam.pitch === 0 && !entering && introDone;
    if (isClosed !== closed) { closed = isClosed; if (closed) { closeT = t; flash = Math.max(flash, .8); } onClose(closed); }
    // aberto, o giro passa a ser em volta do meio real do objeto (sem empurrá-lo para fora da tela)
    if (!entering) {
      pivot.updateMatrixWorld(true);
      const oa = Math.min(1, (Math.abs(cam.yaw) + Math.abs(cam.pitch)) / .3);
      cam.target.copy(cMid).applyMatrix4(root.matrixWorld).multiplyScalar(oa * oa * (3 - 2 * oa));
    }
    // aberto, a câmera recua um pouco para o objeto inteiro caber na tela
    if (!entering) cam.zoom = 1 / (1 + .5 * Math.min(1, (Math.abs(cam.yaw) + Math.abs(cam.pitch)) / .55));
    // entrada
    if (entering) {
      if (entering.z0 == null) entering.z0 = cam.zoom;
      const e = clamp((performance.now() - entering.t0) / 1300);
      const s = ease(e);
      cam.k = s;
      cam.target.lerpVectors(entering.from, entering.to, s);
      cam.zoom = entering.z0 + s * s * 7.5;
    }
    applyCam();
    // portas
    for (const p of P) {
      const on = (hover === p && !p.cfg.locked) || (entering && entering.p === p) ? 1 : 0;
      p.hov += (on - p.hov) * (1 - Math.pow(.003, dt));
      p.pl.intensity = (p.cfg.locked ? 0 : 6) + p.hov * 30;
      p.pool.material.uniforms.uA.value = (p.cfg.locked ? .05 : .22) + p.hov * .5;
      const b = .62 + p.hov * .45;
      p.paint.material.color.setScalar(p.cfg.locked ? .62 : b);
      if (p.fig) { p.fig.material.uniforms.uB.value = b; p.fig.position.z = .12 + p.hov * .5; }
      p.inner.scale.setScalar(1 + p.hov * .05);
      // folhas: entreabertas em repouso, escancaradas com o cursor ou ao entrar
      const want = p.cfg.locked ? 0 : entering && entering.p === p ? 2.2 : 1.05 + p.hov * 1.0;
      p.open += (want - p.open) * (1 - Math.pow(.02, dt));
      const shake = p.cfg.locked ? Math.sin(t * 40) * .04 * (hover === p ? 1 : 0) : Math.sin(t * 1.3 + p.cfg.at[0]) * .03;
      p.doors[0].rotation.y = -(p.open + shake); p.doors[1].rotation.y = p.open + shake;
      if (p.fx) { p.fx.mat.uniforms.uT.value = t; p.fx.mat.uniforms.uA.value = .35 + p.hov * .8; p.fx.mat.uniforms.uZ.value = cam.zoom; }
      p.hit.getWorldPosition(p.center);
    }
    // lanterna: o raio do cursor encontra o plano do objeto e a luz fica um pouco à frente dele
    if (torchOn) {
      ray.setFromCamera(ptr, camera);
      const dir = camDir();
      const t0 = -ray.ray.origin.dot(dir) / ray.ray.direction.dot(dir);
      torchTo.copy(ray.ray.origin).addScaledVector(ray.ray.direction, t0).addScaledVector(dir, 6.5);
      if (!torchAt.lengthSq()) torchAt.copy(torchTo);
      torchAt.lerp(torchTo, 1 - Math.pow(.004, dt));
      torch.position.copy(torchAt);
    }
    const tOn = torchOn && !entering ? 1 : 0;
    torch.intensity += ((tOn ? 90 : 0) - torch.intensity) * (1 - Math.pow(.05, dt));
    dustU.uT.value = t; dustU.uOn.value = torch.intensity / 90; dustU.uZ.value = cam.zoom;
    sky.material.uniforms.uM.value.set(ptr.x * .5 + .5, ptr.y * .5 + .5, torch.intensity / 90);
    // duas passadas quando fechado: a terceira viga fica atrás de tudo
    const su = sky.material.uniforms; su.uT.value = t; su.uYaw.value = cam.yaw; su.uAsp.value = W / H; su.uOpen.value += ((closed ? 0 : 1) - su.uOpen.value) * .1;
    renderer.clear();
    if (closed) {
      camera.layers.set(BEHIND); renderer.render(scene, camera);
      renderer.clearDepth();
      camera.layers.set(0); renderer.render(scene, camera);
    } else {
      camera.layers.enableAll(); renderer.render(scene, camera);
    }
    camera.layers.enableAll();
  }
  function loop() { if (!running) return; frame(Math.min(clock.getDelta(), .05)); raf = requestAnimationFrame(loop); }
  function start() { if (running || still) return; running = true; clock.getDelta(); raf = requestAnimationFrame(loop); }
  function stop() { running = false; cancelAnimationFrame(raf); }
  document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));
  start();
  if (still) frame(.016);

  // posição de cada porta na tela, para as etiquetas em HTML
  const upW = new THREE.Vector3();
  function screen(id) {
    const p = P.find(q => q.cfg.id === id); if (!p) return null;
    // um ponto logo acima da moldura, no "alto" da gravidade dela
    upW.set(0, 1, 0).applyQuaternion(p.g.getWorldQuaternion(tmpQ));
    v3.copy(p.center).addScaledVector(upW, FH / 2 + .9).project(camera);
    return { x: (v3.x * .5 + .5) * W, y: (-v3.y * .5 + .5) * H };
  }
  return {
    screen, enter: id => { const p = P.find(q => q.cfg.id === id); return p ? enter(p) : null; },
    get closed() { return closed; }, get entering() { return !!entering; },
    set(o) { if (o.yaw != null) cam.yaw = o.yaw; if (o.pitch != null) cam.pitch = o.pitch; if (o.spin != null) spin = o.spin; if (o.hover !== undefined) setHover(P.find(q => q.cfg.id === o.hover) || null); if (o.enter != null) { const p = P.find(q => q.cfg.id === o.enter); if (p) { enter(p); entering.t0 = performance.now() - o.t * 1300; } } },
    settle() { lastMove = performance.now(); for (const p of P) { p.hov = hover === p ? 1 : 0; p.open = p.cfg.locked ? 0 : 1.05 + p.hov * 1.0; } loopU.uA.value = .9; frame(.016); frame(.016); },
    pause: stop, resume: start,
    begin() { if (!intro0) intro0 = performance.now() + 350; },
  };
}

function studioEnv(renderer) {
  const s = new THREE.Scene();
  s.background = new THREE.Color(0x0a0808);
  const box = (w, h, color, x, y, z, ry = 0, rx = 0) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide }));
    m.position.set(x, y, z); m.rotation.set(rx, ry, 0); s.add(m);
  };
  box(16, 8, new THREE.Color(2.2, 1.7, 1.2), -8, 10, 6, .6, -.7);
  box(3, 16, new THREE.Color(.8, .95, 1.3), 12, 1, 2, -1.2);
  box(30, 4, new THREE.Color(.35, .28, .22), 0, -10, 0, 0, Math.PI / 2);
  const pm = new THREE.PMREMGenerator(renderer);
  const env = pm.fromScene(s, .03).texture;
  pm.dispose();
  return env;
}
