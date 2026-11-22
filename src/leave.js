/* Saída entre os paradoxos: o cartão "próximo paradoxo" cresce até cobrir a tela e se dissolve na cor
   de fundo da página seguinte (a mesma da tela de entrada dela), então a troca de página não pisca.
   Os outros links internos (voltar às portas) só escurecem a tela na cor do destino. */
const TONE = [[/montaigne/i, '#efebe2'], [/idiota/i, '#0d0907'], [/./, '#0c0a0b']];
const toneOf = href => TONE.find(([re]) => re.test(href))[1];
let leaving = false;

function veil(color) {
  const v = document.createElement('div');
  v.setAttribute('aria-hidden', 'true');
  v.style.cssText = `position:fixed;inset:0;z-index:200;pointer-events:none;background:${color};opacity:0;transition:opacity .55s cubic-bezier(.2,.7,0,1)`;
  document.body.append(v); made.push(v);
  return v;
}

function go(a, e) {
  const href = a.getAttribute('href');
  if (leaving || !href || href.startsWith('#') || a.target === '_blank' || /^https?:/.test(href)) return;
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button) return;
  e.preventDefault();
  leaving = true;
  const tone = toneOf(href);
  const img = a.classList.contains('next') && a.querySelector('img');
  if (img) {
    // a pintura do cartão sai da moldura e ocupa a tela
    const r = a.getBoundingClientRect();
    const fly = document.createElement('div');
    fly.setAttribute('aria-hidden', 'true');
    const ins = `${r.top}px ${innerWidth - r.right}px ${innerHeight - r.bottom}px ${r.left}px`;
    fly.style.cssText = `position:fixed;inset:0;z-index:199;pointer-events:none;background:#000 url("${img.currentSrc || img.src}") center/cover no-repeat;clip-path:inset(${ins} round 22px);transition:clip-path .9s cubic-bezier(.76,0,.24,1), filter .9s;filter:brightness(.55)`;
    document.body.append(fly); made.push(fly);
    const v = veil(tone);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      fly.style.clipPath = 'inset(0px 0px 0px 0px round 0px)';
      fly.style.filter = 'brightness(.9)';
      setTimeout(() => { v.style.opacity = 1; }, 650);
    }));
    setTimeout(() => { location.href = href; }, 1250);
  } else {
    const v = veil(tone);
    requestAnimationFrame(() => requestAnimationFrame(() => { v.style.opacity = 1; }));
    setTimeout(() => { location.href = href; }, 520);
  }
}

document.addEventListener('click', e => {
  const a = e.target.closest && e.target.closest('a[href]');
  if (a) go(a, e);
});
// voltar pelo histórico: a página volta como estava, sem o véu
const made = [];
addEventListener('pageshow', e => { if (e.persisted) { made.splice(0).forEach(el => el.remove()); leaving = false; } });
