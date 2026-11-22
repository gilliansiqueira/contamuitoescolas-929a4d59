# Cartões: Stone ID completo e botão de baixar a planilha

## O que descobri
- Das 10.310 linhas enviadas, só 81 estão com o Stone ID abreviado (ex.: `4,14627E+13`). Todas são de Foz do Iguaçu, em dois arquivos CSV:
  - recebimentos 01/10 a 13/11: 74 linhas
  - vendas 01/11 a 13/11: 7 linhas
- Nessas duas planilhas, o número já chegou abreviado. Alguém abriu o CSV no Excel e salvou de novo, e o Excel trocou o número pela forma curta. Os dígitos do fim se perderam no próprio arquivo, então não tem como recuperar esses números aqui.
- Nos outros envios (como os da Stone em .xlsx), o Stone ID foi guardado inteiro.

## O que vou fazer
1. **Barrar no envio:** se a coluna de Stone ID/NSU vier abreviada (com "E+"), a tela avisa antes de gravar: "Stone ID abreviado pelo Excel — baixe de novo da Stone sem abrir no Excel" e mostra quais linhas estão assim. A planilha não é gravada.
2. **Ler sempre como texto:** códigos longos (Stone ID, NSU, Stonecode) passam a ser guardados como texto, sem nunca virarem número. Assim não perdem dígito.
3. **Botão "Baixar"** ao lado da lixeira em cada envio, nas abas de recebimentos e de vendas. Ele gera uma planilha Excel com todas as linhas e colunas originais. O Stone ID vai como texto, então aparece inteiro no Excel e o outro chat consegue ler.
4. **Os dois arquivos de Foz:** a equipe baixa de novo da Stone o CSV, sem abrir no Excel, ou já em .xlsx. Depois exclui os dois envios antigos e sobe os novos.

Isso continua sendo só material de conferência: não muda receita, despesa nem saldo.

## Detalhes técnicos
- `cardSheetParse.ts`: nova `isScientificId(v)` (`/^\d+([.,]\d+)?E\+\d+$/i`). Ela é usada pela coluna `nsu` e por cabeçalhos com id/code/nsu. Linhas com esse padrão bloqueiam a importação e aparecem listadas. Há teste no vitest.
- Na leitura do XLSX: para colunas de identificador, usar o texto da célula (`cell.w`) ou `String(BigInt)` quando for inteiro seguro. Com isso, o `raw` também guarda o identificador como string.
- Exportação no `CardSheetsPanel`: busca `card_sheet_rows` por `origem_upload_id` em páginas de 1000. Monta as linhas a partir de `raw` e força as colunas de identificador como célula do tipo `s` (texto). Gera o arquivo com `XLSX.writeFile` e o nome do arquivo original em `.xlsx`.
