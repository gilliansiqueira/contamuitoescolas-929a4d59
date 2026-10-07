# Renovação Vitória 2027/1 — por que ainda há 54 itens na Conferência

## O que os dados mostram
- **Sem correspondência nas turmas (11–12):** quase todos têm matrícula 7550–7574 (feitas em set/out 2026). São **alunos novos** já matriculados para 2027/1, com parcelas geradas, mas que não estão nas turmas atuais. O sistema ainda não liga esse aviso com o arquivo de Turmas em Formação. Os poucos com matrícula antiga (6850, 6436, 7225, 7229) podem ter saído ou trancado e ainda ter parcelas em aberto — esses sim precisam ser olhados.
- **Sem parcelas do módulo (40):** alunos que estão nas turmas mas sem parcela a partir da data de corte. Causas comuns: pagaram à vista, são bolsistas/permuta, ou a data "Parcelas a partir de" está tarde demais. Isso não quer dizer que estão quitados.
- **Saiu da base (2):** dois alunos que estavam antes e não vieram no último relatório de turmas.
- **Formação: alunos novos (1 aviso, 8 alunos)** e **nome parecido (1):** só informativos.

## Mudança proposta
1. Quando um aluno "sem correspondência" aparecer nas Turmas em Formação, classificar como **"Aluno novo 2027/1"** (só informativo, com marcação em lote), e não como erro. Assim, a lista vermelha mostra só quem tem matrícula antiga.
2. No aviso "Sem parcelas do módulo", mostrar a data de corte usada e uma dica: "confira se pagou à vista, é bolsista ou se a data de corte está tarde".
3. Nada muda nos números da planilha, nas edições da equipe ou nos dados financeiros.

## Detalhes técnicos
- `persist.ts`: após `applyRenewedFromNextPeriod`, cruzar issues `sem_correspondencia` com matrículas do último `turmas_formacao`; convertê-las em `formacao_aluno_novo_parcelas` (novo label em `ISSUE_LABEL`).
- Mensagem de `sem_financeiro` passa a incluir a data de corte.
- Teste em `src/test/renewal.test.ts`.
