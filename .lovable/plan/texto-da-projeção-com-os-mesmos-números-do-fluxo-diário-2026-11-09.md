## Texto da projeção com os mesmos números do Fluxo Diário

**O que está acontecendo**
- O texto já busca os dados no momento em que você clica em "Gerar texto" (Pinheirinho não tem texto salvo antigo).
- O problema é a conta: o texto da projeção usa um cálculo próprio, mais simples. Ele soma os previstos brutos e começa do saldo inicial ou do banco.
- O Fluxo Diário usa outra montagem: realizado do extrato até o último dia com movimento, previsto só nos dias seguintes e a fonte certa de cada mês. Por isso os dois mostram cenários diferentes.

**O que vou fazer**
1. Primeiro, comparar em Pinheirinho, mês a mês (nov, dez, jan), os números do texto com os do Fluxo Diário. Assim confirmo de quais lançamentos vem a diferença e listo esses lançamentos para você.
2. Fazer o texto da projeção usar exatamente o cálculo do Fluxo Diário para:
   - receitas, despesas e resultado de cada mês;
   - menor saldo do mês, com a data;
   - saldo previsto no fim do mês.
3. Manter o comportamento de clicar e gerar com os dados atuais. Cada clique em "Gerar texto" pega o andamento do dia. Se já houver um texto salvo, aparece um aviso quando os números de hoje forem diferentes dos usados nele.
4. Criar um teste com um caso fixo: os números do texto precisam ser iguais aos do Fluxo Diário.

O texto do relatório mensal (o mês fechado) não muda. Também nenhum valor da plataforma é alterado: muda só de onde o texto lê os números.

### Detalhes técnicos
- `buildProjectionFacts` (`src/lib/reportNarrativeFacts.ts`) passa a receber os totais e saldos diários de `buildDailyRows`/`closingEstimate` (`src/lib/dailyFlow.ts`), com a mesma montagem de `useDailyFlowMonthlyTotals`: realizado `origem='fluxo'`, `resolveMonthSource` e o saldo acumulado entre os meses.
- Remover a soma própria (`fut`/`futureBalances`) do caminho da projeção.
- Teste em `src/test` comparando os fatos com `closingEstimate` num conjunto fixo de lançamentos.
