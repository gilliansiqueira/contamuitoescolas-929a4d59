# Aba "Alunos de 2027" na Renovação escolar

## Objetivo
Os alunos com matrícula nova, identificados como do próximo período (2027/1) e que não estão nas turmas abertas, deixam de aparecer como aviso na Conferência e passam para uma aba própria: **Alunos de 2027**.

## O que muda para a equipe
- Nova aba "Alunos de 2027" dentro da Renovação escolar, ao lado de Planilha e Conferência.
- A aba lista cada aluno novo em uma linha, com: nome, matrícula, turma em formação (quando houver) e quantidade de parcelas já lançadas (quando houver).
- A lista junta as duas origens de hoje: alunos das turmas em formação que não estão na base atual e alunos fora das turmas abertas que já têm parcelas.
- Esses alunos não contam mais como pendência na Conferência e não entram na planilha de renovação (continua como hoje).
- Contador na aba mostra o total de alunos de 2027 identificados.
- Nada muda nos dados da planilha, nas correções da equipe nem nos cálculos financeiros.

## Detalhes técnicos
- `mergeEngine.ts`: ao gerar os itens `formacao_aluno_novo` e `formacao_aluno_novo_parcelas`, gravar no `detail` os dados estruturados de cada aluno (nome, matrícula, turma, quantidade de parcelas), em vez de só texto.
- `RenovacaoModule.tsx`: nova aba "Alunos de 2027" que lê esses itens e monta a lista em formato de tabela; o bloco "Informativo" da Conferência deixa de exibir esses dois tipos.
- Manter os itens gravados em `renewal_issues` (sem migração de banco); apenas a apresentação muda. Itens antigos sem dados estruturados continuam aparecendo no Informativo até o próximo recálculo.
- Testes em `src/test/renewal.test.ts` para a geração dos dados estruturados.

## Validação
- Rodar os testes da renovação.
- Recalcular uma planilha piloto e conferir que os alunos de 2027 aparecem na aba nova e somem da Conferência.
- Publicar em relatorioscontamuito.online ao final.
