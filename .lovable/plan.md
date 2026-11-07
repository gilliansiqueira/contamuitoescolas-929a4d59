# Faixa de atrasos: quem vê o quê (conferido, sem alteração)

## Como funciona hoje
- **Colaboradoras**: a faixa vermelha e a janela de avisos contam só as empresas em que a pessoa é a responsável na carteira. Ninguém vê atrasos de outra carteira.
- **Gestoras** veem a equipe toda, separada por responsável. Hoje são 4 pessoas: Acy, adm (Bruna), Gisele e Isabelly.
- Empresas "Sem responsável" aparecem só para essas 4 gestoras.

## Proposta
Nenhuma mudança: a regra já está como você pediu. Se quiser tirar alguém da visão da equipe toda (por exemplo, Gisele ou Isabelly), me avise e ajusto.

## Detalhes técnicos
- `src/components/TeamDeadlineNotice.tsx`: `scope = portfolio.filter(p => isManager || p.responsible_user_id === user.id)`, com `isManager = canManageCollaborators`. Esse é o caso de super_admin (Acy, adm) e de `user_permissions.collaborators_manage` (Gisele, Isabelly).
- As outras 15 administradoras não têm essa permissão, então veem só a própria carteira.
