# Alunos com financeiro e sem turma: incluir na planilha

## O que aconteceu em Chapecó
Na Conferência havia 14 alunos com parcelas do módulo em aberto que não estavam em nenhuma turma (ex.: Miguel Albanio Andrade, Daiana de Cesaro Bottega, Erick Vinicius Gaboardi). Quando a equipe dá o check, o aviso só sai da lista. O aluno nunca entra na planilha, porque a planilha só é montada a partir do relatório de turmas.

## O que muda
1. Nova aba "Financeiro sem turma" na planilha baixada, com: Aluno, Matrícula, Nº de parcelas em aberto, Valor/vencimentos (quando o relatório trouxer) e a observação "Tem financeiro, mas não está em nenhuma turma. Confirmar com a escola se está estudando".
2. Nessa aba entram todos os alunos com esse aviso, **marcados ou não**. O check vale só para a Conferência e não tira o aluno da planilha.
3. Alunos que depois aparecerem numa turma (por exemplo, numa nova importação) saem dessa aba sozinhos.
4. Vale para todas as escolas. Chapecó já fica certa no próximo download, porque os 14 avisos estão salvos.

## Detalhes técnicos
- Fonte: `renewal_issues` com `kind='sem_correspondencia'` (resolvidos ou não) da planilha, usando o `detail` (sacado, mat, count, pending).
- A aba é gerada na exportação do Excel e não grava linhas em `renewal_rows`, para não misturar com os alunos de turma nem afetar contagens e quadros.
- Teste: um aviso resolvido aparece na aba, e um aluno que existe nas linhas não aparece.
