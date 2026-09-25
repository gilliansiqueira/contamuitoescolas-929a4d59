# Cuiabá Goiabeiras: o que os PDFs mostram

## Banco do Brasil: causa da diferença de R$ 19.560,27 encontrada
Pelo PDF do BB de 25/09:
- Em conta: −R$ 48.824,96, coberto pela aplicação.
- Aplicado (Invest. Resgate Autom.): **R$ 49.777,42**.
- Total: **R$ 952,46**.

Todas as movimentações do BB Rende Fácil no PDF estão no sistema: R$ 63.409,73 aplicados e R$ 69.233,86 resgatados. Para fechar em R$ 49.777,42, o aplicado de 31/08 tem que ser **R$ 55.601,55**. No cadastro está **R$ 75.161,82**, exatamente R$ 19.560,27 a mais. O saldo em conta de 31/08 (R$ 0,00) está certo, porque o PDF mostra "Saldo Anterior 0,00".

## Sicredi: está certo, mas falta subir o extrato de 25/09
- O PDF confirma o saldo anterior de R$ 100,00 em conta, como corrigi.
- Em 25/09 o Sicredi tem **R$ 2.696,00 em conta**: um PIX recebido da INFLUX ENGLISH, que entrou só nesse dia. Tem ainda **R$ 6.028,51 aplicado**. O total é **R$ 8.724,51**.
- A planilha de vocês mostra só os R$ 6.028,51 do Sicredi, então deixou de fora os R$ 2.696,00 em conta. Coincidentemente, a Stone também tem R$ 2.696,00. Vale conferir se a planilha não trocou uma coisa pela outra.
- O extrato do sistema vai só até 24/09. É preciso subir o OFX do Sicredi até 25/09 (o arquivo "extrato_1.ofx" que você me mandou).

## O que vou fazer
1. BB: corrigir o aplicado de 31/08 de R$ 75.161,82 para **R$ 55.601,55**. Nenhum lançamento muda. A diferença de R$ 19.560,27 some.
2. Conferir na tela que o BB fica sem diferença.
3. Sicredi: nada a mudar no cadastro. Depois que o OFX de 25/09 for importado, o total esperado é R$ 8.724,51. A diferença que sobrar deve ser só uns R$ 9 de rendimento do mês, em "A confirmar", sem travar nada.

## Detalhes técnicos
- run_sql: `UPDATE bank_accounts SET auto_invest_saldo_inicial=55601.55 WHERE id='b00b3174-4841-47ff-8d79-05b2a76423e1'`.
- Conferência via Playwright no Resumo de Cuiabá Goiabeiras.
