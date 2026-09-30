# Portão – Sicredi: saldo de R$ 91.532,28 x R$ 24.575,93

## O que foi confirmado
- Todos os lançamentos do extrato do Sicredi (28 a 30/09) já estão no sistema. Nenhum está faltando e nenhum está duplicado.
- R$ 91.532,28 é o saldo do Sicredi em **29/09**. Os pagamentos de 30/09 (boletos Influx, entre eles o de R$ 55.686,66) somam R$ 66.956,35 a menos. Com eles, o saldo fica exatamente **R$ 24.575,93**.
- Por que o saldo parou em 29/09: o Itaú e a Stone só têm extrato até 29/09. O sistema corta todas as contas no mesmo dia para não misturar datas. A tabela, porém, mostra "Atualizada até 30/09" no Sicredi, e isso confunde.

## O que vou fazer
1. Na tabela "Saldos por conta", deixar claro o dia do saldo. Exemplo: "Saldo em 29/09". Quando uma conta tiver extrato mais recente, mostrar um aviso: "Sicredi tem movimento até 30/09 (saldo R$ 24.575,93). Envie Itaú e Stone até 30/09 para avançar o corte."
2. Não muda nenhum cálculo, saldo ou lançamento. É só uma mudança no que aparece na tela.

**Para já:** enviando os extratos do Itaú e da Stone até 30/09, o Sicredi passa a mostrar R$ 24.575,93.

## Detalhes técnicos
- Componente da tabela "Saldos por conta" em `CashflowConference.tsx`: exibir a data de corte comum usada no cálculo e, por conta, o saldo na última data própria (`accountBalances` até `lastDateByAccount`) apenas como informação.
