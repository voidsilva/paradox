/* Trilha de capítulos: uma linha fina no pé da tela que enche com a leitura. Cada capítulo é um ponto;
   passar o mouse (ou o foco do teclado) mostra a pintura daquele capítulo, clicar leva até ele.
   items: [{ label, img, y: () => posição de rolagem }]; go(y) rola até lá; light() diz se o fundo é claro. */
export function initRail({ items, go, light = () => false, asset = u => u }) {
  const nav = document.createElement('nav');
  nav.className = 'rail';
  nav.setAttribute('aria-label', 'Capítulos');
  nav.innerHTML = '<i class="rail__bar"><b></b></i><figure class="rail__peek" aria-hidden="true"><img alt=""><figcaption class="mono"></figcaption></figure>';
  const fill = nav.querySelector('b'), peek = nav.querySelector('.rail__peek'), pImg = peek.querySelector('img'), pCap = peek.querySelector('figcaption');
  const dots = items.map((it, k) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'rail__dot';
    b.setAttribute('aria-label', it.label);
    b.innerHTML = `<span class="mono">${['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII'][k] || k + 1}</span>`;
    const show = () => {
      pImg.src = asset(it.img); pCap.textContent = it.label;
      peek.style.left = b.style.left; nav.classList.add('peeking');
    };
    b.addEventListener('pointerenter', show); b.addEventListener('focus', show);
    b.addEventListener('pointerleave', () => nav.classList.remove('peeking'));
    b.addEventListener('blur', () => nav.classList.remove('peeking'));
    b.addEventListener('click', () => go(it.y()));
    nav.append(b);
    return b;
  });
  // pré-carrega as miniaturas quando a pessoa chega perto da trilha
  nav.addEventListener('pointerenter', () => items.forEach(it => { const i = new Image(); i.src = asset(it.img); }), { once: true });
  document.body.append(nav);

  let max = 1, cur = -1;
  function layout() {
    max = Math.max(1, document.documentElement.scrollHeight - innerHeight);
    items.forEach((it, k) => { dots[k].style.left = (Math.min(1, Math.max(0, it.y() / max)) * 100).toFixed(3) + '%'; });
  }
  function update() {
    const p = Math.min(1, Math.max(0, scrollY / max));
    fill.style.transform = `scaleX(${p.toFixed(4)})`;
    let k = -1;
    items.forEach((it, i) => { if (scrollY >= it.y() - innerHeight * .35) k = i; });
    if (k !== cur) { dots.forEach((d, i) => { d.classList.toggle('on', i === k); d.classList.toggle('past', i < k); }); cur = k; }
    nav.classList.toggle('light', light());
  }
  layout(); update();
  addEventListener('resize', () => { layout(); update(); });
  addEventListener('load', () => { layout(); update(); });
  addEventListener('scroll', update, { passive: true });
  setTimeout(() => { layout(); update(); }, 1500);
  return { update, layout };
}
