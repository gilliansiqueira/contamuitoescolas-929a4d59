# Exportar Movimentações para Excel + aceitar a planilha de dinheiro da OAP

## 1. Botão "Exportar Excel" em Fluxo Bancário > Movimentações

- Botão ao lado dos filtros. Exporta exatamente o que está na tela: mesmo período, conta, filtros (Receitas/Despesas, status, busca) e partes divididas.
- Uma linha por lançamento (ou por parte, quando o lançamento foi dividido), em ordem de data.
- Colunas: Data · Conta · Descrição · Contraparte · Categoria (item do modelo) · Tipo (Receita / Despesa / Operação / Ignorar, vindo da classificação oficial) · Entrada · Saída · Saldo da conta · Status da conciliação · Justificativa · Origem (arquivo do extrato).
- Valores como número no formato brasileiro (1.500,50), datas dd/mm/aaaa, cabeçalho fixo e filtro do Excel ligados, linha de totais (entradas, saídas, líquido) no final.
- Segunda aba "Resumo por conta": saldo inicial, entradas, saídas e saldo final de cada conta no período.
- Os lançamentos de cheques dos sócios (conta "Fora do banco") não entram, igual à tela.
- Nome do arquivo: `Movimentacoes_<Empresa>_<período>.xlsx`.

## 2. Planilha de dinheiro da OAP não é aceita

**Causa:** a planilha não tem os títulos "Data" e "Valor" na linha de cabeçalho (só "Observação / Empresa", "Tipo Movimentação", "Categoria", "Entrada/Saída", "Saldo"). O leitor procura esses dois títulos para achar a tabela; sem eles, diz "nenhum lançamento reconhecido".

**Correção no leitor de planilhas:**
- Quando faltar o título, descobrir sozinho a coluna de data (coluna com datas) e a de valor (coluna numérica ao lado da descrição).
- Sentido pela coluna "Entrada/Saída" (nunca pelo sinal); valor gravado positivo.
- Linha "Saldo Agosto" vira o saldo anterior do extrato; a coluna "Saldo" serve para conferir linha a linha, e a importação só é liberada se os saldos fecharem (mesma regra dos outros extratos).
- Ignorar a lista lateral de categorias (colunas à direita sem data/valor).
- Na planilha de setembro: 9 lançamentos (8 entradas de dinheiro + 1 saída de R$ 2.721,00 para Murillo V Domingues).
- A "Categoria" da planilha aparece como sugestão na prévia, mas a classificação continua passando pelo modelo da empresa.

## Detalhes técnicos

- Export: novo `src/lib/bankStatements/exportMovements.ts` usando `xlsx` (já instalado), chamado em `BankTransactionsTable.tsx` com as linhas já filtradas; tipo vem de `tipoMeta`/`classificationUtils`, sem recalcular nada.
- Leitor: em `parsers.ts`, `detectHeaderRow`/parse tabular com fallback quando `iData`/`iValor` < 0: inferir por conteúdo das primeiras linhas; reconhecer "saldo <mês>" como saldo anterior. Teste automático com a planilha da OAP.
- Verificar importando o arquivo na conta "Caixa Dinheiro" da OAP (prévia) e exportando um mês.
