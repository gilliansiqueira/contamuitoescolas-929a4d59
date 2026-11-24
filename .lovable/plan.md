# Filtro "Pendentes sem justificativa" no Fluxo Bancário

## O que muda
- No filtro **Situação** da tabela de lançamentos do Fluxo Bancário entra uma quarta opção: **Pendentes sem justificativa**. As opções ficam: Todas, Só pendentes, Pendentes sem justificativa e Conciliados.
- A opção mostra só os lançamentos pendentes que ainda pedem motivo, ou seja, os que hoje aparecem com a etiqueta vermelha "Sem justificativa".
- O aviso "X sem justificativa — ver" no topo passa a abrir já com esse filtro, em vez de "Só pendentes". Assim aparecem exatamente os lançamentos contados no aviso.
- Contagens, somas e o fechamento do dia continuam iguais. É só uma forma de ver os lançamentos.

## Detalhe técnico
`src/components/fluxo-bancario/BankTransactionsTable.tsx`: o estado `status` ganha o valor `'sem_justificativa'`. Nesse caso, o filtro aplica `recon_status === 'pendente' && !justification_reason_id && needsJustification(t)`, usando a mesma regra do hook `useReconJustification`, sem duplicar a regra. O botão do aviso passa a chamar `setStatus('sem_justificativa')`.
