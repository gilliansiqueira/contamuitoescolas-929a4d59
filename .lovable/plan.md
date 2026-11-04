# Usar as parcelas do Omni na planilha de renovação

## O que muda
Hoje, quando o aluno não tem parcela do curso a partir da data de corte (01/10/2026 em Manaus Centro), as colunas de pagamento da planilha ficam "Sem informação", mesmo que o Omni (ou o Sponte) tenha as parcelas dele.

Passa a ser assim:
- **Parcelas a partir do corte**: continua igual, preenchendo forma de pagamento, vencimento da última parcela e término do pagamento.
- **Só parcelas antes do corte** (no Omni ou no Sponte): a planilha preenche com essas parcelas, em vez de "Sem informação":
  - Forma de pagamento: a do sistema. O Omni não informa o meio, então fica "À vista" (tudo pago numa data só) ou "Parcelado".
  - Vencimento da última parcela: a data da última parcela do curso.
  - Término do pagamento: a mesma data. Se for cartão de crédito, fica "A confirmar", como hoje.
- Em Manaus Centro, isso preenche os 19 alunos com curso quitado e os 3 com parcela vencida (Wendel, Adiel e Ageu Medrado). Para estes 3, o aviso "cobrar antes de renovar" continua.
- Ficam como "Sem informação" só os 3 sem nenhuma parcela de curso: Rayssa Pereira de Souza, Lucas Emanuel Brito Cordeiro Reis e Matheus Ribeiro de Lima.
- O que a equipe já preencheu à mão na planilha continua valendo.
- Alunos com parcelas no Omni que não estão em nenhuma turma (ex.: Carlos Abraão, Renata Maués) continuam só na lista de conferência e não viram linha nova na planilha, porque não têm turma.

## Detalhes técnicos
- `src/lib/renewal/mergeEngine.ts` (`buildImported`): guardar as parcelas do módulo antes do corte por aluno (já agrupadas em `preCut`). Quando `ps` estiver vazio, usar essas parcelas para `venc_ultima_parcela`, `forma_pagamento_atual` e `termino_pagamento`, com a mesma regra de cartão. A mesma parcela nos dois sistemas conta uma vez, pelo vencimento.
- O aviso `sem_financeiro` de quitado continua se resolvendo sozinho; o de vencida continua aberto.
- Teste novo em `src/test/renewalMultiSource.test.ts`; conferir com a simulação dos dados de Manaus Centro.
- Para valer na tela: subir os dois arquivos do Omni na renovação de Manaus Centro (ou reimportar, se já tiverem sido enviados).
