# Renovação: modelo de Dourados e Hauer respeitado

## O que foi encontrado
- **Dourados:** nenhum modelo foi gravado. O arquivo "Modelo_ren_2027.xlsx" tem formatação aplicada até a última linha do Excel (1.048.565 linhas). Por dentro ele pesa mais de 500 MB, e o navegador não consegue ler. Por isso a planilha ficou nas colunas padrão do sistema (é o rascunho do print).
- **Hauer:** o modelo foi gravado e aplicado (12 colunas na ordem certa, listas de Status e Teacher). Mas o Excel baixado só copia a cor do primeiro título: não copia cores por coluna nem a formatação das linhas. O quadro de status também não segue o do modelo.

## O que vou fazer
1. **Ler modelos "pesados":** o sistema lê só o começo da aba (títulos, quadros e primeiras linhas) e as listas de opções. Ele ignora as linhas vazias formatadas até o fim. O modelo de Dourados passa a ser aceito em segundos.
2. **Aviso claro quando falhar:** se um modelo não puder ser lido, aparece uma mensagem dizendo o motivo. Hoje ele não grava nada e não avisa.
3. **Guardar a aparência do modelo:**
   - cor e fonte do título de **cada** coluna;
   - cor de fundo e fonte das linhas de dados;
   - largura de cada coluna;
   - opções de **Status Renovação** e **Situação do Contrato**, na ordem e com a escrita do modelo (ex.: Autorizado, Contrato Pronto, Não Rematriculará, Pedagógico, Renovado).
4. **Excel baixado igual ao modelo:** mesma ordem de colunas, mesmas cores, mesmas listas e quadros de resumo (Professores, Status Renovação, Situação do Contrato) com os itens do modelo. "Renovado" e "Rematriculado" continuam contando como renovados.
5. **Dourados e Hauer:** subo o modelo de Dourados, aprovo e aplico na planilha 2027/1. Em Hauer, releio o modelo já enviado para pegar as cores e reaplico. As correções da equipe continuam valendo.

## Validação
- Teste automático: modelo com milhares de linhas vazias formatadas é lido; ordem das colunas, cores e listas são preservadas.
- Baixar o Excel de Dourados e de Hauer e comparar com os modelos (ordem, cores, status, situação).

## Detalhes técnicos
- `templateParser.ts`: descompactar a aba em streaming (fflate) lendo só as primeiras linhas e o bloco `dataValidations` do fim, sem montar o XML inteiro; fallback ExcelJS para arquivos leves.
- `TemplateStructure.columns[]` ganha `headerStyle` e `cellStyle` (fill/font); `exportXlsx.ts` aplica por coluna e usa `options` do modelo nos quadros.
- Sem impacto financeiro; módulo continua isolado.
