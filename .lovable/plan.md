# Rio Verde – saldo em conta Sicoob

## Causa encontrada (conferida linha a linha)
Diferença: R$ 10.849,99 − R$ 6.594,87 = **R$ 4.255,12**.

O arquivo OFX do Sicoob trouxe os depósitos de cheque **bloqueados** como entradas e, alguns dias depois, trouxe também a **liberação** desses mesmos depósitos. O dinheiro foi contado duas vezes. No PDF do banco, os bloqueados aparecem com "*" e não entram no saldo; só a liberação entra.

| Depósito bloqueado (contado a mais) | Valor | Liberação (correta) |
|---|---|---|
| 10/09 DEP.CHEQUE BLOQ.1D | 1.641,25 | 11/09: 586,25 + 1.055,00 |
| 15/09 DEP.CHEQUE BLOQ.1D | 1.055,66 | 16/09: 1.055,66 |
| 18/09 DEP CH.CANAL ATEND.1D | 470,25 | 21/09: 470,25 |
| 22/09 DEP CH.CANAL ATEND.1D | 1.087,96 | 23/09: 1.087,96 |
| **Total** | **4.255,12** | |

Somente Rio Verde tem esse caso hoje (nenhuma outra empresa).

## O que será feito
1. **Corrigir os dados de Rio Verde:** retirar os 4 depósitos bloqueados (R$ 4.255,12) dessa importação de setembro, com registro na auditoria. As liberações ficam e continuam como receita. Saldo em conta passa a ser R$ 6.594,87, igual ao banco.
2. **Evitar que aconteça de novo:** na leitura de OFX do Sicoob, depósitos de cheque bloqueados ("DEP.CHEQUE BLOQ", "DEP CH.CANAL ATEND") deixam de ser importados, porque o valor já entra pela liberação. Aparece um aviso na prévia mostrando quantos foram deixados de fora.
3. **Receita:** hoje a receita de setembro está inflada em R$ 4.255,12 nessa conta; volta ao valor correto.

## Observação
A aplicação está R$ 76.451,35 no sistema e R$ 76.451,72 no banco (R$ 0,37 de rendimento), que deve aparecer em "A confirmar no próximo extrato", sem bloquear nada.

## Detalhes técnicos
- Remover da `bank_transactions` as 4 linhas (conta Sicoob Rio Verde, import OFX 25/09) por id; os triggers regeram `bank_cashflow_entries`. Registrar em `audit_log`.
- `src/lib/bankStatements/parsers.ts` (OFX): filtrar memos de depósito bloqueado quando houver liberação correspondente/padrão Sicoob; teste com os 4 casos.
- Nenhum dado antes de 01/09/2026 é tocado.
