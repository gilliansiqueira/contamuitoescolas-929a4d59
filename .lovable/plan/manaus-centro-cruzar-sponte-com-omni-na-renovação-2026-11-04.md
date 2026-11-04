# Manaus Centro – cruzar Sponte com Omni na Renovação

## O que o cruzamento mostra (conferido agora)
A renovação de Manaus Centro hoje usa só o Sponte e aponta 34 inconsistências: 24 "sem financeiro", 7 "sem correspondência" e 3 "várias turmas". Cruzando com os dois relatórios do Omni (Alunos por turma: 232 alunos em 48 turmas; Parcelas por aluno de 01/05 a 04/11: 2.070 parcelas):

- **Sem financeiro (24):** 21 alunos têm parcelas do curso no Omni. 19 estão todas pagas (curso quitado ou pago à vista) e 2 estão vencidas (Adiel e Ageu Medrado, 1 parcela cada). Saem como inconsistência e passam a mostrar o financeiro do Omni.
- Continuam pendentes 3 alunos sem nenhuma parcela de curso nos dois sistemas: Rayssa Pereira de Souza, Lucas Emanuel Brito Cordeiro Reis e Matheus Ribeiro de Lima (podem ser bolsistas ou ter pago antes de maio).
- **Sem correspondência:** Renata da Silva Maués tem 12 parcelas do curso no Omni (7 a vencer), mas não está em nenhuma turma, nem no Sponte nem no Omni. Fica pendente para a equipe confirmar.
- **Alunos só de um lado:** 11 alunos estão em turma no Omni e não estão no Sponte (ex.: Adrian Lima dos Santos, Laura Beckman Sotero). 4 estão no Sponte e não estão no Omni (ex.: Allen Cesar Salazar de Alcântara, Vera Lúcia dos Anjos Santos). Vão aparecer numa lista própria, "Divergência entre sistemas", sem entrar nem sair da planilha sozinhos.

## O que vou fazer
1. Gravar os dois relatórios do Omni na renovação de Manaus Centro como fontes extras, ao lado do Sponte. O Sponte continua sendo a base, e o Omni só completa.
2. Parcelas: juntar as do Sponte e as do Omni. A mesma parcela (aluno + vencimento + valor) conta uma vez. Recalcular a situação e a forma de cobrança dos 21 alunos.
3. Turmas: completar professor, telefone e e-mail vazios com o Omni, sem adicionar alunos. Criar a lista "Divergência entre sistemas" com os 11 + 4 nomes.
4. Refazer as inconsistências e conferir os números finais: espero cerca de 3 "sem financeiro" e 1 "sem correspondência". As correções manuais já feitas na planilha ficam preservadas.
5. Registrar no histórico de alterações da empresa.

## Detalhes técnicos
- Usar `mergeContasImports` (Omni Parcelas via `fromOmniParcelas`) e `complementTurmas`/`inOtherTurmas` de `src/lib/renewal/multiSource.ts`. Novo tipo de pendência `divergencia_sistemas` no `mergeEngine.ts`, com teste em `src/test/`.
- Gravação em `renewal_imports` (source_key do Omni) e refazer `renewal_issues`/`renewal_rows` da folha `9ca2a66c…`. `overrides` é mantido.
