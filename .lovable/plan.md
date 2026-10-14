# Equipe e acessos direto na Central

## Como fica para você (proprietária)
1. **Novo botão "Equipe e acessos" na Central** (página inicial), sem precisar entrar em nenhuma empresa.
   - Um cartão por pessoa da equipe, com as empresas da carteira dela em etiquetas.
   - Para tirar uma empresa, clique no "x" da etiqueta. Para incluir, use "+ Empresa" e escolha uma ou várias de uma vez.
   - Também é possível arrastar ou "Passar carteira": mover várias empresas de uma pessoa para outra em um único passo (como no caso Bella → Rayssa).
2. **Na linha de cada cliente da Central**, ao clicar no nome da responsável, abre um seletor rápido para trocar a responsável ou incluir mais alguém da equipe. Isso já atualiza a carteira das duas pessoas.
3. A aba Usuários dentro da empresa continua existindo, mas passa a mostrar só os logins daquela empresa.

## O que as meninas podem fazer (limitado)
- **Próprio login:** trocar a própria senha e o nome que aparece.
- **Logins dos clientes da carteira dela:** criar login de cliente, enviar link de nova senha e ligar ou desligar uma empresa *da própria carteira* nesse login.
- **Não podem:** excluir login, mudar alguém para equipe/proprietária, mexer na carteira de outra colega ou na própria carteira, nem ver clientes fora da carteira dela.
- Toda alteração fica registrada (quem, quando, o quê) para você consultar.

## Dados e segurança
- Nenhum cálculo, relatório ou lançamento é alterado.
- As regras de permissão passam a ser verificadas no servidor, não só na tela, para que ninguém consiga burlar pelo navegador.

## Detalhes técnicos
- Novo painel `TeamAccessPanel` no `ManagementCenter` (só super_admin), lendo `profiles`/`user_roles`/`user_schools`; seletor inline de responsável usa `set_management_responsible` + insert em `user_schools`.
- Nova RPC `transfer_portfolio(_from, _to, _school_ids[])` security definer, só super_admin, com registro em `audit_log`.
- Nova Edge Function `manage-client-login` (ações: criar cliente, link de senha, vincular/desvincular empresa) validando que o chamador é admin e que a empresa está na carteira dele; super_admin sem restrição. Sem ação de exclusão.
- Hoje a exclusão de usuário em `UsersConfig` é feita pelo navegador: restringir a super_admin (UI + RLS de delete em `profiles`/`user_roles`/`user_schools`).
- `create-admin-user` passa a aceitar admin restrito apenas para `role='cliente'` em escola da carteira.
- Troca de senha própria via `supabase.auth.updateUser` em "Minha conta" no cabeçalho.
