/*
  O Paradoxo — ser bom é suficiente?
  Fonte: vídeo "O Paradoxo de Ser uma Boa Pessoa | O Alerta de Dostoiévski para a Sociedade"
  (A Psique, 15/03/2026, youtube.com/watch?v=7dcqp1zuZd4) sobre O Idiota (1869).
  As imagens são quadros do próprio vídeo (pinturas a óleo), algumas recortadas para flutuar.
  Roteiro: 7 cenas seguindo a narração do vídeo → página em papel com a "bondade forte".
*/
import Lenis from 'lenis';
import { createSound } from 'app/sound.js';
import { ignite } from 'app/ignite.js';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const params = new URLSearchParams(location.search);
const STILL = params.has('still');
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = matchMedia('(pointer: fine)').matches;
const easeOut = x => 1 - Math.pow(1 - x, 3);
const easeIO = x => (x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const asset = u => (window.__ASSETS && window.__ASSETS[u]) || u;

// ---------- texto quebrado em palavras e letras ----------
function splitChars(root) {
  let n = 0;
  const label = root.textContent.replace(/\s+/g, ' ').trim();
  const walk = node => {
    [...node.childNodes].forEach(ch => {
      if (ch.nodeType === 3) {
        const frag = document.createDocumentFragment();
        ch.textContent.split(/(\s+)/).forEach(part => {
          if (!part) return;
          if (/^\s+$/.test(part)) { frag.append(' '); return; }
          const w = document.createElement('span'); w.className = 'w'; w.setAttribute('aria-hidden', 'true');
          [...part].forEach(c => { const sp = document.createElement('span'); sp.className = 'ch'; sp.textContent = c; sp.style.setProperty('--ci', n++); w.append(sp); });
          frag.append(w);
        });
        ch.replaceWith(frag);
      } else if (ch.nodeType === 1) walk(ch);
    });
  };
  walk(root);
  const sr = document.createElement('span'); sr.className = 'sr'; sr.textContent = label;
  root.append(sr);
  return [...root.querySelectorAll('.ch')];
}
function splitWords(root) {
  const words = [];
  const walk = node => [...node.childNodes].forEach(ch => {
    if (ch.nodeType === 3) {
      const frag = document.createDocumentFragment();
      ch.textContent.split(/(\s+)/).forEach(part => {
        if (!part) return;
        if (/^\s+$/.test(part)) { frag.append(part); return; }
        const w = document.createElement('span'); w.className = 'lw'; w.textContent = part; words.push(w); frag.append(w);
      });
      ch.replaceWith(frag);
    } else if (ch.nodeType === 1) walk(ch);
  });
  walk(root);
  return words;
}

// ---------- rolagem suave ----------
let lenis = null;
if (!STILL && !reduced) {
  lenis = new Lenis({ lerp: .09, wheelMultiplier: .9, touchMultiplier: 1.4 });
  lenis.stop();
  const tick = t => { lenis.raf(t); requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
  document.addEventListener('click', e => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const id = a.getAttribute('href');
    const el = id === '#top' ? null : document.querySelector(id);
    if (id !== '#top' && !el) return;
    e.preventDefault();
    lenis.scrollTo(el || 0, { offset: el ? -20 : 0, duration: 2.2 });
  });
}

function detectTier() {
  const q = params.get('q');
  if (q) return q;
  const c = document.createElement('canvas');
  const gl = c.getContext('webgl2') || c.getContext('webgl');
  if (!gl) return 'off';
  if ((navigator.deviceMemory || 8) <= 2 || matchMedia('(pointer: coarse)').matches || innerWidth < 820) return 'low';
  return 'high';
}
const tier = detectTier();

// ---------- carregamento ----------
const loader = $('#loader'), loadN = $('#loadN'), loadPic = $('#loadPic');
let world = null;
let introP = STILL || reduced ? 1 : 0;

// enquanto carrega, as pinturas passam como num projetor
const LOAD_PICS = ['p15-rua', 'p01-retrato', 'p09-caveira', 'p03-trem', 'p06-salao', 'p05-nastassia', 'p12-angustia', 'p07-flor', 'p19-brinde', 'p20-duas'];
let picI = 0;
const picTimer = loadPic && !reduced && !STILL ? setInterval(() => { loadPic.src = asset('img/paint/' + LOAD_PICS[picI++ % LOAD_PICS.length] + '.jpg'); }, 150) : 0;

function reveal() {
  clearInterval(picTimer);
  document.body.classList.remove('is-loading');
  loader.classList.add('out');
  setTimeout(() => loader.remove(), 1700);
  if (introP < 1) {
    const t0 = performance.now() + 300, D = 2800;
    if (world) world.set({ intro: 0 });
    const step = now => {
      introP = clamp((now - t0) / D);
      if (world) world.set({ intro: easeOut(introP) });
      updateWorld();
      if (introP < 1) requestAnimationFrame(step); else if (lenis) lenis.start();
    };
    requestAnimationFrame(step);
  } else if (lenis) lenis.start();
  onScroll();
  // enquanto há 3D, o texto acompanha a câmera a cada quadro
  const follow = () => {
    if (world) { const r = worldEl.getBoundingClientRect(); if (r.bottom > 0 && r.top < innerHeight) updateWorld(); }
    requestAnimationFrame(follow);
  };
  if (world && !STILL) requestAnimationFrame(follow);
}

(async () => {
  try { await document.fonts.ready; } catch (e) { /* segue */ }
  if (tier === 'off') { $('#gl').hidden = true; stage.classList.add('flat'); coreEl.classList.add('flat'); if (STILL) reveal(); else { clearInterval(picTimer); loader.classList.add('ready'); loadN.textContent = '32'; } return; }
  try {
    const { createWorld } = await import('./world/world.js');
    world = await createWorld({
      canvas: $('#gl'), tier, still: STILL,
      onProgress: v => { loadN.textContent = String(Math.round(v * 32)).padStart(2, '0'); },
    });
    window.__world = world;
    if (!STILL) world.start();
  } catch (e) {
    console.warn('Sem 3D:', e);
    $('#gl').hidden = true;
    stage.classList.add('flat');
  }
  await initCore();
  if (STILL) { reveal(); return; }
  clearInterval(picTimer);
  loader.classList.add('ready'); loadN.textContent = '32';
  $('#enterSnd').focus({ preventScroll: true });
})();

// ---------- atração principal: o rosto do paradoxo ----------
const coreEl = $('#core'), coreCanvas = $('#coreGl'), coreFlat = $('#coreFlat');
const caps = $$('.cap', coreEl);
// janelas em que cada legenda fica na tela (progresso 0..1 da seção)
const CAP_WIN = [[.0, .1], [.43, .52], [.85, .91], [.92, 1.01]];
const FLAT_IMG = ['p01-retrato', 'p16-olhar', 'p05-nastassia', 'p05-nastassia'];
const CORE_SEG = [[-2, -1], [.12, .42], [.54, .84], [.9, 1]];
let core = null, coreP = 0, coreHeat = 0;
async function initCore() {
  try {
    const { createCore } = await import('./core/core.js');
    core = await createCore({ canvas: coreCanvas, tier, still: STILL, asset });
    window.__core = core;
  } catch (e) {
    console.warn('Sem partículas:', e);
    coreCanvas.hidden = true; coreEl.classList.add('flat');
  }
}
function updateCore() {
  const r = coreEl.getBoundingClientRect();
  const p = clamp(-r.top / (r.height - innerHeight));
  coreP = p;
  if (core) core.set({ p });
  caps.forEach((c, k) => c.classList.toggle('on', p >= CAP_WIN[k][0] && p < CAP_WIN[k][1]));
  let heat = 0;
  CORE_SEG.forEach(([a, b], k) => { if (k && p > a && p < b) heat = Math.sin((p - a) / (b - a) * Math.PI); });
  coreHeat = r.top < innerHeight && r.bottom > 0 ? heat : 0;
  if (!core) {
    const k = CAP_WIN.findIndex(([a, b]) => p >= a - .04 && p < b);
    const img = asset('img/paint/' + FLAT_IMG[Math.max(0, k)] + '.jpg');
    if (coreFlat.dataset.k !== img) { coreFlat.dataset.k = img; coreFlat.src = img; }
    coreFlat.style.opacity = p > .86 ? 0 : 1;
  }
}
{
  const setPtr = (e, active) => {
    if (!core) return;
    const rc = coreCanvas.getBoundingClientRect();
    core.set({ mx: ((e.clientX - rc.left) / rc.width - .5) * 2, my: -((e.clientY - rc.top) / rc.height - .5) * 2, active });
  };
  coreCanvas.addEventListener('pointermove', e => setPtr(e, true), { passive: true });
  coreCanvas.addEventListener('pointerdown', e => setPtr(e, true), { passive: true });
  coreCanvas.addEventListener('pointerleave', e => setPtr(e, false));
  coreCanvas.addEventListener('pointerup', e => { if (e.pointerType !== 'mouse') setPtr(e, false); });
}

// ---------- trilha ----------
const sound = createSound();
const sndBtn = $('#sndBtn');
function setSound(v) {
  if (v) sound.start(); else sound.stop();
  sndBtn.setAttribute('aria-pressed', v);
  document.body.classList.toggle('snd-on', v);
}
$('#enterSnd').addEventListener('click', () => { setSound(true); reveal(); });
$('#enterMute').addEventListener('click', () => reveal());
sndBtn.addEventListener('click', () => setSound(!sound.on));
document.addEventListener('visibilitychange', () => {
  if (document.hidden && sound.on) { sound.stop(); sound.wasOn = true; }
  else if (!document.hidden && sound.wasOn) { sound.wasOn = false; setSound(true); }
});
let curU = 0;
setInterval(() => {
  if (!sound.on) return;
  const w = world && world.stats;
  const o = w ? { heat: w.heat, transit: w.transit, fin: w.fin, scene: w.scene }
    : { heat: 0, transit: 0, fin: clamp((curU - 6) / .5), scene: Math.min(LAST, Math.round(curU)) };
  // na atração principal: cada troca de rosto é uma explosão de brasa
  const cr = coreEl.getBoundingClientRect();
  if (cr.top < innerHeight * .5 && cr.bottom > innerHeight * .5) { o.heat = coreHeat; o.transit = coreHeat * .8; o.scene = 7 + CORE_SEG.findIndex(([a, b]) => coreP < b); o.fin = coreP > .86 ? 1 : 0; }
  sound.update(o);
}, 80);

// ---------- menu ----------
const menuBtn = $('#menuBtn'), menu = $('#menu');
function toggleMenu(v = menu.hidden) { menu.hidden = !v; menuBtn.setAttribute('aria-expanded', v); menuBtn.textContent = v ? 'Fechar' : 'Menu'; }
menuBtn.addEventListener('click', () => toggleMenu());
$$('a', menu).forEach(a => a.addEventListener('click', () => toggleMenu(false)));
addEventListener('keydown', e => { if (e.key === 'Escape' && !menu.hidden) { toggleMenu(false); menuBtn.focus(); } });

addEventListener('pointermove', e => {
  if (world) world.pointer((e.clientX / innerWidth - .5) * 2, -(e.clientY / innerHeight - .5) * 2);
}, { passive: true });

// ---------- ato 1: cenas ----------
const worldEl = $('#world');
const sts = $$('.st').map(el => ({
  el, i: +el.dataset.st,
  lines: $$('.ln', el).map(ln => ({ el: ln, chars: ln.closest('.st__t') && !reduced ? splitChars(ln) : null })),
}));
sts.forEach(s => s.lines.forEach(ln => ln.chars && prepChars(ln.chars)));
const LAST = 6, SPAN = 6.6;
const idx = $$('#index li'), indexEl = $('#index');
const hdr = $('#hdr'), cue = $('#cue');

// sem 3D: a pintura da cena atual vira o fundo do palco
const FALLBACK = ['p15-rua', 'p09-caveira', 'p03-trem', 'p06-salao', 'p12-angustia', 'p07-flor', 'p19-brinde'];
const stage = $('.stage');
let fbCur = -1;

// título: as letras se acendem como brasa que esfria até a cor do texto;
// na saída o fogo pega a palavra a partir de um ponto, cada letra fica em brasa,
// carboniza e sobe como cinza.
const EMBER = [255, 150, 64], CHAR = [34, 20, 12];
const mixC = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
function prepChars(chars) {
  const N = chars.length, ig = Math.random() * N; // ponto onde o fogo pega
  chars.forEach((c, k) => {
    const m = getComputedStyle(c).color.match(/\d+/g) || [241, 232, 216];
    c._base = m.slice(0, 3).map(Number);
    c._o = clamp(Math.abs(k - ig) / Math.max(4, N * .7)) * .75 + Math.random() * .25;
    c._dx = (Math.random() - .5) * 60; c._r = (Math.random() - .5) * 50;
    c._key = '';
  });
}
function charStyle(chars, inN, outN) {
  const N = chars.length, st = Math.min(.07, .9 / N);
  chars.forEach((c, k) => {
    let tf, col, sh = 'none', op = 1;
    if (outN > 0) {
      const b = clamp(outN * 1.7 - c._o * .7);
      const heat = clamp(b / .3), burnt = clamp((b - .25) / .3), ash = easeOut(clamp((b - .45) / .55));
      col = mixC(mixC(c._base, EMBER, heat), CHAR, burnt);
      const g = heat * (1 - burnt * .7) * (1 - ash);
      if (g > .02) sh = `0 0 ${(.12 + g * .25).toFixed(2)}em rgba(255,110,30,${(g * .9).toFixed(2)}), 0 0 .04em rgba(255,200,120,${g.toFixed(2)})`;
      tf = `translate3d(${(c._dx * ash).toFixed(1)}%,${(-ash * 140).toFixed(1)}%,0) rotate(${(c._r * ash).toFixed(1)}deg) scale(${(1 - ash * .35).toFixed(3)})`;
      op = 1 - ash;
    } else {
      const pi = easeOut(clamp(inN * (1 + N * st) - k * st));
      const cool = clamp((pi - .35) / .65);
      col = mixC(EMBER, c._base, cool);
      const g = pi * (1 - cool);
      if (g > .02) sh = `0 0 ${(.1 + g * .3).toFixed(2)}em rgba(255,120,40,${(g * .8).toFixed(2)})`;
      tf = `translate3d(0,${((1 - pi) * 70).toFixed(1)}%,0) rotate(${((1 - pi) * 8).toFixed(1)}deg)`;
      op = pi;
    }
    const key = tf + col + op;
    if (key === c._key) return;
    c._key = key;
    c.style.transform = tf;
    c.style.color = `rgb(${col})`;
    c.style.textShadow = sh;
    c.style.opacity = op.toFixed(3);
  });
}

function lineStyle(el, inN, outN) {
  if (reduced) { el.style.opacity = Math.min(inN, 1 - outN); return; }
  let o, y, b;
  if (outN > 0) { o = 1 - outN; y = -outN * 50; b = outN * 8; }
  else { const e = 1 - inN; o = inN; y = e * 90; b = e * 10; }
  el.style.opacity = o.toFixed(3);
  el.style.transform = `translate3d(0,${y.toFixed(1)}px,0)`;
  el.style.filter = b > .1 ? `blur(${b.toFixed(1)}px)` : 'none';
}

function updateWorld() {
  const r = worldEl.getBoundingClientRect();
  const p = clamp(-r.top / (r.height - innerHeight));
  const su = p * SPAN;
  if (world) world.set({ u: Math.min(su, SPAN) });
  // o texto segue a câmera (que espera o fogo), não a barra de rolagem
  const u = world && !STILL ? world.progress : su;
  curU = u;

  for (const s of sts) {
    const inV = s.i === 0 ? clamp(introP * 1.25 - .2) : clamp((u - (s.i - .14)) / .16);
    const outV = s.i === LAST ? clamp((u - 6.42) / .14) : clamp((u - (s.i + .34)) / .12);
    const vis = inV > 0 && outV < 1;
    s.el.classList.toggle('vis', vis);
    if (!vis) continue;
    const L = s.lines.length, st = .14;
    s.lines.forEach((ln, n) => {
      const a = clamp(inV * (1 + (L - 1) * st) - n * st), b = clamp(outV * (1 + (L - 1) * st) - (L - 1 - n) * st * .5);
      if (ln.chars) charStyle(ln.chars, a, b);
      else lineStyle(ln.el, a, b);
    });
  }
  const cur = Math.min(LAST, Math.floor(u + .14));
  if (!world && cur !== fbCur) { fbCur = cur; stage.style.backgroundImage = `url(${asset('img/paint/' + FALLBACK[cur] + '.jpg')})`; }
  idx.forEach((li, k) => li.classList.toggle('on', k === cur));
  indexEl.classList.toggle('gone', p >= .985);
  cue.style.opacity = u > .05 || introP < 1 ? 0 : 1;
}

// ---------- ato 2 ----------
// borda de papel rasgado
{
  const pts = []; let x = 0;
  while (x < 100) { pts.push(`${x.toFixed(2)}% ${(6 + Math.random() * 30 + Math.sin(x * .21) * 8).toFixed(1)}%`); x += .5 + Math.random() * 1.6; }
  pts.push('100% 60%', '100% 100%', '0% 100%');
  $('.tear').style.clipPath = `polygon(${pts.join(',')})`;
  // faíscas que sobem da borda que ainda queima
  const sm = document.createElement('div'); sm.className = 'smolder'; sm.setAttribute('aria-hidden', 'true');
  for (let i = 0; i < (finePointer ? 26 : 14); i++) {
    const e = document.createElement('i');
    e.style.cssText = `left:${(Math.random() * 100).toFixed(1)}%;--t:${(2.2 + Math.random() * 2.8).toFixed(2)}s;--d:${(-Math.random() * 5).toFixed(2)}s;--x:${((Math.random() - .5) * 120).toFixed(0)}px;--h:${(90 + Math.random() * 160).toFixed(0)}px;--s:${(.5 + Math.random()).toFixed(2)}`;
    sm.append(e);
  }
  $('.tear').after(sm);
}

const deck = $('#deck'), cards = $$('.dc', deck);
cards.forEach(c => {
  c.addEventListener('click', () => { if (!finePointer) c.classList.toggle('flip'); });
  c.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); c.classList.toggle('flip'); } });
});
cards.forEach((c, k) => c.style.setProperty('--i', (k - (cards.length - 1) / 2).toFixed(2)));

