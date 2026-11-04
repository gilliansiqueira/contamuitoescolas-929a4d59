# Acesso do Acy igual ao da Bruna

## O que encontrei
A conta **acy@contamuito.com** está incompleta:
- Tem só o nível "super administrador". O seu acesso (adm@contamuito) tem também o nível **"administrador"**, e é ele que libera a carteira de empresas e as telas da equipe.
- **Falta o cadastro de perfil** da conta, com o escopo "todas as empresas". Sem ele, a plataforma entra sem nenhuma empresa, que é exatamente o que ele está vendo.

A conta antiga (acy@joinville.com) foi apagada, então ele não consegue mais entrar por ela.

## O que vou fazer
1. Criar o perfil da conta acy@contamuito.com com acesso a **todas as empresas**, igual ao seu.
2. Dar a ele também o nível **administrador**, ficando com administrador + super administrador, como você.
3. Registrar a mudança no histórico de alterações.
4. Conferir no banco que as duas contas ficaram iguais.

Depois, ele precisa **sair e entrar de novo** com acy@contamuito.com.

## Detalhes técnicos
- `INSERT INTO profiles (user_id, email, admin_scope) VALUES ('4d08be23-…', 'acy@contamuito.com', 'all')`.
- `INSERT INTO user_roles (user_id, role) VALUES ('4d08be23-…', 'admin') ON CONFLICT DO NOTHING`.
- Registro em `audit_log`.
