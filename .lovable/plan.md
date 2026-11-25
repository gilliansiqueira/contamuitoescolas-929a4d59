# Thauane como responsável pela Bia

## O que já existe
A plataforma já tem a opção "Supervisão" (Configurações → Usuários): quem supervisiona uma colega passa a ver a carteira dela somada à própria, recebe os avisos de atraso dela na Central e vê o placar dela.

Hoje a carteira da Bia tem 4 empresas: Sinop, Rio Verde, Londrina Dom Bosco e **Ather Engenharia**. A Thauane ainda não supervisiona ninguém.

## O que vou fazer
1. Marcar a Thauane como supervisora da Bia (só esse vínculo; nenhum outro acesso, papel ou permissão muda).
2. Com isso a Thauane passa a ver, na carteira dela: Sinop, Rio Verde e Londrina Dom Bosco, com os avisos de extrato, conciliação e relatório atrasados da Bia, e o andamento dela no placar da equipe.
3. Conferir nos dados que o vínculo foi gravado e que as três empresas aparecem para ela.

## Ponto de atenção: Ather
A supervisão traz a carteira inteira da Bia, então a **Ather também apareceria** para a Thauane. Se ela não deve ver a Ather, digo isso ao aprovar e eu limito a supervisão às três escolas (pequeno ajuste para a supervisão ignorar empresas específicas).

## Detalhes técnicos
- Inserir em `team_supervision` (supervisor = Thauane 9abbf168…, membro = Bia f7ee955c…).
- Sem migração, sem mudança de código, sem efeito financeiro. Vale na hora (ela precisa sair e entrar de novo para atualizar a carteira).
