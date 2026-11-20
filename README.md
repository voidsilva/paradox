# Paradoxo — filosofia em pinturas

Dois sites sobre vídeos do canal A Psique, com um lobby para escolher:

| Página | Vídeo | Atração |
|---|---|---|
| `index.html` | — | As portas: um triângulo de Penrose em 3D feito de três galerias de pinturas. Ele só fecha de um ângulo; arrastar abre o truque, soltar fecha de novo. Cada porta fica numa gravidade diferente; clicar voa para dentro da pintura |
| `idiota.html` | “O Paradoxo de Ser uma Boa Pessoa” (Dostoiévski, *O Idiota*) — youtube.com/watch?v=7dcqp1zuZd4 | Cenas que queimam umas nas outras; retrato que se parte em cacos de vidro |
| `montaigne.html` | “Quando Você Para de se Importar, Tudo Começa a Dar Certo” (Montaigne, *Ensaios*) — youtube.com/watch?v=LWuZr9304Y4 | Identidade própria (dia de névoa, papel, EB Garamond e rubrica vermelha). Mecânica própria: um **livro pop-up em 3D**. A capa abre, cada cena é uma página dupla com a pintura impressa e uma figura recortada que se levanta do papel; rolar vira as folhas (com curvatura), papéis soltos voam e no fim o vento leva todas as folhas. **Segure**: segurar o mouse (ou o botão no celular) amassa a pintura, e só soltar revela a próxima |

As pinturas que aparecem nos vídeos viram o próprio cenário 3D: cada cena tem uma pintura ao fundo e figuras recortadas flutuando em camadas na frente dela.

## Abrir
- **Dois cliques:** `dist-standalone/Paradoxo.html` (as portas), `Paradoxo-O-Idiota.html` e `Paradoxo-Montaigne.html`. Mantenha os três na mesma pasta para os links funcionarem.
- **Como projeto:** `node scripts/serve.mjs` e abrir http://localhost:5173 (precisa de servidor por causa dos módulos). Na Vercel, a raiz já é o lobby.

## Estrutura
```
index.html, lobby/            as portas: lobby/world.js (objeto impossível, câmera ortográfica, duas passadas), lobby.js, lobby.css, lobby/img (miniaturas)
idiota.html                   texto do site do Idiota
montaigne.html                texto do site do Montaigne
src/styles.css                estilos compartilhados (tokens no topo)
src/sound.js                  trilha gerada no navegador; createSound({chords, melody, fire, ...})
src/world/world.js            cena 3D compartilhada; createWorld({config}) — IDIOTA é o padrão
src/main.js, src/core/        roteiro e atração do Idiota
montaigne/src/main.js         roteiro do Montaigne (config MONTAIGNE: cenas, lado do texto, figuras)
montaigne/src/book.js         o livro pop-up (capa, folhas que viram em shader, figuras que levantam, vento, final)
montaigne/src/hold.js         atração "Segure"
montaigne/src/theme.css       identidade do Montaigne (cores, fontes, layout) por cima do styles.css
img/, montaigne/img/          pinturas (paint/) e recortes (cut/)
scripts/standalone.py         gera os três arquivos únicos
```

## Editar
- Texto: o `.html` de cada site (`article.st` = cenas 3D; `#page` = página clara).
- Cenas do Idiota: `IDIOTA.scenes` em `src/world/world.js`. Cenas do Montaigne: `MONTAIGNE.scenes` em `montaigne/src/main.js` (`side` do texto, `bg` impresso na página dupla, e no primeiro `cuts` a figura pop-up: `x` escolhe a página e a posição, `h` a altura).
- Novo paradoxo: copie `montaigne.html` + `montaigne/`, troque a config e as imagens, e adicione uma porta em `PORTALS` (lobby/lobby.js) e um link em `.doors` (index.html).
- Depois de mudar algo: `python scripts/standalone.py`.

## Qualidade
`?q=high`, `?q=low` ou `?q=off` (sem 3D: as pinturas viram fundo fixo). Respeita “reduzir movimento” do sistema.
