/* Lobby: carrega o objeto impossível, cola as etiquetas nas portas e faz a entrada */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const Q = new URLSearchParams(location.search);
const STILL = Q.has('still');
const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
const asset = u => (window.__ASSETS && window.__ASSETS[u]) || u;
const body = document.body, veil = $('#veil');
const tags = Object.fromEntries($$('.tag').map(t => [t.dataset.id, t]));
const HREF = Object.fromEntries($$('.doors a').map(a => [a.dataset.id, a.getAttribute('href')]));
const TONE = { idiota: '#170c06', montaigne: '#e4e1d8' };

// as três portas: onde ficam, qual é o chão de cada uma
const L = 14, T = 2.6;
const PORTALS = [
  { id: 'idiota', paint: 'img/paint/p15-rua.jpg', cut: 'img/cut/p01-retrato.webp', figH: .84, fade: .18, tone: 0xffa04a, fx: 'ember',
    at: [L * .5, T / 2, 0], up: [0, 1, 0], fwd: [.45, 0, 1] },
  { id: 'montaigne', paint: 'montaigne/img/paint/m15-praia.jpg', cut: 'montaigne/img/cut/m09-horizonte.webp', figH: .8, fade: .02, figX: .12, tone: 0xcfe0ff, fx: 'wind', ped: 0xbdb7aa, door: 0xd9d3c6,
    at: [L + T / 2, L * .48, 0], up: [1, 0, 0], fwd: [0, .45, 1] },
  { id: 'soon', locked: true, tone: 0x999999, ped: 0x8d826f,
    at: [L, L + T / 2, L * .55], up: [0, 1, 0], fwd: [1, 0, .45] },
];

let lobby = null;
import { createLobbySound } from 'lobby/sound.js';
const sound = createLobbySound();
const sndBtn = $('#snd');
const store = (k, v) => { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } };
function setSound(v) {
  if (v) sound.start(); else sound.stop();
  sndBtn.setAttribute('aria-pressed', v);
  store('paradoxo-som', v ? '1' : '0');
}
sndBtn.addEventListener('click', () => setSound(!sound.on));
// quem já ligou o som volta com ele: liga no primeiro toque (o navegador só deixa assim)
if (store('paradoxo-som') === '1') addEventListener('pointerdown', () => { if (!sound.on) setSound(true); }, { once: true, capture: true });
document.addEventListener('visibilitychange', () => {
  if (document.hidden && sound.on) { sound.stop(); sound.was = true; }
  else if (!document.hidden && sound.was) { sound.was = false; setSound(true); }
});

// cursor que segue a mão com atraso
const cur = $('#cur'), curTxt = cur.querySelector('span');
const CTONE = { idiota: '#e2a24e', montaigne: '#e8e4da', soon: 'rgba(241,236,228,.35)' };
let mx = -100, my = -100, cx = -100, cy = -100;
addEventListener('pointermove', e => { if (e.pointerType !== 'mouse') return; mx = e.clientX; my = e.clientY; body.classList.add('cur-on'); }, { passive: true });
document.addEventListener('pointerleave', () => body.classList.remove('cur-on'));
addEventListener('pointerdown', () => body.classList.add('dragging'));
addEventListener('pointerup', () => body.classList.remove('dragging'));
(function follow() {
  const k = RM ? 1 : .22; cx += (mx - cx) * k; cy += (my - cy) * k;
  cur.style.transform = `translate3d(${cx.toFixed(1)}px, ${cy.toFixed(1)}px, 0)`;
  requestAnimationFrame(follow);
})();
let leaving = false;
function go(id) {
  const href = HREF[id]; if (!href || leaving) return;
  leaving = true;
  sound.enter();
  veil.style.background = TONE[id] || '#000';
  body.classList.add('leaving');
  if (lobby) { lobby.enter(id); setTimeout(() => veil.classList.add('on'), 650); setTimeout(() => { location.href = href; }, 1350); }
  else { veil.classList.add('on'); setTimeout(() => { location.href = href; }, 300); }
}
$$('.doors a').forEach(a => a.addEventListener('click', e => { if (e.metaKey || e.ctrlKey || e.shiftKey) return; e.preventDefault(); go(a.dataset.id); }));
$$('.doors a').forEach(a => { a.addEventListener('pointerenter', () => lobby && lobby.set({ hover: a.dataset.id })); a.addEventListener('focus', () => lobby && lobby.set({ hover: a.dataset.id })); });

function hasGL() { try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch (e) { return false; } }

async function init() {
  if (Q.get('q') === 'off' || !hasGL()) { body.classList.add('flat'); body.classList.remove('is-loading'); if (STILL || !lobby) body.classList.remove('intro'); return; }
  try {
    const { createLobby } = await import('lobby/world.js');
    const low = Q.get('q') === 'low' || (Q.get('q') !== 'high' && (matchMedia('(pointer: coarse)').matches || (navigator.hardwareConcurrency || 8) <= 4));
    lobby = await createLobby({
      canvas: $('#gl'), asset, portals: PORTALS, still: STILL, low,
      onHover: id => {
        sound.hover(id);
        if (id) { curTxt.textContent = id === 'soon' ? 'Em breve' : 'Entrar'; cur.style.setProperty('--ctone', CTONE[id] || '#f1ece4'); }
        $$('.tag').forEach(t => t.classList.toggle('on', t.dataset.id === id));
        body.classList.toggle('hovering', !!id);
      },
      onClose: c => { body.classList.toggle('open', !c); if (c) { if (!body.classList.contains('intro')) sound.chime(); body.classList.remove('flash'); void body.offsetWidth; body.classList.add('flash'); } },
      onEnter: id => go(id),
      onIntro: () => body.classList.remove('intro'),
    });
    window.__lobby = lobby;
  } catch (e) {
    console.warn('Sem 3D:', e);
    body.classList.add('flat');
  }
  body.classList.remove('is-loading'); if (STILL || !lobby) body.classList.remove('intro');
  if (lobby && lobby.begin) lobby.begin();
  if (!lobby) return;
  // etiquetas presas às portas
  const qs = {};
  for (const id in tags) { const el = tags[id].querySelector('i.q'); if (el) qs[id] = { el, w: 0 }; }
  addEventListener('resize', () => { for (const id in qs) qs[id].w = 0; });
  document.fonts && document.fonts.ready.then(() => { for (const id in qs) qs[id].w = 0; });
  const place = () => {
    for (const id in tags) {
      const s = lobby.screen(id); if (!s) continue;
      const x = Math.min(innerWidth - 74, Math.max(74, s.x)), y = Math.min(innerHeight - 20, Math.max(90, s.y));
      tags[id].style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
      // a pergunta não pode sair da tela: desliza para dentro sem tirar a etiqueta da porta
      const q = qs[id];
      if (q) { q.w = q.w || q.el.offsetWidth; const off = Math.min(0, innerWidth - 14 - (x + q.w / 2)) + Math.max(0, 14 - (x - q.w / 2)); q.el.style.marginLeft = off.toFixed(1) + 'px'; }
    }
    if (!STILL) requestAnimationFrame(place);
  };
  place();
}
init();

// voltar pelo histórico devolve o lobby
addEventListener('pageshow', e => { if (e.persisted) location.reload(); });
// o arquivo único troca os caminhos das imagens
if (window.__ASSETS) $$('img').forEach(i => { const s = i.getAttribute('src'); if (s) i.src = asset(s); });
