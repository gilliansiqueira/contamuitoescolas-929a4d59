# Renovação: modelo de Dourados e Manaus não grava

## O que foi encontrado
- Em **Dourados** e **Manaus Laranjeiras** nenhum modelo foi gravado: o arquivo do modelo nem chegou a ser salvo no sistema. As duas planilhas 2027/1 continuam com as 20 colunas padrão.
- Em **Hauer** o modelo foi gravado e aplicado (23 colunas).
- Ou seja, a falha acontece no navegador, **antes** de salvar: na leitura do arquivo ou no clique em "Usar este arquivo como modelo".
- Causas prováveis (ainda não confirmadas):
  1. O site oficial ainda está com a versão antiga, sem a leitura de modelos pesados (a correção de hoje não foi publicada).
  2. Mesmo com a versão nova, o navegador pode travar ao descompactar um arquivo com formatação até a linha 1 milhão.
  3. Se o envio do arquivo falhar, o sistema hoje não avisa (o erro é ignorado).

## O que vou fazer
1. **Confirmar a causa** com o arquivo de Dourados e com o de Manaus (preciso que você me mande o modelo de Manaus), rodando a leitura como o navegador faz.
2. **Leitura em segundo plano:** o modelo passa a ser lido sem travar a tela, com a mensagem "Lendo modelo…" e um limite de tempo. Se não der, aparece o motivo claro.
3. **Avisos de erro:** se o envio do arquivo ou a gravação falharem, aparece a mensagem; hoje fica em silêncio.
4. **Ao aprovar o modelo**, se a escola já tiver planilha criada, o sistema oferece aplicar o modelo nela na hora (sem perder correções da equipe).
5. **Dourados e Manaus:** gravo os modelos e aplico nas planilhas 2027/1; confiro ordem das colunas, cores e listas de Status Renovação e Situação do Contrato.
6. Publicar e pedir Ctrl + Shift + R.

## Validação
- Teste automático com modelo de milhares de linhas vazias formatadas.
- Abrir a Renovação de Dourados e Manaus e baixar o Excel para comparar com os modelos.

## Detalhes técnicos
- `templateParser`/`slimXlsx` rodam num Web Worker; timeout e mensagem de erro.
- `useAsTemplate`: checar `error` do `storage.upload`; após inserir, chamar `applyTemplateToSheet` nas sheets sem modelo.
- Nada muda nos cálculos financeiros.
