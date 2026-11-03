# Rondonópolis — receitas de cartão duplicadas na projeção

## O que encontrei
A partir de novembro/2026 o cartão de crédito aparece duas vezes:

| Mês | Maquininha Stone (enviado 13/10) | Cartão do Sponte (enviado 29/10) |
|---|---|---|
| 11/2026 | R$ 320.920,39 | R$ 337.766,48 |
| 12/2026 | R$ 279.415,76 | R$ 336.406,34 |
| 01/2027 | R$ 143.666,39 | R$ 256.747,06 |
| 02 a 05/2027 | R$ 42.221,28 | R$ 202.524,11 |

O envio do Sponte de 29/10 trouxe só cartão (crédito, e uma linha de débito de R$ 258,34) e entrou por cima das parcelas da Stone, em vez de substituí-las. Isso fere a regra de nunca ter cartão do Sponte e da maquininha no mesmo período. Os cheques (R$ 7.855,60 em nov e R$ 3.546,80 em dez) e as contas a pagar não estão duplicados.

## O que vou fazer
1. Manter as parcelas reais da maquininha Stone e retirar o cartão do Sponte de 01/11/2026 em diante (cerca de 1.970 lançamentos, R$ 1,13 milhão), com registro no histórico de alterações.
2. Fevereiro a maio/2027: o Sponte tem mais que a Stone (vendas futuras ainda não passadas na máquina). Também retiro, pela mesma regra; se preferir manter o Sponte só nos meses sem Stone, me avise.
3. Ajustar a importação do Sponte para que o cartão substitua (ou seja barrado) quando já houver maquininha no mesmo período, com aviso na tela, e criar um teste dessa regra.
4. Conferir depois: total de receitas por mês na projeção = Stone + cheque + outras formas, sem sobra.

## Detalhes técnicos
- Remoção: `financial_entries` com `origem='sponte'`, `tipo='entrada'`, `payment_method_key in ('credito','debito')`, `data >= '2026-11-01'`, do upload `recebimentos_2026-10-01_2027-12-31_...csv`; log em `audit_log`.
- As 12 saídas (estornos) do mesmo arquivo ficam; reviso se pertencem ao cartão.
- Guarda na importação do Sponte: antes de gravar, verificar `origem='cartao'` no intervalo e excluir/barrar o cartão do Sponte nesse período.
