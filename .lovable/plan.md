# Lucratividade automática em Blumenau

## O que encontrei
- Blumenau já tem um indicador "Lucratividade", mas ele é **manual** e não está ligado ao cálculo automático. Por isso não aparece a partir de outubro.
- Ele tem valores digitados de jan a jul/2026 (ex.: jan −22,9%, jul −59,84%). Agosto e setembro estão vazios.
- Nas outras 39 escolas, o indicador automático se chama "Lucratividade operacional".

## O que será feito
1. Renomear o indicador de Blumenau para "Lucratividade operacional" e ligá-lo ao cálculo automático, igual às outras escolas.
2. Manter **todo o histórico** já digitado (jan–jul/2026), sem mudar nenhum valor.
3. A partir de outubro/2026 o valor passa a ser calculado sozinho (mesmo número do Dashboard), só para meses encerrados. Novembro só entra em 1º de dezembro.
4. Agosto e setembro continuam vazios (o cálculo automático só começa em outubro). Se quiser, digite esses dois meses à mão.
5. Conferir o valor de outubro gravado com o Dashboard de Blumenau.

## Detalhes técnicos
- Alteração apenas de dados: `kpi_definitions` (id fe58d41a…) recebe `auto_key='lucro_operacional'` e `name='Lucratividade operacional'`. Sem mudança de código.
- `useAutoProfitability` grava outubro na próxima abertura do Dashboard/Indicadores; `kpi_values` antigos permanecem.
