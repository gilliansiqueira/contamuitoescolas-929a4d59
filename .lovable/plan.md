# Ler o extrato PDF do Nubank (WNC)

**Causa:** o sistema não tem leitura para o PDF do Nubank. Por isso aparece "Nenhum lançamento reconhecido". O arquivo tem texto normal e dá para ler sem erro.

## O que muda
- O sistema passa a reconhecer o PDF do Nubank PJ ("Movimentações", dias como "29 SET 2026", blocos "Total de entradas" e "Total de saídas", "Saldo do dia").
- Cada linha vira um lançamento com data, sentido e valor. O sentido vem do bloco onde a linha está: entradas entram como entrada e saídas como saída, nunca pelo sinal.
- A descrição junta o tipo e o nome, por exemplo "Transferência enviada pelo Pix - Patricia Silva de Souza", sem CPF nem dados de agência.
- **Rendimento:** o Nubank soma o rendimento diário no "Saldo do dia" sem listar como linha. Essa diferença vira um lançamento "Rendimento líquido" de entrada, que fica pendente para a equipe classificar. Neste extrato, a soma dá R$ 12,76.
- **Conferência:** o saldo final só pode dar R$ 48.724,58 + 7.602,96 + 12,76 − 5.828,34 = **R$ 50.511,96**. Se não fechar, ou se aparecer uma diferença diária grande que não pode ser rendimento, nada é importado e a tela mostra o motivo.
- O saldo final do extrato é gravado como saldo da conta Nubank.

## Teste
- Teste automático com este extrato: 19 lançamentos e saldo final de R$ 50.511,96.
- Também confiro que o OFX do Nubank continua funcionando como hoje.

## Detalhes técnicos
- `src/lib/bankStatements/parsers.ts`: `isNubankPjPdf` / `parseNubankPjPdfLines` no despacho de PDF (ao lado do BB), com fixture `src/test/fixtures/nubankWnc.json` e `src/test/bankNubankPdf.test.ts`.
- Rendimento só é criado se a diferença diária for positiva e menor que 0,1% do saldo. Depois, a soma tem que bater com o "Rendimento líquido" do resumo.
