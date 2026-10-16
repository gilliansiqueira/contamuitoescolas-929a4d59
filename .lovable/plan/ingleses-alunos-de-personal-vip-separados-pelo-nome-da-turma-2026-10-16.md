# Ingleses: alunos de Personal/VIP separados pelo nome da turma

## O que encontrei
Na planilha de Floripa Ingleses, 7 alunos estão em turmas com nome "Personal …" ou "VIP …", mas no Sponte a modalidade deles está cadastrada como **InCompany** (5), **Hybrid** (1) ou **Regular** (1). Hoje a separação em abas olha só a modalidade, por isso esses alunos ficaram na aba principal. Exemplo: "Personal - Ketlin Lorrayne Fernandes Paes" (InCompany).

## O que muda
- A aba passa a considerar também o **nome da turma**: se a turma começa com Personal, VIP, Semi ou ON (as modalidades separadas da escola), o aluno vai para a aba correspondente, mesmo que o Sponte esteja com outra modalidade.
- Quando a modalidade e o nome da turma batem, nada muda.
- Vale para todas as escolas que separam modalidades.
- Depois de publicar, basta clicar em **Recalcular planilha** em Ingleses. As correções da equipe continuam valendo.
- Nenhum cálculo financeiro é alterado.

## Detalhes técnicos
- `mergeEngine.ts` (`buildImported`): a aba vem da modalidade; se ela não estiver em `separate_modalities`, usar o primeiro termo da turma (`norm(turma)` começando com a modalidade seguida de espaço, hífen ou fim). "PERS" é tratado como Personal.
- Teste em `src/test/renewal.test.ts`: turma "Personal - X" com modalidade InCompany vai para a aba Personal; turma Regular continua na principal.
