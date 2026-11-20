# Paradoxos — filosofia em pinturas

Dois sites sobre vídeos do canal A Psique, com um lobby para escolher:

| Página | Vídeo | Atração |
|---|---|---|
| `index.html` | — | Lobby: cartas 3D que inclinam com o mouse (ou o giroscópio no celular) e crescem até virar o site escolhido |
| `idiota.html` | “O Paradoxo de Ser uma Boa Pessoa” (Dostoiévski, *O Idiota*) — youtube.com/watch?v=7dcqp1zuZd4 | Cenas que queimam umas nas outras; retrato que se parte em cacos de vidro |
| `montaigne.html` | “Quando Você Para de se Importar, Tudo Começa a Dar Certo” (Montaigne, *Ensaios*) — youtube.com/watch?v=LWuZr9304Y4 | Cenas que o vento leva; **Segure**: segurar o mouse (ou o botão no celular) amassa a pintura, e só soltar revela a próxima |

As pinturas que aparecem nos vídeos viram o próprio cenário 3D: cada cena tem uma pintura ao fundo e figuras recortadas flutuando em camadas na frente dela.

## Abrir
- **Dois cliques:** `dist-standalone/Paradoxos.html` (lobby), `O-Paradoxo.html` e `Solte-Montaigne.html`. Mantenha os três na mesma pasta para os links funcionarem.
- **Como projeto:** `node scripts/serve.mjs` e abrir http://localhost:5173 (precisa de servidor por causa dos módulos). Na Vercel, a raiz já é o lobby.

## Estrutura
```
index.html, lobby/            lobby (CSS e JS próprios, sem 3D)
idiota.html                   texto do site do Idiota
montaigne.html                texto do site do Montaigne
src/styles.css                estilos compartilhados (tokens no topo)
src/sound.js                  trilha gerada no navegador; createSound({chords, melody, fire, ...})
src/world/world.js            cena 3D compartilhada; createWorld({config}) — IDIOTA é o padrão
src/main.js, src/core/        roteiro e atração do Idiota
montaigne/src/main.js         roteiro do Montaigne (config MONTAIGNE: cenas, vento, final)
montaigne/src/hold.js         atração "Segure"
montaigne/src/theme.css       paleta fria do Montaigne por cima do styles.css
img/, montaigne/img/          pinturas (paint/) e recortes (cut/)
scripts/standalone.py         gera os três arquivos únicos
```

## Editar
- Texto: o `.html` de cada site (`article.st` = cenas 3D; `#page` = página clara).
- Cenas do Idiota: `IDIOTA.scenes` em `src/world/world.js`. Cenas do Montaigne: `MONTAIGNE.scenes` em `montaigne/src/main.js` (`bg`, e em `cuts` posição `x,y,z` e altura `h`).
- Novo paradoxo: copie `montaigne.html` + `montaigne/`, troque a config e as imagens, e adicione uma carta em `index.html`.
- Depois de mudar algo: `python scripts/standalone.py`.

## Qualidade
`?q=high`, `?q=low` ou `?q=off` (sem 3D: as pinturas viram fundo fixo). Respeita “reduzir movimento” do sistema.
