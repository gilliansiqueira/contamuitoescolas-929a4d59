# Ana (anacarolina@contamuito.com) como auxiliar de supervisão

Deixar a Ana com os mesmos acessos da Isabelly (sem ver o Ponto).

## O que muda para ela
- Passa a ver todas as empresas para ajudar a equipe (hoje vê só as 4 da carteira dela). A carteira e os avisos dela continuam só nas próprias empresas.
- Pode criar e alterar colaboradores, como a Gisele e a Isabelly (nunca as contas de proprietária, papéis ou permissões).
- Vê o acompanhamento de acessos dos clientes.
- Não vê o Ponto da equipe.

## Detalhes técnicos
Migração de dados:
- `profiles.admin_scope = 'all'` para user_id `96e10000-108d-4d24-8e3e-a2c6b4926416` (hoje `list`).
- Inserir em `user_permissions`: `collaborators_manage` e `client_logins_view` (on conflict do nothing).
- Papel `admin`, empresas da carteira e supervisão atual ficam como estão.
- Conferir depois lendo de volta perfil e permissões.
