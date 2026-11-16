# O Paradoxo — ser bom é suficiente?

Site sobre o vídeo **“O Paradoxo de Ser uma Boa Pessoa | O Alerta de Dostoiévski para a Sociedade”** (canal A Psique, 15/03/2026, https://www.youtube.com/watch?v=7dcqp1zuZd4), que lê *O Idiota* (1869).

As pinturas que aparecem no vídeo viram o próprio cenário 3D: cada cena tem uma pintura ao fundo e personagens recortados flutuando em camadas na frente dela, e o scroll leva a câmera de uma pintura para a outra, atravessando cada tela.

## Abrir
- **Dois cliques:** `dist-standalone/O-Paradoxo.html` (arquivo único, tudo embutido).
- **Como projeto:** `node scripts/serve.mjs` e abrir http://localhost:5173 (precisa de servidor por causa dos módulos).

## Estrutura
```
index.html              texto de todas as cenas e da página
src/styles.css          cores, fontes, layout
src/main.js             roteiro do scroll, animação do texto, cartas, elenco, player
src/world/world.js      cena 3D (SCENES = pintura de fundo + recortes de cada cena)
img/paint/              21 quadros do vídeo
img/cut/                11 personagens recortados (fundo transparente)
scripts/standalone.py   gera o arquivo único
```

## Editar
- Texto: `index.html` (`article.st` = cenas 3D; `#page` = página clara).
- Trocar pintura/recorte de uma cena: lista `SCENES` em `src/world/world.js` (`bg`, e em `cuts` posição `x,y,z` e altura `h`).
- Depois de mudar algo: `python scripts/standalone.py` para atualizar o arquivo único.

## Qualidade
`?q=high`, `?q=low` ou `?q=off` (sem 3D: as pinturas viram fundo fixo). Respeita “reduzir movimento” do sistema.
