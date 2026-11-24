# SJP Cora: conferência do saldo + aviso de número errado no cadastro

## SJP - Cora (conferido)
- O arquivo que você mandou foi baixado em **23/11**, e os saldos no sistema batem com ele até ali. Os 83 lançamentos do arquivo estão gravados, e o saldo do começo de novembro bate em R$ 764,61. Pelo arquivo, o saldo era de R$ 2.510,63 naquele momento.
- Em 24/11, às 12h47, a equipe subiu um extrato mais novo da Cora com **6 lançamentos depois desse arquivo**: Pix enviados à Zavadniak de R$ 2.000,00 e R$ 1.500,00, e recebimentos de R$ 277,14, R$ 392,70, R$ 398,92 e R$ 466,00. Juntos dão **−R$ 1.965,24**. Por isso o sistema hoje não mostra mais R$ 2.510,63, e sim **R$ 545,39**, que é o saldo seguindo o extrato mais novo.
- Os R$ 6.295,75 do print são de antes desses envios.
- **Falha encontrada:** a Cora coloca no arquivo o "fim do mês" (30/11) como data do saldo, embora ele seja o saldo do momento em que o extrato foi baixado. A plataforma entende essa data como futura e descarta o saldo. Por isso a coluna "Conferência com o banco" da Cora fica sempre "—" e a diferença não aparece sozinha.

### Correção
1. Quando o extrato traz um saldo com data futura igual ao fim do período do arquivo, como na Cora, passar a usar esse saldo como o saldo do último dia com lançamentos. Assim a conferência da Cora volta a funcionar automaticamente a cada extrato.
2. Gravar o saldo nos envios recentes da Cora do SJP, lendo os arquivos já guardados, para a conferência aparecer já com o extrato de 24/11. Se o banco mostrar hoje um valor diferente de R$ 545,39, a tela vai apontar a diferença e o dia.
3. Teste com o seu arquivo: o saldo lido deve ser R$ 2.510,63 em 23/11.

## Aviso de número errado no cadastro de contas
- Na tela de cadastrar/editar conta, se o campo **Conta** ou **Agência** tiver formato de CNPJ (14 dígitos ou com "/") ou de CPF (11 dígitos com pontos), aparece um aviso em vermelho: "Isso parece um CNPJ/CPF. Coloque aqui o número da conta e informe o documento no campo do titular."
- O salvamento fica bloqueado enquanto houver barra ou formato de CNPJ, que nunca é número de conta. Para 11 dígitos sem pontos (alguns bancos digitais, como o Mercado Pago, têm contas assim), só aparece o aviso, sem bloquear.
- Teste da regra: CNPJ bloqueia, conta normal passa, 11 dígitos só avisa.

## Detalhe técnico
- `src/lib/bankStatements/parsers.ts` (OFX): se `DTASOF === DTEND`, `DTEND > hoje` e há lançamentos, manter `saldoFinalInformado` em `periodoFim` (última data com lançamento) em vez de mover para `saldoAtualCabecalho`. O caso do Inter (DTASOF posterior a DTEND) continua igual. Teste em `src/test/`.
- Backfill: atualizar `saldo_final_informado` dos imports da conta `6c9d6a55…` relendo os arquivos guardados.
- Validação pura nova em `src/lib/bankAccountNumber.ts` com teste; usada no formulário de `BankAccountsImports.tsx`.
