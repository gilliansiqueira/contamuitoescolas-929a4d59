# Receitas por categoria opcional na entrega do relatório

## O que muda para a equipe
- A etapa "4. Receitas por categoria" passa a aparecer com a etiqueta **Opcional (temporário)** no Controle do relatório mensal.
- Se ficar em aberto, **não conta como pendência**: a empresa não aparece no card "Receitas por categoria" como pendente, não trava o avanço para "Entregue" e não entra em "Outras pendências".
- Quem quiser continua podendo marcar como concluída ou "Não se aplica" normalmente; marcações já feitas ficam como estão.
- Vale para todas as empresas e todos os meses, até voltarmos a tornar obrigatória (basta desligar a marcação, sem mexer em código).
- As outras etapas do grupo (ex.: Vendas, que hoje aparece no mesmo card) continuam obrigatórias.

## Detalhes técnicos
- Migration: `closing_step_templates.optional boolean not null default false`; `update ... set optional = true where step_key = 'receitas_categoria'`.
- `useClosingSteps`: incluir `optional` no tipo `ClosingStepTemplate`.
- `ManagementCenter.tsx`: no cálculo de `openGroups`/`doneGroups` e de `reportStage`, ignorar etapas abertas cujo template é `optional` (tratadas como "não se aplica" para pendência).
- `ReportChecklist.tsx`: badge "Opcional" e contador "X de Y etapas" sem contar opcionais abertas.
- Entrega/atraso do relatório segue baseada em "Envio ao cliente" — sem alteração; nenhum cálculo financeiro é tocado.
