# Relatório gerencial Conta Muito em 16:9

## Objetivo

Substituir o PDF atual por uma apresentação financeira personalizada, dinâmica e confiável, inspirada na narrativa do relatório São Carlos/Connect, mas gerada exclusivamente com os dados reais da empresa e do período selecionados.

O primeiro caso de validação será **Dourados — agosto de 2026**. Depois, o relatório será gerado para uma segunda empresa para comprovar que nome, período, categorias, conteúdo e quantidade de páginas se adaptam automaticamente.

## Problemas confirmados

- O PDF atual tem **21 páginas A4 paisagem**, enquanto a referência usa páginas horizontais **16:9** com maior hierarquia visual.
- Em Dourados/agosto de 2026, os 254 lançamentos detalhados somam **R$ 248.905,56**, mas todos têm `conta_id` vazio. Os 67 nomes de conta encontram correspondência no plano de contas, cuja categoria-mãe está no campo de grupo; o gerador atual procura apenas a relação por `pai_id`, por isso tudo aparece como “Sem categoria”.
- O resumo mostra despesas de **R$ 232.044,09**, enquanto o detalhamento bruto mostra **R$ 248.905,56**. São fontes/conceitos diferentes no código atual e ainda não há uma ponte que explique, linha por linha, os **R$ 16.861,47** de diferença.
- A página de folha/alunos/lucratividade consulta a estrutura antiga, que não possui registros para Dourados no período. Já os indicadores configuráveis possuem lucratividade de **25,62%** em agosto de 2026; por isso o mesmo PDF afirma ausência e depois mostra o valor.
- A direção dos indicadores (`maior é melhor` ou `menor é melhor`) é lida da base, mas descartada antes da montagem do PDF. Assim, a interpretação da variação não consegue distinguir corretamente casos como aumento de evasão.
- O gráfico do resumo é desenhado mesmo com um único mês, criando pontos isolados sem valor analítico.
- O histórico atual pode incluir meses existentes na projeção com valor zero, produzindo quedas artificiais em vez de lacunas.
- Tabelas extensas geram páginas genéricas “Anexo · continuação”, contrariando a narrativa por assunto solicitada.

## Implementação

### 1. Camada única de preparação e auditoria dos dados

- Manter receitas, despesas, resultado, operações e saldos vindos exclusivamente dos motores financeiros oficiais.
- Preparar uma estrutura mensal explícita com valores **realizados**, **previstos** e **operações de caixa** separados.
- Construir uma conciliação obrigatória:

```text
Saldo inicial
+ receitas que impactam caixa
- despesas que impactam caixa
+ operações de entrada
- operações de saída
= saldo final

Receitas do resultado
- despesas do resultado
= resultado
```

- Comparar o total oficial de despesas com o detalhamento e identificar exatamente quais lançamentos explicam qualquer diferença, incluindo operações, itens ignorados, duplicações ou registros fora do conceito apresentado.
- Nunca ocultar divergência: quando os conceitos forem diferentes, usar nomes distintos e mostrar a ponte de conciliação; quando deveriam coincidir, bloquear a apresentação incoerente e apontar os registros responsáveis.
- Considerar mês sem realizado como ausência de valor, nunca zero artificial.

### 2. Corrigir categorias e subcategorias

- Resolver cada lançamento realizado pelo identificador da conta quando existir e, no legado de Dourados, pelo nome normalizado da conta.
- Usar a hierarquia efetivamente cadastrada no plano de contas: categoria-mãe pelo grupo e subcategoria pela conta; preservar suporte a relações pai/filha quando presentes em outras empresas.
- Não apresentar “Sem categoria” como análise válida. Se algum lançamento continuar sem correspondência, criar um bloco de pendências com quantidade, valor e linhas responsáveis.
- Conferir que a soma das categorias e subcategorias fecha com o conceito de despesa exibido na página.

### 3. Unificar indicadores

- Tratar os indicadores configuráveis e ativos como fonte principal do relatório, evitando duplicidade com a estrutura antiga.
- Exibir valor atual, mês de referência, valor anterior comparável, meta/faixa configurada e classificação.
- Interpretar melhora ou piora conforme a direção cadastrada: aumento de inadimplência, evasão ou desconto não será descrito como melhora.
- Usar a fonte antiga somente quando não existir indicador configurável equivalente e houver valor real cadastrado.
- Criar página própria de inadimplência apenas quando quantidade de alunos, valor em aberto ou acompanhamento estiverem disponíveis; caso contrário, não gerar uma página vazia.

