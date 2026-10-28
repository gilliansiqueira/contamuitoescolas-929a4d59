# Cores na planilha de renovação da Champagnat (no formato do modelo enviado)

## Motivo
- A Champagnat nunca teve um Modelo salvo. A planilha dela saiu só com as colunas básicas, sem as listas e sem as cores de Status Renovação e Situação do Contrato.
- Isso pode acontecer com qualquer escola que ainda não salvou o Modelo.

## Modelo da Champagnat (tirado do arquivo enviado)
- **Colunas, nesta ordem:** Turma, Professor, Integrantes atuais, Aluno, Matrícula, Curso, Estágio, Modalidade, Nº contrato, Término do contrato, Forma de pgto atual, Venc. última parcela. Depois vêm as colunas da equipe, com título laranja: Status Renovação, Situação do Contrato, Turma de destino, Forma de pgto negociada, Data Remat., Responsável e Observações.
- **Status Renovação:** Rematriculado (azul), Pendente e Não Rematriculará (vermelho). Rematriculado conta como renovado.
- **Situação do Contrato:** Follow Lançado, Planejamento Enviado, Lançamento Autorizado, Cont. Ass. c/ Pendência Finan., Contrato Lançado no Sistema (verde) e Rematriculado sem pendências (verde-claro). Vou copiar do arquivo as cores das outras opções.
- **Títulos:** azul-marinho nas colunas importadas e laranja nas colunas da equipe. Abas Renovação e Personal, com o quadro por professor em cima.

## O que vou fazer
1. **Cores padrão sempre:** quando uma coluna de Status ou Situação não tiver cores configuradas, o sistema usa as cores padrão, na tela e no Excel. Nenhuma planilha volta a sair sem cor.
2. **Champagnat:** salvar o Modelo acima como o Modelo da escola e aplicar na planilha atual. Status, situação e observações que a equipe já preencheu ficam como estão.
3. **Excel:** a lista de opções e a cor também entram em linhas extras abaixo dos alunos, como no modelo, para alunos novos já ficarem coloridos.
4. **Outras escolas sem Modelo:** listar quais estão assim e aplicar o padrão nelas também.
5. Gerar o Excel da Champagnat e conferir as cores, as listas e o quadro.

## Detalhes técnicos
- `exportXlsx.ts` e `RenewalGrid.tsx` usam `options`/`optionColors` do catálogo `FIELDS` como reserva quando a coluna não tiver esses dados.
- Inserir o Modelo da Champagnat em `renewal_templates` e aplicar em `renewal_sheets.columns`, preservando os `overrides`.
- Adicionar um teste: coluna sem cores → o Excel sai com as cores padrão.
