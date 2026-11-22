/*
  O Paradoxo — ser bom é suficiente?
  Fonte: vídeo "O Paradoxo de Ser uma Boa Pessoa | O Alerta de Dostoiévski para a Sociedade"
  (A Psique, 15/03/2026, youtube.com/watch?v=7dcqp1zuZd4) sobre O Idiota (1869).
  As imagens são quadros do próprio vídeo (pinturas a óleo), algumas recortadas para flutuar.
  Roteiro: 7 cenas seguindo a narração do vídeo → página em papel com a "bondade forte".
*/
import Lenis from 'lenis';
import { dissolve } from './entry.js';
import { initFire } from './fire.js';
import { initRail } from './rail.js';
import './leave.js';
import { createSound } from 'app/sound.js';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const params = new URLSearchParams(location.search);
const STILL = params.has('still');
// "Reduzir movimento" (Windows com efeitos de animação desligados): tudo que segue a rolagem da própria pessoa
// continua; saem só a inércia da rolagem, o projetor que pisca, a distorção pela velocidade e os botões magnéticos.
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
let introP = STILL ? 1 : 0;

// enquanto carrega, as pinturas passam como num projetor
const LOAD_PICS = ['p15-rua', 'p01-retrato', 'p09-caveira', 'p03-trem', 'p06-salao', 'p05-nastassia', 'p12-angustia', 'p07-flor', 'p19-brinde', 'p20-duas'];
let picI = 0;
const picTimer = 0; // a abertura agora é uma pintura parada que entra em foco (antes trocava a cada 150 ms)

function reveal() {
  clearInterval(picTimer);
  document.body.classList.remove('is-loading');
  loader.classList.add('out');
  // a pintura da abertura vira o mundo: queima
  const pic = $('#loadPic');
  const go = () => dissolve({ img: pic, host: loader, mode: 'burn', filter: 'brightness(.62) saturate(.95)', dur: 1900,
    shade: (c, w, h) => { const g = c.createLinearGradient(0, h, 0, 0); [[0, 'rgba(13,9,7,.92)'], [.55, 'rgba(13,9,7,.25)'], [1, 'rgba(13,9,7,.4)']].forEach(([o, col]) => g.addColorStop(o, col)); c.fillStyle = g; c.fillRect(0, 0, w, h); } });
  (STILL || !pic.complete || !pic.naturalWidth ? Promise.resolve() : go()).finally(() => loader.remove());
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
  const follow = () => { if (world) updateWorld(); requestAnimationFrame(follow); };
  if (world && !STILL) requestAnimationFrame(follow);
}

