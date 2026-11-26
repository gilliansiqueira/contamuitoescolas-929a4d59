# Corrigir: escolas da Bia no acesso da Thauane

## O que estava errado
- Eu estava incluindo no acesso da própria Thauane (thau@contamuito.com), mas só ajustei a tela.
- O servidor, que monta a lista da Central, só devolve para ela as escolas em que **ela** é responsável. Sinop, Rio Verde e Londrina Dom Bosco têm a Bia como responsável, então nem chegam na tela, e a mudança anterior não tinha efeito.
- O mesmo filtro está nas listas do fechamento do dia e das pendências.

## O que muda
- Nessas três listas, o servidor passa a devolver também as escolas das colegas que a pessoa supervisiona (Thauane recebe as da Bia).
- Nenhuma outra pessoa muda, e ninguém passa a ver números de carteiras que não supervisiona.
- Depois, confiro nos dados, simulando o acesso da Thauane, que as três escolas aparecem.

## Detalhes técnicos
- Migração: em `get_management_portfolio`, `get_management_daily_status` e `get_management_reconciliation_backlog`, acrescentar `OR sms.responsible_user_id IN (SELECT member_id FROM team_supervision WHERE supervisor_id = auth.uid())` à condição de visibilidade (mantendo `can_see_school`).
- A tela já trata supervisionadas em "Minha carteira" (mudança anterior).
