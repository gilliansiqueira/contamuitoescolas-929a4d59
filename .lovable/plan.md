# Fluxo de Caixa em todas as empresas — sem deixar o sistema lento

## Situação atual
- O Fluxo de Caixa segue ativo **somente nas três escolas piloto** (Dourados, Uberlândia Centro, Uberlândia Santa Mônica). Nenhuma outra empresa foi incluída ainda.
- Da melhoria de velocidade, já foi feito: atalhos no banco de dados e carregamento em partes (cada parte da tela busca seus dados separadamente, mostrando o que chega primeiro).

## O que falta — Fase 1 (velocidade)
1. **Carregar primeiro o ano atual:** ao abrir o Dashboard, buscar primeiro os meses recentes e o ano anterior em segundo plano. A tela abre rápido e completa os números antigos sem travar.
2. **Manter dados em memória:** ao trocar de aba (Dashboard → Fluxo Diário → voltar), não buscar tudo de novo.
3. **Buscar só o que cada tela precisa:** cada aba pede apenas as colunas e o período que usa, em vez de carregar tudo sempre.

## O que falta — Fase 2 (fluxo de caixa para todas)
4. Criar a configuração de fonte para **todas as empresas** com status **"Rascunho"** — nada muda para ninguém nesse momento.
5. Para cada empresa, definir a competência inicial e gerar a conferência (totais do banco x planilha), como foi feito nas pilotos.
6. Ativar em **grupos de ~10 empresas**, somente após a conferência de cada uma fechar e vocês aprovarem na tela. Cada ativação é reversível (botão Pausar volta para a planilha).
7. Antes de cada ativação: checar se a empresa tem contas bancárias cadastradas, saldo de referência e extratos importados — sem isso, a empresa fica como "Rascunho" até estar pronta.

## Garantias
- Mesmas regras das pilotos: histórico congelado, troca de fonte reversível, nada anterior à competência inicial é alterado, Análise de Despesas continua com upload separado.
- Números do Dashboard e do Fluxo Diário não mudam com a Fase 1 — só a velocidade.
- Nenhuma empresa é ativada automaticamente; sempre passa pela conferência e pela aprovação de vocês.

## Validação
- Conferir que Dourados e Portão mostram os mesmos valores de antes após a Fase 1.
- Testar troca de abas e de empresa medindo o tempo de carregamento.
- Para cada grupo ativado: conferência fechando, ativação, teste de reversão em uma empresa do grupo.
