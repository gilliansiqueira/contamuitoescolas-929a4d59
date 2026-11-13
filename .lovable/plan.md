# Aviso só para Isabelly e Gisele: contas a pagar de Vitória, São Braz e Lauro de Freitas

## Como fica
Hoje os avisos do topo da tela ("Atenção equipe!") aparecem para toda a equipe. Vou permitir que um aviso apareça **só para pessoas escolhidas**. Depois crio este aviso, que Isabelly e Gisele verão ao entrar:

> **Cobrir as contas a pagar da Gabrieli**
> Vejam as contas a pagar de Vitória, São Braz e Lauro de Freitas. Lauro tem contas para pagar hoje (13/11).

- O aviso aparece até elas clicarem em "Entendi". Você pode desligá-lo quando quiser na mesma tela onde edita os avisos.
- Na edição de avisos, cada aviso ganha a escolha **"Para quem"**: toda a equipe, que é o padrão e mantém os avisos atuais como estão, ou pessoas específicas.
- Esta mudança não passa as empresas para a carteira delas. Se você quiser que Vitória, São Braz e Lauro fiquem como responsabilidade delas na Central, me diga e eu troco a responsável.

## Detalhes técnicos
- Na migração, adicionar a coluna `team_announcements.destinatarios uuid[]`, em que nulo significa todos. Ajustar a política de leitura para que só os destinatários e quem gerencia vejam o aviso.
- `TeamDeadlineNotice.tsx`: filtrar avisos por destinatário, adicionar a escolha de pessoas na edição e mostrar o texto sem datas quando o aviso não tiver prazos.
- Inserir o aviso com os ids de Isabelly e Gisele, buscados em `profiles`, e o prazo "Contas a pagar Lauro" em 13/11/2026.
