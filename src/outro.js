/* Final: o cartão do próximo paradoxo cresce com a rolagem até ocupar a tela. Chegando ao fim e parando
   ali um instante, a pessoa entra nele (o clique faz o mesmo). Voltar a rolar para cima cancela. */
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const ease = x => (x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

export function initOutro(sec) {
  if (!sec) return;
  const a = sec.querySelector('.next'), hint = sec.querySelector('.outro__hint');
  let armT = 0, armed = false;
  function update() {
    const r = sec.getBoundingClientRect();
    const p = clamp(-r.top / Math.max(1, r.height - innerHeight));
    const e = ease(clamp(p / .8));
    const gut = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--gut')) || 24;
    const cardH = Math.min(innerHeight * .42, 340);
    const it = ((innerHeight - cardH) / 2) * (1 - e), ix = gut * (1 - e);
    a.style.clipPath = `inset(${it.toFixed(1)}px ${ix.toFixed(1)}px ${it.toFixed(1)}px ${ix.toFixed(1)}px round ${(22 * (1 - e)).toFixed(1)}px)`;
    sec.style.setProperty('--op', e.toFixed(3));
    sec.classList.toggle('full', p > .82);
    document.body.classList.toggle('outro-on', e > .55); // a pintura ocupa a tela: o cabeçalho e a trilha saem
    // no fim: um segundo parado ali e a porta abre
    const atEnd = p > .992;
    if (atEnd && !armed) { armed = true; sec.classList.add('arm'); armT = setTimeout(() => a.click(), 1100); }
    else if (!atEnd && armed) { armed = false; sec.classList.remove('arm'); clearTimeout(armT); }
  }
  addEventListener('scroll', update, { passive: true });
  addEventListener('resize', update);
  update();
  if (hint) hint.hidden = false;
}
