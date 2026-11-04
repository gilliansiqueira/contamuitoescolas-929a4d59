# Planilha de renovação de Manaus Centro corrigida

## Resposta: professor vazio nos 21 alunos
Os 21 alunos vieram do relatório de turmas do Sponte, onde as 5 turmas deles estão sem professor. No Omni todos têm professor:
- B1 LATE (sáb 14h) e 1A (sáb 8h): Juan Pablo de Abreu Nogueira
- B2 Adults (sáb 14h): Gabriel Canto Leite
- B2 TEENS (seg e qua 18h): Raissa Tavares de Souza
- C3 (qui 15h): Isaac Ginoris Oramas

Os 4 alunos da B1 LATE aparecem no Omni numa turma de 2027/1. O professor é o mesmo.

## O que vou fazer
1. Gravar os dois relatórios do Omni que você mandou ("Alunos por turma" e "Parcelas por aluno") na renovação de Manaus Centro, ao lado do Sponte.
2. Refazer a planilha com as regras novas:
   - professor vazio completado pelo Omni (21 alunos → 0 sem professor);
   - pagamento preenchido com as parcelas do Omni quando não houver no Sponte;
   - cursos quitados baixados sozinhos;
   - os alunos que você já desconsiderou continuam desconsiderados;
   - o que você já preencheu à mão continua valendo.
3. Gerar o Excel da planilha no mesmo formato da tela ("Baixar planilha") e mandar aqui no chat.
4. Conferir no arquivo: os 21 com professor, quantos ainda ficam "Sem informação" no pagamento (devem ser só 3) e os totais de alunos por turma.

## Detalhes técnicos
- `renewal_imports` da folha `9ca2a66c…` recebe os dois arquivos, lidos pelo mesmo leitor da tela; `rebuildSheet` é rodado com a lógica do projeto (`persist.ts`) e o arquivo é gerado com `buildWorkbook` (`exportXlsx.ts`), salvo em Files como `renovacao-manaus-centro-2026-11-04.xlsx`.
- O que for gravado fica registrado no histórico de alterações da empresa.
