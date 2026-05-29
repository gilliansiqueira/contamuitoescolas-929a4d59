---
name: Single Source of Truth Financeira
description: SSOT - classificationUtils + tipoMeta + useSchoolModel. Sem cálculos paralelos
type: feature
---

Toda lógica financeira (Dashboard, CashFlow, DailyFlow, ProjectedVsReal, snapshotUtils) usa a mesma cadeia:

1. **Filtro de Ignorar** — `filterActiveEntries(entries, classifications)` remove
   entradas com classificação 'ignorar'. Nenhuma tela pode duplicar essa lógica.

2. **Gate do Modelo Financeiro** — `useSchoolModel(schoolId)` retorna `isInModel(label)`.
   Quando a escola tem template ativo, tipos fora do modelo são descartados
   ANTES de qualquer cálculo. Aplicado em: Dashboard, CashFlow, DailyFlow,
   ProjectedVsReal e snapshotUtils.

3. **Resolução de metadados** — `resolveTipoMeta(tipoKey, classifications)` em
   `@/lib/tipoMeta.ts` é a ÚNICA função que mapeia rótulo → classificação/sinal.
   Sem heurística por nome. Sem fallback diferente entre telas. Sem regex.

4. **Cálculo de impacto** — `getSaldoImpact(entry, classifications)` e
   `calculateTotals(entries, classifications)` em `classificationUtils.ts`.
   Categorias 'ignorar' retornam impacto 0. Sinal vem da config do usuário.

5. **ProjectedVsReal** usa `tipoRegistro` ('projetado' vs 'realizado') e
   `calculateTotals`, jamais `entry.tipo` direto.

## Garantias
- `e.tipo === 'entrada'/'saida'` NÃO pode ser usado para somar valores em
  agregações. Sempre via `getSaldoImpact` / `calculateTotals`.
- Nenhuma tela pode mapear "saida → despesa" por nome — só via `type_classifications`.
- snapshotUtils.resolveHistTipo delega para `resolveTipoMeta` (sem heurística).
