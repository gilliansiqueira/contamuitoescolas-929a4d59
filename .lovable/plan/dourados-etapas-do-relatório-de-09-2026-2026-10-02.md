# Dourados — etapas do relatório de 09/2026

## O que encontrei
- **Vendas** e **Receitas por categoria**: já estão marcadas automaticamente.
- **KPIs**: 5 de 6 preenchidos. Falta só **Ticket Médio** de setembro. Por isso a etapa continua aberta. Esse comportamento está certo.
- **Despesas (Contas pagas)**: as despesas de setembro entraram hoje (195 lançamentos no Relatório Realizado, às 10:36). Mas essa tela não deixa registro de "envio de arquivo" onde o sistema procura. Por isso a etapa não marcou. **Esse é o erro.**
- **Conciliação**: 704 de 705 lançamentos de setembro estão conciliados. Falta 1 pendente, então a análise de despesas e o realizado da projeção ainda não chegam a 100%.

## O que vou corrigir
1. A etapa "Contas pagas" também vai marcar sozinha quando existirem despesas realizadas do mês, lançadas até o prazo.
2. Ela vai se atualizar na hora em que as despesas forem salvas ou apagadas, sem precisar abrir a tela. Assim já funciona para todas as empresas.
3. Vou recalcular setembro em todas as empresas ativas. Dourados deve passar a mostrar "Contas pagas" marcada.
4. Vou mostrar qual é o lançamento pendente da conciliação de Dourados, para a equipe resolver. O Ticket Médio continua com a equipe.

## Detalhes técnicos
- `_refresh_report_progress`: `v_pagas` passa a aceitar também `EXISTS realized_entries` com `school_id`, `data` no mês e `created_at < v_due`, além de `upload_records` (`centro_custos`/`realizado`).
- Adicionar `report_progress_stmt_trigger` por comando em `realized_entries` (INSERT/UPDATE/DELETE).
- Backfill: chamar `_refresh_report_progress(id,'2026-09')` para as empresas ativas.
- Sem mudança de tela e sem impacto nos cálculos financeiros.
