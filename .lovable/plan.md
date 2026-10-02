# Conciliação "Feita com pendências"

## O problema
Hoje a tarefa "Conciliação do dia" só se marca como concluída quando não sobra nenhum lançamento pendente desde 01/09. Se a menina conciliou o dia, mas ainda sobrou algum item que depende do cliente, a tarefa continua "Pendente", mesmo com o trabalho feito.

## O que muda
- Nova situação **"Feita com pendências"** na tarefa "Conciliação do dia", ao lado de Pendente / Concluída / Não se aplica.
  - Aparece com um ícone amarelo e a nota "Restam N lançamento(s) (R$ X)", contados automaticamente.
  - **Conta como feita** no "3 de 4" e na Central, então não fica mais como atraso.
  - A bolinha da empresa fica **amarela**, e não vermelha, para não esconder o que ainda falta.
- **Automático:** o sistema também marca "Feita com pendências" sozinho quando todos os lançamentos que sobraram têm motivo preenchido (a mesma lista de justificativas que já existe).
- Quando a última pendência for conciliada, a tarefa passa sozinha para **Concluída**.
- A etapa "Conciliação de despesas" do relatório mensal **não muda**: para o relatório, continua exigindo 100%.

## Detalhes técnicos
- `daily_task_checklist.status`: aceitar o novo valor `done_with_pending`. Se houver CHECK, ajustar por migração.
- `ensure_daily_tasks`:
  - Com 0 pendentes → `completed`, como hoje.
  - Com pendentes, todos com motivo (`bank_transactions` com justificativa) → `done_with_pending` com `source='auto'`. Só promove `open`; nunca rebaixa uma marcação feita pela equipe.
  - Se a tarefa está como `done_with_pending` e as pendências zeram → `completed`.
- `ReportChecklist.tsx` / `ClosingStepsDialog.tsx`: nova opção no seletor, ícone âmbar e nota com a quantidade e o valor restantes (vindos de `get_management_daily_status.recon_pending` / backlog).
- `useDailyTasksSummary` e Central (`dailyReconState`, MyDayPanel): `done_with_pending` conta como feita; estado visual "warn" (amarelo), em vez de "late".
- Sem mudança em cálculos financeiros, saldos ou na regra de 01/10 que exige justificativa para fechar o dia.

## Validação
Em Cuiabá Goiabeiras (9 pendentes): marcar à mão "Feita com pendências" e conferir 4 de 4, a nota "Restam 9 (R$ 1.148,74)" e a bolinha amarela na Central.
