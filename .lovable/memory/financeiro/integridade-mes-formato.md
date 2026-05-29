---
name: Integridade de formato de mês
description: Coluna `month` é estritamente AAAA-MM em todas as tabelas; CHECK no banco bloqueia gravações fora do padrão
type: feature
---

Todas as tabelas com coluna `month` (historical_monthly, monthly_revenue, conversion_data, kpi_values, receivable_category_values, investment_entries, period_closures, period_closure_snapshots) têm CHECK constraint:

`month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'`

Inserts/updates com formatos como `20251-01`, `202510-01`, `2025/01` ou `jan-25` falham no banco. O importador de Histórico Financeiro (HistoricoFinanceiroConfig.confirmImport) também aborta a importação inteira se houver qualquer linha com mês inválido — nada de gravação parcial.

Cleanup histórico (mig 2026-05-29): removidas 49 linhas duplicadas de Rio Verde e renomeadas 10 linhas de outra escola. Resolveu divergência saldo final Dez/25 ≠ saldo inicial Jan/26.
