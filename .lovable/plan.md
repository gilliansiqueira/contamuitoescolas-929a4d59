# Dourados: prévia da ativação parando em 18/09

## Por que não bate com o fechamento
A prévia mostra "Realizado até **18/09/2026**", mas o fechamento vai até 25/09. Por isso Receita (R$ 154.737,35) e Despesa (R$ 240.188,92) ficam menores. Os números não estão errados: eles só vão até 18/09.

O motivo da data de 18/09:
- A prévia usa como data de corte a do banco **menos atualizado**, para não misturar um banco até 25/09 com outro parado em 18/09.
- Em Dourados, BB, Sicredi, Stone e Inter estão até 25/09, mas o **último extrato do Bradesco vai só até 18/09**. O Bradesco quase não tem movimento, então ninguém subiu um extrato mais novo, e ele segurou a data de todos.

Depois de destravar, a prévia até 25/09 deve mostrar Receita R$ 205.802,08 e Despesa R$ 247.400,13. Isso é igual ao fechamento, exceto pelos R$ 599,00 de 01/09 que faltam na planilha.

## O que vou fazer
1. **Contar a data do extrato, não só do último lançamento.** Se subirem um extrato do Bradesco até 25/09 sem nenhum movimento novo, a conta passa a valer até 25/09. Hoje só conta a data do último lançamento.
2. **Aceitar extrato sem nenhum lançamento.** O sistema registra o período do arquivo (as datas "de/até" do próprio extrato) e mostra "Sem movimentação no período", sem dar erro.
3. **Mostrar na prévia qual conta está segurando a data**, por exemplo: "Realizado até 18/09 porque o Bradesco só tem extrato até 18/09: suba o extrato mais recente".
4. Conferir Dourados na tela depois que o extrato do Bradesco for importado.

**Para vocês:** subir o extrato do Bradesco de setembro até hoje, mesmo que venha sem movimento.

## Detalhes técnicos
- `refresh_bank_cashflow_status` (migration): `synced_through` = mínimo, por conta ativa, de `greatest(max(bank_transactions.data), max(bank_statement_imports.periodo_fim))`.
- Parser/import: extrato sem lançamentos usa DTSTART/DTEND do OFX (ou o período do PDF) como `periodo_inicio`/`periodo_fim`; o insert do import é permitido com 0 linhas.
- ActivationPreview/CashflowConference: exibir a conta que define o corte.
