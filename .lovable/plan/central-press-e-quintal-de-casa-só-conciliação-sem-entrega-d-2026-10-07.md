# Central Press e Quintal de Casa: só conciliação, sem entrega de relatório

## O que muda
- **Central Press** e **Quintal de Casa** deixam de ter as etapas de relatório mensal e ficam apenas com as etapas de conciliação.
- Etapas que **permanecem** nessas duas empresas:
  - Conciliação de despesas 100%
  - Subir Contas a Pagar (Análise de despesas)
- Etapas **desativadas** só para essas duas empresas (as demais empresas não mudam):
  - Comparar projetado x realizado
  - Atualizar receitas e despesas futuras
  - Enviar simulação de vendas e previsão de saldo
  - KPIs calculados e lançados
  - Receitas por categoria
  - Vendas
  - Contatos e matrículas
  - Análise em texto + PDF enviados ao cliente
- No mês em andamento (outubro/2026), as etapas desativadas aparecem como **"Não se aplica"**, sem desfazer nada que já tenha sido marcado manualmente pela equipe.
- Nos meses seguintes, essas etapas nem são geradas para essas empresas.
- As Tarefas do dia (conciliação diária) e a bolinha da Central continuam funcionando normalmente para as duas.

## O que não muda
- Nenhum lançamento financeiro, extrato ou conciliação é alterado.
- Nenhuma outra empresa é afetada.
- Reversível a qualquer momento: basta reativar as etapas na janela "Relatório" de cada empresa.

## Detalhes técnicos
- Inserir registros em `school_closing_step_overrides` (disabled=true) para os 8 templates de relatório, para os school_id de Central Press e Quintal de Casa — mesma mecânica da janela "Etapas desta empresa".
- Atualizar `monthly_closing_checklist` do mês corrente: marcar `not_applicable` apenas as etapas desativadas que estejam `open` e não tenham sido concluídas manualmente.
- Conferir na Central que os cards de etapas de relatório não contam mais essas duas empresas como pendentes.

## Conferência
- Abrir a Central no mês atual e confirmar que Central Press e Quintal de Casa não aparecem mais como pendentes nas etapas de relatório, apenas na conciliação.
