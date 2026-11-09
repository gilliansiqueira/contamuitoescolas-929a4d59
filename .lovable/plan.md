# Editar usuário e trocar e-mail

## O que muda para você
- Na lista de Usuários (Configurações e Equipe › Usuários/Carteiras), cada usuário ganha um botão **Editar** (lápis), ao lado de senha e excluir.
- Abre uma janela com: **Nome** e **E-mail**. Ao salvar, o e-mail de login muda na hora (sem mandar confirmação para o novo endereço), e o usuário passa a entrar com o e-mail novo, mantendo a mesma senha, empresas e permissões.
- Avisos claros: "E-mail já está em uso por outro usuário" e "E-mail inválido".
- Fica registrado no histórico de acessos quem trocou e o e-mail antigo → novo.

## Quem pode editar
Mesma regra que já vale para trocar senha: super admin edita todos; equipe com permissão de gerir colaboradores edita colaboradores (nunca contas de proprietária); equipe edita clientes das empresas da própria carteira.

## Detalhes técnicos
- Nova Edge Function `update-user` (mesma checagem de permissão de `reset-user-password`, via `canManageCollaborator` + `admin_manages_school`), que chama `auth.admin.updateUserById(user_id, { email, email_confirm: true })`, atualiza `profiles.email`/nome e grava `user_access_changes` com `action: 'alterou_email'`.
- `UsersConfig.tsx`: botão lápis + diálogo de edição; recarrega a lista após salvar.
- Validação de e-mail no cliente e no servidor (minúsculas, sem espaços).
