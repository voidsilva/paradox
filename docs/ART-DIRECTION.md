# Direção de arte

**Ideia:** um museu escuro em que as pinturas do vídeo se soltam da moldura. Cada cena é uma colagem em camadas: tela de fundo escurecida + personagens recortados à frente + quadros soltos com moldura dourada pelo caminho + poeira dourada no ar. A câmera repousa em cada cena e depois atravessa a pintura até a próxima.

**Roteiro (7 cenas):** Ser bom é suficiente? → O experimento (Míchkin) → O trem (Rogójin, Lébedev) → 100.000 rublos no fogo (brasas) → Bom demais (bondade ≠ passividade) → A luz dói (disco de luz) → O que fica. Depois, um papel rasgado abre a página clara: a bondade forte (6 cartas), quem é quem, a pergunta, o vídeo.

**Cor:** noite `#0d0907`, osso `#f1e8d8`, ouro `#d9ad62`, brasa `#c4512b`, papel `#eee4d1`, tinta `#1b130d`.

**Tipo:** Archivo condensada e pesada para a afirmação; Bodoni Moda itálica como a voz que interrompe; Plex Mono pequena para legendas e números.

**Movimento:** linhas de texto entram de baixo com blur e saem para cima; a velocidade do scroll entorta as pinturas e separa um pouco o RGB; recortes respiram devagar; o mouse dá paralaxe.

**v3 (momentos):** lente com aberração e distorção nas travessias; faíscas saindo da borda da pintura em chamas; notas de cem rublos caindo e queimando na cena III; feixes de luz na cena V; no final, todos os quadros soltos se juntam numa parede de museu enquanto a câmera recua. Cartas viram e mostram um exemplo do romance no verso.

**Trilha:** gerada ao vivo em Ré menor (Ré m, Si♭, Sol m, Lá): cordas graves que abrem o filtro nas travessias, piano esparso com eco longo, sino grave a cada cena nova, estalos de fogo proporcionais à queima, e Ré maior no final.

**Voz dos textos:** frases curtas, afirmativas, ancoradas em fatos do romance (a troca de cruzes, o desmaio de Gánia, o sanatório, a pergunta de Ippolit). Nada de conselho genérico.

**v4:** o fogo tem tempo próprio (~5 s por pintura): a tela arde parada e a câmera só atravessa quando o fogo abre passagem; o texto acompanha a câmera, não a barra. Atração principal entre o mundo e a página: "O rosto do paradoxo", Míchkin, Nastássia e Rogójin feitos de partículas com relevo (src/core/core.js), que explodem em brasa e se refazem até virar a palavra "idiota", que vira cinza.

**v5 (tela limpa):** cada cena mostra só o título; sem índice lateral, sem poeira de pontos. A atração principal virou "O retrato que quebra": o quadro de Míchkin trinca como vidro a partir do rosto, os cacos dão uma volta inteira no ar (passando o verso de tela crua) e se juntam em Rogójin; na segunda quebra, em Nastássia; no fim voam contra a câmera. Uma malha só, animada no vertex shader.

## v6 — cacos de verdade
- Material físico: verniz de vidro (clearcoat) refletindo um estúdio de luz gerado em código (PMREM), chanfro lapidado em cada caco, bordas de ouro polido, verso de linho.
- Antes da primeira trinca o quadro é liso e inteiro; a trinca acende em ouro e a luz vaza por trás.
- Cerca de 600 cacos (alta) com cortes secundários, mais pó de vidro instanciado.
- Pós próprio: bloom em meia resolução, tom fílmico ACES, aberração cromática leve e grão.

## Montaigne — Paradoxo II
- Identidade oposta à do Idiota: dia em vez de noite, névoa (`#e2dfd6`) em vez de fumaça, papel de livro (`#efebe2`), tinta (`#1a1e25`) e rubrica vermelha (`#b0391f`) em vez de ouro.
- Letra: EB Garamond, a letra de Claude Garamond, Paris, da geração de Montaigne. Títulos em serifa leve com itálico vermelho, capitular no começo de cada parágrafo, rótulos em Instrument Sans espaçada. Cantos retos, filetes, pontilhado de índice.
- Mecânica: um livro pop-up de capa dura vermelha sobre uma mesa na névoa (os Ensaios). Na entrada a capa abre. Cada cena é uma página dupla com a pintura impressa como prancha, títulos correntes, legenda em vermelho e número de página.
- Página da esquerda: o ensaio composto (capítulo, título, capitular vermelha). Página da direita: um teatro de papel que se levanta em camadas, do fundo para a frente, com mola: a pintura num cartão de borda rasgada, dois morros de papel com as cores da pintura e um arco de proscênio com cortina. Cada camada faz sombra na página.
- Luz: o sol da tarde entra pela janela da torre e desenha os caixilhos e a sombra de folhas balançando sobre a mesa e o livro. Uma fita marcadora vermelha sai da lombada e cai na mesa.
- Passagem entre cenas: a folha vira com curvatura real (shader de vértice; o canto da frente vai antes) e o deslocamento de ar levanta papéis manuscritos soltos.
- Texto: as letras chegam como tinta que assenta e saem uma por uma levadas pelo vento, girando como papel.
- Final: o vento arranca as folhas uma depois da outra e a névoa vira papel branco, que é o fundo da página.
- Atração: segurar amassa a pintura e escurece a sala em volta; soltar desdobra e revela a próxima.

## As portas (lobby)
- Um triângulo de Penrose: três vigas, cada uma uma galeria com a identidade de um paradoxo (nogueira e ouro; pedra clara e molduras finas; linho cru com esboços para o próximo).
- Câmera ortográfica na direção (1,1,1). Só desse ângulo a terceira viga encosta na primeira; ela é desenhada antes e o resto por cima. Arrastar abre o objeto e mostra o truque; ao soltar, ele volta sozinho e fecha.
- Cada porta tem duas folhas entreabertas; com o cursor elas se escancaram (a trancada só treme).
- Uma lanterna quente segue o cursor, passa rasante pelas galerias e acende a poeira no ar.
- Cada porta está numa gravidade (em pé, de lado). Brasas sobem da porta do Idiota; papéis voam da porta do Montaigne. O céu é metade brasa, metade névoa.

## v11
- Início: som todo gerado (lobby/sound.js), desligado até a pessoa tocar em "Som"; zumbido grave, brasa perto do Idiota, vento perto do Montaigne, sino quando o objeto fecha, sopro ao entrar. A escolha fica salva.
- Início: cursor em anel que segue a mão e vira "Entrar" na cor da porta; a pergunta da porta desliza para dentro da tela no celular.
- Montaigne: palco do livro mais alto (fundo .8, arco .96) e poeira dourada que só aparece dentro do feixe da janela (mesma função gobo do chão).

## v12 (varal)
- O livro saiu. Montaigne agora é um varal na névoa clara (montaigne/src/varal.js): cada capítulo é uma pintura impressa em papel presa por dois prendedores. Quando o capítulo acaba, os prendedores saltam e o vento leva a folha; a câmera segue pelo fio até a próxima. Tudo é função da rolagem, então voltar devolve as folhas ao fio.
