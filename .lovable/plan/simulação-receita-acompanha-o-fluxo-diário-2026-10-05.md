# Simulação: receita acompanha o Fluxo Diário

## Como é hoje
- Na Simulação, a linha "Receita projetada (sistema)" soma só as previsões importadas (Sponte, cheques, cartão). Em Out/26 da Uberlândia Centro isso dá R$ 84.159,72.
- O Fluxo Diário faz outra conta: até o último dia com extrato usa o que realmente entrou no banco, e dali em diante usa o que ainda está previsto. Isso dá os ~R$ 87 mil.
- As duas telas não se falam, e a Simulação fica parada no número da importação.

## O que muda
1. A linha passa a se chamar **"Receita (realizado + previsto)"** e usa exatamente o mesmo total de entradas do Fluxo Diário, mês a mês.
   - Mês corrente: o que já entrou até hoje mais o que falta entrar até o fim do mês (os R$ 87 mil de outubro).
   - Meses futuros: só o previsto, como hoje.
   - Meses que já passaram: só o que de fato entrou.
2. A linha se atualiza sozinha. A cada extrato enviado ou lançamento conciliado, o valor muda, sem precisar reimportar nada.
3. Abaixo do valor do mês corrente aparece uma nota pequena, por exemplo "R$ 52.300 recebidos · R$ 34.700 a receber".
4. A **Receita simulada** que vocês digitam continua somando por cima. A Receita total, o Resultado e o Saldo final seguem a conta de hoje.
5. Para manter tudo coerente, Contas a pagar e Operações do mês corrente usam a mesma regra: realizado até o último extrato, previsto depois.

## Detalhes técnicos
- Tirar o cálculo de entradas e saídas por mês que hoje está dentro de `DailyFlowTable.tsx` (realizado até o último dia com extrato e projetado depois, com os ajustes de `usePeriodMovementCtx`) e levá-lo para um hook compartilhado, por exemplo `useDailyFlowMonthlyTotals(schoolId)`. Esse hook passa a ser usado pelo Fluxo Diário e pela Simulação, sem duplicar regra; a classificação continua vindo da SSOT (`classificationUtils`, `tipoMeta`, `ledgerEngine`).
- `Simulation.tsx`: trocar `sistemaProjetadoPorMes`, `contasPagarPorMes` e operações pelos totais do hook.
- Teste comparando o total de outubro da Uberlândia Centro nas duas telas.
- Nada é gravado: a Simulação continua isolada.
