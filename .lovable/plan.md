# Aviso de prazos para a equipe

## O que a equipe vai ver
- **Janela ao entrar:** no primeiro acesso do dia, abre uma janela laranja com o aviso e o botão "Entendi". Depois de clicar, só volta a aparecer no dia seguinte.
- **Faixa fixa no topo:** barra laranja em todas as telas enquanto o aviso estiver ativo, com a contagem regressiva.
- **Texto (tom urgente):** "🚨 Atenção equipe! Faltam X dias para entregar as projeções (30/10) e Y dias para os relatórios (06/11)." No dia do prazo aparece "é HOJE"; depois que o prazo passa, aquela parte some sozinha. Quando todos os prazos passam, o aviso inteiro sai do ar.
- O aviso aparece só para a equipe interna. Os clientes não veem.

## Quem gerencia
- Você, a Isabelly e a Gisele terão uma tela "Avisos da equipe" nas Configurações. Ali dá para criar o aviso, escrever o título, adicionar prazos (nome e data), ativar ou pausar e excluir.
- O primeiro aviso já entra cadastrado: Projeção até 30/10/2026 e Texto e relatório até 06/11/2026.

## Detalhes técnicos
- Novas tabelas `team_announcements` (título, ativo, criado_por) e `team_announcement_deadlines` (rótulo, data), com RLS: leitura para `is_admin()`, escrita para o super_admin ou quem tem `user_permissions.collaborators_manage`.
- A informação "Entendi hoje" fica em `team_announcement_dismissals` (user_id, data), sem usar localStorage.
- A contagem de dias usa a data de São Paulo.
- Componentes: `TeamDeadlineBanner` no layout principal, `TeamDeadlineDialog` e a tela de configuração. Cores laranja e destaque usando as cores do tema.
- Teste para a contagem regressiva: 29/10 → projeção em 1 dia, relatório em 8 dias; no dia → "HOJE"; depois do prazo → oculto.
