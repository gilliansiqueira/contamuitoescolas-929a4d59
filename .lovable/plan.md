# Importação do relatório de ponto: erro de totais e botão Gravar escondido

## O que está acontecendo
1. **"Os totais não batem" é erro da leitura, não do relatório.** Cada pessoa aparece com 34 dias, o que indica que o PDF cobre um período longo. Quando a mesma pessoa aparece em mais de uma parte do relatório (uma por página ou por semana), cada parte imprime o seu próprio total. A leitura junta todos os dias da pessoa, mas guarda só o total da **última** parte. Exemplo, Francilane: total impresso 52:48 contra 192:54 somando todos os dias.
2. **O botão Gravar some** porque a janela cresce com a lista de diferenças e passa da altura da tela, sem rolagem. Diminuir o zoom não resolve.

## O que vou fazer
1. **Conferir cada parte com o seu próprio total.** Os dias de cada parte são comparados com o total impresso nela, e os totais de todas as partes são somados para mostrar o total da pessoa. Uma diferença real continua bloqueando a gravação e mostra em qual parte (datas) ela está.
2. **Dia repetido em duas partes conta uma vez só**, para não dobrar horas.
3. **A janela cabe na tela:** a lista de diferenças e a tabela rolam por dentro. Os botões Cancelar e Gravar ficam sempre à vista, e a lista de diferenças pode ser recolhida.
4. Teste automático com uma pessoa em duas partes (totais 52:48 + 140:06 = 192:54).

## O que preciso de você
- Se puder, me mande o **PDF do ponto** que deu erro. Com ele confirmo o formato e testo antes de você subir de novo.

## Detalhes técnicos
- `src/lib/teamTime/cartaoPontoParser.ts`: cada linha "Funcionário:" abre um bloco `{ inicio, fim, dias, totais }` dentro do funcionário; os totais vão para o bloco atual; a divergência é por bloco; `f.totais` = soma dos blocos; dias deduplicados por data.
- `src/components/team/ImportCartaoPonto.tsx`: `DialogContent` com `max-h-[85vh] flex flex-col`, corpo `min-h-0 flex-1 overflow-y-auto`, rodapé `shrink-0`; diferenças em bloco recolhível.
- Teste em `src/test/cartaoPontoBlocks.test.ts`.