// títulos da página: letras sobem quando entram na tela; o resto aparece em sequência
$$('.big, .foot__t').forEach(h => { splitChars(h); h.classList.add('rv'); });
$$('.kick, .note, .pick__btns, .foot .btn, .foot__q, .foot__cols p, .cast li, .frame').forEach(e => e.classList.add('up'));
$$('.cast li').forEach((li, k) => li.style.setProperty('--d', k * 70 + 'ms'));
$$('.foot__cols p').forEach((p, k) => p.style.setProperty('--d', k * 90 + 'ms'));
const seen = new IntersectionObserver(es => es.forEach(e => {
  if (e.isIntersecting) { e.target.classList.add('in'); seen.unobserve(e.target); }
}), { rootMargin: '0px 0px -10% 0px' });
$$('.rv, .up').forEach(e => (reduced || STILL ? e.classList.add('in') : seen.observe(e)));

// imagens do papel: pegam fogo e se revelam quando entram na tela
if (!STILL && !reduced) {
  const burnIn = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return;
    burnIn.unobserve(e.target);
    const el = e.target;
    if (el.classList.contains('dc')) ignite($('img', el), { cover: '#f8f2e6', dur: 1.5, delay: (+el.dataset.k) * .12 });
    else if (el.classList.contains('frame')) ignite(frameImg, { cover: '#120b07', dur: 2.2, delay: .25 });
    else if (el.classList.contains('next')) ignite($('img', el), { cover: '#1b130d', dur: 1.8 });
  }), { rootMargin: '0px 0px -18% 0px' });
  $$('.dc').forEach((c, k) => { c.dataset.k = k; ignite($('img', c), { cover: '#f8f2e6', dur: 0 }); burnIn.observe(c); });
  [$('.frame'), $('.next')].forEach(el => el && burnIn.observe(el));
  // começam cobertas
  const fi = $('.player__face img'); if (fi) ignite(fi, { cover: '#120b07', dur: 0 });
  const ni = $('.next img'); if (ni) ignite(ni, { cover: '#1b130d', dur: 0 });
}

