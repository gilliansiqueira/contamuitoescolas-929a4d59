# Relatórios: etapas marcadas sozinhas + prazo do 5º dia útil

## O que muda para a equipe
1. **As etapas se marcam sozinhas assim que o dado entra**, sem precisar abrir o relatório:
   - **Análise de despesas:** quando a conciliação do mês chega a 100% e o arquivo de contas pagas do mês é enviado.
   - **KPIs:** quando todos os KPIs ativos da empresa têm valor no mês. Se faltar algum, a etapa mostra "3 de 5 preenchidos".
   - **Receitas por categoria, Vendas, Contatos e matrículas:** quando existe lançamento do mês. Hoje isso aparece só como dica e ainda depende de clique.
   - **Projeção:** continua como hoje (conciliação 100% e upload de projeção).
   - Quando o sistema marca uma etapa, aparece "Marcado automaticamente: <motivo>". **A marcação feita pela equipe nunca é desfeita.** Se o dado for apagado depois, uma etapa marcada pelo sistema volta a ficar aberta.
2. **Prazo automático:** o relatório do mês vence no **5º dia útil do mês seguinte**, sem contar sábados, domingos e feriados nacionais. Para setembro/2026, o prazo é **06/10**, porque 02/10 é sexta, 05/10 é segunda e 06/10 é terça.
   - Na Central aparece "vence em 2 dias úteis" ou "atrasado 1 dia".
   - A cor muda para amarelo a 2 dias úteis do prazo e vermelho quando o prazo passa sem entrega.
   - Os cards do topo (Projeção, Análise de despesas…) passam a contar só o que falta no mês do relatório.
3. **O mês do relatório passa a ser o mês anterior por padrão** até a entrega. Em outubro, a Central mostra setembro.

## Detalhes técnicos
- Novo `refresh_report_progress(_school_id, _month)` (security definer), reaproveitando `ensure_monthly_checklist`:
  - completa `kpis` quando todos os `kpi_definitions` ativos têm `kpi_values` no mês;
  - completa `receitas_categoria`, `vendas` e `contatos_matriculas` pelas mesmas consultas de `get_report_step_hints`;
  - corrige a janela dos uploads, que hoje é `uploaded_at >= início do mês` sem limite. O novo critério é: upload entre o início do mês e o prazo, ou `periodo` do upload no mês;
  - reabre só etapas com `source='automatic'` cujo dado sumiu.
- Triggers AFTER INSERT/UPDATE/DELETE (de linha, leves) em `kpi_values`, `receivable_category_values`, `sales_data`, `conversion_data`, `upload_records` e `bank_transactions` (`recon_status`), que chamam o refresh da empresa e do mês afetado. Sem tarefa agendada.
- Função `report_due_date(_month)`: 5º dia útil com tabela fixa de feriados nacionais 2026–2027. `get_management_portfolio` passa a devolver `due_date`, `business_days_left` e `is_late`. `closing_due_day` fica como reserva (comentado como deprecated se não for mais usado).
- `ReportChecklist`/`ManagementCenter`: rótulo "automático", contagem dos KPIs, selo de prazo e mês padrão = mês anterior.
- Antes de implementar, conferir como a tela chama `ensure_monthly_checklist` hoje, para não duplicar chamadas.

## Pergunta
"Terminar de subir as despesas" é o envio de **Contas pagas / Centro de custos**, ou também o **Detalhamento de despesas** feito na tela? Se você não disser, considero só o envio do arquivo mais a conciliação a 100%.
