# Tarefas da gestão (Bruna, Isa, Ana e Gisele)

## O que muda
- Nova aba **"Tarefas"** no menu da equipe, visível só para quatro pessoas: Bruna (adm@contamuito), Isabelly, Ana Carolina e Gisele. Ninguém mais da equipe nem os clientes veem.
- Qualquer uma das quatro pode criar uma tarefa e escolher a **responsável** (ela mesma ou outra das quatro).
- Cada tarefa tem: título, descrição (opcional), empresa (opcional, ex.: Indaiatuba), responsável, prazo (opcional) e situação **Pendente / Em andamento / Concluída**.
- Na tela:
  - abas "Minhas", "Todas" e "Concluídas";
  - filtro por responsável e por empresa;
  - tarefas atrasadas destacadas;
  - comentários curtos em cada tarefa para acompanhar o andamento ("liguei pro cliente...");
  - quem criou e quando concluiu ficam registrados.
- Já cadastro como exemplo as que você citou:
  - Bruna: Brasília Sudoeste, cálculo de retorno do material didático;
  - Bruna: São Carlos, valuation;
  - Gisele: Indaiatuba, vincular o Asaas;
  - Gisele: Indaiatuba, mudar o saldo inicial no Omni.
- As tarefas não entram em nenhum cálculo financeiro; servem só para organizar a rotina.

## Detalhes técnicos
- Permissão `user_permissions.gestao_tarefas` concedida aos 4 usuários; função `can_use_mgmt_tasks()`.
- Tabelas `mgmt_tasks` (title, description, school_id nullable, assignee_id, created_by, due_date, status, completed_at, timestamps) e `mgmt_task_comments`; GRANTs + RLS com `can_use_mgmt_tasks()`; quando houver school_id, política RESTRICTIVE `can_see_school` (empresas restritas).
- Tela `src/components/mgmt-tasks/MgmtTasks.tsx`, regras puras (atraso, filtros) em `src/lib/mgmtTasks.ts` com teste; item no menu "Operação" condicionado à permissão.
- Regra registrada no AGENTS.md.
