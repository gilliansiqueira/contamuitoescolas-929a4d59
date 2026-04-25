---
name: Snapshot de meses fechados (Projeção)
description: Ao fechar mês na Projeção grava snapshot imutável; Dashboard prefere snapshot ao recálculo dinâmico
type: feature
---
Tabela `period_closure_snapshots` guarda valores finais (receitas, despesas, resultado, operações in/out, saldo_movimento, saldo_inicial, saldo_final + quebra `por_tipo` em jsonb) por (school_id, month, module). `useCloseMonths` para módulo `projecao` calcula o snapshot via `computeMonthSnapshot` (em `src/lib/snapshotUtils.ts`) ANTES de inserir o fechamento e grava com `closure_id` linkado. `Dashboard` usa `useSnapshotMap('projecao')` e adiciona fonte `'snapshot'` em `monthSources` com prioridade máxima — `tipoAggregations`, `monthlyChart`, `annualLineChart` e `saldoInicialCalculado` consomem o snapshot quando o mês está coberto. Reabrir mantém o snapshot como histórico (auditável) mas o `monthSources` volta a recalcular dinamicamente assim que o status passa a `reopened`. Mudanças em `type_classifications` NÃO afetam meses com snapshot.
