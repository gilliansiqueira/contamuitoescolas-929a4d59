---
name: Single Source of Truth Financeira
description: SSOT - Regras de classificação aplicam só a Fluxo Realizado e Histórico Financeiro
type: feature
---

Toda lógica financeira (Dashboard, CashFlow, DailyFlow, ProjectedVsReal, snapshotUtils) usa a mesma cadeia:

1. **Escopo das regras de classificação (incl. "Ignorar")** — As regras de
   `type_classifications` SÓ se aplicam a entries de:
   - Fluxo de Caixa Realizado (`origem='fluxo'`)
   - Histórico Financeiro digitado (`historical_monthly`)
   - Entries manuais (`origem='manual'`)

   Uploads de **Sponte, Cheques, Cartões e Contas a Pagar** (`origem ∈
   {sponte, cheque, cartao, contas_pagar}`) NUNCA são filtrados nem
   reclassificados por regras do usuário. Eles sempre entram pelo `tipo`
   nativo (entrada=receita somar, saida=despesa subtrair). Implementado
   em `ledgerEngine.resolveEntryLedgerRule` / `getLedgerSaldoImpact` via
   `ORIGENS_SEMPRE_CLASSIFICADAS`.

2. **Filtro de "Ignorar" — APENAS em Realizado/Histórico** —
   `filterActiveEntries(entries, classifications)` só é aplicado em:
   - Fluxo de Caixa Realizado (RelatorioRealizado e snapshots)
   - Histórico Financeiro (snapshotUtils)
   Projeção, Dashboard, Fluxo Diário, Recebíveis, Calendário, Simulação e
   ProjetadoVsReal **NÃO** removem categorias "ignorar". Origem
   `contas_pagar` nunca é filtrada em nenhum contexto.

3. **Importação NÃO descarta registros** — `applyRules` em FileUpload.tsx
   nunca retorna `null` para ação `'ignorar'`.

4. **Gate do Modelo Financeiro** — `useSchoolModel(schoolId)` retorna
   `isInModel(label)`. Tipos fora do modelo são descartados — exceto
   `origem='contas_pagar'`, que sempre passa.

5. **Resolução de metadados** — `resolveTipoMeta` em `@/lib/tipoMeta.ts` é
   a ÚNICA função que mapeia rótulo → classificação/sinal.

6. **Cálculo de impacto** — `getSaldoImpact` / `calculateTotals` em
   `classificationUtils.ts`. Categorias 'ignorar' retornam 0 impacto APENAS
   para origens elegíveis.

## Garantias
- `e.tipo === 'entrada'/'saida'` NÃO pode somar valores em agregações.
  Sempre via `getSaldoImpact` / `calculateTotals`.
- Nenhuma tela mapeia "saida → despesa" por nome em sponte/cheque/cartao/
  contas_pagar — esses são fixos pelo `tipo` do registro.
