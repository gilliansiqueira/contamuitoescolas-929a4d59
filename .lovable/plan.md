# Resolver a lentidão (aumentar o servidor) e publicar a área nova

## Resumo

O suporte da Lovable confirmou: o servidor de dados está no tamanho **Tiny** (o menor) e sofre sobrecarga contínua de processamento — por isso as quedas e lentidão, e por isso reiniciar não resolve. Verifiquei o passo 1 que eles sugeriram: **não há nenhuma tarefa agendada** rodando no projeto (o agendador nem está instalado), então a causa não são tarefas em segundo plano. Resta o passo 2: **aumentar o tamanho da instância**.

## Passos

1. **Aumentar o tamanho da instância do Lovable Cloud.** Você escolhe o tamanho numa telinha de confirmação que mostra CPU, memória e o custo mensal estimado de cada opção. A troca leva alguns minutos, com uma breve interrupção, e pode ser desfeita depois (voltar ao tamanho menor). Uma instância maior aumenta o custo de uso do Cloud — o valor exato aparece na telinha antes de você aprovar.
2. **Conferir a saúde do servidor depois da troca** (memória, conexões, velocidade de resposta) e confirmar que a lentidão parou.
3. **Republicar o site**: a publicação da área "Ponto da Equipe" foi interrompida quando sua mensagem chegou. Refaço a publicação e confiro no ar.
4. **Entregar a lista final do que pedir à Employer/ePays** para conectar a API do ponto.

## O que NÃO muda

- Nenhum dado, tabela, relatório ou tela é alterado — só a capacidade do servidor.
- A sincronização automática do ponto continua desligada até confirmarmos os limites da API.
- Nada muda para os clientes além de o sistema parar de travar.

## Detalhes técnicos

- Verificado agora: `cron.job` não existe (sem pg_cron, sem Jobs); saúde do banco: memória 48%, 16/60 conexões, disco 6%, 0 reinícios desde o boot; backend respondendo normalmente neste momento.
- 21.056 transações revertidas desde o boot (acumulado) — consistente com consultas pesadas falhando sob carga na instância Tiny.
- As telas Dashboard e Realizado carregam todos os lançamentos de uma empresa de uma vez; com vários usuários ao mesmo tempo, isso satura o tamanho menor. O redimensionamento ataca a causa; otimizar essas consultas pode vir depois, se necessário.
