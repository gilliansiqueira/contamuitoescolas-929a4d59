# Cuiabá Goiabeiras: o que a tela mostra agora e o que falta

## Conferido na tela (Fluxo Bancário → Resumo → Saldo por conta)
- **Stone:** R$ 2.696,00, "confere" com o banco.
- **Banco do Brasil:** total **R$ 952,46**, igual ao banco, porque usa o saldo do extrato. Mas aparece "a confirmar no próximo extrato: diferença de −R$ 19.560,27". Isso quer dizer que o saldo de 31/08 somado aos lançamentos não chega nos R$ 952,46.
- **Sicredi:** total R$ 6.019,27 contra R$ 6.028,51 no banco. Faltam R$ 9,24, que devem ser rendimento. O total está quase certo, mas a divisão está errada: R$ 19.465,67 em conta e −R$ 13.446,40 aplicado.
- **Consolidado:** R$ 9.667,73 contra R$ 9.676,97 na planilha. A diferença é só esses R$ 9,24 do Sicredi.

## O que vou fazer
1. **Sicredi:** corrigir o saldo de 31/08. Hoje está R$ 19.565,67 em conta e R$ 0,00 aplicado. Vai ficar **R$ 100,00 em conta e R$ 19.465,67 aplicado**, que fecha com o extrato zerado em conta. O total de 31/08 continua o mesmo, e nenhum lançamento muda. Com isso, a coluna "Aplicado" deixa de aparecer negativa.
2. **Sicredi:** pedir para importarem o extrato até 25/09 (o arquivo que você me mandou). Assim a conferência com o banco passa a aparecer, e os R$ 9,24 de rendimento vão para "A confirmar".
3. **Banco do Brasil:** a diferença de R$ 19.560,27 continua visível em "a confirmar", sem travar nada. Para achar a causa, preciso do **saldo do BB em 31/08 (em conta e aplicado)** ou do PDF de setembro. O aplicado de 31/08 hoje está em R$ 75.161,82; pela conta, deveria estar em uns R$ 55.601,55.

## Detalhes técnicos
- run_sql em bank_accounts 1eed550f: `saldo_inicial=100`, `auto_invest_saldo_inicial=19465.67`. Total de 31/08 inalterado, R$ 19.565,67.
- BB (b00b3174): sem alteração até o saldo de 31/08 ser confirmado.
