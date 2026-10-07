# PDF do mês: Operações e "Acumulado" da categoria Outras (Uberlândia)

## Operações: causa confirmada
Nos cartões de Entradas e Saídas da página "Operações Financeiras", o PDF está somando também os lançamentos marcados como **Ignorar** no Fluxo Bancário. As barras de cada item já estão certas.

**Uberlândia Centro, setembro**
- Os itens somam R$ 7.735,00 de entrada (Sociedade e Entrada Aporte) e R$ 29.085,08 de saída (Compra da Escola, Saída Empréstimo e Distribuição de lucros). São os valores corretos que você informou.
- Os Ignorados somam R$ 5.242,73 de cada lado: Fatura de cartão R$ 2.048,04, Pix e estorno UPGRADE R$ 2.177,19, devoluções SM etc. Isso explica exatamente os R$ 12.977,73 e R$ 34.327,81 que aparecem hoje.

**Uberlândia Santa Mônica:** é o mesmo caso. Lançamentos Ignorar de R$ 10.000,00 (Pix e estorno MFLC), R$ 450,00, R$ 697,00 e outros entram nos totais. Ao tirá-los, as saídas devem ficar em R$ 23.370,00. Vou conferir esse número antes de concluir.

### Correção
- Os cartões de Entradas, Saídas e Impacto líquido passam a somar só os itens de operação mostrados nas barras.
- Ignorados ficam fora, como já acontece no Dashboard.
- Vale para todas as empresas. O saldo final não muda.

## Acumulado de "Outras" (Uberlândia Centro): causa ainda não confirmada
O PDF mostra R$ 55.693,74 e o correto é R$ 72.013,90, uma diferença de R$ 16.320,16. O valor vem do histórico mensal de despesas da categoria Outras, de janeiro a setembro de 2026. Primeiro vou abrir mês a mês para achar onde está a falta. Pode ser um mês sem histórico, categorias filhas que não entram em "Outras" ou um nome diferente da categoria mãe. Depois corrijo a causa e mostro quais meses e linhas faltavam.

## Detalhes técnicos
- `mesCompletoPdf.ts` (linhas 248–264): `operationsIn/Out` passam a ser a soma de `data.operations` (os mesmos itens das barras), em vez de `data.operacoesIn/Out`, que incluem Ignorar. Também revisar o cartão "Operações de caixa" da capa (linha 252).
- Conferir em `Dashboard.tsx`, por volta da linha 970, como o card monta os itens, para manter a mesma fonte (SSOT).
- Acumulado: rastrear a montagem de `expenseHistory` para "Outras" e comparar mês a mês com `realized_entries` e `historical`.
- Teste em `mesCompletoPdf.test.ts` com um Ignorar presente.
