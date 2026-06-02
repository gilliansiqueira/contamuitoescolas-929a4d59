---
name: Single Source of Truth Financeira
description: SSOT - Contexto da regra "ignorar" e gate do modelo. Sem cálculos paralelos
type: feature
---

Toda lógica financeira (Dashboard, CashFlow, DailyFlow, ProjectedVsReal, snapshotUtils) usa a mesma cadeia:

1. **Filtro de "Ignorar" — APENAS em Realizado/Histórico** —
   `filterActiveEntries(entries, classifications)` só é aplicado em:
   - Fluxo de Caixa Realizado (RelatorioRealizado e seus snapshots)
   - Histórico Financeiro (snapshotUtils)
   Projeção, Dashboard, Fluxo Diário, Fluxo, Recebíveis, Calendário,
   Simulação e ProjetadoVsReal **NÃO** removem categorias "ignorar".
   Origem `contas_pagar` nunca é filtrada por categoria/modelo em nenhum contexto.

2. **Importação NÃO descarta registros** — `applyRules` em FileUpload.tsx
   nunca retorna `null` para ação `'ignorar'`. Todos os registros das
   origens (sponte, cheque, cartao, contas_pagar) são salvos integralmente.

3. **Gate do Modelo Financeiro** — `useSchoolModel(schoolId)` retorna
   `isInModel(label)`. Quando a escola tem template ativo, tipos fora do
   modelo são descartados ANTES de cálculo — exceto `origem='contas_pagar'`,
   que sempre passa.

4. **Resolução de metadados** — `resolveTipoMeta(tipoKey, classifications)`
   em `@/lib/tipoMeta.ts` é a ÚNICA função que mapeia rótulo →
   classificação/sinal. Sem heurística por nome.

5. **Cálculo de impacto** — `getSaldoImpact(entry, classifications)` e
   `calculateTotals(entries, classifications)` em `classificationUtils.ts`.
   Categorias 'ignorar' retornam impacto 0 quando consumidas.

6. **ProjectedVsReal** usa `tipoRegistro` ('projetado' vs 'realizado') e
   `calculateTotals`, jamais `entry.tipo` direto.

## Garantias
- `e.tipo === 'entrada'/'saida'` NÃO pode ser usado para somar valores em
  agregações. Sempre via `getSaldoImpact` / `calculateTotals`.
- Nenhuma tela pode mapear "saida → despesa" por nome — só via `type_classifications`.
- snapshotUtils.resolveHistTipo delega para `resolveTipoMeta` (sem heurística).
