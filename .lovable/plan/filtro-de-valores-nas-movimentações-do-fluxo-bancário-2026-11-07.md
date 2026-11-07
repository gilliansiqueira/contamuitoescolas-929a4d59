# Filtro de valores nas Movimentações do Fluxo Bancário

## O que muda
Na barra de filtros das Movimentações (ao lado da busca), dois campos novos: **Valor de** e **Valor até**, no formato brasileiro (ex.: 1.500,50).

- Preencher só "de": mostra valores a partir dele; só "até": até ele; os dois: a faixa. Mesmo valor nos dois = valor exato.
- Compara o valor sem sinal, valendo para entradas e saídas (o filtro de Entradas/Saídas/categoria continua separado).
- Soma com os filtros já existentes (conta, período, status, busca, categoria, Nibo, arquivo).
- Botão "x" para limpar a faixa.
- Totais, seleção em lote e exportação seguem o que estiver filtrado, como hoje.

Nenhum cálculo financeiro muda — é só filtro de exibição.

## Detalhes técnicos
- `src/components/fluxo-bancario/BankTransactionsTable.tsx`: estados `minValor`/`maxValor` (texto), convertidos com o parser BR existente; condição extra no `.filter` da linha ~218 sobre `Math.abs(Number(t.valor))`.