// parágrafo que acende palavra por palavra com a rolagem
const lede = $('.lede'), ledeWords = splitWords(lede);
// moldura do vídeo abre com a rolagem
const frame = $('.frame'), frameImg = $('.player__face img');

function updatePage() {
  const page = $('#page').getBoundingClientRect();
  hdr.classList.toggle('on-page', page.top < 40);
  $('#page').classList.toggle('lit', page.top < innerHeight + 60 && page.top > -260);
  const lr = lede.getBoundingClientRect();
  const lp = reduced ? 1 : clamp((innerHeight * .85 - lr.top) / (lr.height + innerHeight * .3));
  const lit = lp * (ledeWords.length + 3);
  ledeWords.forEach((w, k) => { w.style.opacity = (.14 + .86 * clamp(lit - k)).toFixed(2); });
  const fr = frame.getBoundingClientRect();
  const fp = reduced ? 1 : easeOut(clamp((innerHeight - fr.top) / (innerHeight * .75)));
  frame.style.clipPath = `inset(${((1 - fp) * 12).toFixed(2)}% ${((1 - fp) * 16).toFixed(2)}% round ${(6 + (1 - fp) * 30).toFixed(1)}px)`;
  if (frameImg) frameImg.style.scale = (1 + (1 - fp) * .3).toFixed(3);
  const d = deck.getBoundingClientRect();
  const open = reduced ? 1 : clamp((innerHeight * .95 - d.top) / (innerHeight * .6));
  deck.style.setProperty('--open', open.toFixed(3));
}

