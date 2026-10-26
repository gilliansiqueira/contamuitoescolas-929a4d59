# Go Company: diferença no saldo do Sicoob

## O que conferi (linha a linha com o PDF de 26/10)
Todos os lançamentos de 01/10 a 23/10 do sistema batem com o extrato. Em 23/10 o banco também fecha em -R$ 1.371,50. A diferença vem de duas coisas, e nenhuma é lançamento errado:

1. **Em conta: falta o dia 26/10.** O último extrato importado vai só até 23/10. Em 26/10 entrou um PIX de R$ 2.000,00 (Gabriela Bittencourt Correa). Com ele, o saldo fica em **R$ 628,50**, igual ao banco.
2. **Aplicado: o RDC automático não tem saldo informado.** O banco mostra **R$ 27.356,76** aplicado, mas o sistema mostra "—". As aplicações e os resgates do mês foram lidos certo: R$ 22.369,73 líquidos em outubro. Só que a conta nunca recebeu o saldo de partida da aplicação, que era R$ 4.987,03 em 30/09. Por isso o total aparece negativo.

Total certo: R$ 628,50 + R$ 27.356,76 = **R$ 27.985,26**.

## O que será feito
1. Importar este PDF na conta Sicoob da Go Company. Só entra o PIX de 26/10. Os outros lançamentos já existem e não duplicam.
2. Gravar o saldo do PDF em 26/10: em conta R$ 628,50 e aplicado R$ 27.356,76. A aplicação passa a aparecer na coluna "Aplicado".
3. Fazer a leitura do PDF do Sicoob pegar a linha "SALDO EM RDC AUTOMÁTICO" como saldo aplicado, para isso não se repetir nos próximos extratos. Incluir um teste automático com este arquivo.
4. Conferir na tela: Saldo atual R$ 27.985,26, com "confere" nas duas colunas.

Nenhum lançamento já existente é alterado. Tudo fica registrado no histórico da empresa.

## Detalhes técnicos
- `parsers.ts` (Sicoob PDF): ler `SALDO EM RDC AUTOMÁTICO` → `saldoAplicadoInformado`; `SALDO EM CONTA` continua como `saldoFinalInformado`.
- Teste em `src/test/bankSicoobPdf.test.ts`: fixture GO 26/10, saldo em conta 628,50 e aplicado 27.356,76.
- A importação usa o fluxo normal da tela, com hash e rastreabilidade. A âncora fica em `bank_account_balances` com data 2026-10-26.
