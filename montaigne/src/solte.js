/* "Segure e solte": o que a pessoa ainda segura vira tinta em grãos. Segurar aperta as letras (elas
   tremem e avermelham); soltar abre a mão: uma frente de vento varre da esquerda para a direita e leva
   os grãos, como as pinturas lá em cima. Só então aparece a resposta de Montaigne. Canvas 2D. */
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));

export function initSolte({ root, onRelease = () => {} }) {
  const cv = root.querySelector('.solte__cv'), ctx = cv.getContext('2d');
  const btn = root.querySelector('.solte__btn');
  const DPR = Math.min(devicePixelRatio || 1, 2);
  let W = 1, H = 1, grains = [], text = '', state = 'idle', g = 0, relT = 0, born = 0, raf = 0, visible = false, last = 0;
  const INK = [26, 30, 37], RED = [176, 57, 31];

  function size() {
    const r = cv.getBoundingClientRect();
    W = Math.max(2, Math.round(r.width * DPR)); H = Math.max(2, Math.round(r.height * DPR));
    cv.width = W; cv.height = H;
    if (text) build(text, false);
  }

  // o texto vira grãos: desenha numa tela escondida e guarda cada ponto com tinta
  function build(t, arrive = true) {
    text = t;
    const off = document.createElement('canvas'); off.width = W; off.height = H;
    const o = off.getContext('2d');
    let fs = Math.min(H * .62, W * .2);
    o.font = `italic 400 ${fs}px "EB Garamond", Garamond, Georgia, serif`;
    while (o.measureText(t).width > W * .92 && fs > 18) { fs -= 2; o.font = `italic 400 ${fs}px "EB Garamond", Garamond, Georgia, serif`; }
    o.textAlign = 'center'; o.textBaseline = 'middle'; o.fillStyle = '#000';
    o.fillText(t, W / 2, H * .52);
    const d = o.getImageData(0, 0, W, H).data;
    const step = Math.max(2, Math.round(DPR * (W < 700 ? 1.6 : 2)));
    const out = [];
    for (let y = 0; y < H; y += step) for (let x = 0; x < W; x += step) {
      if (d[(y * W + x) * 4 + 3] > 110) out.push({ hx: x + (Math.random() - .5) * step, hy: y + (Math.random() - .5) * step, x: 0, y: 0, vx: 0, vy: 0, s: Math.random(), a: 1 });
    }
    for (const p of out) {
      if (arrive) { p.x = -W * (.1 + Math.random() * .4); p.y = p.hy + (Math.random() - .5) * H * .8; }
      else { p.x = p.hx; p.y = p.hy; }
    }
    grains = out; born = performance.now(); state = 'idle'; g = 0;
    root.classList.remove('released');
    kick();
  }

  function frame(now) {
    raf = 0;
    const dt = Math.min(.05, (now - (last || now)) / 1000); last = now;
    ctx.clearRect(0, 0, W, H);
    if (state === 'hold') g = Math.min(1, g + dt * .55); else if (state !== 'gone') g = Math.max(0, g - dt * 2.5);
    const sz = Math.max(1.4, DPR * 1.6);
    const cx = W / 2, cy = H * .52;
    const col = INK.map((c, k) => Math.round(c + (RED[k] - c) * g));
    let alive = 0;
    const age = (now - born) / 1000;
    for (const p of grains) {
      if (state === 'gone') {
        const delay = (p.hx / W) * .6 + p.s * .15;
        const t = (now - relT) / 1000 - delay;
        if (t > 0) {
          p.vx += (420 + p.s * 520) * DPR * dt; p.vy += Math.sin(p.hx * .02 + t * 5 + p.s * 6) * 260 * DPR * dt - 40 * DPR * dt;
          p.x += p.vx * dt; p.y += p.vy * dt; p.a = Math.max(0, p.a - dt * (.55 + p.s * .5));
        }
      } else {
        // em repouso a tinta respira; segurando, aperta para o centro e treme
        const k = 1 - Math.pow(.0009, dt);
        const tx = cx + (p.hx - cx) * (1 - g * .07), ty = cy + (p.hy - cy) * (1 - g * .12);
        const j = g * g * 2.6 * DPR;
        p.x += (tx - p.x) * (age < 1.6 ? k * .5 : k) + (Math.random() - .5) * j;
        p.y += (ty - p.y) * (age < 1.6 ? k * .5 : k) + (Math.random() - .5) * j;
      }
      if (p.a <= 0) continue;
      alive++;
      ctx.globalAlpha = p.a * (.75 + p.s * .25);
      ctx.fillStyle = `rgb(${col[0]},${col[1]},${col[2]})`;
      ctx.fillRect(p.x, p.y, sz, sz);
    }
    ctx.globalAlpha = 1;
    root.style.setProperty('--g', g.toFixed(3));
    if (state === 'gone' && alive === 0) { state = 'empty'; return; }
    if (visible && state !== 'empty') raf = requestAnimationFrame(frame);
  }
  function kick() { if (!raf && visible) { last = 0; raf = requestAnimationFrame(frame); } }
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) { size(); kick(); } }, { rootMargin: '80px' }).observe(cv);
  addEventListener('resize', () => { if (visible) size(); });

  function hold(v) {
    if (!grains.length || state === 'gone' || state === 'empty') return;
    if (v) { state = 'hold'; btn.setAttribute('aria-pressed', 'true'); root.classList.add('holding'); kick(); return; }
    if (state !== 'hold') return;
    btn.setAttribute('aria-pressed', 'false'); root.classList.remove('holding');
    if (g < .15) { state = 'idle'; return; } // um toque rápido não é segurar
    state = 'gone'; relT = performance.now();
    for (const p of grains) { p.vx = 0; p.vy = 0; }
    root.classList.add('released');
    setTimeout(() => onRelease(text), 900);
    kick();
  }
  btn.addEventListener('pointerdown', e => { e.preventDefault(); try { btn.setPointerCapture(e.pointerId); } catch (_) { /* segue */ } hold(true); });
  cv.addEventListener('pointerdown', e => { if (e.pointerType === 'mouse' && e.button === 0) { e.preventDefault(); hold(true); } });
  addEventListener('pointerup', () => hold(false));
  addEventListener('pointercancel', () => hold(false));
  btn.addEventListener('contextmenu', e => e.preventDefault());
  btn.addEventListener('keydown', e => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) { e.preventDefault(); hold(true); } });
  btn.addEventListener('keyup', e => { if (e.key === ' ' || e.key === 'Enter') hold(false); });

  return { set: t => build(t), get text() { return text; } };
}
