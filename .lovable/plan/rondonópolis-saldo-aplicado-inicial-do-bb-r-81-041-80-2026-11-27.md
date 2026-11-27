# Rondonópolis – saldo aplicado inicial do BB (R$ 81.041,80)

## Objetivo
Registrar que em 31/08/2026 os R$ 81.041,80 do BB de Rondonópolis estavam aplicados, para o Fluxo Bancário e o Dashboard mostrarem o mesmo saldo.

## Passos
1. Conferir os dados atuais da conta BB de Rondonópolis: saldo inicial gravado em 31/08, saldo aplicado e se existem resgates/aplicações posteriores no extrato.
2. Gravar o saldo de 31/08 dividido em conta corrente R$ 0,00 e aplicado R$ 81.041,80, sem apagar nenhum lançamento.
3. Se o extrato tiver resgates dessa aplicação depois de 31/08, confirmar que eles reduzem o aplicado (regra já corrigida no motor do fluxo bancário).
4. Conferir na tela, com usuário de teste, Dashboard x Fluxo Bancário de Rondonópolis e informar a diferença restante (esperado: cerca de zero).

## Detalhes técnicos
- Alteração só de dados da âncora da conta BB (saldo inicial/aplicado), via atualização pontual; nenhuma mudança de regra ou código.
- Nenhum cálculo fora da fonte única (projectionEngine/ledgerEngine).
