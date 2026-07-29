---
name: Mês parcial — realizado até o corte + projeção depois
description: Regra SSOT para meses não fechados com fluxo importado (corte do realizado) e prazo de cobrança não reaplicado
type: feature
---
**Corte do realizado (`computeFluxoCutoff` em `src/lib/periodMovement.ts`)**
Quando um mês tem entries de origem `fluxo` (fonte = 'fluxo') e não está fechado:
- O realizado vale até a data de corte = último dia com movimento de fluxo (para meses já encerrados o corte é o último dia do mês). Não se estende o corte até "hoje": mês em aberto herda o SALDO PROJETADO para o mês seguinte, não o realizado parcial.
- Depois do corte, a projeção volta a valer (contas a pagar, sponte, cheque, cartão). Nunca há soma no mesmo dia.
- `MonthMovement.parcial` + `realizadoAte` sinalizam o mês em aberto; o Dashboard mostra um aviso "Período em aberto (parcial)".
- Consequência: `saldoFinal(M)` de um mês parcial já é "realizado até X + previsão até o fim do mês" e é herdado como `saldoInicial(M+1)`.

**Prazo de cobrança não pode ser aplicado duas vezes**
`financial_entries.delay_rule_applied` indica que a importação já deslocou `data` (guardando o vencimento em `data_original`). `applyPaymentDelay` (`src/lib/projectionEngine.ts`) retorna `entry.data` sem alteração quando `delayJaAplicado` é verdadeiro.

**Observações da projeção**: tabela `projection_notes` (school_id, month, note) — um comentário por mês, editado em `src/components/dashboard/ProjecaoNotas.tsx`.
