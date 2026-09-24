# Deixar as ações da lista de Movimentações sempre visíveis

## Problema
A lista tem muitas colunas. Por isso, os três pontinhos (onde fica "Dividir valor") ficam escondidos à direita, e é preciso rolar para o lado para chegar neles.

## O que muda (só a aparência, nada nos números)
1. **Botões na frente da linha:** logo depois da caixinha de seleção, cada linha ganha um botão "Dividir" e os três pontinhos. Assim eles ficam sempre à vista, sem precisar rolar para o lado.
2. **Lista mais estreita:**
   - "Conciliado por" e "Em" viram uma só coluna, "Conferência": mostra o nome e a data em duas linhas pequenas.
   - "Origem" sai da lista e passa a aparecer quando você para o mouse sobre a descrição.
   - "Observação" vira um ícone de balão, que fica destacado quando a linha já tem observação. Clicar abre a edição, como hoje.
3. **Cabeçalho fixo:** o cabeçalho da lista continua visível quando você rola para baixo.
4. **Barra de rolagem no topo:** se ainda sobrar largura, aparece uma barra de rolagem lateral também em cima da lista, sem precisar descer até o fim.

## O que não muda
Valores, datas, saldos, conciliação, categorias e histórico continuam iguais. A mudança é só na organização da tela.

## Ponto separado, para confirmar depois
No print aparecem acentos quebrados ("COBRAN�A"). São lançamentos importados antes da correção de acentos. Posso corrigir só o texto mostrado, preservando o original, mas isso fica para outra etapa, se você quiser.

## Detalhes técnicos
- `BankTransactionsTable.tsx`: mover a célula de ações para a 2ª coluna; `sticky left-0` para seleção e ações, com fundo `bg-card`; `thead` com `sticky top-0`.
- Juntar as colunas reconciled_by/reconciled_at; tooltip com a origem; célula de observação com ícone e popover que reaproveita o editor atual.
- Barra de rolagem superior sincronizada com o `scrollLeft` do container.
- Não mexe nos hooks, no banco de dados nem nos cálculos.
