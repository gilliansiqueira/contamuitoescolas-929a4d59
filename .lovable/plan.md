# Go Company — resultado de outubro/2026

## O que encontrei
Resultado na tela: receitas R$ 65.155,22 − despesas R$ 27.604,88 = **R$ 37.550,34**.

Quatro saídas de R$ 21.731,10 no total foram conciliadas como **Operação**, por isso ficaram fora do resultado:

| Data | Lançamento | Valor | Como está |
|---|---|---|---|
| 13/10 | PIX Sicoob (parte de R$ 15.000) | 6.881,01 | Pró-labore, mas marcado como "operação" |
| 28/10 | Gilmara | 6.000,00 | Pró-labore, mas marcado como "operação" |
| 13/10 | PIX Sicoob (outra parte) | 8.118,99 | Devolução Aporte (item que não entra no resultado) |
| 02/10 | Hubla | 731,10 | Reserva Saque (item que não entra no resultado) |

Se as quatro contarem como despesa: 65.155,22 − 49.335,98 = **R$ 15.819,24**, o valor que você esperava, centavo por centavo. É o mesmo total da Análise de Despesas de outubro.

## O que fazer
1. **Pró-labore (R$ 12.881,01):** trocar a marcação de "operação" para despesa normal nas duas linhas. Isso é erro de conciliação. Resultado vai para R$ 24.669,33.
2. **Devolução de Aporte (R$ 8.118,99) e Reserva Saque (R$ 731,10):** pela regra da plataforma, devolução de aporte é operação (só mexe no caixa). Para chegar em R$ 15.819,24, esses dois itens do modelo da Go Company precisam passar a "entra no resultado". Faço isso só se você confirmar.
3. Registrar a alteração no histórico da empresa e conferir de novo: resultado de outubro igual a R$ 15.819,24 (ou R$ 24.669,33 se o item 2 ficar como está).

## Detalhes técnicos
- `bank_transaction_splits` 570f40e4 (6.881,01) e `bank_transactions` f7a5ae6a (6.000,00): `categoria/movement_kind` operacao → normal; o gatilho sincroniza `bank_cashflow_entries`.
- Item 2: `financial_model_template_items` 4fce387d e a6855765 com `entra_no_resultado=true` (modelo c3eb744f — verificar antes se é usado só pela Go Company).
