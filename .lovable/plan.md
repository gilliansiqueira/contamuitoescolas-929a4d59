# Palmital: saldo final do Dashboard diferente do saldo do banco

## O que já confirmei
- Novembro em si está certo: o resultado do Dashboard (−R$ 18.287,80) é igual ao movimento do banco no mês (entradas R$ 51.594,87 − saídas R$ 69.882,67).
- A diferença inteira (cerca de R$ 5.570) está no **saldo inicial** de novembro: o Dashboard começa em R$ 29.808,51, mas o banco fechou outubro em cerca de R$ 24.238,26.
- O saldo do Dashboard é uma corrente desde 01/07 (saldo inicial da empresa R$ 44.613,99) somando julho e agosto da planilha de fluxo e, depois, os extratos. Os saldos iniciais das 6 contas em 31/08 somam R$ 31.207,26 — o fechamento de agosto da planilha provavelmente não é esse número.
- Outros pontos suspeitos: 262 linhas da planilha de fluxo em setembro (com extratos já ativos desde 01/09), 2 lançamentos manuais em agosto (R$ 1.902,43) e 55 lançamentos da Stone de 30/06 a 31/08, anteriores ao início das contas.

## O que vou fazer
1. Calcular mês a mês (jul, ago, set, out) o saldo que o Dashboard usa e compará-lo com o saldo das contas, para apontar exatamente quais linhas criam os R$ 5.570.
2. Corrigir a causa encontrada nos dados de Palmital, por exemplo:
   - se for a planilha de setembro somando junto com o extrato, tirar essa duplicidade;
   - se for o saldo da empresa em 01/07 que não fecha com as contas em 31/08, ajustar esse saldo inicial (com sua confirmação do valor);
   - se forem os lançamentos da Stone antes de 31/08, deixá-los fora do saldo.
3. Conferir que o saldo final de novembro no Dashboard passe a ser R$ 5.950,46, igual ao Resumo do Fluxo Bancário, sem mudar receitas, despesas nem resultado de nenhum mês.

Nenhuma regra de cálculo muda para as outras empresas. Antes de qualquer exclusão ou mudança de valor, mostro a lista das linhas responsáveis.
