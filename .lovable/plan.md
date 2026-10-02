# Corrigir "Última alteração" e contagem dos cards da Central

## O que está errado (confirmado)

1. **"há 4 min" em todas as empresas**: a coluna soma, entre outras coisas, o horário em que as etapas do relatório foram atualizadas. Como o sistema agora marca/atualiza as etapas sozinho (ao abrir a Central e nos gatilhos), as 60 empresas ativas tiveram etapas tocadas nos últimos 30 minutos — e isso apareceu como se a equipe tivesse mexido.
2. **"59 pendentes · 47 concluídas" em Projeção**: cada card junta várias etapas (ex.: Projeção = "Comparar projetado x realizado" + "Atualizar receitas e despesas futuras"). Hoje a empresa conta como pendente se *qualquer* etapa do card está aberta e como concluída se *qualquer* uma está fechada — por isso aparece nos dois números.

## Correções

1. **Última alteração = só ação da equipe**
   - Etapas do relatório entram no cálculo apenas quando marcadas por uma pessoa (não quando o sistema marca ou desmarca sozinho).
   - Continuam contando: uploads, lançamentos, extratos, conciliações e Histórico de Alterações.
2. **Cards sem sobreposição**
   - Concluída = todas as etapas daquele card fechadas.
   - Pendente = pelo menos uma etapa aberta.
   - Pendentes + Concluídas = total de empresas com etapas geradas (ex.: Projeção 12 pendentes · 47 concluídas).
   - Empresas já entregues contam como concluídas em todos os cards.
3. **Relatório sempre até o último dia do mês anterior**
   - As marcações automáticas de setembro consideram somente dados com data até 30/09 (lançamentos, KPIs, vendas, contatos, conciliação). Vou revisar cada regra automática e ajustar a que olhar além do fim do mês; a "Última alteração" continua mostrando o momento real da ação (é o que diz quando a equipe mexeu).
   - Reprocessar setembro nas empresas ativas depois do ajuste.

## Detalhes técnicos

- Migração recriando `get_management_portfolio`: no LATERAL `la`, trocar `max(c.updated_at)` de `monthly_closing_checklist` por `max(completed_at)` filtrando `completed_by IS NOT NULL` (marcação humana).
- `ManagementCenter.tsx`: `openGroups`/`doneGroups` passam a agrupar por grupo — `done` só quando todas as etapas aplicáveis do grupo estão ≠ 'open'; `report_delivered` entra em `done`.
- Revisar `_refresh_report_progress` para garantir filtros `data <= último dia do mês` em todas as fontes; backfill `'2026-09'`.
- Conferir na tela com login de super admin antes de concluir.
