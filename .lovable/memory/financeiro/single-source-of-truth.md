---
name: Single Source of Truth Financeira
description: SSOT - Classificação explícita em type_classifications vale para todas as origens (inclusive uploads nativos)
type: feature
---

Toda lógica financeira (Dashboard, CashFlow, DailyFlow, ProjectedVsReal, snapshotUtils) usa a mesma cadeia:

1. **Escopo das regras de classificação** — As regras de `type_classifications`
   se aplicam a TODAS as origens quando há uma linha EXPLÍCITA cadastrada
   para a `categoria` ou `tipoOriginal` da entry. Isso inclui uploads
   nativos: Sponte, Cheques, Cartões e Contas a Pagar.

   - Se o usuário cadastrou "Pro-Labore" como Operação em
     "Classificação de Tipos", entries de contas_pagar com categoria
     "Pro-Labore" passam a contar como Operação no Dashboard e no
     Fluxo Diário.
   - Se NÃO houver classificação explícita, uploads nativos voltam ao
     default por tipo (entrada=receita somar, saida=despesa subtrair) e
     são bucketados como "Receita (Sponte/Cheques/Cartões)" ou
     "Despesa (Contas a Pagar)" no Dashboard.
   - DEFAULT_MAPPINGS (saida/entrada/despesa etc.) NUNCA são aplicados
     a uploads nativos — só classificação explícita do usuário.

   Implementado em `ledgerEngine.findExplicitClassification` /
   `resolveEntryLedgerRule` / `getLedgerSaldoImpact` e replicado no
   bucketing do Dashboard.

2. **Filtro de "Ignorar" — APENAS em Realizado/Histórico** —
   `filterActiveEntries(entries, classifications)` só é aplicado em:
   - Fluxo de Caixa Realizado (RelatorioRealizado e snapshots)
   - Histórico Financeiro (snapshotUtils)
   Projeção, Dashboard, Fluxo Diário, Recebíveis, Calendário, Simulação e
   ProjetadoVsReal **NÃO** removem categorias "ignorar".

3. **Importação NÃO descarta registros** — `applyRules` em FileUpload.tsx
   nunca retorna `null` para ação `'ignorar'`.

4. **Gate do Modelo Financeiro** — `useSchoolModel(schoolId)` retorna
   `isInModel(label)`. Tipos fora do modelo são descartados — exceto
   `origem='contas_pagar'`, que sempre passa.

5. **Resolução de metadados** — `resolveTipoMeta` em `@/lib/tipoMeta.ts` é
   a ÚNICA função que mapeia rótulo → classificação/sinal.

6. **Cálculo de impacto** — `getSaldoImpact` / `calculateTotals` em
   `classificationUtils.ts`. Categorias 'ignorar' retornam 0 impacto.

## Garantias
- `e.tipo === 'entrada'/'saida'` NÃO pode somar valores em agregações.
  Sempre via `getSaldoImpact` / `calculateTotals`.
- Tudo que aparece no Dashboard aparece também no Fluxo Diário (mesma
  classificação, mesmo bucket).
