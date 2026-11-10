# Esconder pendências, acessos e atrasos das outras carteiras

## Quem pode ver tudo (visão de gestão)
Bruna, Acy, Gisele, Isabelly e Ana.

## Quem perde a visão das outras carteiras
Kassila, Thau e Hannah, e qualquer outra pessoa da equipe. Elas continuam podendo **entrar** em qualquer empresa para ajudar, mas na Central só veem a própria carteira: pendências, totais, atrasos, relatório, "Meu dia", avisos e registro de acessos de clientes.

## O que muda
1. Nova permissão por pessoa: "Ver todas as carteiras" (`team_oversight` em `user_permissions`), concedida a Gisele, Isabelly e Ana. Bruna e Acy já veem por serem proprietárias.
2. **No servidor** (não só na tela): as consultas da Central (`get_management_portfolio`, `get_management_daily_status`, `get_management_reconciliation_backlog`, `get_client_access_overview` e o registro de acessos) passam a devolver só as empresas da própria carteira para quem não tem essa permissão. Assim, nem por outro caminho a pessoa vê números das colegas.
3. **Na tela**: o painel de gerência, o seletor "Todas as carteiras / Carteira de Fulana" e os totais gerais aparecem só para quem tem a permissão. Hoje isso é liberado para todo mundo que "acessa todas as empresas" — é essa a falha.
4. Na tela de usuários, a permissão aparece como opção para ligar/desligar em outras pessoas no futuro.

## Conferência
- Entrar como Kassila: só a carteira dela, sem opção de outras, mas consegue abrir uma empresa de outra pessoa.
- Entrar como Gisele: vê todas as carteiras como hoje.

## Detalhes técnicos
- Função `can_oversee_team()` = `is_super_admin() or exists(user_permissions 'team_oversight')`.
- Filtro nas RPCs: `can_oversee_team() or responsible_user_id = auth.uid()` (responsável em `school_management_settings`).
- `showManager`/`showOwnerFilter` em `ManagementCenter.tsx`, `TeamAlerts`/`teamAlerts.ts` e `ClientLoginActivity.tsx` passam a usar a nova permissão em vez de `admin_scope='all'`.
- `admin_scope='all'` continua só como acesso para entrar nas empresas.
- Registrar a regra no AGENTS.md.
