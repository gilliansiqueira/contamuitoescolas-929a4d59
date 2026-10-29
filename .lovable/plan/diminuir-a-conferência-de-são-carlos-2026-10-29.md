# Diminuir a Conferência de São Carlos

## Situação de agora
Agora são 205 itens na Conferência (a planilha foi recalculada depois daquela contagem):
- **139 alunos "sem parcelas do curso":** os dois arquivos de contas a receber só têm vencimentos a partir de outubro/2026. Para esses alunos só sobra material didático, o que normalmente quer dizer que o curso foi pago antes. O aviso está certo, mas o arquivo não mostra o pagamento.
- **60 alunos "não vieram na nova importação":** estão nas turmas do Omni, mas não nas turmas do Sponte. São alunos de verdade, só que ficam em outro sistema.
- **5 com parcelas mas sem turma** e **1 matrícula em duas turmas:** estes precisam mesmo de conferência.

## O que vou fazer
1. **Alunos do Omni deixam de ser pendência:** quem aparece nas turmas do outro sistema enviadas para a mesma planilha passa a ser aluno normal, sem aviso. Isso vale para São Carlos, para a Linhares e para as próximas. Saem 60 avisos de São Carlos.
2. **Sem parcela do curso, mas com material em aberto:** a pendência vira um aviso mais claro, "Curso provavelmente quitado antes de out/2026 — só material em aberto". Ela continua aparecendo, com o motivo explicado.
3. **Para resolver os 139 de verdade:** se a escola enviar o contas a receber (recebidas) de junho a setembro/2026, eu cruzo como fiz na Uberlândia e tiro da Conferência quem pagou à vista ou parcelado.
4. Deixar um teste para a regra do item 1 e conferir as novas contagens em São Carlos.

## Detalhes técnicos
- Em `rebuildSheet`/`persist.ts`, não gerar `fora_da_base` para linhas cujo aluno (matrícula ou nome idêntico) está em uma importação de turmas de outro sistema do mesmo sheet (`isOmniTurmas`).
- Em `mergeEngine`, quando um aluno tem só parcelas de material, gerar `sem_financeiro` com a mensagem explicativa.
- Teste em `src/test/renewalMultiSource.test.ts`.
