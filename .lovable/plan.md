# Aumentar o servidor (com custo visível antes de aprovar) e publicar

## Resumo

Você aprovou aumentar a instância do Lovable Cloud. O custo aparece **antes** de qualquer cobrança: ao executar, abre um seletor com cada tamanho, sua CPU/memória e o **custo mensal estimado em créditos** (calculado com base no seu uso recente). Você escolhe o tamanho e aprova — ou cancela, sem custo.

## Como funciona o custo

- O Cloud é cobrado em **créditos**, no mesmo saldo das mensagens.
- Todo plano tem **20 créditos grátis por mês** para o Cloud; o que passar disso é descontado do saldo de créditos do espaço de trabalho.
- Créditos extras podem ser comprados em Configurações → Planos e créditos.
- A instância pode ser reduzida de volta depois, se a carga diminuir.

## Passos

1. **Abrir o seletor de tamanho** — você vê os tamanhos com CPU, memória e custo mensal estimado, escolhe e aprova. A troca leva alguns minutos, com uma breve interrupção do sistema.
2. **Conferir a saúde do servidor** depois da troca (memória, conexões, velocidade) e confirmar que a lentidão parou.
3. **Republicar o site** com a área "Ponto da Equipe" (a publicação anterior foi interrompida) e conferir no ar.
4. **Entregar a lista final do que pedir à Employer/ePays** para conectar a API do ponto.

## O que NÃO muda

- Nenhum dado, tabela, relatório ou tela é alterado — só a capacidade do servidor.
- Seu plano Pro continua o mesmo; o que muda é apenas o consumo de créditos do Cloud.
- A sincronização automática do ponto continua desligada até confirmarmos os limites da API.

## Detalhes técnicos

- Plano verificado: Pro, assinatura ativa desde 01/05/2026 — redimensionamento disponível.
- Diagnóstico confirmado: sem tarefas agendadas (pg_cron não instalado); causa da lentidão é a instância Tiny com sobrecarga de CPU, conforme o suporte.
