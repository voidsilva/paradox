/*
  Solte — o paradoxo de Montaigne
  Fonte: vídeo "Quando Você Para de se Importar, Tudo Começa a Dar Certo – A Filosofia de Michel de Montaigne"
  (A Psique, youtube.com/watch?v=LWuZr9304Y4). As imagens são quadros do próprio vídeo.
  Roteiro: 7 cenas que se soltam ao vento → "Segure" (a atração) → página clara.
*/
import Lenis from 'lenis';
import { createSound } from 'shared/sound.js';
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

// as sete cenas: pintura de fundo + figuras recortadas; a passagem é o vento, não o fogo
const MONTAIGNE = {
  dir: 'montaigne/img/', fog: 0x0a0d12, dawn: 0xe4e1d8, gold: 0xc8b48c, mode: 'wind', notes: -1, rays: 4, glow: 5, finale: 'release',
  paints: ['m01-pano', 'm02-montaigne', 'm03-janela', 'm04-barba', 'm05-punho', 'm06-multidao', 'm07-bobo', 'm08-leitor', 'm09-horizonte', 'm10-torre', 'm11-casal', 'm12-campo', 'm13-olhos', 'm14-ela', 'm15-praia', 'm16-bracos', 'm17-retrato', 'm18-colina'],
  cuts: ['m01-pano', 'm02-montaigne', 'm05-punho', 'm08-leitor', 'm09-horizonte', 'm11-casal', 'm12-campo', 'm16-bracos', 'm17-retrato'],
  scenes: [
    { bg: 'm18-colina', dim: .5, look: -1.5, cuts: [{ k: 'm17-retrato', x: 6.5, y: -1.6, h: 12.5, z: 1.5 }] },
    { bg: 'm04-barba', dim: .4, look: -3.5, cuts: [{ k: 'm05-punho', x: 7, y: -2.2, h: 9.5, z: 1 }] },
    { bg: 'm06-multidao', dim: .42, look: 3.5, cuts: [{ k: 'm01-pano', x: -7.5, y: -1.8, h: 10.5, z: 2 }] },
    { bg: 'm10-torre', dim: .5, look: -3.5, cuts: [{ k: 'm08-leitor', x: 7, y: -2.4, h: 9, z: 1.5 }] },
    { bg: 'm13-olhos', dim: .3, look: 0, cuts: [{ k: 'm12-campo', x: -12.5, y: -3.2, h: 8.5, z: 0 }, { k: 'm09-horizonte', x: 12.5, y: -2, h: 10.5, z: 1 }] },
    { bg: 'm14-ela', dim: .48, look: 3.5, cuts: [{ k: 'm11-casal', x: -7.5, y: -2.4, h: 8.5, z: 2 }] },
    { bg: 'm15-praia', dim: .62, look: -1, cuts: [{ k: 'm16-bracos', x: 7.5, y: -1.6, h: 11.5, z: 1.5 }] },
  ],
};

// ---------- carregamento ----------
const loader = $('#loader'), loadN = $('#loadN'), loadPic = $('#loadPic');
let world = null;
let introP = STILL || reduced ? 1 : 0;

// enquanto carrega, as pinturas passam como num projetor
const LOAD_PICS = ['m17-retrato', 'm18-colina', 'm05-punho', 'm06-multidao', 'm10-torre', 'm13-olhos', 'm14-ela', 'm16-bracos', 'm09-horizonte', 'm15-praia'];
let picI = 0;
const picTimer = loadPic && !reduced && !STILL ? setInterval(() => { loadPic.src = asset('montaigne/img/paint/' + LOAD_PICS[picI++ % LOAD_PICS.length] + '.jpg'); }, 150) : 0;

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
  const follow = () => { if (world) updateWorld(); requestAnimationFrame(follow); };
  if (world && !STILL) requestAnimationFrame(follow);
}

