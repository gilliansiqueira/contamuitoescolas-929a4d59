# Rondonópolis – conferir saldo do BB

## O que encontrei
- Os lançamentos de outubro no sistema batem linha a linha com o extrato (OFX de 28/10). Nada duplicado nem faltando.
- O próprio extrato mostra **−R$ 85.985,32 em conta** em 28/10: a "Aplicação CDB" de R$ 100.000,00 saiu antes do resgate automático, que o banco faz no fim do dia.
- O saldo verdadeiro do banco é **R$ 398.526,81** (linha "Saldo" do extrato) = R$ 484.512,13 de "Invest. Resgate Autom." − R$ 85.985,32 em conta.
- O sistema só mostra o negativo porque a conta BB de Rondonópolis **não está marcada como "tem aplicação automática"** e nunca recebeu o saldo aplicado. Por isso o total aparece −R$ 84.883,95 e a conferência acusa diferença.
- O CDB de R$ 100.000,00 aparece no extrato como "BB CDB DI BLOQUEADO", fora do valor de resgate automático.

## O que vou fazer
1. Marcar a conta BB de Rondonópolis como "tem aplicação automática" (BB Rende Fácil + CDB DI).
2. Gravar o saldo do extrato de 28/10: em conta −R$ 85.985,32 e aplicado R$ 484.512,13, total R$ 398.526,81. Registrar no histórico da empresa.
3. Conferir de onde vem a diferença de −R$ 229.761,11 mostrada na conferência e confirmar que ela some com o passo 2. Se sobrar alguma diferença, localizar as linhas exatas que a causam (por exemplo o saldo inicial de 31/08, de R$ 81.041,80).
4. Abrir a tela do Fluxo Bancário de Rondonópolis e confirmar o total.

## Ponto para você decidir
- O CDB bloqueado de R$ 100.000,00 entra no "Aplicado"? Por padrão vou deixar **fora**, igual ao "Saldo" do banco (R$ 398.526,81). Se quiser incluir, o aplicado fica R$ 584.512,13.

## Detalhes técnicos
- Conta `61e0106e-…` (`bank_accounts.has_auto_invest=false`, sem linhas em `bank_account_balances`). Atualizar `has_auto_invest` e inserir âncora em `bank_account_balances` (28/10, saldo_conta −85985,32, saldo_aplicado 484512,13, origem manual).
- Lançamentos de "BB Rende Fácil"/"Aplicação CDB" já estão como `auto_aplicacao` (só Caixa), sem mudança de classificação.
- Sem alteração de código.
