# Gráficos completos de despesas e matrículas em quantidade

## Objetivo

Fazer o PDF reproduzir a leitura visual da aba **Relatório Realizado · Análise de Despesas**, com uma página geral e uma página dedicada para cada categoria-mãe, além de corrigir matrículas e contatos para serem apresentados como quantidades de pessoas.

## Alterações

### 1. Reorganizar a apresentação

- Retirar a página atual **Receitas recebidas e vendas**, que ocupa a posição 5 e foi considerada desnecessária.
- Posicionar a análise de despesas logo após a evolução financeira:
  1. capa e resumo;
  2. leitura gerencial;
  3. evolução de receitas;
  4. **Despesas por categoria**;
  5. **Franqueadora**;
  6. uma página para cada categoria-mãe seguinte;
  7. indicadores, comercial, matrículas e contatos.
- Manter a geração condicional: categorias sem valor no período não criam páginas vazias.

### 2. Página “Despesas por categoria”

- Usar o mesmo agrupamento por categoria-mãe da aba online: conta normalizada associada ao grupo do plano de contas.
- Reproduzir o gráfico horizontal da plataforma, ordenado por valor, com:
  - nome da categoria;
  - valor em reais;
  - percentual do faturamento;
  - destaque visual para categorias acima de 30% do faturamento;
  - total do período e faturamento de referência.
- Reservar a maior parte da página ao gráfico, ajustando altura e espaçamento ao número de categorias sem reduzir os textos a tamanhos ilegíveis.
- Identificar o bloco como **análise das despesas realizadas**, sem misturá-lo ao total financeiro oficial quando os conceitos não forem iguais.

### 3. Uma página por categoria-mãe

- Criar uma página para Franqueadora e para cada categoria-mãe com movimento no período.
- Reproduzir a organização mostrada na plataforma:
  - cabeçalho com total, participação nas despesas, maior gasto e percentual do faturamento;
  - gráfico horizontal de categorias-filhas, em laranja, com valores;
  - gráfico de linhas amplo comparando o ano selecionado com o ano anterior, mês a mês;
  - acumulado até o mês selecionado e variação contra o mesmo período do ano anterior.
- Usar os mesmos dados, agrupamentos e regras temporais da aba online; não criar um cálculo financeiro paralelo no gerador do PDF.
- Não desenhar linha quando uma série tiver menos de dois pontos válidos; nesse caso, mostrar os totais comparáveis disponíveis.

### 4. Corrigir matrículas e contatos

- Separar o formato dos comparativos anuais em **financeiro** e **quantidade**.
- Nas páginas de matrículas e contatos, remover `R$`, “mil” e médias monetárias.
- Exibir números inteiros de pessoas, totais anuais e média mensal em quantidade.
- Manter moeda somente em receitas, despesas, vendas, faturamento e demais valores financeiros.

## Detalhes técnicos

- Extrair ou compartilhar a preparação de categorias usada na tela para que tela e PDF recebam a mesma estrutura de dados.
- Preservar os motores financeiros oficiais para resumo, resultado, operações e saldos.
- Tratar os gráficos de despesas como detalhamento analítico realizado, mantendo explícita qualquer diferença para o total oficial em vez de forçar uma conciliação incorreta.
- Adaptar os desenhadores do PDF para rótulos externos às barras, percentuais e séries anuais completas no formato 16:9.

## Validação

- Gerar o relatório de **Dourados — agosto de 2026**.
- Comparar a página geral de despesas e a página Franqueadora com os dois exemplos enviados.
- Conferir valores, percentuais, categorias-filhas, acumulados e séries 2025/2026 contra a aba online.
- Renderizar todas as páginas do PDF e revisar cortes, sobreposições, legibilidade, páginas vazias e ordem final.
- Confirmar visualmente que matrículas e contatos aparecem apenas como quantidades, nunca como moeda.