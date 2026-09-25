# Cuiabá Goiabeiras: por que os saldos não batem

Conferi as três contas, linha a linha, com os arquivos que você mandou. Todos os lançamentos entraram, sem nenhum duplicado. As diferenças vêm do **saldo inicial cadastrado em cada conta**, não dos extratos.

## 1. Stone: diferença de R$ 2.310,70 (causa confirmada)
- O saldo inicial foi cadastrado como R$ 0,00 **em 01/09**. Para o sistema, isso quer dizer "saldo no **fim** do dia 01/09". Então ele pula os lançamentos do próprio dia 01/09.
- Em 01/09 entraram duas vendas: R$ 1.577,62 + R$ 733,08 = **R$ 2.310,70**, exatamente a diferença.
- Contando o dia 01/09, a Stone fecha em **R$ 2.696,00**, igual ao banco.
- O mesmo acontece em outras **15 contas** de outras empresas, cadastradas com data 01/09 em vez de 31/08.

## 2. Sicredi: saldo inicial no lugar errado (causa provável)
- Os R$ 19.565,67 foram cadastrados como saldo **em conta**, e o aplicado como R$ 0,00. Mas o próprio extrato mostra a conta zerada, com tudo indo para a aplicação. Então esses R$ 19.565,67 eram o **aplicado**, não o saldo em conta.
- Com o valor no lugar certo, o total fica em **R$ 6.019,27**. O banco mostra **R$ 6.028,51**: sobram R$ 9,24, que devem ser rendimento. Eles aparecem em "A confirmar no próximo extrato", sem travar nada.
- O extrato que está no sistema vai até 24/09. O arquivo novo que você mandou vai até 25/09 e deve ser importado.

## 3. Banco do Brasil: diferença de R$ 19.560,27 (causa ainda não confirmada)
- Pelo extrato, o saldo em conta confere: −R$ 48.824,96, coberto pela aplicação.
- Com o aplicado cadastrado em 31/08 (R$ 75.161,82) e o dia 01/09 incluído, o total fica em R$ 20.512,73. O banco mostra R$ 952,46.
- A diferença, de R$ 19.560,27, fica muito perto do saldo do Sicredi (R$ 19.565,67). Suspeito que o aplicado inicial do BB esteja errado ou tenha sido somado com o do Sicredi. Para confirmar, preciso do **saldo do BB em 31/08 (em conta e aplicado)** ou do PDF do BB de setembro.

## O que vou fazer
1. **Tornar a data mais clara no cadastro:** o campo passa a dizer "Saldo no fechamento do dia" e já vem com o último dia do mês anterior (31/08). Assim ninguém cadastra 01/09 sem querer.
2. **Corrigir as contas cadastradas com data 01/09:** a data passa a ser 31/08, com o mesmo valor. Isso vale para as 16 contas. Nenhum lançamento é tocado. Antes de corrigir, confiro em cada conta se o valor bate com o saldo de abertura, como aconteceu na Stone.
3. **Sicredi de Goiabeiras:** mover os R$ 19.565,67 de "em conta" para "aplicado", com R$ 0,00 em conta.
4. **Banco do Brasil de Goiabeiras:** esperar o saldo de 31/08 ou o PDF antes de mexer.
5. Pedir para importarem o extrato do Sicredi até 25/09.

## Detalhes técnicos
- `bankCashflowEngine.ts:59` usa `t.data > saldo_inicial_data` (saldo = fechamento do dia). A regra fica como está: 53 contas usam 31/08 corretamente.
- Correção de dados via run_sql: `bank_accounts.saldo_inicial_data` e `auto_invest_saldo_data` de '2026-09-01' para '2026-08-31', só em contas sem lançamentos antes de 01/09 que conflitem. A conta Stone de Goiabeiras tem lançamentos antes de 01/09 (de 26/06 em diante), que continuam sendo ignorados pelo corte.
- Sicredi (1eed550f): `saldo_inicial=0`, `auto_invest_saldo_inicial=19565.67`.
- No formulário de conta: novo rótulo e data padrão igual ao último dia do mês anterior.
