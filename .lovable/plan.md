# Cores na planilha de renovação da Champagnat

## Motivo
- A Champagnat nunca teve um Modelo salvo na aba "1. Modelo".
- Por isso, a planilha dela foi criada com as colunas básicas. As colunas Status Renovação e Situação do Contrato não têm cores nem opções de lista.
- As cores só entram quando alguém salva o Modelo da escola, então qualquer escola nova (ou que veio do Omni) pode ter o mesmo problema.

## O que vou fazer
1. **Cores padrão sempre:** quando uma coluna de Status ou Situação não tiver cores configuradas, o sistema usa as cores padrão (Renovado azul, Pendente laranja, Aguardando Retorno cinza, Não Rematriculará vermelho, e as cores de Situação do quadro de vocês). Vale para a tela e para o Excel exportado.
2. **Champagnat:** salvar para ela o Modelo padrão (as mesmas colunas, com as opções e as cores) e aplicar na planilha atual, sem apagar nada do que a equipe preencheu.
3. **Outras escolas sem Modelo:** listar quais estão nessa situação e aplicar o padrão nelas também.
4. Gerar o Excel da Champagnat e conferir que as listas e as cores aparecem.

## Detalhes técnicos
- `exportXlsx.ts` e `RenewalGrid.tsx` passam a usar `optionColors`/`options` do catálogo `FIELDS` quando a coluna da planilha não tiver esses dados.
- Gravar em `renewal_templates` e `renewal_sheets.columns` usando `applyTemplateToSheet`; os `overrides` não mudam.
- Adicionar um teste: coluna sem cores → o Excel sai com as cores padrão.
