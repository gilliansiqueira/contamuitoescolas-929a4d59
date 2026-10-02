# Excluir a Piraquara duplicada (cadastro vazio)

## O que será excluído

A empresa **Piraquara** está cadastrada duas vezes:

| Cadastro | Criada em | Contas | Lançamentos | Uploads | Usuários | Situação |
|---|---|---|---|---|---|---|
| Correta (vai continuar) | 04/07/2026 | 3 | 191 | 15 | 1 | botão ativado |
| Duplicada (vai ser excluída) | 04/08/2026 | 0 | 0 | 0 | 0 | sem dados |

A duplicada **não tem nenhum dado financeiro**: nenhuma conta bancária, nenhum lançamento, nenhum arquivo enviado, nenhum usuário ligado a ela. As únicas 67 linhas existentes foram geradas automaticamente pelo sistema (25 registros de atividade, 20 tarefas do dia, 20 etapas do relatório mensal, 1 fonte de dados, 1 configuração de gestão e 1 recurso ativado).

## O que será feito

1. **Gravar o histórico antes de excluir** — um registro no Histórico de Alterações da Piraquara correta, informando a data, o cadastro removido e o motivo (empresa duplicada sem dados).
2. **Excluir a empresa duplicada** — ao remover o cadastro, as 67 linhas automáticas ligadas a ele somam junto, sem deixar nada para trás.
3. **Conferir o resultado** — confirmar que a Piraquara correta continua com as 3 contas, 191 lançamentos, 15 arquivos e 1 usuário, que o total de empresas cai de 63 para 62 e que a lista "sem botão ativado" passa de 30 para 29 empresas.

## Riscos e cuidados

- A exclusão é definitiva (não há como desfazer). Por isso o histórico é gravado antes.
- Nenhuma tela ou cálculo financeiro muda: a duplicada nunca participou de nenhum número.
- O cadastro correto não é tocado em nenhum passo.

## Detalhes técnicos

- `DELETE FROM public.schools WHERE id = '760c3ab2-099f-47da-a6eb-e8f11a00fd02'`.
- Todas as 67 linhas da duplicada estão em tabelas com `ON DELETE CASCADE` (`management_activity_history`, `daily_task_checklist`, `monthly_closing_checklist`, `school_data_sources`, `school_features`, `school_management_settings`), então a exclusão não gera registros órfãos.
- `audit_log.school_id` é `NOT NULL` e também tem cascade, então o registro do Histórico de Alterações é gravado com o id da Piraquara correta (182f7218-a572-42dd-895f-3e0b1ee31a51) e o id removido fica descrito no texto do registro — assim a informação sobrevive à exclusão.
- Verificação final: contagem de `schools`, contagem por tabela das duas empresas e a lista de empresas com `dashboard_source = 'planilha'`.
