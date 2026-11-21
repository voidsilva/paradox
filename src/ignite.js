// Imagens que pegam fogo ao aparecer no papel.
// Um campo de ruído em baixa resolução cobre a imagem com a cor do papel; um limiar
// sobe com o tempo e abre buracos de bordas em brasa, até a imagem ficar inteira.
// O canvas é pequeno (≈ 80 px) e o navegador o amplia com suavização: as bordas
// ficam orgânicas sem custo de GPU.

function field(w, h) {
  const r = () => Math.random();
  const G = 6, gw = Math.ceil(w / G) + 2, gh = Math.ceil(h / G) + 2;
  const g1 = Array.from({ length: gw * gh }, r);
  const G2 = 2.5, hw = Math.ceil(w / G2) + 2, hh = Math.ceil(h / G2) + 2;
  const g2 = Array.from({ length: hw * hh }, r);
  const smp = (g, gw, s, x, y) => {
    const fx = x / s, fy = y / s, ix = Math.floor(fx), iy = Math.floor(fy);
    let tx = fx - ix, ty = fy - iy; tx = tx * tx * (3 - 2 * tx); ty = ty * ty * (3 - 2 * ty);
    const a = g[iy * gw + ix], b = g[iy * gw + ix + 1], c = g[(iy + 1) * gw + ix], d = g[(iy + 1) * gw + ix + 1];
    return a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty;
  };
  // o fogo começa num ponto da borda de baixo e sobe
  const ox = (.2 + Math.random() * .6) * w, oy = h * (.85 + Math.random() * .2);
  const D = Math.hypot(w, h);
  const f = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const n = smp(g1, gw, G, x, y) * .65 + smp(g2, hw, G2, x, y) * .35;
    f[y * w + x] = n * .42 + Math.hypot(x - ox, y - oy) / D * .78;
  }
  let mn = Infinity, mx = -Infinity;
  for (const v of f) { if (v < mn) mn = v; if (v > mx) mx = v; }
  for (let i = 0; i < f.length; i++) f[i] = (f[i] - mn) / (mx - mn);
  return f;
}

const hexRGB = h => { const n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };

// target: a imagem; cover: cor do papel por cima; dur: segundos
export function ignite(target, { cover = '#eee4d1', dur = 1.4, delay = 0 } = {}) {
  if (!target || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const host = target.parentElement;
  if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
  let cv = target._ign;
  if (!cv) {
    cv = document.createElement('canvas');
    cv.className = 'ign'; cv.setAttribute('aria-hidden', 'true');
    host.insertBefore(cv, target.nextSibling);
    target._ign = cv;
  }
  cancelAnimationFrame(cv._raf);
  const place = () => {
    cv.style.left = target.offsetLeft + 'px'; cv.style.top = target.offsetTop + 'px';
    cv.style.width = target.offsetWidth + 'px'; cv.style.height = target.offsetHeight + 'px';
    cv.style.borderRadius = getComputedStyle(target).borderRadius;
  };
  place();
  const asp = (target.offsetHeight || 1) / (target.offsetWidth || 1);
  const W = 72, H = Math.max(8, Math.round(W * asp));
  cv.width = W; cv.height = H;
  const f = field(W, H);
  const g = cv.getContext('2d');
  const img = g.createImageData(W, H), d = img.data;
  const P = hexRGB(cover);
  const draw = t => {
    // t: 0 = tudo coberto, 1 = tudo revelado
    const th = t * 1.25 - .05;
    for (let i = 0, j = 0; i < f.length; i++, j += 4) {
      const v = f[i] - th;           // < 0: já queimou
      if (v < 0) { d[j + 3] = 0; continue; }
      if (v < .035) {                // borda em brasa
        const k = v / .035;
        d[j] = 255; d[j + 1] = 120 + 90 * (1 - k); d[j + 2] = 40 + 60 * (1 - k); d[j + 3] = 255;
      } else if (v < .11) {          // chamuscado
        const k = (v - .035) / .075;
        d[j] = 40 + (P[0] - 40) * k * k; d[j + 1] = 22 + (P[1] - 22) * k * k; d[j + 2] = 12 + (P[2] - 12) * k * k; d[j + 3] = 255;
      } else { d[j] = P[0]; d[j + 1] = P[1]; d[j + 2] = P[2]; d[j + 3] = 255; }
    }
    g.putImageData(img, 0, 0);
  };
  draw(0);
  cv.style.opacity = 1;
  const t0 = performance.now() + delay * 1000;
  const step = now => {
    const t = Math.max(0, (now - t0) / 1000 / dur);
    draw(Math.min(1, t));
    if (t < 1) cv._raf = requestAnimationFrame(step);
    else cv.style.opacity = 0;
  };
  cv._raf = requestAnimationFrame(step);
  addEventListener('resize', place, { once: true });
}
