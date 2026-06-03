---
name: Gate estrito do Modelo Financeiro
description: Dashboard/Histórico/Snapshots ignoram tipos fora do modelo financeiro ativo da escola
type: feature
---

Dashboard, Histórico Financeiro e cálculo de snapshots usam um gate estrito contra o **Modelo Financeiro ativo** da escola (`schools.financial_model_template_id` → `financial_model_template_items`).

Regras:
- Se a escola TEM modelo atribuído → tipos cujo `name` (normalizado) não existir nos itens do modelo são **excluídos** de:
  - `activeEntries` (financial_entries)
  - `historicalRows` (historical_monthly)
  - `snapshot.por_tipo` (period_closure_snapshots)
- Sem modelo atribuído → comportamento fail-open (não filtra), mantendo retrocompatibilidade.
- **Exceção obrigatória**: entries de origem `contas_pagar`, `sponte`, `cheque` e `cartao` SEMPRE passam pelo gate. Esses uploads são classificados pelo `tipo` nativo (entrada/saida) e não devem ser barrados pelo nome da categoria (ex.: "Boleto Bancário", "Cartão de Crédito", "cartao" não existem no modelo mas representam receita projetada). Implementado via `ORIGENS_BYPASS_MODELO` em `projectionEngine.projectEntries`.
- "Ignorar" sempre força `impactaCaixa=false` e `entraNoResultado=false` no consumo (Dashboard `resolveTipoMeta`), mesmo se a config legada disser o contrário.

Implementação:
- Hook `useSchoolModel(schoolId)` em `src/hooks/useSchoolModel.ts` expõe `{ hasModel, isInModel }`.
- `src/lib/snapshotUtils.ts` carrega itens do modelo via `loadSchoolModelItems` e aplica o mesmo filtro ao calcular snapshots.
