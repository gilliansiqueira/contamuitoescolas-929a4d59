# Corrigir os números do PDF de Dourados — agosto/2026

## Objetivo

Fazer o PDF repetir exatamente os valores exibidos na plataforma para Dourados em agosto de 2026, mantendo os motores financeiros oficiais como única fonte dos cálculos.

## Diagnóstico confirmado

- **Saldo final:** o cartão principal da plataforma mostra o saldo realizado, mas o PDF recebe hoje o saldo projetado. Isso explica a divergência de conceito entre os dois locais.
- **Franqueadora:** o PDF escolhe a maior linha individual dentro das despesas e imprime o nome da categoria-mãe. Por isso mostra R$ 54.847,50 em vez de somar todas as linhas de Franqueadora; os dados de agosto totalizam **R$ 76.173,88**.
- **Matrículas e contatos de 2025:** os dados de janeiro a agosto somam exatamente **273 matrículas** e **759 contatos**. Os cartões do PDF somam hoje todos os meses disponíveis de 2025, chegando incorretamente a 342 e 1.044, embora a comparação deva parar em agosto.
- **Junho:** a base contém movimento financeiro em junho de 2026. O gráfico não deve transformar esse mês em zero nem omiti-lo.
- **Resultado de julho:** o PDF está chegando a R$ 104.006,75 a partir da composição mensal atual, enquanto a plataforma mostra R$ 104.037,11. A diferença de R$ 30,36 será rastreada nas linhas efetivamente consideradas pela mesma fonte oficial antes do ajuste; não será compensada manualmente.

## Alterações

1. **Unificar a visão do resumo**
   - Alimentar o saldo final do PDF com a mesma visão realizada apresentada no cartão principal da plataforma.
   - Levar ao PDF o total de operações de caixa já consolidado pelo motor oficial, em vez de reconstruí-lo dentro do gerador.
   - Exibir separadamente entradas, saídas e impacto líquido quando houver operações, para o valor não desaparecer nem ficar ambíguo.

2. **Corrigir o principal ponto de atenção**
   - Escolher a maior **categoria-mãe já agregada**, não a maior subcategoria.
   - Confirmar Franqueadora em R$ 76.173,88 no período de agosto/2026.
   - Manter as páginas detalhadas usando o mesmo agrupamento da aba Análise de Despesas.

3. **Corrigir as séries financeiras anuais**
   - Montar receitas, despesas e resultado de 2025/2026 com `buildMonthMovement`, mês a mês, sem cálculo alternativo.
   - Garantir que junho use os lançamentos oficiais existentes e apareça nos dois gráficos.
   - Limitar apenas os meses posteriores a agosto; meses anteriores com dados permanecem visíveis.
   - Comparar o resultado de julho com a plataforma e localizar as linhas responsáveis pelos R$ 30,36 antes de alterar qualquer regra. A correção será feita na origem compartilhada caso exista divergência real; se a diferença for apenas uma versão antiga do PDF, será corrigido somente o caminho de exportação.

4. **Aplicar o corte Jan–Ago aos totais de pessoas**
   - Nos cartões de Matrículas e Contatos, somar janeiro até o mês do relatório nos dois anos.
   - Manter o gráfico anual completo conforme solicitado; o corte vale somente para o total e a média exibidos no topo.
   - Validar 2025 com 273 matrículas e 759 contatos.

## Garantias técnicas

- Nenhum valor financeiro será digitado ou ajustado manualmente no código.
- Receitas, despesas, resultado, operações e saldo continuarão vindo de `periodMovement` e dos motores de classificação oficiais.
- O gerador receberá valores consolidados da camada de dados; não criará uma segunda regra financeira.
- Não haverá alteração de banco nem dos dados de Dourados.
- Serão adicionados testes de regressão para corte anual, categoria-mãe, junho, operações e seleção do saldo realizado.

## Validação

- Gerar novamente o PDF de **Dourados — agosto/2026**.
- Conferir: operações de caixa preenchidas; saldo final **R$ 259.525,74**; Franqueadora **R$ 76.173,88**; julho **R$ 104.037,11**; junho visível em receitas e despesas; 2025 com **273 matrículas** e **759 contatos**.
- Comparar os números com a tela online e renderizar todas as páginas do PDF para revisar cortes, sobreposições e legibilidade.
- Repetir a geração para uma segunda empresa, garantindo que a correção não seja específica de Dourados.
