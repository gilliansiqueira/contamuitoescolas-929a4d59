# Tarefas do dia e Relatório mensal na Central de Clientes

## Objetivo
Separar duas listas de acompanhamento:
- **Tarefas do dia** (rotina diária): conciliação, agendamento de contas a pagar, baixas no sistema e fechamento de caixa para o cliente.
- **Relatório** (entrega mensal): o passo a passo abaixo.

A tela inicial da Central fica praticamente igual; só o nome "Fechamento" vira **Relatório**. Os detalhes das etapas ficam dentro da aba que hoje se chama Fechamento (renomeada para Relatório). As 3 etapas genéricas de hoje saem do Relatório e passam para Tarefas do dia.

## Tarefas do dia (lista diária, modelo padrão por empresa)

```text
1. Conciliação do dia ............ automático (sem pendências do dia no Fluxo Bancário)
2. Agendamento de contas a pagar . manual
3. Baixas no sistema ............. manual
4. Fechamento de caixa enviado ao cliente ... manual
```
- Geradas todo dia útil como pendentes, com quem marcou e quando; ajustes por empresa (desativar, renomear, tarefa extra) no mesmo modelo do Relatório.
- Na Central, a coluna de conciliação do dia continua como está; ao lado, um contador "Tarefas do dia: 3 de 4", e o detalhe abre dentro da ficha da empresa.

## Etapas (modelo padrão para todas as empresas)

```text
1. Projeção
   1.1 Projetado x Realizado ............ automático (Fluxo Bancário ativo e mês conciliado)
   1.2 Atualizar receitas/despesas futuras  automático (upload de projeção feito no mês)
   1.3 Enviar simulação de vendas + previsão de saldo do próximo mês ... manual
2. Despesas
   2.1 Conciliação 100% ................. automático (sem pendências no Fluxo Bancário do mês)
   2.2 Subir Contas a Pagar (Análise de despesas) automático (upload de contas pagas do mês)
3. KPIs calculados e lançados ........... manual (mostra se já existem valores no mês)
4. Receitas por categoria ............... manual (mostra se já existem valores)
5. Vendas ............................... manual (mostra se já existem valores)
6. Contatos e matrículas ................ manual (mostra se já existem valores)
7. Análise em texto + PDF enviados ao cliente ... manual, com assistente de texto
```

Tipos de etapa:
- **Automática**: o sistema marca como concluída quando a condição é cumprida; a equipe pode marcar "concluída manualmente" com observação se precisar.
- **Manual com dica**: a equipe marca; o sistema mostra "já há dados lançados" ou "ainda sem dados" para ajudar.
- **Manual**: só a equipe marca.

Continua valendo: ajustes por empresa (desativar, renomear, etapa extra) e geração automática todo mês como pendente.

## Tela
- Tela inicial da Central: mesma estrutura de hoje, só troca "Fechamento" por **Relatório** (percentual e cards).
- Colunas da tabela, sem repetição:
  - **Andamento** passa a mostrar o **percentual do Relatório** do mês (barra + "5 de 9 etapas"), em vez de repetir a conciliação.
  - **Conciliação do dia** fica como único lugar da conciliação: selo (Extrato não enviado / Aguardando início / Em andamento / Concluída / Indisponível) + "X conciliados hoje".
  - Sai o texto repetido "Ativa há X min" (o tempo já aparece em Última alteração).
- Aba **Relatório** (antiga Fechamento): painel do mês da empresa, agrupado em Projeção, Despesas, KPIs, Receitas, Vendas, Contatos/Matrículas e Envio, com selo Automático/Manual, quem marcou e quando.
- Cada etapa tem atalho para a tela onde a tarefa é feita (Simulação, Importação, Indicadores etc.).
- A marca "Relatório entregue" da Central fica ligada à etapa 7.

## Etapa 7 — assistente de análise
- Botão **"Gerar rascunho da análise"**: monta um texto a partir dos números oficiais do mês (receita, despesa, resultado, projetado x realizado, maiores despesas, KPIs, saldo previsto do próximo mês) usando a IA da plataforma.
- A equipe revisa e edita; o texto fica salvo por empresa/mês, com botão Copiar, e é marcado junto com o envio do PDF.
- A IA só redige; nenhum número é recalculado por ela — todos vêm da fonte única de cálculo.

## Fora de escopo
- Cálculo automático de lucratividade (fica para depois).
- Nenhuma mudança em cálculos financeiros, Dashboard ou Fluxo Diário.
- Clientes não veem as etapas.

## Detalhes técnicos
- Migration aditiva: coluna `check_kind` ('auto' | 'hint' | 'manual') e `group_key` em `closing_step_templates`; novas etapas inseridas e as 3 antigas desativadas (não apagadas; meses já gerados preservados).
- `ensure_monthly_checklist` passa a avaliar condições automáticas (bank_transactions do mês sem pendência, upload_records do mês por tipo, existência de kpi_values / receivable_category_values / sales_data / conversion_data) e marcar `source='auto'`, sem sobrescrever marcações manuais.
- Nova tabela `monthly_report_analyses` (school_id, month, texto, gerado_em, editado_por) com GRANT + RLS só equipe.
- Tarefas do dia: nova tabela `daily_task_templates` (+ overrides por empresa) e `daily_task_checklist` (school_id, day, task_key, status, completed_by/at), com GRANT + RLS só equipe; função `ensure_daily_tasks(_school_id, _day)` idempotente; as 3 etapas antigas do fechamento viram modelo das tarefas diárias.
- Edge Function `draft-monthly-analysis` com Lovable AI, recebendo os totais já calculados pelo frontend via SSOT.
- Renomear rótulos em ManagementCenter.tsx e ClosingStepsDialog.tsx; novo painel ReportStepsPanel.

## Validação
- Empresa com Fluxo Bancário conciliado sai com 1.1 e 2.1 marcadas sozinhas.
- Subir Contas a Pagar marca 2.2; marcar 7 liga "Relatório entregue".
- Gerar rascunho da análise em uma empresa com dados e conferir que os números batem com o Dashboard.
