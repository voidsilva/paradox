/*
  O Paradoxo — ser bom é suficiente?
  Fonte: vídeo "O Paradoxo de Ser uma Boa Pessoa | O Alerta de Dostoiévski para a Sociedade"
  (A Psique, 15/03/2026, youtube.com/watch?v=7dcqp1zuZd4) sobre O Idiota (1869).
  As imagens são quadros do próprio vídeo (pinturas a óleo), algumas recortadas para flutuar.
  Roteiro: 7 cenas seguindo a narração do vídeo → página em papel com a "bondade forte".
*/
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const params = new URLSearchParams(location.search);
const STILL = params.has('still');
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

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
const loader = $('#loader'), loadN = $('#loadN');
let world = null;
function reveal() {
  document.body.classList.remove('is-loading');
  loader.classList.add('out');
  setTimeout(() => loader.remove(), 1000);
  onScroll();
}

(async () => {
  try { await document.fonts.ready; } catch (e) { /* segue */ }
  if (tier === 'off') { $('#gl').hidden = true; stage.classList.add('flat'); reveal(); return; }
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
  reveal();
})();

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
const sts = $$('.st').map(el => ({ el, i: +el.dataset.st, lines: $$('.ln', el) }));
const LAST = 6, SPAN = 6.6;
const idx = $$('#index li'), indexEl = $('#index');
const hdr = $('#hdr'), cue = $('#cue');

// sem 3D: a pintura da cena atual vira o fundo do palco
const FALLBACK = ['p15-rua', 'p09-caveira', 'p03-trem', 'p06-salao', 'p12-angustia', 'p07-flor', 'p19-brinde'];
const asset = u => (window.__ASSETS && window.__ASSETS[u]) || u;
const stage = $('.stage');
let fbCur = -1;

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
  const u = p * SPAN;
  if (world) world.set({ u: Math.min(u, LAST) });

  for (const s of sts) {
    const inV = s.i === 0 ? 1 : clamp((u - (s.i - .14)) / .16);
    const outV = s.i === LAST ? clamp((u - 6.42) / .14) : clamp((u - (s.i + .34)) / .12);
    const vis = inV > 0 && outV < 1;
    s.el.classList.toggle('vis', vis);
    if (!vis) continue;
    const L = s.lines.length, st = .14;
    s.lines.forEach((ln, n) => {
      lineStyle(ln, clamp(inV * (1 + (L - 1) * st) - n * st), clamp(outV * (1 + (L - 1) * st) - (L - 1 - n) * st * .5));
    });
  }
  const cur = Math.min(LAST, Math.floor(u + .14));
  if (!world && cur !== fbCur) { fbCur = cur; stage.style.backgroundImage = `url(${asset('img/paint/' + FALLBACK[cur] + '.jpg')})`; }
  idx.forEach((li, k) => li.classList.toggle('on', k === cur));
  indexEl.classList.toggle('gone', p >= .985);
  cue.style.opacity = u > .05 ? 0 : 1;
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
cards.forEach((c, k) => c.style.setProperty('--i', (k - (cards.length - 1) / 2).toFixed(2)));

function updatePage() {
  const page = $('#page').getBoundingClientRect();
  hdr.classList.toggle('on-page', page.top < 40);
  const d = deck.getBoundingClientRect();
  const open = reduced ? 1 : clamp((innerHeight * .95 - d.top) / (innerHeight * .6));
  deck.style.setProperty('--open', open.toFixed(3));
}

let lastY = scrollY, ticking = false;
function onScroll() {
  updateWorld();
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

// retrato que segue o cursor
const peek = $('#peek');
$$('#cast li').forEach(li => {
  li.addEventListener('pointerenter', () => { peek.src = li.dataset.img; peek.classList.add('on'); });
  li.addEventListener('pointerleave', () => peek.classList.remove('on'));
  li.addEventListener('pointermove', e => { peek.style.left = e.clientX + 'px'; peek.style.top = e.clientY + 'px'; });
});

// a pergunta do vídeo
const ANS = {
  b: 'Real, rara e poderosa: é assim que o vídeo descreve a bondade de Míchkin. Mas Dostoiévski não deixa a leitura terminar em conforto. Sem discernimento e firmeza, ela fracassa justo onde mais queria fazer o bem.',
  i: 'Talvez. Míchkin não sabe dizer não nem interromper ciclos destrutivos. Mesmo assim, o romance não ridiculariza a bondade: mostra que ela precisa de força, critério e limite para não virar alimento do caos.',
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
