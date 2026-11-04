# Central de ajuda da equipe, Meu Dia por carteira e acompanhamento de uso

## O que já dá para saber hoje
- A janela "Resumo do seu dia" foi fechada nos últimos dias por todas as meninas (de 2 a 3 dias cada desde que entrou no ar, todas hoje, 04/11).
- Fechar a janela não quer dizer que leram: dá para clicar em "Entendi" direto.
- **Hoje a plataforma não registra cliques no sininho, nem quem abre o Meu Dia ou as empresas dos avisos.** Isso entra no item 3.

## 1. Central de ajuda (treinamento)
Botão "Ajuda" no topo para a equipe, com:
- **Passo a passo por assunto** (ex.: subir extrato, subir planilha do Sponte, projeção futura, conciliar, folha e benefícios, renovação, acessos e senhas). Cada guia em etapas numeradas, com "onde clicar" e erros comuns.
- **Ajuda na própria tela**: um ícone "?" em cada tela abre o guia daquela tela.
- **Trilha do novo funcionário**: lista de guias para ler na ordem, com "Concluí". A gestora vê quem concluiu o quê.
- **Perguntar à ajuda**: campo de pergunta livre. A IA responde apenas com base nos guias cadastrados e mostra de qual guia tirou a resposta. Se não souber, avisa e manda a pergunta para você.
- Só super administradoras escrevem e editam guias, com histórico de versões. Começo com 8 guias escritos a partir de como as telas funcionam hoje, para você revisar.

## 2. Meu Dia e avisos só da carteira de cada uma
- Avisos e Meu Dia sempre só das empresas de que a pessoa é responsável. Avisos da equipe inteira continuam só para gestoras.
- **Novos avisos de dinheiro** por empresa da carteira:
  - **Saldo**: extrato desatualizado (sem saldo do último dia útil) e saldo previsto negativo nos próximos 15 dias (mesmo cálculo da lista de caixa negativo).
  - **Contas a pagar**: contas vencendo hoje e amanhã com o total, e contas vencidas sem baixa.
- Meu Dia reorganizado em blocos por empresa: Saldo · Contas a pagar · Conciliação · Relatório do mês · Pedidos, com botão para abrir direto a tela certa.
- Cada aviso tem um botão "Resolvido / visto". O aviso só some quando o problema é resolvido ou marcado.

## 3. Saber se estão acompanhando
- Registrar quando cada pessoa: abre o sininho, abre o Meu Dia, clica num aviso, marca um aviso como visto, lê um guia.
- Nova aba "Acompanhamento" na Equipe, só para gestoras: por pessoa, últimos 7 dias, com dias em que abriu o Meu Dia, avisos abertos x ignorados e tempo médio até resolver.
- Os registros começam a contar após publicar. Não dá para recuperar o passado.

## Detalhes técnicos
- Tabelas `help_articles` (slug, tela, título, etapas em markdown, ordem, versão) + `help_article_versions`, `help_progress` (user_id, article_id, concluido_em); escrita só `is_super_admin()`.
- Edge Function `help-ask` (Lovable AI) recebe a pergunta e os guias relevantes; resposta restrita ao conteúdo, com citação do slug.
- `team_activity_events` (user_id, kind, school_id, ref, created_at); insert pelo próprio usuário, leitura por super_admin/supervisoras (`team_supervision`).
- Novos alertas em `src/lib/teamAlerts.ts` (funções puras + testes): `staleBalanceAlert`, `negativeCashAlert` (reusa `src/lib/cashRisk.ts`), `payablesDueAlert` usando os mesmos dados da projeção, sem recalcular regras financeiras. `team_alert_acks` (user_id, alert_key, dia).
- Filtro de carteira continua por `responsible_user_id` do portfólio.