### 4. Novo visual 16:9

- Gerar páginas em proporção **16:9**, com fundo grafite, títulos brancos grandes, laranja Conta Muito nos destaques e cores de alto contraste nos gráficos.
- Manter logo, empresa e período em todas as páginas, com paginação discreta.
- Usar uma grade consistente, números grandes, textos legíveis e um assunto principal por página.
- Não desenhar gráfico de linha com menos de dois pontos válidos. Para um único mês, mostrar número destacado e comparação válida.
- Evitar páginas vazias, textos minúsculos, tabelas espremidas e repetição de informações.

### 5. Narrativa adaptável ao conteúdo

1. **Resumo do mês** — saldo inicial, receitas, despesas, retiradas/pró-labore quando existirem, resultado, operações que explicam o caixa e saldo final.
2. **Leitura gerencial** — o que melhorou, o que piorou e o principal ponto de atenção, sempre sustentados pelos dados.
3. **Evolução financeira** — receitas, despesas e resultado por mês e contra períodos equivalentes de anos anteriores; anos parciais identificados.
4. **Realizado x previsto** — receitas e despesas separadas por status, somente quando houver ambos; nunca somados sob o mesmo rótulo.
5. **Composição de receitas e vendas** — receitas por tipo e vendas por meio de pagamento em blocos distintos, explicando que são medidas diferentes.
6. **Despesas** — ranking de categorias-mãe, participação no faturamento, limites cadastrados e conciliação do total.
7. **Categorias relevantes** — principais subcategorias e evolução histórica apenas quando houver pontos suficientes; quantidade de páginas proporcional à relevância e aos dados.
8. **Indicadores** — valores, metas/faixas, comparação e leitura correta da direção.
9. **Comercial** — ativo e receptivo, contatos, matrículas e conversão quando disponíveis.
10. **Inadimplência** — página própria somente quando houver dados suficientes.
11. **Matrículas realizado x previsto** — somente quando as duas séries existirem.
12. **Anexo opcional de conferência** — tabelas completas organizadas por assunto, sem títulos genéricos e sem repetir os quadros executivos.

Blocos sem dados serão omitidos ou combinados com outra página; não haverá página inteira apenas para informar ausência.

## Detalhes técnicos

- Ampliar os dados do relatório com direção do KPI, faixas, valores anteriores, status realizado/previsto e resultado da conciliação.
- Reutilizar os motores oficiais para toda classificação e cálculo financeiro; o gerador visual apenas apresenta estruturas já conciliadas.
- Separar preparação financeira, preparação gerencial e desenho das páginas para evitar regras de negócio dentro do PDF.
- Criar componentes de desenho reutilizáveis para cabeçalho 16:9, indicadores, barras, séries temporais, comparações e tabelas paginadas por assunto.
- Manter a geração sob demanda, sem aumentar o carregamento inicial da plataforma.
- Não alterar a estrutura do banco nesta etapa. Eventuais falhas reais de cadastro serão listadas no resultado da validação antes de qualquer correção de dados.

## Validação e entrega

- Gerar novamente **Dourados — agosto de 2026**.
- Conferir os cinco números principais, operações de caixa e fórmulas de saldo/resultado contra a tela para o mesmo período.
- Conferir, linha por linha, a diferença hoje existente entre R$ 232.044,09 e R$ 248.905,56 e documentar a causa final.
- Confirmar categorias de Dourados pelo plano de contas e listar somente vínculos realmente ausentes como pendência cadastral.
- Conferir receitas, vendas, faturamento, despesas, KPIs, conversão, contatos e matrículas contra suas telas de origem.
- Gerar o PDF real, renderizar todas as páginas em imagens e revisar cortes, sobreposições, contraste, escalas, textos, vazios e paginação.
- Entregar o PDF final de Dourados e imagens das páginas de resumo, despesas, indicadores e realizado x previsto.
- Fazer uma segunda geração para outra empresa disponível e confirmar a adaptação automática.
- Informar objetivamente quais divergências foram corrigidas e quais, se houver, dependem de cadastro.
