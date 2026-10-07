# Brasília – Caixa: saldo de 06/10 e botão "Aprovar e ativar"

## O que já conferi
- Não precisa Excel: o OFX e o PDF da Caixa enviados são lidos normalmente (mesmos lançamentos, 01/10 a 06/10).
- Hoje o sistema só tem lançamentos da Caixa até 02/10 — por isso mostra R$ 8.052,67 (saldo de 02/10). O extrato novo termina em 06/10 com **R$ 7.269,37** em conta, que bate com o que vocês informaram.
- Em 01/10 o sistema tem 7 lançamentos somando R$ 5.384,14, mas o extrato tem 5 somando R$ 4.774,06 — há R$ 610,08 a mais (provável repetição de lançamentos).
- O aplicado não vem no OFX/PDF, então precisa ser informado à mão (R$ 14.881,73).
- Atenção: R$ 7.269,37 + R$ 14.881,73 = **R$ 22.151,10**, não R$ 24.881,73. Vou usar a soma, a menos que me corrijam.

## Sobre o "Aprovar e ativar"
O botão trava pela diferença de R$ 1.463,07 de **setembro** (saldo final previsto R$ 110.833,48 x banco R$ 109.370,41). Os lançamentos de outubro da Caixa não mexem em setembro. Vou localizar exatamente quais contas/linhas de setembro formam esses R$ 1.463,07 (duplicadas, datas fora do mês ou saldo de 30/09 errado) e corrigir.

## Passos
1. Remover os lançamentos repetidos de 01/10 na Caixa (os R$ 610,08 sobrando), depois de confirmar linha a linha.
2. Importar o OFX de 01/10 a 06/10 (sem duplicar o que já existe).
3. Gravar o saldo de 06/10: R$ 7.269,37 em conta e R$ 14.881,73 aplicado.
4. Achar e explicar as linhas que formam a diferença de R$ 1.463,07 em setembro; corrigir para liberar o botão.
5. Mostrar o antes/depois de cada conta.
