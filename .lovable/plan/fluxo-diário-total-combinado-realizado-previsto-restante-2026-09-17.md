# Fluxo Diário — total combinado (realizado + previsto restante)

## Objetivo

Na linha de totais da tabela Fluxo Diário, mostrar em **negrito e itálico** quanto o mês deve fechar: o que já entrou/saiu de fato somado com o que ainda está previsto para o restante do período. Assim dá para comparar, a cada dia, se o cliente está melhor ou pior que o previsto.

## O que muda (visível)

- Na tabela "Fluxo Diário Completo", logo abaixo da linha TOTAIS, aparece uma nova linha: **"Previsto de fechamento (realizado + previsto restante)"**.
- Nessas duas colunas, em negrito e itálico:
  - **Entrada Realizada** → total realizado até hoje + entradas previstas dos dias futuros.
  - **Saída Realizada** → total realizado até hoje + saídas previstas dos dias futuros.
- Todo o resto continua igual: linhas diárias, linha divisória verde "Realizado até...", coluna Saldo Final Projetado e os totais atuais não mudam.

## Detalhes técnicos

- Arquivo: `src/components/DailyFlowTable.tsx` (somente ele).
- Novo cálculo derivado dos dados já existentes (`dailyData`):
  - `entradaPrevistaRestante` = soma de `entradaPrevista` apenas dos dias com `isAfterCutoff`.
  - `saidaPrevistaRestante` = idem para `saidaPrevista`.
  - Combinado = `totals.entradaRealizada + entradaPrevistaRestante` (e equivalente para saída).
- Nova linha no `<tfoot>`, abaixo de TOTAIS, com classes `font-bold italic`, mantendo as cores das colunas (verde para entradas, vermelho para saídas).
- Se não houver dias futuros com previsão, o combinado é igual ao realizado (a linha aparece mesmo assim, sem duplicar valores de forma confusa).
- Nenhuma regra de cálculo financeiro é alterada; é apenas uma soma de exibição a partir dos mesmos dados da tabela (SSOT preservada).
- Versão mobile mantém os cartões atuais (sem alteração).
