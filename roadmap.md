# Roadmap

## Aberto
- [ ] Credencial da API PontoFopag (PONTOFOPAG_API_TOKEN) — pendente da Employer/ePays
- [ ] Confirmar formato das respostas da API PontoFopag e limites de consulta antes de ligar a sincronização automática
- [ ] Acompanhar o custo do servidor (créditos de "Cloud compute") nos próximos dias para ver se continua dentro dos 20 créditos grátis do mês
- [ ] Migração do projeto para o espaço "Bruna's Lovable" — adiada: exportar os dados antes e confirmar com o suporte se o banco vai junto
- [ ] Rodar uma nova varredura de segurança antes de compartilhar o site amplamente

## Feito
- [x] Área "Ponto da Equipe" criada (tabelas team_time_*, função server-side, tela, menu só para super administrador)
- [x] Servidor de dados recuperado após o incidente de indisponibilidade
- [x] Verificado: sem tarefas agendadas (pg_cron não instalado) — a lentidão vinha do tamanho da instância
- [x] Instância aumentada para "Mini" (um tamanho acima da menor) e saúde conferida: memória 40%, 14/60 conexões, disco 6%, 0 reinícios
- [x] Site oficial republicado com a área "Ponto da Equipe" (arquivo principal publicado: assets/index-cqrBBjDJ.js; a área está no bloco Index-BXmUQo3n.js)
- [x] Cartão de crédito e endereço de cobrança confirmados neste espaço de trabalho
- [x] Lista do que pedir à Employer/ePays entregue
