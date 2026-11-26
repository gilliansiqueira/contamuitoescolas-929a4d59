# Escolas da Bia na "Minha carteira" da Thauane

## O que acontece hoje
- O vínculo foi salvo: a Thauane é supervisora da Bia e tem acesso a Sinop, Rio Verde e Londrina Dom Bosco.
- Mas a Central abre no filtro **"Minha carteira"**, que mostra só as escolas em que **a própria pessoa** é a responsável. As três escolas têm a Bia como responsável, então ficam escondidas.
- O seletor de carteiras nem aparece para ela, porque só surge para quem é responsável por alguma escola. Por isso ela não consegue trocar.

## O que muda
- Para quem supervisiona alguém, "Minha carteira" passa a incluir também as escolas das pessoas supervisionadas (Thauane: as suas + as da Bia).
- O seletor de carteiras passa a aparecer também para supervisoras.
- O nome da responsável continua aparecendo em cada escola, para ela saber que é da Bia.
- Os avisos de atraso e as prioridades do dia seguem o mesmo conjunto.
- Ninguém ganha acesso novo; outras pessoas não mudam.

## Detalhes técnicos
- `useAuth`: expor `supervised_member_ids` (já lidos de `team_supervision`).
- `ManagementCenter.tsx`: filtro `mine` aceita `responsible_user_id` igual ao usuário ou a um supervisionado; `showOwnerFilter` considera também supervisionadas; mesma regra em `priorities`/myDay e no `mineIdSet` de `TeamAlerts`.
- Teste pequeno da regra "minha carteira inclui supervisionadas".
