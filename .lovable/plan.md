# Vitória: lucratividade não mudou na tela — corrigir os valores gravados

## O que encontrei
- A classificação já mudou: o pró-labore de Júlia e Vinicius agora sai das despesas.
- Mas os números de lucratividade que aparecem nos Indicadores são valores gravados mês a mês. De jan/2025 a set/2026 eles foram digitados ou gravados antes da mudança, então continuam com o pró-labore dentro das despesas (ex.: jul 20,52%, ago 21,8%, set 4,38%).
- Outubro (1,7%) é o único mês recalculado automaticamente, e isso só acontece quando alguém abre o Dashboard de Vitória.
- Vitória só tem o indicador "Lucratividade operacional". Não existe "Lucratividade total" cadastrado, por isso ele não aparece.

## O que vou fazer
1. Criar em Vitória o indicador "Lucratividade total" (com a retirada dos sócios), ao lado do operacional.
2. Recalcular pela regra oficial os meses de 2026 que têm dados na plataforma (jul/2026 em diante, e antes disso onde houver lançamentos realizados), gravando operacional e total. Os meses de 2025 ficam como estão (vieram de fora da plataforma).
3. Liberar só para Vitória o recálculo automático desde o primeiro mês com dados, para os valores não voltarem ao antigo.
4. Abrir o Dashboard e os Indicadores de Vitória e conferir: operacional subiu, total mostra a retirada.

## Ponto de atenção
- Se em algum mês de 2026 os lançamentos realizados não estiverem na plataforma, mantenho o valor digitado e aviso quais meses ficaram assim.

## Detalhes técnicos
- `kpi_definitions` de Vitória: só `auto_key='lucro_operacional'`; inserir `lucro_total`.
- Recalcular com `computeProfitability(buildMonthMovement(...))` (SSOT) e gravar em `kpi_values` (upsert), sem mês fechado (Vitória não tem fechamentos).
- Início do automático por empresa: coluna opcional em `school_features`/configuração (ex.: `auto_profit_start`) lida por `isAutoProfitMonth`; padrão segue out/2026 para as demais.