let lastY = scrollY, ticking = false;
function onScroll() {
  updateWorld();
  updateCore();
  updatePage();
  const dy = scrollY - lastY; lastY = scrollY;
  if (world && !reduced) world.kick(dy);
}
addEventListener('scroll', () => {
  if (STILL) { onScroll(); return; }
  if (!ticking) { ticking = true; requestAnimationFrame(() => { ticking = false; onScroll(); }); }
}, { passive: true });
addEventListener('resize', onScroll);
onScroll();

// cursor: ponto + anel que cresce sobre o que é clicável
if (finePointer && !reduced && !STILL) {
  const dot = document.createElement('div'), ring = document.createElement('div');
  dot.className = 'cur'; ring.className = 'cur cur--ring';
  document.body.append(dot, ring);
  let x = -100, y = -100, rx = x, ry = y;
  addEventListener('pointermove', e => {
    x = e.clientX; y = e.clientY;
    ring.classList.toggle('hot', !!e.target.closest('a, button, .dc, #cast li'));
    document.body.classList.add('has-cur');
  }, { passive: true });
  document.addEventListener('pointerleave', () => document.body.classList.remove('has-cur'));
  const follow = () => {
    rx += (x - rx) * .17; ry += (y - ry) * .17;
    dot.style.transform = `translate3d(${x}px,${y}px,0)`;
    ring.style.transform = `translate3d(${rx.toFixed(1)}px,${ry.toFixed(1)}px,0)`;
    requestAnimationFrame(follow);
  };
  follow();
  // botões magnéticos
  $$('.btn, .pill, .player__play').forEach(b => {
    const host = b.classList.contains('player__play') ? b.parentElement : b;
    host.addEventListener('pointermove', e => {
      const r = b.getBoundingClientRect();
      b.style.translate = `${((e.clientX - r.left - r.width / 2) * .28).toFixed(1)}px ${((e.clientY - r.top - r.height / 2) * .28).toFixed(1)}px`;
    });
    host.addEventListener('pointerleave', () => { b.style.translate = ''; });
  });
}

