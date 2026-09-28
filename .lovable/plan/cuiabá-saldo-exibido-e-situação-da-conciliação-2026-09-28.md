# Cuiabá: saldo exibido e situação da conciliação

## Resultado esperado
- No Dashboard de Cuiabá Goiabeiras, o saldo **realizado até 28/09** deve mostrar **R$ 16.790,46**, como o saldo bancário conferido no Fluxo Diário, sem apresentar o fechamento previsto de setembro como se já tivesse acontecido.
- A previsão até o fim do mês continua disponível, mas identificada separadamente. A diferença de **R$ 9,71** entre o saldo bancário e os movimentos registrados continua explicitamente **“a confirmar no próximo extrato”**, sem lançar rendimento fictício nem alterar a conciliação.
- Na Central, empresa sem extrato não aparece como “Conciliação em andamento”. Com extrato e pendências, mas sem conciliação iniciada no dia, aparece claramente como “Aguardando início”; “Em andamento” só indica conciliação efetivamente iniciada.

## Como fazer
1. Ajustar a apresentação do saldo principal no Dashboard para usar o saldo realizado bancário conferido na data do último extrato, pela fonte canônica do Fluxo Bancário, e manter o saldo projetado calculado pelo motor financeiro em campo próprio. Fazer o Fluxo Diário e o Dashboard distinguirem as mesmas datas e rótulos; não criar cálculo financeiro paralelo nas telas.
2. Deixar visível o detalhamento da diferença: saldo bancário de R$ 16.790,46 em 28/09; cinco pagamentos **futuros de 30/09** somando R$ 1.466,53; e R$ 9,71 ainda a confirmar. Conferir que a diferença total de R$ 1.476,24 se explica por essas duas parcelas, sem mudar lançamentos ou valores salvos.
3. Refinar os cartões e a situação de conciliação na Central para estados mutuamente claros: **Extrato não enviado**, **Aguardando início**, **Em andamento** e **Concluída**. Manter a bolinha vermelha para extrato não enviado/atrasos anteriores, e aplicar os mesmos critérios nos filtros dos cartões e na lista de empresas, inclusive na visão de dia anterior.
4. Testar Cuiabá nas duas telas com setembro selecionado e verificar os estados da Central no computador e no celular, inclusive extrato sem movimentação e empresa sem Fluxo Bancário.

## Detalhes técnicos
- Conferido: a fonte bancária de Cuiabá está ativa desde setembro; os saldos informados em 28/09 são R$ 7.446,64 (BB), R$ 9.343,82 (Sicredi) e R$ 0,00 (Stone). O saldo inicial é R$ 75.167,22 e os movimentos sincronizados somam **−R$ 59.853,00**, incluindo cinco itens bancários marcados como previsão em 30/09 (**−R$ 1.466,53**). Só os movimentos confirmados somam **−R$ 58.386,47**, dando R$ 16.780,75; os R$ 9,71 restantes são a diferença bancária ainda pendente. O Dashboard hoje mostra o saldo calculado de fim de mês, R$ 15.314,22, no cartão principal.
- Preservar `periodMovement`, `projectionEngine`, `ledgerEngine`, `classificationUtils` e `tipoMeta` como fonte das regras de classificação e projeção; caso seja necessário disponibilizar um saldo bancário conferido por data, expô-lo por uma função/hook compartilhado, não por uma soma local em cada tela.
- A Central já recebe `statement_received`, `recon_required`, `recon_pending` e `reconciled_today`; hoje o cartão “Conciliação em andamento” exige somente pendência, e por isso também abrange empresas que não começaram. Não mudar a situação das etapas de fechamento.
