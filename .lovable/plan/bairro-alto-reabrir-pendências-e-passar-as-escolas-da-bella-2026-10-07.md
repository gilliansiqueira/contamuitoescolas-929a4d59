# Bairro Alto: reabrir pendências e passar as escolas da Bella para a Rayssa

## O que encontrei
- As 5 saídas do Itaú de Bairro Alto que estão no print somam R$ 1.321,94. A Bella marcou todas como conciliadas: 4 em 29/09 e a da Leroy Merlin em 02/10. Por isso Bairro Alto não aparecia em Pendências.
- A Rayssa ainda não tem login no sistema, nem com o e-mail rayssa@contamuito.com.
- SJP, Bairro Alto, Morada do Sol e Linhares ainda estão com a Bella como responsável.

## O que vou fazer
1. **Bairro Alto:** voltar as 5 saídas para pendente, registrando o motivo "reaberto: falta lançar no contas a pagar". Assim elas voltam a aparecer em Pendências.
2. **Login da Rayssa:** criar o acesso de administradora para rayssa@contamuito.com, restrito à lista de escolas dela, como já é feito para a Bella. Ela recebe um e-mail para definir a senha, pelo "Esqueci minha senha".
3. **Carteira:** ligar SJP, Bairro Alto, Morada do Sol e Linhares à Rayssa e colocá-la como responsável dessas 4 escolas.
4. **Bella:** continua na equipe, sem essas 4 escolas.
5. **Conferir:** em "Por responsável", a Rayssa aparece com as 4 escolas, e Bairro Alto aparece em Pendências com 5 lançamentos.

## Detalhes técnicos
- Reabrir: `update bank_transactions set recon_status='pendente', recon_by/at/email=null, recon_note=...` para os ids b1968d0f, 69c08bf2, b2349787, c03ad4ba e 25ca5db1. Antes, checar se setembro de Bairro Alto não está com o mês fechado, o que bloquearia a alteração.
- Usuária: usar a Edge Function `create-admin-user` (role admin, `admin_scope='list'`). Depois, `user_schools` com as 4 escolas, remover essas 4 da Bella (`user_schools`/`profiles.school_id`) e chamar `set_management_responsible` para cada escola.
