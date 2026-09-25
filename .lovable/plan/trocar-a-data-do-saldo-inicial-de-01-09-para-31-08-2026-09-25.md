# Trocar a data do saldo inicial de 01/09 para 31/08

## Por que
Quando o saldo inicial está com data 01/09, o sistema entende que é o saldo no **fim** do dia 01/09. Por isso, pula os lançamentos do próprio dia 01/09. Em Cuiabá Goiabeiras, na Stone, isso explica exatamente a diferença de R$ 2.310,70: são duas vendas do dia 01/09. Com o dia incluído, a Stone fecha em R$ 2.696,00, igual ao banco.

## O que vou fazer
1. Trocar a data do saldo inicial de **01/09 para 31/08**, mantendo o mesmo valor, em todas as contas cadastradas assim. Hoje são 15 contas. Isso vale para o saldo em conta e para o saldo aplicado.
2. Nenhum lançamento é alterado. Muda só a data do saldo inicial.
3. Recalcular a conferência com o banco de cada conta alterada e mostrar para você quais passaram a bater e quais ainda têm diferença.
4. Para não voltar a acontecer: no cadastro de conta, o campo passa a dizer "Saldo no fechamento do dia" e já vem com o último dia do mês anterior.

## O que continua pendente em Cuiabá Goiabeiras
- **Sicredi:** os R$ 19.565,67 parecem ser o saldo aplicado, e não o saldo em conta. Com o valor no lugar certo, a diferença deve ficar em uns R$ 9 de rendimento. Só mudo isso se você confirmar.
- **Banco do Brasil:** vai sobrar uma diferença de uns R$ 19.560. Para achar a causa, preciso do saldo do BB em 31/08 (em conta e aplicado) ou do PDF de setembro.
- **Sicredi:** o extrato que está no sistema vai até 24/09. É preciso importar o arquivo novo, que vai até 25/09.

## Detalhes técnicos
- Via run_sql: `UPDATE bank_accounts SET saldo_inicial_data='2026-08-31'` onde o valor atual é '2026-09-01'. Também `auto_invest_saldo_data`, nos mesmos casos.
- O motor (`t.data > saldo_inicial_data`) não muda: 53 contas já usam 31/08 corretamente.
- Depois da troca, rodar uma consulta que compara o saldo calculado com `saldo_final_informado` do último extrato de cada conta alterada.
- Formulário de conta: novo rótulo e data padrão.
