# Remover o acesso da Rubia e da Isis

## Se entraram desde ontem à tarde (26/10, 15h)
- **Rubia (rubia@contamuito.com):** não entrou. O último acesso foi em 16/10. Hoje, às 14h50, alguém pediu "esqueci a senha" para o e-mail dela, na rede do escritório (o mesmo endereço de internet das outras meninas). Ninguém entrou depois disso.
- **Isis (isis@gmail.com):** não entrou. O último acesso foi em 17/09.
- **Isis, segunda conta (isiscontamuito@gmail.com):** não entrou. O último acesso foi em 30/06. Essa conta não tem nenhuma empresa ligada.

## O que vou fazer
1. Bloquear o login das 3 contas. Quem estiver com o sistema aberto é desconectado na hora, e o link de "esqueci a senha" pedido hoje deixa de funcionar.
2. Tirar delas o papel de equipe e as empresas ligadas (4 empresas para a Rubia e 4 para a Isis).
3. Tirar as duas das supervisões, para que nenhuma supervisora continue com a carteira delas.
4. Mostrar quais empresas tinham a Rubia ou a Isis como responsável na Central. Essas empresas precisam de nova responsável. Você me diz para quem passar.
5. Manter tudo o que elas fizeram: histórico, conciliações e registros de quem alterou o quê.

## Detalhes técnicos
- Bloqueio por `banned_until` no auth, sem apagar o usuário, para não perder o histórico de auditoria.
- Apagar `user_roles`, `user_schools` e `team_supervision` (tanto onde elas supervisionam quanto onde são supervisionadas). Registrar a mudança em `user_access_changes`.
- Listar `school_management_settings.responsible_user_id` que apontam para os 3 IDs.
