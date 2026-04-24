---
name: Fechamento de períodos (Projeção)
description: Sistema de fechar/reabrir meses no módulo Projeção, totalmente independente do Realizado, com botão direto no Histórico Financeiro
type: feature
---
Tabela `period_closures` ganhou coluna `module` ('realizado' | 'projecao') com índice único `(school_id, month, module) WHERE status='closed'`. Função `is_month_closed_for_module(school_id, month, module)` e `is_date_in_closed_month_for_module`. Triggers em `historical_monthly`, `financial_entries`, `sales_data` e `conversion_data` bloqueiam INSERT/UPDATE/DELETE quando o mês está fechado para 'projecao' (bypass via `is_admin()`). Botão de cadeado fica direto no cabeçalho de cada coluna de mês em `HistoricoFinanceiroConfig` — clique abre AlertDialog de confirmação. Meses fechados mostram badge "Fechado" e inputs ficam disabled. Reabertura admin-only via dialog com motivo registrado em `audit_log`. Hook `usePeriodClosures(schoolId, 'projecao')` / `useClosedMonths(schoolId, 'projecao')`. Independente do fechamento do Realizado.
