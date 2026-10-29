# Avisos ao entrar, controles da equipe e atendimento

Vamos fazer em 3 etapas, nesta ordem. Cada uma pode ser publicada separadamente.

## Etapa 1 — Avisos ao entrar (janela + sininho)
- **Janela no primeiro acesso do dia**, igual ao aviso de prazos. Ela mostra o **Resumo do Meu Dia** da pessoa:
  - empresas da carteira dela com conciliação de ontem em aberto;
  - **pendências antigas**: conciliação parada há mais de 5 dias, com o nome da empresa e há quantos dias está assim;
  - relatórios do mês atrasados ou a 2 dias do prazo.
  - Cada item tem um botão que abre a empresa. O botão "Ver meu dia completo" leva ao Meu Dia.
- **Sininho no topo, com contador**, em todas as telas da equipe. Depois de fechar a janela, os mesmos avisos continuam disponíveis ali. O número some quando não há pendências.
- Esses avisos aparecem só para a equipe, nunca para o cliente.

## Etapa 2 — Placar da equipe e alerta para as gestoras
- **Placar da equipe** na Central, com uma linha por pessoa: empresas em dia, empresas atrasadas, pendências antigas, relatórios entregues no mês e o que foi feito hoje (conciliações e envios de extrato).
  - Super admin vê todas as pessoas.
  - Gestoras veem as pessoas que supervisionam: Isa vê Geovanna, Ana vê Hannah.
  - Cada pessoa vê a própria linha.
- **Alerta para as gestoras:** na janela e no sininho da gestora aparece "Geovanna está sem atividade hoje até as 14h" ou "Hannah acumula 3 empresas atrasadas". O horário e os limites ficam como sugestões iniciais (sem atividade até 14h, 3 ou mais atrasos) e podem ser ajustados.

## Etapa 3 — Atendimento
- **Registro de pedidos do cliente** em cada empresa e numa lista geral na Central. Cada pedido guarda:
  - o que o cliente pediu, quem atende e o prazo;
  - a situação: Aberto, Aguardando cliente ou Resolvido;
  - observações.
  - Pedidos vencidos também entram no sininho de quem atende.
- **Ficha da empresa** com contatos (nome, telefone, e-mail, função), bancos e contas, sistemas usados (Sponte, Omni, Nibo etc.), dia combinado de envio do extrato e observações livres. Abre por um botão "Ficha" no cartão da empresa.
- Só a equipe vê e edita. O cliente não tem acesso.

## Detalhes técnicos
- Etapa 1: o componente `TeamAlerts` reaproveita os dados que a Central já carrega (`useManagementDailyStatus`, `useManagementBacklog`, `useManagementPortfolio`, a regra de prazo `report_due_date`). Para guardar quem já viu a janela no dia, usa a tabela `team_alert_dismissals (user_id, dia)`, nunca localStorage. O sininho fica no cabeçalho de `Index.tsx`, junto com o `TeamDeadlineNotice`.
- Etapa 2: a RPC `get_team_scoreboard(_day)` é security definer e agrega por responsável de carteira, respeitando `team_supervision`, `can_see_school` e as empresas restritas. Não usa nenhum cálculo financeiro.
- Etapa 3: tabelas novas `client_requests` e `school_profile` (contatos em jsonb), ambas com `school_id`. A RLS libera `is_admin()` e a política RESTRICTIVE `can_see_school`, com GRANT adequado.
- Testes para as regras: pendência antiga a partir de 5 dias, alerta a partir de 3 atrasos, pedido vencido aparecendo no sininho.
