# Acabar com a "empresa principal" da equipe

## Agora (dados)
- A Bella tem SJP marcada como "principal" e não há botão para tirar essa marcação. Vou tirar SJP dela. Ela fica com FourBio e Agência One.
- A Rayssa fica com Bairro Alto, SJP, Morada do Sol e Linhares, todas iguais na carteira dela, sem nenhuma "principal".
- A Rayssa passa a ser a responsável dessas 4 escolas na Central. Linhares e Morada do Sol também saem da Bella, se ainda estiverem ligadas a ela.

## Tela de Usuários (equipe)
- Para administradoras, sai o campo "Empresa principal". Cada empresa vira um item da carteira, e todas podem ser removidas do mesmo jeito.
- As principais que já existem para a equipe passam a valer como empresas comuns da carteira. Ninguém perde acesso.
- **Clientes não mudam:** eles continuam com uma empresa principal, que é a que abre ao entrar.

## Detalhes técnicos
- Dados: para todos os admins, copiar `profiles.school_id` para `user_schools` (sem duplicar) e depois zerar `profiles.school_id`. A Bella fica sem SJP. Em seguida, `sync_school_management_responsible` nas escolas afetadas, para a Rayssa ficar responsável.
- `UsersConfig.tsx`: esconder o campo "principal" para role admin, tanto na criação quanto na lista. Na lista, mostrar só as empresas da carteira, com botão de remover em todas.
- `create-admin-user`: para admin, gravar a empresa escolhida em `user_schools`, não em `profiles.school_id`.
- As regras de acesso (`user_has_school_access` e a responsável automática) já leem `user_schools`, então nada muda nos cálculos.
