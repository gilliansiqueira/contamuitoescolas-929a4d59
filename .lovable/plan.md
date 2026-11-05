# São Carlos (saídas previstas) + projeções que seguem "atrasadas" mesmo marcadas

## 1. São Carlos — saídas previstas de 01 a 08/10
**O que aconteceu:** essas datas nunca tiveram contas a pagar previstas gravadas. O envio de 02/09 ia até 30/09 e o de 09/10 foi gravado só a partir de 09/10. O envio de hoje não apagou nada.

**O que vou fazer:**
- Gravar o relatório enviado (87 contas, R$ 100.532,73) como previsto de 01 a 08/10, substituindo só esses dias. Contas de sábado (03/10, R$ 237,07) vão para sexta, 02/10, como manda a regra de fim de semana da projeção.
- Por dia: 01/10 R$ 6.323,79 · 02/10 R$ 4.967,59 (+ R$ 237,07 de sábado) · 05/10 R$ 82.193,43 · 06/10 R$ 3.787,12 · 07/10 R$ 813,24 · 08/10 R$ 2.210,49.
- Fica rastreado como um envio próprio, que pode ser excluído.

**Duplicidade do envio de hoje:** o envio de hoje começou em 30/10, mas as contas antigas desse intervalo não foram substituídas:
- 30/10: Apoema R$ 950, Puragua R$ 300 e Telebayte R$ 610,99 aparecem duas vezes.
- 03/11: VIVO R$ 74 aparece duas vezes.
Vou remover só as cópias antigas e registrar no histórico. Também vou corrigir a regra: a substituição passa a começar na primeira data realmente gravada, para que contas de fim de semana puxadas para sexta não fiquem duplicadas. Vou criar um teste para esse caso.

## 2. Projeções marcadas que seguem "atrasadas"
**Causa confirmada (exemplo do print):** a etapa "Atualizar receitas e despesas futuras" foi marcada automaticamente em 01/10, mais de 15 dias antes do prazo. Pela regra combinada, ela não vale como entrega. Mesmo assim, a tela mostra "Concluída" sem nenhum aviso, e um novo envio ou um novo check não atualiza a data. Por isso a escola continua contando como atrasada.

**O que vou fazer (mantendo a regra dos 15 dias):**
- A etapa marcada cedo aparece em laranja: "Marcada em 01/10, cedo demais. Atualize a projeção ou confirme de novo."
- Um botão **"Confirmar hoje"** atualiza a data da marcação, e a escola sai da faixa vermelha na hora.
- Um novo envio de dados futuros atualiza a data da marcação automática, que antes ficava presa na primeira vez. Marcações manuais da equipe continuam intactas.
- Vou listar quais escolas estão nessa situação hoje para você conferir.

## Detalhes técnicos
- Gravar 01–08/10 em `financial_entries` (origem `contas_pagar`, `source_kind` import, novo `origem_upload_id` em `upload_records`) via run_sql. Sábado vai para sexta. Antes, apagar só `contas_pagar` de 2026-10-01 a 2026-10-08 (hoje vazio).
- Duplicidade: apagar as linhas com imported_at 2026-10-09 em 30/10 (3 casadas por valor) e 03/11 (VIVO 74), com registro em `audit_log`.
- Substituição por data no upload de contas a pagar: usar `min(data ajustada, data escolhida)`. Teste em `src/test/`.
- `_refresh_report_progress`: quando `proj_futuras` for automática e houver upload mais recente, atualizar `completed_at` (migration). Na UI do relatório (`useClosingSteps`/checklist), usar `isFuturasTooEarly` para mostrar o aviso e o botão "Confirmar hoje", que regrava `completed_at = now()`.
