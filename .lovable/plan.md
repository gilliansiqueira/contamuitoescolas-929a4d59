# Renovação Champagnat (Omni) + correção para as próximas

## O que encontrei
- O novo arquivo do Omni ("alunos-por-turma-2026-10-28") tem **3 abas**: Resumo, Alunos e Turmas. A primeira aba agora é o **Resumo**.
- O sistema só lê a **primeira aba** do arquivo. Por isso ele encontra o Resumo, não acha alunos e recusa o arquivo. O arquivo de 16/10 só tinha a aba de alunos e funcionava.
- A Champagnat já tem no sistema um relatório de turmas antigo do Sponte (141 alunos) e o Contas a Receber (1.857 linhas).

## O que vou fazer
1. **Correção para as próximas:** o sistema vai procurar a aba certa em todo o arquivo (Alunos do Omni, ou Turmas Existentes / Contas a Receber do Sponte), sem depender da ordem das abas. A aba Turmas do Omni também vai completar a **Sala** de cada turma, que não vem na aba Alunos.
2. **Teste automático** com este arquivo: deve ler 133 alunos e 57 turmas, com telefone, e-mail, professor e sala.
3. **Planilha da Champagnat:** gravar o arquivo do Omni na Champagnat no lugar do relatório antigo do Sponte, recalcular a planilha usando o Contas a Receber que já está lá (vencimento da última parcela) e preservar o que a equipe já editou.
4. Exportar o Excel no modelo da escola e salvar em Arquivos para você mandar ao cliente, com o quadro de renováveis e % por professor e no total. Vou conferir o arquivo antes de entregar.

## Pontos de atenção
- Os alunos que estavam só no relatório antigo do Sponte e não aparecem no Omni vão para a Conferência, para vocês decidirem.
- Se o Contas a Receber estiver desatualizado, a coluna "Venc. última parcela" pode sair incompleta. Nesse caso, mande o Contas a Receber atual.

## Detalhes técnicos
- `src/lib/renewal/sponteParser.ts`: na leitura do workbook, percorrer `wb.SheetNames` e usar a primeira aba onde `detectOmni` ou `detectSource` encontra cabeçalho; se houver aba "Turmas" do Omni (Turma/Instrutor/Sala/Alunos), mesclar `Sala` e `IntegrantesAtuais` por nome da turma.
- Teste em `src/test/renewal.test.ts` com o arquivo enviado.
- Gravação na Champagnat (`992d3914-…`) pelo mesmo caminho de `persist.ts` (substitui `turmas_existentes` da planilha 2617ed5e), depois recálculo e exportação via `exportXlsx.ts` para `/mnt/documents/Renovacao_Champagnat.xlsx`.
