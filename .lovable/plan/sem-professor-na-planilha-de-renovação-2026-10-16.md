# "Sem professor" na planilha de renovação

## O que muda
- No Excel baixado, a coluna Professor vazia passa a mostrar **"Sem professor"**.
- O quadro de resumo do Excel ganha a linha **"Sem professor"** (turmas, alunos, renovados e %), no fim da lista, para os números somarem com o total de alunos.
- Na tela, o quadro de resumo usa o mesmo nome "Sem professor" (hoje mostra "(sem professor)") e também deixa essa linha por último.
- Correções feitas pela equipe na coluna Professor continuam valendo; se alguém preencher um professor depois, o aluno sai de "Sem professor".
- Nenhum dado financeiro nem a planilha gravada é alterada — só a exibição e a exportação.

## Detalhes técnicos
- `exportXlsx.ts`: constante `SEM_PROFESSOR = 'Sem professor'`; ao escrever as linhas, professor vazio vira esse texto; lista de professores do quadro inclui "Sem professor" ao final quando houver vazios, usando as mesmas fórmulas COUNTIFS (a célula agora tem o texto, então as fórmulas contam normalmente).
- `buildSummary`: usar o mesmo rótulo e ordenar com ele por último.
- Teste em `src/test/renewal.test.ts`: aluno sem professor aparece como "Sem professor" no resumo e é contado.
