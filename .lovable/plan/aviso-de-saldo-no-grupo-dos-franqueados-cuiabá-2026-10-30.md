# Aviso de saldo no grupo dos franqueados (Cuiabá)

## O que muda para a equipe
- Nas empresas **Cuiabá Goiabeiras** e **Cuiabá Jardim Itália**, entram duas tarefas fixas todo dia em "Tarefas do dia":
  - "Enviar saldos no grupo dos franqueados — 9h"
  - "Enviar saldos no grupo dos franqueados — 17h"
- O aviso fica ligado à **empresa**, não à pessoa. Hoje aparece para a Manu; se a carteira mudar, passa sozinho para a nova responsável.
- Lembrete no "Resumo do seu dia" e no sininho: a partir das 9h (e das 17h), se a tarefa ainda não estiver marcada, aparece "Enviar saldos — Cuiabá Goiabeiras (9h)" em destaque, até alguém marcar como feito.
- Fica registrado quem marcou e a que horas, para acompanhamento.
- Tarefa só em dias úteis (seg–sex). Pode ajustar depois se precisarem também no sábado.

## Detalhes técnicos
- Migration: coluna nova `school_ids uuid[]` (nula = todas) e `due_time time` em `daily_task_templates`; `ensure_daily_tasks` passa a criar a tarefa só para empresas da lista. Inserir os 2 modelos (`saldo_franqueados_09`, `saldo_franqueados_17`) com as duas escolas.
- `src/lib/teamAlerts.ts`: nova regra pura "tarefa com horário vencida e não marcada" (horário de São Paulo) + teste.
- `TeamAlerts`/sininho mostram o alerta para quem tem a empresa na carteira (via RPCs da carteira já existentes).
- Sem impacto em cálculos financeiros.