// retrato que segue o cursor
const peek = $('#peek'), peekImg = $('img', peek);
$$('#cast li').forEach(li => {
  li.addEventListener('pointerenter', () => {
    if (peekImg.dataset.src !== li.dataset.img) { peekImg.dataset.src = li.dataset.img; peekImg.src = asset(li.dataset.img); }
    peek.classList.add('on');
    if (!reduced) ignite(peekImg, { cover: '#eee4d1', dur: .75 });
  });
  li.addEventListener('pointerleave', () => peek.classList.remove('on'));
  li.addEventListener('pointermove', e => { peek.style.left = e.clientX + 'px'; peek.style.top = e.clientY + 'px'; });
});

// a pergunta do vídeo
const ANS = {
  b: 'Dostoiévski queria escrever “um homem positivamente belo”, o mais perto de Cristo que teve coragem. E termina o livro com esse homem de volta ao sanatório, sem reconhecer ninguém. A santidade dele era verdadeira. Só não salvou uma única pessoa naquela casa.',
  i: 'O apelido é cruel, e o livro sabe disso: Míchkin enxerga o que ninguém mais vê. O que falta a ele não é inteligência. É coragem de agir sobre o que vê, de escolher uma pessoa, de dizer não a outra.',
};
$$('[data-pick]').forEach(b => b.addEventListener('click', () => {
  $$('[data-pick]').forEach(x => x.setAttribute('aria-pressed', x === b));
  const a = $('#pickA');
  a.textContent = ANS[b.dataset.pick];
  splitWords(a).forEach((w, k) => w.style.setProperty('--k', k));
  a.classList.remove('burnin'); void a.offsetWidth; a.classList.add('burnin');
}));

// player
$('#playerBtn').addEventListener('click', () => {
  const f = document.createElement('iframe');
  f.src = 'https://www.youtube-nocookie.com/embed/7dcqp1zuZd4?autoplay=1&rel=0';
  f.title = 'O Paradoxo de Ser uma Boa Pessoa | O Alerta de Dostoiévski para a Sociedade';
  f.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
  f.allowFullscreen = true;
  $('#player').replaceChildren(f);
  f.focus();
});

// copiar
$$('[data-copy]').forEach(b => b.addEventListener('click', async () => {
  const out = b.parentElement.querySelector('.copied');
  try { await navigator.clipboard.writeText(b.dataset.copy); out.textContent = 'Copiado'; } catch (e) { out.textContent = b.dataset.copy; }
  setTimeout(() => { out.textContent = ''; }, 2400);
}));
