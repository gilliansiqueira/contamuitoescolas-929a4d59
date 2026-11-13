# Aba Cartões: corrigir a leitura das planilhas em CSV

## O que está errado
Testei as três planilhas que você mandou (recebimentos Stone de Vitória, vendas Stone de Pinheirinho e relatório PagBank de Lauro de Freitas). Todas vêm em **CSV com ponto e vírgula**, e a tela lia esse tipo de arquivo no **formato americano**:
- **Valores:** "360,000000" virava 360.000.000 e "2.208,00" virava 2,21.
- **Datas:** "11/12/2026" virava 12 de novembro. O mesmo arquivo misturava datas trocadas e datas certas. Por exemplo, a venda de 05/11 do PagBank aparecia como 11/05.
- **Resultado:** totais absurdos, períodos errados e o bloqueio "total não confere".

Quando li os mesmos arquivos como texto brasileiro, os resultados ficaram certos:
- Vitória (recebimentos): 134 linhas, de 03/11 a 13/11, bruto R$ 55.118,83 e líquido R$ 54.285,67, com os cancelamentos já descontados.
- Pinheirinho (vendas): 40 linhas, de 03/11 a 12/11, bruto R$ 73.151,47 e líquido R$ 72.169,85.
- Lauro (PagBank): 2 vendas, bruto R$ 2.905,20 e líquido R$ 2.869,98, com liberação prevista para 11/03/2027.

## O que vou mudar
1. Arquivos **.csv** passam a ser lidos como texto, no formato brasileiro (vírgula decimal, data dia/mês/ano). A leitura também reconhece o separador do arquivo (; , ou tab) e os acentos, inclusive em arquivos antigos do Excel.
2. Planilhas **.xlsx** continuam sendo lidas como hoje.
3. Na Stone, "Cancelamento Parcial" e as linhas negativas entram como desconto e aparecem como estão no arquivo.
4. No PagBank, o "Código NSU" passa a ser usado como identificador, em vez do código longo da transação, para facilitar o cruzamento com o banco.
5. Testes automáticos com as três planilhas reais, conferindo os totais acima.

As planilhas de cartão continuam sendo só material de conferência e não alteram nenhum cálculo financeiro.

## Detalhes técnicos
- `CardSheetsPanel.tsx`: quando a extensão for .csv, decodificar em UTF-8 com BOM e usar windows-1252 como alternativa. Depois, separar linhas e colunas com `splitCsv` (aspas, detecção do separador) e entregar os textos brutos para `parseCardSheet`, que já usa `parseBRNumber` e `parseBRDate`.
- `cardSheetParse.ts`: exportar `parseCsvText`. No padrão `nsu`, dar prioridade a `codigo nsu`. Os padrões de data/valor ficam como estão, porque o mapeamento já sai correto para os três arquivos.
- Fixtures em `src/test/fixtures/cardSheets/` com testes em `cardSheetParse.test.ts`.
- Envios já gravados com valores errados: listar e apagar os envios de cartão das três empresas feitos com o leitor antigo, para a equipe reenviar.
