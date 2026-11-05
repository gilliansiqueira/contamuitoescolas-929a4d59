# Lucratividade: não gravar o mês em andamento

## O que está acontecendo
Sim, novembro está sendo gravado e recalculado a cada abertura. Como o mês ainda está no começo (pouca receita entrou e muitas contas já saíram), aparece −210,21%, o que distorce o gráfico e a comparação.

## O que muda
- O cálculo automático grava **só meses encerrados**: outubro/2026 hoje, e novembro a partir de 1º de dezembro.
- O valor de novembro que já foi gravado em todas as escolas será apagado, deixando o gráfico como antes.
- O quadro "Fechamentos e lucratividade" do Dashboard continua mostrando o mês atual como prévia, sem gravar nos Indicadores.
- Outubro segue atualizando até o mês ser fechado. Depois de fechado, fica travado.

## Detalhes técnicos
- `isAutoProfitMonth` passa a usar `month < currentMonth` (exclusivo); ajustar teste em `src/test/profitability.test.ts` (2026-11 com mês atual 2026-11 → falso).
- Limpeza de dados: apagar `kpi_values` com `month = '2026-11'` cujos `kpi_definition_id` tenham `auto_key` não nulo.
- Atualizar a regra no `AGENTS.md` ("até o mês anterior ao atual").
