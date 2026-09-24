# Simplificar a conferência e a classificação do Fluxo Bancário

## Objetivo
Deixar a aba clara para a equipe e reduzir drasticamente o trabalho manual: lançamentos comuns serão classificados automaticamente pela categoria já definida, enquanto somente operações e exceções precisarão de detalhamento.

## Como ficará a classificação
- **Entrada comum** recebe automaticamente o item oficial **Receita** do modelo financeiro da empresa.
- **Saída comum** recebe automaticamente o item oficial **Despesa** do modelo financeiro da empresa.
- **Operação** exige a escolha do tipo específico do modelo, como aporte, empréstimo, antecipação, distribuição, rendimento, tarifa ou imposto.
- **Transferência interna, aplicação/resgate do principal e Ignorar** continuam neutros e não pedem tipo financeiro.
- **Lançamentos divididos** seguem a mesma regra por parte: partes comuns recebem Receita/Despesa; somente partes marcadas como Operação exigem detalhamento.
- Ao trocar a categoria, o tipo acompanha automaticamente. Ao transformar um lançamento comum em Operação, ele volta para “Detalhar operação” até a equipe escolher o item correto.
- A seleção sempre grava o identificador do item oficial do modelo da empresa; não haverá texto livre nem regra paralela por sinal.

## Aplicação nos dados existentes
- Preencher automaticamente os lançamentos comuns ainda sem tipo, apenas a partir de **01/09/2026**, nas três empresas em conferência.
- Usar exclusivamente os IDs de Receita e Despesa do modelo de cada empresa.
- Não alterar descrições, valores, datas, conciliação, arquivos originais ou lançamentos históricos.
- Não classificar automaticamente operações, transferências sem par ou outras exceções.
- Manter toda mudança reversível e auditável.

## Tela de movimentações
- Substituir as duas colunas confusas, “Categoria” e “Tipo financeiro”, por uma coluna principal **Classificação**.
- Mostrar diretamente: Receita, Despesa, Transferência, Aplicação automática, Ignorar ou o nome da operação detalhada.
- Para itens comuns, permitir corrigir a categoria em um seletor simples.
- Para Operação, abrir a escolha do tipo específico somente quando necessário.
- Destacar no topo uma fila de trabalho curta: **Operações para detalhar**, **Transferências sem par** e **Divisões pendentes**.
- Manter conciliação separada da classificação, pois ela não altera cálculos nem saldos.

## Aba Conferência Dashboard
- Exibir primeiro um veredito simples: **saldo fecha** ou **há diferença**, com o valor e as pendências que exigem ação.
- Reduzir o topo para saldo inicial, entradas, saídas, saldo final e fechamento.
- Mostrar claramente dois períodos separados: **dias comparados com a planilha** e **movimentações posteriores**, que não são erro.
- Manter visíveis somente as divergências que precisam de trabalho e os botões **Sincronizar** e **Baixar Excel**.
- Recolher por padrão os detalhes técnicos: por conta, por tipo, por dia, aplicações, contas sem movimento e demais informações de auditoria.
- Quando não houver problema, mostrar uma confirmação curta em vez de tabelas extensas.

## Segurança financeira e validação
- Reutilizar o modelo financeiro da escola e a sincronização existente; não criar outro fluxo de cálculo.
- Preservar a composição do saldo e a linha “Movimentações em classificação” apenas para exceções realmente pendentes.
- Confirmar que classificar ou conciliar nunca altera o saldo bancário.
- Testar entrada, saída, operação, transferência, aplicação, ignorar, divisão e troca entre as três escolas sem mistura de dados.
- Conferir que junho, julho e agosto permanecem congelados e que nenhuma fonte do Dashboard é ativada durante esta etapa.
