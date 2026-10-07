# Renovação escolar: subir "Turmas em Formação" para marcar renovados

## Ideia
Na etapa Relatórios, aparece um terceiro relatório opcional: **Turmas em Formação (próximo período, ex.: 2027/1)**. Quem já estiver matriculado numa turma nova é marcado como renovado.

## Como funciona
1. A equipe exporta no Sponte as turmas em formação de 2027/1, com os alunos, e envia o arquivo como os outros (Excel/CSV, com prévia antes de gravar).
2. O cruzamento usa a matrícula. Pelo nome, só quando for idêntico e único. Nomes parecidos vão para a Conferência.
3. Para cada aluno encontrado na planilha:
   - **Status da renovação** fica "Rematriculado".
   - **Turma de destino** recebe o nome da turma nova.
   - **Data de rematrícula** é preenchida, se o relatório trouxer essa data.
4. O que a equipe já marcou à mão nunca é trocado. Se o relatório disser outra coisa, a diferença aparece para revisão.
5. Alunos da turma nova que não estão na base atual (alunos novos) **não entram na planilha**. Eles aparecem só como uma contagem informativa na Conferência.
6. Dá para enviar o relatório de novo depois, conforme mais alunos renovarem. Cada envio só acrescenta renovações.

## O que preciso de você
- Um arquivo de exemplo de Vitória das turmas de 2027/1, exportado do Sponte, para eu ajustar a leitura às colunas reais. Me diga também em qual tela do Sponte ele é gerado.

## Detalhes técnicos
- Nova fonte `turmas_formacao` em `renewal_sources` (inserção de dado, sem mudar a estrutura das tabelas).
- `sponteParser` passa a reconhecer o layout. Em `mergeEngine`, um novo passo `applyRenewedFromNextPeriod(rows, formacao)` preenche `status_renovacao`, `turma_destino` e `data_rematricula` em `imported`. A precedência dos overrides e os conflitos seguem como hoje.
- Cada importação fica registrada em `renewal_imports`, para rastrear de onde veio cada dado. Novos itens de conferência: `formacao_nome_semelhante` e `formacao_aluno_novo`.
- Testes em `src/test/renewal.test.ts`: aluno renovado, marcação manual preservada, nome ambíguo e aluno novo ignorado.
- Nenhum impacto nos cálculos financeiros.
