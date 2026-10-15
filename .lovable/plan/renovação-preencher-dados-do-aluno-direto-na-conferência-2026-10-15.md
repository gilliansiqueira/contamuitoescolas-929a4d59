# Renovação: preencher dados do aluno direto na Conferência

## Problema
Alunos com parcelas canceladas, mas ainda ativos, aparecem em "Sem parcelas do módulo". Hoje só é possível conferir ou desconsiderar. Não dá para registrar a situação real do aluno.

## O que muda
1. Nos itens ligados a um aluno ("Sem parcelas do módulo", "Aluno em mais de uma turma" etc.), aparece o botão **"Preencher e dar OK"**.
2. Ele abre um pequeno formulário com:
   - Forma de pagamento atual
   - Vencimento da última parcela (data)
   - Término do pagamento (data ou "A confirmar")
   - Motivo (lista: Parcelas canceladas – aluno ativo, Pagou à vista, Bolsista/permuta, Outro)
   - Observação (texto livre)
3. Ao salvar:
   - Os valores vão para a linha do aluno na planilha como **correção da equipe**. Por isso continuam valendo depois de recalcular ou reimportar.
   - Motivo e observação vão para a coluna Observações (sem apagar o que já existir).
   - O item fica marcado como conferido, com o motivo à vista na lista.
4. Ao recalcular, se o aluno já tiver essas correções, o aviso volta como conferido e não como pendência.

## O que não muda
- Nenhum dado financeiro é alterado. A renovação continua separada dos cálculos.
- "Marcar todos como conferidos" e "Desconsiderar" continuam como estão.

## Detalhes técnicos
- `RenovacaoModule.tsx`: dialog no item com `row_key`; grava overrides nas colunas pelo `field` (`forma_pagamento_atual`, `venc_ultima_parcela`, `termino_pagamento`, `observacoes`) usando a mesma rotina de edição da grade (com `original` preservado); depois marca a issue como resolvida com `detail.resolucao = { motivo, por, em }`.
- `persist.ts`: ao regravar as issues após recalcular, issue `sem_financeiro` cuja linha tenha override nesses campos já nasce resolvida.
- Teste em `src/test/renewal.test.ts` para a regra de auto-resolução.
