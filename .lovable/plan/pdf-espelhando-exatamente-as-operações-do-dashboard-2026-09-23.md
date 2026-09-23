# PDF espelhando exatamente as operações do Dashboard

## Objetivo
Fazer o PDF geral copiar a classificação e os valores já exibidos na primeira aba (Projeção/Dashboard): tudo que aparece ali como Operação Financeira também aparecerá como operação no PDF, com o mesmo valor e o mesmo sentido de entrada ou saída.

## Implementação
1. Usar no PDF a mesma consolidação mensal central (`periodMovement`) que alimenta os cartões e a seção “Operações Financeiras” do Dashboard.
2. Montar entradas, saídas, impacto líquido e detalhamento das operações a partir do mesmo `tipoAggregations` já exibido na tela, sem reclassificar lançamentos dentro do gerador do PDF.
3. Manter operações fora de Receita, Despesa e Resultado, mas dentro do Caixa e do Saldo Final, exatamente como no Dashboard.
4. Incluir no PDF o detalhamento por tipo de operação, preservando os mesmos rótulos e direções mostrados na tela.
5. Remover qualquer caminho paralelo do PDF que possa produzir um total diferente do Dashboard.

## Conferência geral
- Comparar Dashboard × PDF no mesmo cliente, período e visão (realizado/projetado).
- Verificar operações de entrada, operações de saída, impacto líquido e saldo final.
- Repetir em Dourados e em clientes com meses de fluxo, histórico e projeção.
- Quando houver divergência, listar os lançamentos responsáveis; não ajustar valores manualmente nem criar regra específica por cliente.

## Testes
- Garantir por teste que a soma das operações detalhadas no PDF corresponde aos totais do Dashboard.
- Cobrir operação em Contas a Pagar, fluxo realizado, histórico e projeção.
- Confirmar que Receita, Despesa e Resultado não incorporam operações.
- Confirmar a conciliação: saldo final = saldo inicial + resultado + impacto líquido das operações.

## Detalhes técnicos
A mudança ficará na montagem dos dados do relatório em `Dashboard.tsx` e na apresentação em `mesCompletoPdf.ts`. Os motores centrais (`periodMovement`, `ledgerEngine`, `classificationUtils` e `tipoMeta`) continuarão sendo a única fonte de classificação e cálculo; não haverá alteração dos dados dos clientes.