(async () => {
  try { await document.fonts.ready; } catch (e) { /* segue */ }
  if (tier === 'off') { $('#gl').hidden = true; stage.classList.add('flat'); coreEl.classList.add('flat'); if (STILL) reveal(); else { clearInterval(picTimer); loader.classList.add('ready'); loadN.textContent = '27'; } return; }
  try {
    const { createWorld } = await import('shared/world/world.js');
    world = await createWorld({
      canvas: $('#gl'), tier, still: STILL, config: MONTAIGNE,
      onProgress: v => { loadN.textContent = String(Math.round(v * 27)).padStart(2, '0'); },
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
  loader.classList.add('ready'); loadN.textContent = '27';
  $('#enterSnd').focus({ preventScroll: true });
})();

// ---------- atração principal: segure ----------
const coreEl = $('#segure'), coreCanvas = $('#coreGl'), coreFlat = $('#coreFlat'), holdBtn = $('#holdBtn');
const caps = $$('.cap', coreEl);
let core = null, coreP = 0, coreHeat = 0, holding = false, lastRel = 0, flatGrip = 0;
async function initCore() {
  try {
    const { createHold } = await import('./hold.js');
    core = await createHold({ canvas: coreCanvas, tier, still: STILL, asset, onRelease: () => { lastRel = performance.now(); sound.release(); } });
    window.__core = core;
  } catch (e) {
    console.warn('Sem atração 3D:', e);
    coreCanvas.hidden = true; coreEl.classList.add('flat');
  }
}
function setHold(v) {
  if (v === holding) return;
  holding = v;
  holdBtn.setAttribute('aria-pressed', v);
  coreEl.classList.toggle('holding', v);
  if (core) core.set({ hold: v });
  else if (!v && flatGrip > .3) { lastRel = performance.now(); flatGrip = 0; }
}
function updateCore() {
  const r = coreEl.getBoundingClientRect();
  const p = clamp(-r.top / (r.height - innerHeight));
  coreP = p;
  if (core) core.set({ p });
  if (holding && (r.top > innerHeight * .5 || r.bottom < innerHeight * .5)) setHold(false);
  const inView = r.top < innerHeight && r.bottom > 0;
  coreHeat = inView && core ? Math.max(0, core.grip) : 0;
}
// as legendas reagem ao gesto, não só à rolagem
function capsTick() {
  if (!core) flatGrip = holding ? Math.min(1, flatGrip + .012) : Math.max(0, flatGrip - .05);
  const g = core ? core.grip : flatGrip;
  const since = (performance.now() - lastRel) / 1000;
  const freshRel = lastRel && since < 4.5;
  const k = freshRel ? 3 : g > .82 ? 2 : g > .25 ? 1 : 0;
  caps.forEach((c, i) => c.classList.toggle('on', i === k && coreP > .005 && coreP < .985));
  coreEl.style.setProperty('--g', g.toFixed(3));
  if (!core) coreFlat.style.filter = `grayscale(${g.toFixed(2)}) contrast(${(1 + g * .2).toFixed(2)})`;
  requestAnimationFrame(capsTick);
}
if (!STILL) requestAnimationFrame(capsTick);
{
  const setPtr = e => {
    if (!core) return;
    const rc = coreCanvas.getBoundingClientRect();
    core.set({ mx: ((e.clientX - rc.left) / rc.width - .5) * 2, my: -((e.clientY - rc.top) / rc.height - .5) * 2 });
  };
  coreCanvas.addEventListener('pointermove', setPtr, { passive: true });
  // mouse: a tela inteira segura; no toque, o botão (assim a rolagem continua livre)
  coreCanvas.addEventListener('pointerdown', e => { if (e.pointerType === 'mouse' && e.button === 0) { e.preventDefault(); setHold(true); setPtr(e); } });
  addEventListener('pointerup', () => setHold(false));
  addEventListener('pointercancel', () => setHold(false));
  addEventListener('blur', () => setHold(false));
  holdBtn.addEventListener('pointerdown', e => { e.preventDefault(); try { holdBtn.setPointerCapture(e.pointerId); } catch (_) { /* segue */ } setHold(true); });
  holdBtn.addEventListener('contextmenu', e => e.preventDefault());
  holdBtn.addEventListener('keydown', e => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) { e.preventDefault(); setHold(true); } });
  holdBtn.addEventListener('keyup', e => { if (e.key === ' ' || e.key === 'Enter') setHold(false); });
}

// ---------- trilha ----------
const sound = createSound({
  chords: [[41, 53, 57, 60, 64], [45, 52, 57, 60, 64], [38, 50, 53, 57, 64], [46, 53, 57, 62, 64]], // Fá maior, aberto
  final: [41, 53, 57, 60, 67], melody: [72, 69, 67, 64, 65, 67, 72, 74, 69, 67, 65, 64], fire: false, root: 41, lightScene: 4,
});
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
  // na atração: segurar aperta a música
  const cr = coreEl.getBoundingClientRect();
  o.grip = cr.top < innerHeight * .5 && cr.bottom > innerHeight * .5 ? coreHeat : 0;
  if (o.grip > 0) o.scene = 7;
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
const LAST = 6, SPAN = 6.6;
const idx = $$('#index li'), indexEl = $('#index');
const hdr = $('#hdr'), cue = $('#cue');

// sem 3D: a pintura da cena atual vira o fundo do palco
const FALLBACK = MONTAIGNE.scenes.map(s => s.bg);
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
  if (!world && cur !== fbCur) { fbCur = cur; stage.style.backgroundImage = `url(${asset('montaigne/img/paint/' + FALLBACK[cur] + '.jpg')})`; }
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

// parágrafo que acende palavra por palavra com a rolagem
const lede = $('.lede'), ledeWords = splitWords(lede);
// moldura do vídeo abre com a rolagem
const frame = $('.frame'), frameImg = $('.player__face img');

function updatePage() {
  const page = $('#page').getBoundingClientRect();
  hdr.classList.toggle('on-page', page.top < 40);
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
    ring.classList.toggle('grip', holding);
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
const peek = $('#peek');
$$('#cast li').forEach(li => {
  li.addEventListener('pointerenter', () => { peek.src = li.dataset.img; peek.classList.add('on'); });
  li.addEventListener('pointerleave', () => peek.classList.remove('on'));
  li.addEventListener('pointermove', e => { peek.style.left = e.clientX + 'px'; peek.style.top = e.clientY + 'px'; });
});

// a pergunta do vídeo
const ANS = {
  o: 'Montaigne passou a vida escrevendo sobre si sem tentar agradar. Não por arrogância: o olhar dos outros muda a cada estação, e quem mora nele nunca descansa. Experimente fazer uma coisa nesta semana sem contar para ninguém.',
  c: 'Ele viu guerras religiosas rasgarem a França e não conseguiu impedir nenhuma. Em vez de apertar mais, recolheu-se e cuidou do que estava ao alcance: a própria cabeça. Controle o próximo passo. O resto é clima.',
  p: 'La Boétie não pedia nada a ele, e por isso Montaigne nunca o esqueceu. Quanto mais você segura alguém, mais essa pessoa se afasta. Presença sem cobrança é o que fica.',
  f: 'Ensaio quer dizer tentativa. Montaigne reescreveu o livro até morrer e nunca o deu por pronto. O erro não era o fim do trabalho. Era o trabalho.',
};
$$('[data-pick]').forEach(b => b.addEventListener('click', () => {
  $$('[data-pick]').forEach(x => x.setAttribute('aria-pressed', x === b));
  $('#pickA').textContent = ANS[b.dataset.pick];
}));

// player
$('#playerBtn').addEventListener('click', () => {
  const f = document.createElement('iframe');
  f.src = 'https://www.youtube-nocookie.com/embed/LWuZr9304Y4?autoplay=1&rel=0';
  f.title = 'Quando Você Para de se Importar, Tudo Começa a Dar Certo – A Filosofia de Michel de Montaigne';
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
