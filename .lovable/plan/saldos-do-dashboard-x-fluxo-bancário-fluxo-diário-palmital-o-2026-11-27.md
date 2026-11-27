# Saldos do Dashboard x Fluxo Bancário/Fluxo Diário (Palmital, Obras, Rondonópolis)

A causa ainda não está confirmada. O primeiro passo é medir a diferença real em cada empresa antes de mudar qualquer coisa.

## 1. Diagnóstico (por empresa)
- Ler, para a data de hoje e o fim de novembro: saldo do Dashboard, saldo conferido do Fluxo Bancário (soma das âncoras das contas ativas) e saldo do Fluxo Diário.
- Calcular a diferença exata e localizar as linhas que a explicam, verificando:
  - extratos enviados com o dia ainda aberto (como no caso anterior de Palmital, Bradesco/BB);
  - lançamentos que sobraram de arquivos antigos e não existem no extrato novo;
  - contas inativas ou sem âncora na mesma data;
  - previsões futuras do extrato substituindo itens que não deveriam (efeito da correção recente de Cuiabá, que ainda não está publicada);
  - previsões duplicadas ou recebimentos classificados de forma errada.
- Abrir as telas com um usuário de teste para confirmar os números exibidos.

## 2. Correção
- Problema de dados (linha sobrando, extrato incompleto): corrigir só as linhas identificadas e pedir o extrato que estiver faltando.
- Problema de regra (cálculo diferente entre telas): corrigir no módulo central de cálculo, para que as três telas usem a mesma fonte, e adicionar um teste com os valores reais.

## 3. Conferência
- Reabrir Dashboard, Fluxo Bancário e Fluxo Diário das três empresas e confirmar que os saldos batem.
- Informar, por empresa, a causa, quais linhas a provocaram e o que ainda depende de extrato.

## Detalhes técnicos
- Fontes: `ledgerEngine`/`periodMovement` (motor mensal), `DailyFlowTable`, as âncoras em `bank_account_balances` e `bank_transactions`.
- Nenhuma regra nova fora da fonte única de cálculos; nenhuma linha é apagada sem que a origem esteja identificada.
