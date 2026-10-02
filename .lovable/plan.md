# Lentidão agora: a Central dispara uma avalanche de pedidos

## O que encontrei (16:00)
- O servidor está de pé (memória 65%, 28 de 60 conexões), mas às 15:59 recebeu ~950 pedidos em 1 minuto e vários deram tempo esgotado.
- Os que falharam são quase todos da **Central de Clientes**: carteira das empresas, etapas do mês e tarefas do dia.
- Causa: cada vez que alguém abre a Central, ela manda **um pedido por empresa** (~60) para gerar as etapas do mês e mais ~60 para as tarefas do dia, todos ao mesmo tempo. E cada etapa gerada manda **recarregar a carteira inteira** — ou seja, até 60 recargas da consulta mais pesada da Central por pessoa. Com a Gisele, a Rubia e as outras abrindo a Central, isso trava o servidor e deixa o resto do sistema lento.

## O que vou fazer
1. **Um pedido só para todas as empresas:** novas funções no servidor que geram as etapas do mês e as tarefas do dia de todas as empresas da pessoa de uma vez (mesmas regras de hoje, mesmas permissões, Conta Muito continua oculta).
2. **Recarregar a carteira uma vez só**, no fim, em vez de uma vez por empresa.
3. **Não repetir à toa:** se as etapas já foram geradas há poucos minutos (por outra pessoa ou aba), a Central não refaz; as etapas continuam se atualizando sozinhas quando os dados entram, como já acontece.
4. Conferir depois: tempo para abrir a Central, número de pedidos por abertura (de ~180 para poucos) e se os números da Central ficam iguais aos de antes.

## O que não muda
- Nenhum dado, etapa marcada pela equipe ou regra financeira.

## Detalhes técnicos
- Migração: `ensure_monthly_checklist_bulk(_month)` e `ensure_daily_tasks_bulk(_day)` (SECURITY DEFINER, iteram as empresas visíveis via `user_has_school_access` + `can_see_school`, chamando as funções atuais).
- `ManagementCenter.tsx`: trocar o loop `ensureChecklist.mutate` por uma chamada bulk; invalidar `management-portfolio` uma vez.
- `useDailyTasksSummary`: trocar `Promise.all` de 60 RPCs por `ensure_daily_tasks_bulk`.
- Medir com os registros de pedidos (edge logs) antes/depois.
