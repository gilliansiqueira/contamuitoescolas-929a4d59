# Renovação escolar: renovados no resumo e modelo de Boa Vista

## O que foi encontrado
1. **Renovados zerados no Excel e na tela.** A fórmula exportada e o resumo da tela contam só "Rematriculado" (palavra do modelo de Vitória). Salto, Santa Mônica e Boa Vista usam "Renovado"/"RENOVADOS 100%", então o resumo mostra 0.
2. **Boa Vista fora do modelo.** A planilha 2027/1 de Boa Vista foi criada antes do modelo ser aprovado e ficou com as colunas padrão do sistema; o modelo aprovado depois não foi aplicado a ela. Além disso, o modelo de Boa Vista tem o quadro de resumo à direita (Qntd alunos / Porcentagem / Professores), que a leitura atual não reconhece.
3. **Categorias das parcelas.** Concordo: se uma categoria da escola não estiver na lista, a parcela não é puxada e o aluno fica "Sem informação".

## O que vai mudar
- **Contagem de renovados pela lista da escola:** o resumo (tela e Excel) passa a contar como renovado o status da própria lista de opções da coluna "Status Renovação" que significa renovação (Renovado, Rematriculado, Renovados 100% etc.). Na configuração da escola aparece qual opção conta como renovado, para trocar se precisar.
- **Aplicar modelo em planilha já existente:** botão "Aplicar modelo aprovado" na planilha. Troca colunas, títulos, ordem e listas pelas do modelo, sem perder dados importados nem as correções da equipe (colunas ligadas pela regra, não pelo título). Aplicar agora em Boa Vista 2027/1.
- **Leitura do modelo de Boa Vista:** reconhecer o quadro de resumo ao lado da tabela e os títulos "Teacher" e "Status Renovação" repetido no resumo, sem criar colunas falsas.
- **Aviso de categorias:** na etapa de relatórios, listar as categorias encontradas no arquivo do Sponte que não estão nas regras da escola, com botão para incluí-las — evita o "Sem informação" por esquecimento.

## Fora do escopo
Nenhum impacto nos cálculos financeiros; módulo continua só da equipe.

## Detalhes técnicos
- `exportXlsx.ts`: `computeSummary` e fórmula `COUNTIFS` usam `renewedValues(col)` (opções que casam com /renov|rematric/ normalizado, ou o valor configurado em `renewal_settings`). Nova coluna opcional `renewed_status` em `renewal_settings` (migração aditiva).
- `persist.ts`/`RenovacaoModule.tsx`: `applyTemplateToSheet` mapeia colunas por `field`; colunas manuais sem regra casam por título normalizado; overrides migram para o novo `id`; grava `template_id` e nova versão.
- `templateParser.ts`: ignorar células à direita após coluna vazia na linha de títulos; detectar resumo lateral (palavras "professores", "qntd alunos", "porcentagem").
- `mergeEngine`: devolver categorias não reconhecidas como informativo.
- Testes em `src/test/renewal.test.ts` para "Renovado", aplicação de modelo preservando overrides e parser do layout de Boa Vista.
