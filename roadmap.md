# Roadmap

## Aberto
- [ ] Redimensionar a instância do Lovable Cloud (plano aprovado; usuário escolhe o tamanho no seletor)
- [ ] Conferir saúde do servidor após a troca de tamanho
- [ ] Republicar o site com a área "Ponto da Equipe" (publicação anterior foi interrompida)
- [ ] Entregar a lista final do que pedir à Employer/ePays
- [ ] Credencial da API PontoFopag (PONTOFOPAG_API_TOKEN) — pendente da Employer/ePays
- [ ] Confirmar formato das respostas da API PontoFopag e limites de consulta antes de ligar sync automática

## Feito
- [x] Área "Ponto da Equipe" criada (tabelas team_time_*, edge function, tela, menu só super_admin)
- [x] Servidor de dados recuperado após incidente de indisponibilidade
- [x] Verificado: sem tarefas agendadas (pg_cron não instalado) — causa da lentidão é a instância Tiny
