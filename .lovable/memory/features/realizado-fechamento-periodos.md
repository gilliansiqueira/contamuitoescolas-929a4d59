---
name: Fechamento de períodos (Realizado)
description: Sistema de fechar/reabrir meses no Relatório Realizado, com bloqueio automático no banco via triggers
type: feature
---
Tabela `period_closures` registra meses fechados por escola (status='closed') ou reabertos (status='reopened', mantém histórico). Triggers em `realized_entries`, `monthly_revenue`, `kpi_values` e `receivable_category_values` bloqueiam INSERT/UPDATE/DELETE quando o mês está fechado, exceto para admin (`is_admin()`). Função helper `is_month_closed(school_id, month)` e `is_date_in_closed_month`. Reabertura é admin-only via política RLS de UPDATE. Toda ação grava em `audit_log`. Hook `usePeriodClosures` / `useClosedMonths` expõe os meses fechados ao frontend; UI fica em `Realizado → Configurações → Fechamento`.
