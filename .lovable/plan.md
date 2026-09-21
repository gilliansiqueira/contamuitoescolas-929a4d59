# Relatório PDF geral consolidado da empresa

## Objetivo

Transformar o PDF geral em um relatório gerencial completo do período selecionado, com leitura rápida nas primeiras páginas e detalhamento nos anexos.

O relatório usará exatamente os meses escolhidos no filtro global e terá como itens obrigatórios: **receitas, despesas, resultado, saldo inicial, saldo final, despesas detalhadas, indicadores, conversão e matrículas**.

## Estrutura do relatório

### 1. Capa e resumo executivo

- Nome da empresa e período exato selecionado.
- Data de geração e identificação das fontes usadas no período.
- Cinco números principais: saldo inicial, receitas, despesas, resultado e saldo final.
- Destaques gerenciais: margem do resultado, peso das despesas sobre a receita e variações mais relevantes.
- Resumo financeiro mês a mês, incluindo a origem oficial de cada mês quando houver histórico, fechamento, realizado ou projeção.

### 2. Evolução financeira

- Gráfico mensal de receitas, despesas e resultado durante o período.
- Evolução mensal do saldo, evitando pontos diários quando houver vários meses.
- Destaque para meses negativos, menor saldo de fechamento e saldo final.
- Tabela mensal de conferência com saldo inicial, movimentos do mês e saldo final.

### 3. Análise de despesas

- Gráfico por categoria-mãe, com valores e participação no total.
- Relação das categorias-mãe com suas subcategorias.
- Comparação mensal das principais categorias durante o período.
- Categorias pequenas podem ser agrupadas visualmente no gráfico, mas continuarão discriminadas no anexo.

### 4. Indicadores

- Todos os indicadores ativos da empresa.
- Valor mais recente dentro do período, classificação/faixa e variação em relação ao período anterior comparável.
- Evolução dos indicadores que possuírem dados em mais de um mês.
- Respeitar o número de casas decimais e o formato configurado em cada indicador.

### 5. Conversão

- Contatos, matrículas e taxa de conversão consolidados no período.
- Separação por origem quando os dados cadastrados permitirem, preservando as regras atuais de Ativo e Receptivo.
- Evolução mensal de contatos, matrículas e conversão.

### 6. Matrículas — ano contra ano

- Gráfico alinhado de janeiro a dezembro comparando o ano final selecionado com o ano anterior.
- Destacar somente os meses equivalentes ao intervalo escolhido, sem comparar períodos incompletos de forma desigual.
- Totais dos dois anos, diferença absoluta e variação percentual.

### 7. Anexos detalhados

- Demonstrativo financeiro mês a mês.
- Despesas por categoria-mãe e subcategoria, com valor e participação.
- Tabela completa dos indicadores do período.
- Tabela mensal de contatos, matrículas e conversão.
- Quando um bloco obrigatório não tiver dados, ele permanece no PDF com a indicação clara de “Sem dados cadastrados no período”, em vez de desaparecer.

## Experiência de exportação

- O botão do relatório geral usará o período já selecionado na tela, sem pedir novamente as datas.
- Antes de gerar, uma janela resumirá o período e as seções incluídas.
- O PDF terá páginas A4 planejadas individualmente, títulos consistentes, numeração, nome da empresa e período no rodapé.
- Gráficos serão preparados especificamente para impressão, sem depender de capturar a tela atual.
- O relatório seguirá a identidade visual clara da Conta Muito e continuará legível quando aberto no celular.

## Direção visual escolhida

- Seguir a prévia **Executive financial report**, adaptada integralmente à identidade real da Conta Muito.
- Cabeçalho teal com o logotipo oficial da Conta Muito e detalhes laranja.
- Fundo branco, divisórias leves e números grandes, evitando aparência bancária genérica ou excesso de cartões.
- A primeira página terá os cinco valores obrigatórios em destaque: saldo inicial, receitas, despesas, resultado e saldo final.
- Laranja será usado para alertas, pontos de atenção e detalhes; teal para estrutura, receitas e elementos institucionais.
- Gráficos e destaques responderão rapidamente: o que melhorou, o que piorou e o que exige atenção.
- Todo conteúdo será empresarial e gerencial, sem exemplos de investimentos pessoais ou movimentações genéricas.

## Integridade financeira

- Receitas, despesas, resultado e saldos virão da mesma fonte oficial usada no Dashboard, mês a mês.
- Fechamento, histórico, realizado e projeção respeitarão a prioridade já definida pelo sistema.
- Nenhum total será recalculado por sinal do valor ou por regras próprias do PDF.
- Operações financeiras afetarão somente o caixa; não serão tratadas como receita ou despesa.
- As tabelas detalhadas terão totais de conferência e deverão coincidir com os resumos correspondentes.
- A implementação consolidará os geradores atuais para evitar que o PDF geral e o relatório mensal produzam números diferentes.

## Detalhes técnicos

- Evoluir o fluxo atual de “Mês completo” para receber o período selecionado e os conjuntos de dados adicionais.
- Criar uma camada única de preparação dos dados do relatório, reutilizando `usePeriodMovementCtx`, `buildMonthMovement`, `computeSaldoFinal` e as classificações oficiais.
- Reaproveitar os dados já existentes de despesas realizadas, plano de contas, indicadores e conversão, sem alterar o banco.
- Renderizar os gráficos em páginas próprias para PDF e manter anexos tabulares com paginação segura.
- Remover do caminho principal os cálculos paralelos do gerador mensal antigo, sem alterar as telas financeiras.

## Validação

- Conferir um único mês e um período longo, como janeiro a agosto.
- Validar que os cinco totais da primeira página coincidem exatamente com os cartões do Dashboard para o mesmo período.
- Conferir que o total do gráfico e do anexo de despesas coincide com o total de despesas usado no relatório.
- Comparar matrículas ano contra ano apenas em meses equivalentes.
- Testar empresas com módulos completos, módulos sem dados e períodos que misturam histórico, realizado e projeção.
- Gerar o PDF, renderizar todas as páginas como imagens e revisar cortes, sobreposições, textos pequenos, gráficos e paginação antes da entrega.
