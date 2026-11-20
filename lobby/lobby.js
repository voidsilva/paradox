/* Lobby: cartas que inclinam com o mouse (ou com o giroscópio) e crescem até virar a página escolhida */
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
const asset = u => (window.__ASSETS && window.__ASSETS[u]) || u;
const cards = $$('.card:not(.card--soon)');
const bgs = { bgA: document.getElementById('bgA'), bgB: document.getElementById('bgB') };

function focusBg(k) { Object.entries(bgs).forEach(([n, el]) => el.classList.toggle('on', n === k)); }
focusBg('bgA');
// sem interação, o fundo alterna sozinho
let idle = 0, idleT = setInterval(() => { idle ^= 1; focusBg(idle ? 'bgB' : 'bgA'); }, 5200);

function tilt(card, x, y) { // x, y em 0..1
  card.style.setProperty('--ry', ((x - .5) * 16).toFixed(2) + 'deg');
  card.style.setProperty('--rx', ((.5 - y) * 12).toFixed(2) + 'deg');
  card.style.setProperty('--px', (x * 100).toFixed(1) + '%');
  card.style.setProperty('--py', (y * 100).toFixed(1) + '%');
}
function rest(card) { card.classList.remove('live'); tilt(card, .5, .5); card.style.setProperty('--lift', 0); }

cards.forEach(card => {
  if (!RM) {
    card.addEventListener('pointermove', e => {
      if (e.pointerType !== 'mouse') return;
      const r = card.getBoundingClientRect();
      card.classList.add('live'); card.style.setProperty('--lift', 1);
      tilt(card, (e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height);
    });
    card.addEventListener('pointerleave', () => rest(card));
  }
  const hi = () => { clearInterval(idleT); focusBg(card.dataset.bg); };
  card.addEventListener('pointerenter', hi);
  card.addEventListener('focus', hi);
  card.addEventListener('click', e => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault(); enter(card);
  });
});

// celular: o giroscópio inclina a carta que está no meio da tela
if (!RM && matchMedia('(hover: none)').matches && 'DeviceOrientationEvent' in window) {
  const onTilt = e => {
    if (e.gamma == null) return;
    const mid = innerHeight / 2;
    const c = cards.find(k => { const r = k.getBoundingClientRect(); return r.top < mid && r.bottom > mid; });
    cards.forEach(k => k !== c && rest(k));
    if (!c) return;
    c.classList.add('live');
    tilt(c, Math.max(0, Math.min(1, .5 + e.gamma / 50)), Math.max(0, Math.min(1, .5 + (e.beta - 45) / 60)));
    focusBg(c.dataset.bg); clearInterval(idleT);
  };
  const arm = () => {
    const P = window.DeviceOrientationEvent;
    if (typeof P.requestPermission === 'function') P.requestPermission().then(s => s === 'granted' && addEventListener('deviceorientation', onTilt)).catch(() => {});
    else addEventListener('deviceorientation', onTilt);
  };
  if (typeof DeviceOrientationEvent.requestPermission === 'function') addEventListener('touchend', arm, { once: true });
  else arm();
}

// entrar: a pintura da carta cresce até cobrir a tela, escurece no tom da página e navega
const wipe = document.getElementById('wipe');
let going = false;
function enter(card) {
  if (going) return; going = true;
  const href = card.getAttribute('href');
  if (RM) { location.href = href; return; }
  const r = card.querySelector('.card__in').getBoundingClientRect();
  const img = card.querySelector('.card__paint img');
  Object.assign(wipe.style, { left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px', backgroundImage: `url(${img.currentSrc || img.src})` });
  wipe.style.setProperty('--deep', getComputedStyle(card).getPropertyValue('--deep'));
  document.body.classList.add('leaving');
  requestAnimationFrame(() => requestAnimationFrame(() => {
    wipe.classList.add('go');
    Object.assign(wipe.style, { left: '0px', top: '0px', width: innerWidth + 'px', height: innerHeight + 'px', borderRadius: '0px' });
  }));
  setTimeout(() => { location.href = href; }, 1050);
}
// voltar pelo histórico devolve o lobby inteiro
addEventListener('pageshow', e => { if (e.persisted) { going = false; wipe.className = 'wipe'; document.body.classList.remove('leaving'); cards.forEach(rest); } });

// o arquivo único troca os caminhos das imagens
if (window.__ASSETS) $$('img').forEach(i => { const s = i.getAttribute('src'); if (s) i.src = asset(s); });
