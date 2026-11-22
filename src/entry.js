/* A entrada: a pintura da tela de abertura vira o mundo.
   mode 'burn' (Idiota): o fogo come a tela de dentro para fora, com borda em brasa e fagulhas subindo.
   mode 'dust' (Montaigne): uma frente de vento varre da esquerda para a direita e leva a tinta em grãos.
   Tudo em canvas 2D, uma vez só, por cima do mundo 3D que já está desenhado embaixo. */
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));

// ruído de valor suave (3 oitavas), calculado uma vez
function noiseField(w, h, seed = 1) {
  const G = 64, grid = new Float32Array((G + 1) * (G + 1));
  let s = seed * 9301 + 49297;
  for (let i = 0; i < grid.length; i++) { s = (s * 9301 + 49297) % 233280; grid[i] = s / 233280; }
  const at = (x, y) => {
    const xi = Math.floor(x) % G, yi = Math.floor(y) % G, xf = x - Math.floor(x), yf = y - Math.floor(y);
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const a = grid[yi * (G + 1) + xi], b = grid[yi * (G + 1) + xi + 1], c = grid[(yi + 1) * (G + 1) + xi], d = grid[(yi + 1) * (G + 1) + xi + 1];
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
  const f = new Float32Array(w * h), k = 6 / Math.max(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const X = x * k, Y = y * k;
    f[y * w + x] = at(X + 3.1, Y + 7.7) * .55 + at(X * 2.3 + 11, Y * 2.3 + 5) * .3 + at(X * 6.1 + 23, Y * 6.1 + 17) * .15;
  }
  return f;
}

export function dissolve({ img, host, mode = 'burn', filter = 'none', shade = null, dur = 1900, bleed = 24 }) {
  return new Promise(resolve => {
    const vw = innerWidth, vh = innerHeight;
    const S = Math.min(1, (vw > 900 ? 1100 : 720) / vw);
    const W = Math.max(2, Math.round(vw * S)), H = Math.max(2, Math.round(vh * S));
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    cv.setAttribute('aria-hidden', 'true');
    cv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;z-index:3;pointer-events:none';
    const ctx = cv.getContext('2d', { willReadFrequently: true });
    // a mesma imagem e o mesmo filtro da tela de abertura, então a troca não se nota
    const iw = img.naturalWidth || 1, ih = img.naturalHeight || 1;
    const bw = (vw + bleed * 2) * S, bh = (vh + bleed * 2) * S;
    const sc = Math.max(bw / iw, bh / ih), dw = iw * sc, dh = ih * sc;
    try { ctx.filter = filter; } catch (e) { /* sem filtro */ }
    ctx.drawImage(img, (W - dw) / 2, (H - dh) / 2, dw, dh);
    ctx.filter = 'none';
    if (shade) shade(ctx, W, H);
    const src = ctx.getImageData(0, 0, W, H), out = ctx.createImageData(W, H);
    const sd = src.data, od = out.data;
    const nf = noiseField(W, H, mode === 'burn' ? 3 : 7);
    // campo de chegada: o fogo nasce embaixo, um pouco à esquerda; o vento entra pela esquerda
    const field = new Float32Array(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x, n = nf[i];
      if (mode === 'burn') {
        const dx = (x / W - .42) * (W / H), dy = y / H - .78;
        field[i] = clamp(Math.hypot(dx, dy) / 1.25) * .55 + n * .45;
      } else {
        field[i] = clamp(x / W * .7 + n * .3 + Math.sin(y / H * 6.3) * .03);
      }
    }
    host.append(cv);
    img.style.visibility = 'hidden';
    const parts = [];
    const t0 = performance.now();
    const E1 = mode === 'burn' ? .025 : .05, E2 = mode === 'burn' ? .09 : .0;
    function frame(now) {
      const t = clamp((now - t0) / dur);
      const e = t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      const th = e * (1 + E1 + E2 + .02) - .02;
      for (let i = 0, p = 0; i < field.length; i++, p += 4) {
        const d = field[i] - th;
        if (d < 0) { od[p + 3] = 0; continue; }
        let r = sd[p], g = sd[p + 1], b = sd[p + 2], a = 255;
        if (mode === 'burn') {
          if (d < E1) {
            // borda em brasa: branco quente no fio, laranja logo atrás
            const k = d / E1;
            r = 255; g = 120 + 120 * (1 - k); b = 40 + 140 * (1 - k) * (1 - k);
          } else if (d < E1 + E2) {
            // papel chamuscado antes de queimar
            const k = 1 - (d - E1) / E2, c = 1 - k * .85;
            r = r * c + 40 * k; g = g * c + 14 * k; b = b * c;
          }
        } else if (d < E1) {
          // grão a grão: só parte da tinta ainda está presa
          const h = (Math.sin(i * 12.9898) * 43758.5453) % 1;
          if (Math.abs(h) > d / E1) { od[p + 3] = 0; continue; }
        }
        od[p] = r; od[p + 1] = g; od[p + 2] = b; od[p + 3] = a;
      }
      ctx.putImageData(out, 0, 0);
      // partículas: fagulhas sobem / grãos voam com o vento
      if (t < .96) {
        const want = mode === 'burn' ? 70 : 420;
        for (let tries = 0, made = 0; tries < want * 6 && made < want; tries++) {
          const x = Math.random() * W | 0, y = Math.random() * H | 0, i = y * W + x, d = field[i] - th;
          if (d < 0 || d > E1 * 1.5) continue;
          made++;
          const p = i * 4;
          parts.push(mode === 'burn'
            ? { x, y, vx: (Math.random() - .5) * 40 * S, vy: -(60 + Math.random() * 140) * S, l: 0, L: .6 + Math.random() * .9, s: (1 + Math.random() * 2.2) * S, c: `255,${150 + Math.random() * 90 | 0},${60 + Math.random() * 60 | 0}` }
            : { x, y, vx: (120 + Math.random() * 380) * S, vy: -(20 + Math.random() * 120) * S, l: 0, L: .7 + Math.random() * .9, s: (1 + Math.random() * 1.8) * S, c: `${sd[p]},${sd[p + 1]},${sd[p + 2]}`, w: Math.random() * 6.28 });
        }
      }
      const dt = 1 / 60;
      if (mode === 'burn') ctx.globalCompositeOperation = 'lighter';
      for (let k = parts.length - 1; k >= 0; k--) {
        const q = parts[k];
        q.l += dt;
        if (q.l > q.L) { parts.splice(k, 1); continue; }
        if (mode === 'burn') { q.vx += (Math.random() - .5) * 30 * S; q.vy -= 20 * S * dt; }
        else { q.w += dt * 3; q.vy += Math.sin(q.w) * 40 * S * dt; q.vx *= .995; }
        q.x += q.vx * dt; q.y += q.vy * dt;
        const a = 1 - q.l / q.L;
        ctx.fillStyle = `rgba(${q.c},${(mode === 'burn' ? a : a * .95).toFixed(3)})`;
        ctx.fillRect(q.x, q.y, q.s, q.s);
      }
      ctx.globalCompositeOperation = 'source-over';
      if (t < 1 || parts.length) requestAnimationFrame(frame);
      else { cv.remove(); resolve(); }
    }
    requestAnimationFrame(frame);
  });
}
