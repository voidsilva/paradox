/* "Atire no fogo": Nastássia joga os cem mil rublos na lareira. Aqui a pessoa escreve na nota o que não
   venderia, arrasta a nota até o fogo e ela queima de baixo para cima, com borda em brasa e fagulhas.
   Tudo em canvas 2D: o fogo da lareira (partículas somadas) e a nota (desenhada e queimada pixel a pixel). */
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));

export function initFire(root) {
  const fireCv = root.querySelector('.fogo__fire'), fctx = fireCv.getContext('2d');
  const note = root.querySelector('.fogo__note'), ncv = note.querySelector('canvas'), nctx = ncv.getContext('2d', { willReadFrequently: true });
  const input = root.querySelector('#fogoIn'), btn = root.querySelector('.fogo__btn'), end = root.querySelector('.fogo__end'), again = root.querySelector('.fogo__again');
  const DPR = Math.min(devicePixelRatio || 1, 2);

  // ---------- a nota ----------
  const NW = 640, NH = 290;
  ncv.width = NW; ncv.height = NH;
  function drawNote(text) {
    const c = nctx;
    c.clearRect(0, 0, NW, NH);
    // papel envelhecido
    const g = c.createLinearGradient(0, 0, NW, NH);
    g.addColorStop(0, '#d9c7a1'); g.addColorStop(.5, '#e8d9b5'); g.addColorStop(1, '#c9b285');
    c.fillStyle = g; c.fillRect(0, 0, NW, NH);
    // guilhoché: linhas onduladas finas
    c.strokeStyle = 'rgba(92, 52, 28, .16)'; c.lineWidth = 1;
    for (let k = 0; k < 26; k++) {
      c.beginPath();
      for (let x = 0; x <= NW; x += 6) { const y = 18 + k * 10.4 + Math.sin(x / 22 + k * .7) * 4 + Math.sin(x / 61 - k) * 3; x ? c.lineTo(x, y) : c.moveTo(x, y); }
      c.stroke();
    }
    // moldura dupla
    c.strokeStyle = '#5c341c'; c.lineWidth = 3; c.strokeRect(12, 12, NW - 24, NH - 24);
    c.lineWidth = 1; c.strokeRect(20, 20, NW - 40, NH - 40);
    // rosetas
    const ros = (x, y, r) => { c.save(); c.translate(x, y); c.strokeStyle = 'rgba(92,52,28,.55)'; for (let k = 0; k < 12; k++) { c.rotate(Math.PI / 6); c.beginPath(); c.ellipse(r * .5, 0, r * .5, r * .18, 0, 0, Math.PI * 2); c.stroke(); } c.restore(); };
    ros(78, NH / 2, 46); ros(NW - 78, NH / 2, 46);
    c.fillStyle = '#5c341c'; c.textAlign = 'center';
    c.font = '500 13px "Plex Mono", monospace';
    c.fillText('ГОСУДАРСТВЕННЫЙ КРЕДИТНЫЙ БИЛЕТЪ', NW / 2, 46);
    c.fillText('№ 1869 · ПЕТЕРБУРГЪ', NW / 2, NH - 34);
    c.font = '700 30px "Archivo", sans-serif';
    c.fillText('100 000', 78, 46 + 8);
    c.fillText('100 000', NW - 78, NH - 30);
    c.font = '400 15px "Bodoni Moda", serif';
    c.fillText('cem mil rublos por', NW / 2, 96);
    // o que a pessoa escreveu, grande, no meio
    const t = (text || '').trim() || 'minha palavra';
    let size = 54;
    c.font = `italic 500 ${size}px "Bodoni Moda", serif`;
    while (c.measureText(t).width > NW - 230 && size > 22) { size -= 2; c.font = `italic 500 ${size}px "Bodoni Moda", serif`; }
    c.fillStyle = '#2a140a';
    c.fillText(t, NW / 2, NH / 2 + size * .32 + 8);
    c.font = '400 13px "Bodoni Moda", serif'; c.fillStyle = '#5c341c';
    c.fillText('pague-se ao portador', NW / 2, NH - 62);
  }

  // ---------- o fogo da lareira ----------
  let FW = 1, FH = 1;
  const flames = [], sparks = [];
  let heat = .55, flare = 0, visible = false, raf = 0, last = 0;
  function sizeFire() {
    const r = fireCv.getBoundingClientRect();
    FW = Math.max(2, Math.round(r.width * DPR * .5)); FH = Math.max(2, Math.round(r.height * DPR * .5));
    fireCv.width = FW; fireCv.height = FH;
  }
  function fireFrame(now) {
    raf = visible ? requestAnimationFrame(fireFrame) : 0;
    const dt = Math.min(.05, (now - (last || now)) / 1000); last = now;
    flare = Math.max(0, flare - dt * .45);
    const H = heat + flare, s = Math.min(FW, FH * .8) / 600; // escala pelo lado menor (no celular a seção é alta e estreita)
    // novas chamas ao longo da lenha
    // quantidade proporcional à largura: numa tela estreita o fogo não estoura em branco
    const n = Math.round((26 + 60 * H) * dt * 60 / 4 * clamp(FW / (FH * 1.5), .3, 1.1));
    for (let k = 0; k < n; k++) {
      const u = (Math.random() + Math.random() + Math.random()) / 3;
      flames.push({ x: FW * (.5 + (u - .5) * (.55 + flare * .3)), y: FH * .97, vx: (Math.random() - .5) * 20 * s, vy: -(90 + Math.random() * 170 * H) * s, l: 0, L: .7 + Math.random() * .9 * (.6 + H), r: (40 + Math.random() * 60) * s * (.7 + H * .5) });
    }
    if (Math.random() < (.4 + flare * 3) * dt * 20) sparks.push({ x: FW * (.5 + (Math.random() - .5) * .4), y: FH * .9, vx: (Math.random() - .5) * 80 * s, vy: -(160 + Math.random() * 300) * s, l: 0, L: 1 + Math.random() * 1.6 });
    fctx.globalCompositeOperation = 'source-over';
    fctx.clearRect(0, 0, FW, FH);
    // brilho no chão
    const gl = fctx.createRadialGradient(FW / 2, FH, 0, FW / 2, FH, FH * (.75 + H * .3));
    gl.addColorStop(0, `rgba(255,120,40,${(.35 + H * .25).toFixed(3)})`); gl.addColorStop(1, 'rgba(255,80,20,0)');
    fctx.fillStyle = gl; fctx.fillRect(0, 0, FW, FH);
    fctx.globalCompositeOperation = 'lighter';
    for (let k = flames.length - 1; k >= 0; k--) {
      const f = flames[k]; f.l += dt;
      if (f.l > f.L) { flames.splice(k, 1); continue; }
      const a = f.l / f.L;
      f.vx += Math.sin(now / 300 + f.y / 40) * 14 * s * dt; f.x += f.vx * dt; f.y += f.vy * dt;
      const r = f.r * (1 - a * .7);
      // do branco quente ao vermelho, apagando no alto
      const cr = 255, cg = Math.round(220 - 160 * a), cb = Math.round(120 - 110 * Math.min(1, a * 2));
      const al = (1 - a) * (a < .1 ? a * 10 : 1) * .17;
      const g = fctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, r);
      g.addColorStop(0, `rgba(${cr},${cg},${cb},${al.toFixed(3)})`); g.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);
      fctx.fillStyle = g; fctx.fillRect(f.x - r, f.y - r, r * 2, r * 2);
    }
    for (let k = sparks.length - 1; k >= 0; k--) {
      const p = sparks[k]; p.l += dt;
      if (p.l > p.L) { sparks.splice(k, 1); continue; }
      p.vx += (Math.random() - .5) * 200 * s * dt; p.vy += 30 * s * dt; p.x += p.vx * dt; p.y += p.vy * dt;
      fctx.fillStyle = `rgba(255,${180 + Math.random() * 60 | 0},90,${(1 - p.l / p.L).toFixed(3)})`;
      fctx.fillRect(p.x, p.y, 2 * DPR * .5 + 1, 2 * DPR * .5 + 1);
    }
    fctx.globalCompositeOperation = 'source-over';
  }
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible && !raf) { last = 0; sizeFire(); raf = requestAnimationFrame(fireFrame); } }, { rootMargin: '100px' }).observe(root);
  addEventListener('resize', sizeFire);

  // ---------- arrastar a nota ----------
  let drag = null, burning = false, home = { x: 0, y: 0 };
  const pos = { x: 0, y: 0, r: 0 };
  function place() { note.style.transform = `translate3d(${pos.x.toFixed(1)}px, ${pos.y.toFixed(1)}px, 0) rotate(${pos.r.toFixed(2)}deg)`; }
  function overFire() {
    const nr = note.getBoundingClientRect(), fr = fireCv.getBoundingClientRect();
    return nr.top + nr.height * .5 > fr.top + fr.height * .64;
  }
  note.addEventListener('pointerdown', e => {
    if (burning) return;
    e.preventDefault(); note.setPointerCapture(e.pointerId);
    drag = { x: e.clientX - pos.x, y: e.clientY - pos.y, lx: e.clientX };
    note.classList.add('drag'); root.classList.add('dragging');
  });
  note.addEventListener('pointermove', e => {
    if (!drag) return;
    pos.x = e.clientX - drag.x; pos.y = e.clientY - drag.y;
    pos.r = clamp((e.clientX - drag.lx) * .6, -14, 14); drag.lx = e.clientX;
    place();
    root.classList.toggle('hot', overFire());
  });
  const drop = () => {
    if (!drag) return;
    drag = null; note.classList.remove('drag'); root.classList.remove('dragging');
    if (overFire()) burn();
    else { pos.x = 0; pos.y = 0; pos.r = 0; note.classList.add('back'); place(); setTimeout(() => note.classList.remove('back'), 600); }
    root.classList.remove('hot');
  };
  note.addEventListener('pointerup', drop); note.addEventListener('pointercancel', drop);
  note.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); throwIn(); } });
  btn.addEventListener('click', throwIn);
  input.addEventListener('input', () => { if (!burning) drawNote(input.value); });
  root.querySelector('form').addEventListener('submit', e => { e.preventDefault(); throwIn(); });

  // sem arrastar (teclado, botão): a nota cai sozinha na lareira
  function throwIn() {
    if (burning) return;
    const nr = note.getBoundingClientRect(), fr = fireCv.getBoundingClientRect();
    pos.x = 0; pos.y = (fr.top + fr.height * .8) - (nr.top + nr.height / 2) + pos.y; pos.r = -8;
    note.classList.add('fall'); place();
    setTimeout(() => { note.classList.remove('fall'); burn(); }, 700);
  }

  function burn() {
    burning = true; root.classList.add('burnt');
    flare = .85;
    const src = nctx.getImageData(0, 0, NW, NH), sd = src.data, out = nctx.createImageData(NW, NH), od = out.data;
    // o fogo sobe da borda de baixo, irregular
    const field = new Float32Array(NW * NH);
    const seed = Math.random() * 100;
    for (let y = 0; y < NH; y++) for (let x = 0; x < NW; x++) {
      const n = Math.sin(x * .031 + seed) * .5 + Math.sin(x * .093 + y * .05 + seed * 2) * .3 + Math.sin(x * .21 - y * .17) * .2;
      field[y * NW + x] = (1 - y / NH) * .78 + (n * .5 + .5) * .22;
    }
    const t0 = performance.now(), D = 2600;
    const embers = [];
    const step = now => {
      const t = clamp((now - t0) / D), th = t * 1.15 - .05;
      for (let i = 0, p = 0; i < field.length; i++, p += 4) {
        const d = field[i] - th;
        if (d < 0) { od[p + 3] = 0; continue; }
        if (d < .02) { od[p] = 255; od[p + 1] = 150 + 90 * (1 - d / .02); od[p + 2] = 60; od[p + 3] = 255; continue; }
        if (d < .08) { const k = 1 - (d - .02) / .06, c = 1 - k * .9; od[p] = sd[p] * c + 30 * k; od[p + 1] = sd[p + 1] * c + 10 * k; od[p + 2] = sd[p + 2] * c; od[p + 3] = 255; continue; }
        od[p] = sd[p]; od[p + 1] = sd[p + 1]; od[p + 2] = sd[p + 2]; od[p + 3] = sd[p + 3];
      }
      nctx.putImageData(out, 0, 0);
      for (let k = 0; k < 14 && t < .97; k++) {
        const x = Math.random() * NW | 0, y = Math.random() * NH | 0, d = field[y * NW + x] - th;
        if (d >= 0 && d < .03) embers.push({ x, y, vx: (Math.random() - .5) * 60, vy: -(80 + Math.random() * 160), l: 0, L: .5 + Math.random() * .7 });
      }
      nctx.globalCompositeOperation = 'lighter';
      for (let k = embers.length - 1; k >= 0; k--) {
        const q = embers[k]; q.l += 1 / 60; if (q.l > q.L) { embers.splice(k, 1); continue; }
        q.x += q.vx / 60; q.y += q.vy / 60;
        nctx.fillStyle = `rgba(255,${170 + Math.random() * 70 | 0},80,${(1 - q.l / q.L).toFixed(3)})`; nctx.fillRect(q.x, q.y, 3, 3);
      }
      nctx.globalCompositeOperation = 'source-over';
      if (t < 1 || embers.length) requestAnimationFrame(step);
      else finish();
    };
    requestAnimationFrame(step);
  }
  function finish() {
    const t = (input.value || '').trim() || 'sua palavra';
    end.innerHTML = `Gánia desmaiou antes de tirar o dinheiro das chamas.<br><em class="sw">“${t.replace(/[<>&"]/g, '')}” não estava à venda.</em>`;
    root.classList.add('done');
    again.hidden = false;
  }
  again.addEventListener('click', () => {
    burning = false; root.classList.remove('burnt', 'done'); again.hidden = true; end.textContent = '';
    pos.x = 0; pos.y = 0; pos.r = 0; place(); drawNote(input.value);
    input.focus();
  });

  (document.fonts ? document.fonts.ready : Promise.resolve()).then(() => drawNote(''));
  drawNote('');
}
