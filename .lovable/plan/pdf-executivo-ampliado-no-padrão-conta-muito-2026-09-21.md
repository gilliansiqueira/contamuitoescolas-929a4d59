# PDF executivo ampliado no padrão Conta Muito

## Objetivo

Reformular o relatório geral para ficar próximo da organização do PDF de São José, porém mais moderno, limpo e gerencial. O documento será **A4 paisagem**, usará a identidade Conta Muito já escolhida — fundo claro, teal como estrutura e laranja nos destaques — e continuará respeitando o período selecionado como foco principal.

O histórico usará **todos os anos que realmente possuírem dados**, sem sobrepor muitas linhas em um único gráfico. O indicador DL não será incluído.

## Estrutura do novo relatório

### 1. Capa e resumo executivo
- Logo Conta Muito, empresa, período selecionado e data de geração.
- Saldo inicial, receitas, despesas, resultado e saldo final em destaque.
- Variação contra o período anterior comparável.
- Três leituras objetivas: melhora, piora e ponto de atenção.
- Identificação clara quando o período mistura fechamento, histórico, realizado e projeção.

### 2. Histórico financeiro visual
- Página de receitas e página de despesas.
- Todos os anos disponíveis serão apresentados em **pequenos gráficos anuais separados**, usando a mesma escala para permitir comparação direta sem poluição visual.
- Cada ano mostrará total, média mensal, melhor mês e pior mês.
- O ano mais recente terá maior destaque; anos anteriores permanecerão visíveis como referência.
- Meses sem dados ficarão vazios, nunca serão mostrados como zero artificial.

### 3. Evolução do resultado e do caixa
- Resultado mensal e saldo de fechamento do período.
- Tabela compacta de conferência com saldo inicial, receitas, despesas, operações, resultado e saldo final.
- Operações financeiras aparecerão separadas e continuarão afetando somente o caixa.
- Meses negativos e menor saldo serão destacados.

### 4. Folha, alunos e lucratividade
- Visão conjunta inspirada no arquivo enviado, mas dividida em faixas de leitura para não misturar reais, quantidade e porcentagem na mesma escala.
- Evolução mensal de folha, alunos e lucratividade, com resumo do mês atual e comparação anterior.
- Cada medida só será exibida quando houver uma fonte identificável na plataforma; ausência de dado será informada, sem estimativas ou inferências por nome/sinal.

### 5. Vendas
- Total do período e composição por forma de pagamento cadastrada.
- Cartão, PIX e Boleto apresentados conforme o mapeamento oficial da plataforma; nenhum agrupamento “Outros”.
- Comparação mensal e participação percentual de cada forma.
- Detalhamento por bandeira quando esse dado estiver cadastrado.

### 6. Despesas e faturamento
- Despesas por categoria-mãe, com valor e percentual sobre o faturamento do mesmo período.
- Comparação com limites cadastrados quando existirem.
- Ranking visual das maiores categorias e destaque para concentrações relevantes.
- Uma página detalhada por categoria-mãe, reunindo suas subcategorias, total e participação, com paginação automática.
- Totais dos detalhes obrigatoriamente conferidos contra o total oficial do relatório; divergências serão explicitadas, não ocultadas.

### 7. Indicadores e inadimplência
- Painel com todos os KPIs ativos, valor atual, faixa, tendência e comparação anterior.
- Evolução histórica dos indicadores em pequenos gráficos separados, evitando muitas métricas sobrepostas.
- Bloco específico de inadimplência quando houver dados cadastrados, usando somente os valores oficiais disponíveis.
- Indicadores antigos e configuráveis serão conciliados para evitar duplicidade do mesmo KPI.

### 8. Comercial, matrículas e contatos
- Comercial separado entre Ativo e Receptivo.
- Contatos, matrículas e conversão por origem, com faixa de desempenho configurada.
- Evolução mensal de contatos e matrículas.
- Matrículas por ano usando todos os anos disponíveis, também em pequenos gráficos anuais comparáveis em vez de muitas linhas acumuladas.
- Totais anuais, diferença absoluta e variação percentual entre anos comparáveis.

### 9. Anexos de conferência
- Demonstrativo financeiro mensal.
- Despesas por categoria-mãe e subcategoria.
- Valores completos dos KPIs.
- Vendas por método e bandeira.
- Contatos, matrículas e conversão por mês e origem.
- Todo bloco sem informação permanecerá identificado como “Sem dados cadastrados no período”.

## Experiência visual

- A4 paisagem em todas as páginas, com hierarquia semelhante a uma apresentação executiva.
- Cabeçalhos consistentes com logo, empresa e período; rodapé com fonte dos dados, geração e paginação.
- Fundo claro para impressão e leitura no celular, com teal institucional e laranja para decisões e alertas.
- Gráficos planos e modernos, sem efeitos 3D, ícones decorativos excessivos ou excesso de cores.
- Valores completos nos resumos; abreviações em milhares apenas nos eixos quando necessárias.
- Legendas próximas dos dados e textos grandes o suficiente para leitura sem zoom excessivo.

## Integridade dos dados

- O período selecionado continuará sendo o período principal do relatório; os demais anos entram somente como contexto histórico.
- Receitas, despesas, resultado e saldos serão preparados pelos mesmos motores oficiais usados nas telas financeiras.
- Nenhum cálculo será feito pelo sinal do valor, por `entrada/saída` isoladamente ou por regras próprias do PDF.
- Histórico, fechamento, realizado e projeção manterão a prioridade oficial por mês.
- Vendas, KPIs, inadimplência, conversão, matrículas e contatos usarão seus cadastros existentes, sem criar valores ausentes.
- Não haverá alteração estrutural no banco nesta etapa.

## Detalhes técnicos

- Ampliar a preparação de dados feita no clique para buscar, em paralelo, apenas as colunas necessárias de histórico financeiro, vendas, indicadores, faturamento, despesas e conversão.
- Criar estruturas específicas para histórico anual, vendas, indicadores legados/configuráveis e despesas por categoria, mantendo o gerador visual separado da preparação financeira.
- Reorganizar o gerador atual em funções de página reutilizáveis, com proteção contra cortes, tabelas extensas e páginas de continuação.
- Preservar o carregamento sob demanda para que o novo PDF não deixe a navegação mais lenta.

## Validação

- Conferir São José em março de 2026 contra os blocos correspondentes do arquivo enviado.
- Testar um mês, vários meses e empresas com anos históricos diferentes.
- Confirmar que meses sem informação não viram zero e não criam quedas artificiais nos gráficos.
- Comparar os cinco números principais com o Dashboard para o mesmo período.
- Conferir totais de vendas, despesas, KPIs, conversão, matrículas e contatos com suas telas de origem.
- Gerar o PDF real, converter todas as páginas em imagens e revisar cortes, sobreposições, escalas, contraste, textos e paginação antes da entrega.
