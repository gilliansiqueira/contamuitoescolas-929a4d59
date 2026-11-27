# Acertar o Bradesco de Palmital com o extrato enviado

## O que o extrato mostra
O extrato do Bradesco vai de 09/09 a 26/11, com saldo de R$ 3.669,53, e tem 294 lançamentos. Comparei linha por linha com a plataforma. Só quatro lançamentos aparecem duas vezes na plataforma e uma vez no banco:

| Data | Lançamento | Valor | Linha a mais na plataforma |
|---|---|---|---|
| 25/09 | Rentabilidade investimento | +R$ 0,42 | 1 cópia |
| 25/09 | Rentabilidade investimento | +R$ 0,01 | 1 cópia |
| 27/10 | Depósito em dinheiro (aparece como "DEPOSITO C/C BDN" e "DEP DINHEIRO ATM") | +R$ 1.600,00 | 1 cópia |
| 25/11 | Anuidade do cartão (aparece como "PROVISAO GASTO CART CRED" e "CARTAO CREDITO ANUIDADE") | −R$ 38,66 | 1 cópia |

Somadas, essas cópias explicam R$ 1.561,77 da diferença de R$ 1.561,74. Os R$ 0,03 restantes ficam de antes de 09/09, período que o arquivo não cobre.

## Passos
1. Apagar só as quatro cópias. Fica a linha que tem o mesmo texto do extrato: a do depósito "DEP DINHEIRO ATM", a da anuidade "CARTAO CREDITO ANUIDADE" e uma de cada rentabilidade. As cópias que estavam conciliadas saem junto, e as previsões ligadas a elas voltam a ficar pendentes.
2. Corrigir a importação para que o Bradesco não grave de novo o mesmo lançamento quando o banco troca o texto entre um download e outro, como de "DEPOSITO C/C BDN" para "DEP DINHEIRO ATM" ou de "PROVISAO" para o lançamento definitivo. Incluir um teste.
3. Conferir que o Bradesco fecha em R$ 3.669,53, perto de R$ 0,03, e que o Fluxo Diário e o Fluxo Bancário de Palmital ficam iguais.
