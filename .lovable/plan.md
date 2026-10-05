# Pinheirinho: aceitar a planilha "Fluxo de caixa RC – CEF"

## O que já foi visto nos arquivos
- A planilha enviada é a planilha própria da equipe, e não o modelo novo do sistema. Ela tem as colunas "Saldo inicial:", Data, Valor, Observação / Empresa, Tipo Movimentação, Categoria, Entrada/Saída e Saldo, com um título acima.
- Setembro tem 6 lançamentos. O saldo inicial é R$ 1.127,61 e o saldo final é R$ 352,02, igual ao que aparecia no PDF.
- No arquivo **CSV**, as datas vêm como "09/set", sem o ano. O ano só aparece no título ("Pinheirinho 2026").
- Várias linhas vazias trazem só fórmulas ("Saída" e saldo repetido) e precisam ser ignoradas.
- O motivo provável do erro: o leitor genérico confunde a coluna "Tipo Movimentação" com a coluna Entrada/Saída, e não encontra o saldo inicial, que fica na coluna A da primeira linha. **Isso ainda não está confirmado.** O primeiro passo é reproduzir o erro com os dois arquivos enviados.

## O que será feito
1. Reproduzir a leitura com o xlsx e o csv enviados para confirmar a causa exata.
2. Reconhecer esse formato de planilha:
   - o saldo inicial vem da coluna "Saldo inicial:";
   - o sentido de cada lançamento vem da coluna "Entrada/Saída";
   - a coluna "Saldo" é usada para conferir linha a linha;
   - as linhas sem data e sem valor são ignoradas;
   - no CSV, datas como "09/set" ganham o ano do título (ou do mês do arquivo).
3. Só deixar importar se o saldo calculado fechar com a coluna "Saldo". Se não fechar, o sistema mostra a linha com diferença.
4. Testar com os dois arquivos de setembro (6 lançamentos, saldo final R$ 352,02).

## Detalhes técnicos
- Em `parsers.ts`, detectar o cabeçalho com "entrada/saida" + "saldo" + "valor" antes de `rowsToTx`, ampliando `parseLooseCashSheet` ou criando um leitor ao lado dele. As células `Date` do xlsx viram data, e no CSV "dd/mmm" vira data com o ano do título.
- Adicionar um teste com os dois arquivos como fixture em `src/test/`.
- Nada muda na classificação nem nos motores SSOT.