(async () => {
  try { await document.fonts.ready; } catch (e) { /* segue */ }
  if (tier === 'off') { $('#gl').hidden = true; stage.classList.add('flat'); coreEl.classList.add('flat'); if (STILL) reveal(); else { clearInterval(picTimer); loader.classList.add('ready'); loadN.textContent = '32'; } return; }
  try {
    const { createWorld } = await import('./world/world.js');
    world = await createWorld({
      canvas: $('#gl'), tier, still: STILL,
      onProgress: v => { loadN.textContent = String(Math.round(v * 32)).padStart(2, '0'); loader.style.setProperty('--lp', (v * .9).toFixed(3)); },
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
  loader.classList.add('ready'); loadN.textContent = '32'; loader.style.setProperty('--lp', 1);
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
  // a seção começa debaixo do palco das cenas: a primeira meia tela é a cortina subindo
  const p = clamp((-r.top - innerHeight * .5) / (r.height - innerHeight * 1.5));
  coreP = p;
  if (core) core.set({ p });
  caps.forEach((c, k) => c.classList.toggle('on', p >= CAP_WIN[k][0] && p < CAP_WIN[k][1]));
  let heat = 0;
  CORE_SEG.forEach(([a, b], k) => { if (k && p > a && p < b) heat = Math.sin((p - a) / (b - a) * Math.PI); });
  coreHeat = r.top < innerHeight && r.bottom > 0 ? heat : 0;
  if (!core) {
    const k = CAP_WIN.findIndex(([a, b]) => p >= a - .04 && p < b);
    const img = asset('img/paint/' + FLAT_IMG[Math.max(0, k)] + '.webp');
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
  lines: $$('.ln', el).map(ln => ({ el: ln, chars: ln.closest('.st__t') ? splitChars(ln) : null })),
}));
const LAST = 6, SPAN = 6.6;
const idx = $$('#index li'), indexEl = $('#index');
const hdr = $('#hdr'), cue = $('#cue');

// sem 3D: a pintura da cena atual vira o fundo do palco
const FALLBACK = ['p15-rua', 'p09-caveira', 'p03-trem', 'p06-salao', 'p12-angustia', 'p07-flor', 'p19-brinde'];
const stage = $('.stage');
let fbCur = -1;

// título: cada letra sobe por trás de uma máscara e sai por cima, em onda
function charStyle(chars, inN, outN) {
  const N = chars.length, st = Math.min(.07, .9 / N);
  chars.forEach((c, k) => {
    const pi = easeOut(clamp(inN * (1 + N * st) - k * st));
    const po = easeIO(clamp(outN * (1 + N * st) - k * st));
    const y = outN > 0 ? -po * 115 : (1 - pi) * 115;
    const r = outN > 0 ? -po * 10 : (1 - pi) * 14;
    c.style.transform = `translate3d(0,${y.toFixed(1)}%,0) rotate(${r.toFixed(1)}deg)`;
  });
}

function lineStyle(el, inN, outN) {
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
  if (!world && cur !== fbCur) { fbCur = cur; stage.style.backgroundImage = `url(${asset('img/paint/' + FALLBACK[cur] + '.webp')})`; }
  idx.forEach((li, k) => li.classList.toggle('on', k === cur));
  indexEl.classList.toggle('gone', p >= .985);
  cue.style.opacity = u > .05 || introP < 1 ? 0 : 1;
}

// ---------- ato 2 ----------
// borda de papel rasgado
{
  const pts = []; let x = 0;
  while (x < 100) { pts.push(`${x.toFixed(2)}% ${(30 + Math.random() * 70).toFixed(1)}%`); x += .6 + Math.random() * 1.8; }
  pts.push('100% 60%', '100% 100%', '0% 100%');
  $('.tear').style.clipPath = `polygon(${pts.join(',')})`;
  $('#fogo').style.setProperty('--tear-clip', `polygon(${pts.join(',')})`);
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
$$('.rv, .up').forEach(e => (STILL ? e.classList.add('in') : seen.observe(e)));

// parágrafo que acende palavra por palavra com a rolagem
const lede = $('.lede'), ledeWords = splitWords(lede);
// moldura do vídeo abre com a rolagem
const frame = $('.frame'), frameImg = $('.player__face img');

function updatePage() {
  const page = $('#page').getBoundingClientRect();
  // sobre a lareira o cabeçalho volta a ser claro sobre escuro
  const fg = $('#fogo').getBoundingClientRect();
  hdr.classList.toggle('on-page', page.top < 40 && !(fg.top < 40 && fg.bottom > 40));
  const lr = lede.getBoundingClientRect();
  const lp = clamp((innerHeight * .85 - lr.top) / (lr.height + innerHeight * .3));
  const lit = lp * (ledeWords.length + 3);
  ledeWords.forEach((w, k) => { w.style.opacity = (.14 + .86 * clamp(lit - k)).toFixed(2); });
  const fr = frame.getBoundingClientRect();
  const fp = easeOut(clamp((innerHeight - fr.top) / (innerHeight * .75)));
  frame.style.clipPath = `inset(${((1 - fp) * 12).toFixed(2)}% ${((1 - fp) * 16).toFixed(2)}% round ${(6 + (1 - fp) * 30).toFixed(1)}px)`;
  if (frameImg) frameImg.style.scale = (1 + (1 - fp) * .3).toFixed(3);
  const d = deck.getBoundingClientRect();
  const open = clamp((innerHeight * .95 - d.top) / (innerHeight * .6));
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
if (finePointer && !STILL) {
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
  if (!reduced) $$('.btn, .pill, .player__play').forEach(b => {
    const host = b.classList.contains('player__play') ? b.parentElement : b;
    host.addEventListener('pointermove', e => {
      const r = b.getBoundingClientRect();
      b.style.translate = `${((e.clientX - r.left - r.width / 2) * .28).toFixed(1)}px ${((e.clientY - r.top - r.height / 2) * .28).toFixed(1)}px`;
    });
    host.addEventListener('pointerleave', () => { b.style.translate = ''; });
  });
}

// retrato que segue o cursor
const peek = $('#peek');
$$('#cast li').forEach(li => {
  li.addEventListener('pointerenter', () => { peek.src = li.dataset.img; peek.classList.add('on'); });
  li.addEventListener('pointerleave', () => peek.classList.remove('on'));
  li.addEventListener('pointermove', e => { peek.style.left = e.clientX + 'px'; peek.style.top = e.clientY + 'px'; });
});

// atire no fogo
initFire($('#fogo'));

// ---------- trilha de capítulos ----------
{
  const top = el => el.getBoundingClientRect().top + scrollY;
  const sceneY = i => top(worldEl) + (i ? (i + .02) / SPAN : 0) * (worldEl.offsetHeight - innerHeight);
  const labels = $$('#index li span').map(s => s.textContent.trim());
  const items = FALLBACK.map((bg, i) => ({ label: labels[i] || `Cena ${i}`, img: 'img/paint/' + bg + '.webp', y: () => sceneY(i) }))
    .concat([['#core', 'O retrato que quebra', 'img/paint/p01-retrato.webp'], ['#forte', 'A bondade forte', 'img/paint/p02-dostoievski.webp'], ['#quem', 'Quem é quem', 'img/paint/p05-nastassia.webp'], ['#fogo', 'Atire no fogo', 'img/paint/p06-salao.webp'], ['#video', 'O vídeo', 'img/paint/p01-retrato.webp']].map(([sel, label, img]) => ({ label, img, y: () => top($(sel)) + (sel === '#core' ? innerHeight * .6 : 0) })));
  initRail({
    items, asset,
    go: y => { if (lenis) lenis.scrollTo(y, { duration: 1.8 }); else scrollTo({ top: y, behavior: 'instant' }); },
    light: () => { const pg = $('#page').getBoundingClientRect(), fg = $('#fogo').getBoundingClientRect(); return pg.top < innerHeight - 20 && !(fg.top < innerHeight - 20 && fg.bottom > innerHeight - 20); },
  });
}

// a pergunta do vídeo
const ANS = {
  b: 'Dostoiévski queria escrever “um homem positivamente belo”, o mais perto de Cristo que teve coragem. E termina o livro com esse homem de volta ao sanatório, sem reconhecer ninguém. A santidade dele era verdadeira. Só não salvou uma única pessoa naquela casa.',
  i: 'O apelido é cruel, e o livro sabe disso: Míchkin enxerga o que ninguém mais vê. O que falta a ele não é inteligência. É coragem de agir sobre o que vê, de escolher uma pessoa, de dizer não a outra.',
};
$$('[data-pick]').forEach(b => b.addEventListener('click', () => {
  $$('[data-pick]').forEach(x => x.setAttribute('aria-pressed', x === b));
  $('#pickA').textContent = ANS[b.dataset.pick];
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
