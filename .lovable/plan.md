# Acesso da Gisele + financeiro da Conta Muito + "Meu dia" de gerência

## 1. Empresa restrita (financeiro da Conta Muito)
- Nova opção no cadastro da empresa: **"Empresa restrita (só super admin)"**.
- Cadastramos a empresa "Conta Muito" já marcada como restrita.
- Empresa restrita não aparece para ninguém além dos super admins: nem na lista de empresas, nem na Central, nem no Meu dia, nem nas buscas — a regra fica no banco de dados, então nem tentando pelo endereço direto ela abre.

## 2. Login da Gisele
- Criamos o acesso dela como administradora com visão de **todas as empresas, menos as restritas**; empresas novas entram sozinhas.
- Nova permissão **"Ver Ponto da Equipe"**, liberada só para ela (hoje o Ponto é só de super admin). Ela vê o Ponto, mas continua sem gravar nada direto — a gravação segue só pela sincronização.
- Ela vê a Central inteira com as atualizações de hoje de todas as meninas.
- Preciso do **e-mail da Gisele** para criar o acesso (ela recebe o link para definir a senha).

## 3. "Meu dia" de gerência (aparece para a Gisele e para você)
Um bloco extra acima do Meu dia normal, com 4 cards resumidos e expansíveis:
- **Equipe hoje** — uma linha por responsável: "Rubia — 2 conciliações atrasadas · 3 tarefas abertas · 1 relatório vence em 2 dias". Clicando, abre por empresa.
- **Ponto do dia** — quem está sem marcação, com marcação incompleta ou atrasado hoje, e quem está com banco de horas negativo.
- **Empresas paradas** — sem nenhuma alteração da equipe há 3 dias úteis ou mais, ou com extrato vencido.
- **Riscos de clientes** — soma de todas as empresas: caixa previsto negativo em 15 dias e contas que "não saíram da conta".
- Os números vêm das mesmas fontes que já existem (carteira, tarefas, relatório, Ponto, Meu dia) — nada recalculado.

## Fora de escopo
- Nenhuma mudança em cálculos financeiros. Clientes não veem nada disso.

## Detalhes técnicos
- Migração: `schools.restrita boolean default false`; `user_has_school_access`, `is_admin()`-based policies e RPCs da carteira (`get_management_portfolio`, `get_management_daily_status`, backlog, candidatos) passam a excluir `restrita` quando o usuário não é `super_admin` (função `can_see_school(_school_id)` usada nas políticas que hoje liberam admin geral).
- Permissão de Ponto: tabela `user_permissions(user_id, permission)` com GRANT/RLS (só super_admin edita) + função `can_view_team_time()` = super_admin OU permissão `ponto_view`; políticas SELECT das `team_time_*` trocam `is_super_admin()` por ela. Escrita continua só na Edge Function. A tela do Ponto usa a mesma função para mostrar o menu.
- Gisele: usuário criado por convite, `user_roles`=admin, `profiles.admin_scope='all'`, permissão `ponto_view`.
- Meu dia gerência: novo `ManagerDayPanel` no topo de `ManagementCenter.tsx`, visível com `isSuperAdmin` ou `admin_scope='all'`; reaproveita `rows` da carteira, `useDailyTasksSummary`, `useMyDay` (riscos) e `useTeamTime` (ponto).
