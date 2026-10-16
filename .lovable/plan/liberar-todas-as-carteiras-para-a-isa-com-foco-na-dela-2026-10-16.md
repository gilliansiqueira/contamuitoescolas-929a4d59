# Liberar todas as carteiras para a Isa (com foco na dela)

## O que muda para a Isa
- Ela passa a supervisionar todas as meninas da equipe (hoje supervisiona só a Geovanna).
- Pode consultar e entrar em qualquer empresa dessas carteiras e trabalhar nelas, como já faz com a Geovanna.
- Na Central, a carteira **dela** continua aparecendo primeiro e selecionada por padrão ("Minha carteira").
- As demais aparecem num filtro "Carteira de" (por responsável), para ela abrir só quando precisar.
- Ela não ganha poder de super admin: não altera acessos da equipe, não exclui empresas e não vê empresas restritas.

## Quem entra
Todas as contas da equipe com carteira: Acy, Ana Carolina, Bella, Bruno, contamuito03, Geise, Geovanna (já está), Hannah, Ingrid, Isis, Kerolai, Manu, Rayssa, Rubia, Tamy, Thau.
Ficam de fora: contas administrativas sem carteira (adm, Gisele, Nanci).

## Detalhes técnicos
- Inserir linhas em `team_supervision` (supervisor = Isabelly, member = cada admin acima), via migração idempotente (`on conflict do nothing`).
- Acesso já é resolvido por `user_has_school_access` / `admin_manages_school` somando carteiras supervisionadas; nada muda na regra.
- Central: garantir filtro padrão = carteira própria do usuário e seletor por responsável quando houver supervisionadas (ajuste só de tela, se ainda não existir).
- Conferir com consulta que a Isa enxerga as empresas das carteiras e que empresas restritas continuam ocultas.
