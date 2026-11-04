# Acessos dos clientes na Central de Clientes

Hoje já existem 49 logins de clientes; 33 deles entraram pelo menos uma vez. Dá para mostrar isso.

## O que você vai ver
Nova seção **"Acessos dos clientes"** no menu lateral da Central de Clientes, visível **somente para Acy, adm, Gisele e Isabelly** (as demais pessoas da equipe não veem o item nem conseguem consultar os dados):
- Uma linha por empresa: nome, logins do cliente, **último acesso** (data e hora) e quantos dias atrás.
- Etiqueta de cor: acessou nos últimos 7 dias (verde), 8–30 dias (laranja), mais de 30 dias ou **nunca acessou** (vermelho).
- Filtros: "Nunca acessaram", "Sem acesso há 30+ dias", busca por empresa; ordenação pelo acesso mais antigo.
- Ao abrir a linha: cada login da empresa com seu último acesso e quantos dias diferentes entrou nos últimos 30 dias.

## Precisão do "último acesso"
O login guarda só quando a pessoa digita a senha; quem fica conectado direto não atualizaria. Por isso, a partir de agora a plataforma registra uma vez por dia quando o cliente abre o sistema. Antes disso, vale a data do último login.

## Detalhes técnicos
- Acesso: super_admin (Acy, adm) ou nova permissão `client_logins_view` em `user_permissions`, concedida a Gisele e Isabelly; função `can_view_client_logins()` usada no banco e na tela.
- Tabela `client_access_log (user_id, school_id, day, first_at, last_at)` com chave única por usuário/dia; gravação pelo próprio cliente (upsert diário ao carregar o app); leitura só com `can_view_client_logins()` + RESTRICTIVE `can_see_school`.
- Função segura `get_client_access_overview()` (exige `can_view_client_logins()`) juntando `user_roles` (cliente), `user_schools`, `auth.users.last_sign_in_at` e o registro diário.
- Componente `src/components/management/ClientLoginActivity.tsx` e item no menu de `ManagementCenter.tsx`. Regra de cor pura em `src/lib/clientAccessActivity.ts` com teste.
- Não afeta nenhum cálculo financeiro.
