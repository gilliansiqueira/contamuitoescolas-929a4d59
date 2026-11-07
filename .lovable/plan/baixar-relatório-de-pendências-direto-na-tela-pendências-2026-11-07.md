# Baixar relatório de pendências direto na tela Pendências

## O que muda
1. **Botão "Baixar Excel" no topo dos filtros** (ao lado de responsável/idade): gera uma planilha da equipe com tudo que está filtrado na tela.
   - Aba "Resumo": uma linha por empresa — responsável, nº de pendências, valor pendente (soma sem sinal), pendência mais antiga, dias em atraso. Ordenado por responsável, "Sem responsável" por último. Serve para cobrar a equipe.
   - Aba "Detalhe": todas as linhas — empresa, responsável, data, conta, descrição, entrada/saída, valor, motivo, observação.
2. **Botão "Excel para o cliente" em cada empresa** (ao abrir a linha da empresa): baixa a mesma planilha que já existe no Fluxo Bancário (com coluna "Retorno do cliente" e totais de entradas/saídas), só daquela empresa.
3. Os arquivos respeitam busca, responsável e idade escolhidos; colaboradora só exporta o que já vê (sua carteira).

## Detalhes técnicos
- `ReconciliationBacklog.tsx`: usar as linhas já filtradas (`filtered`), sem nova consulta nem cálculo financeiro.
- Novo `exportTeamBacklogXlsx` em `src/lib/bankStatements/exportPendencias.ts`; reaproveitar `exportPendenciasXlsx` para o botão por empresa.
- Nome do arquivo: `pendencias-equipe-AAAA-MM-DD.xlsx` e `pendencias-<empresa>-AAAA-MM-DD.xlsx`.
- Verificar o download via navegador automatizado.
